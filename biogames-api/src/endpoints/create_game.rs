use axum::{http::StatusCode, response::IntoResponse};
use diesel::{insert_into, sql_query, sql_types::Integer, ExpressionMethods, RunQueryDsl, QueryDsl};
use diesel::BoolExpressionMethods;
use tracing::{event, Level};
use axum::extract::Query;
use once_cell::sync::Lazy;
use serde::Deserialize;
use axum::Json;
use crate::schema::registered_users::dsl as rudsl;
use serde_json::json;

// use diesel::result::Error;
// use tracing::{debug, error};

use crate::{
    establish_db_connection,
    models::{Challenge, CreateGameRequest, Game, GameResponse, ValidatedRequest},
    schema::games::dsl::*

};

static TEST_IMAGE_IDS: Lazy<Vec<i32>> = Lazy::new(|| {
    vec![345,
    20125,
    23246,
    6134,
    9192,
    4376,
    1162,
    22787,
    9809,
    19324,
    2907,
    14342,
    14795,
    438,
    12330,
    10186,
    8781,
    12076,
    19052,
    6547,
    5077,
    8050,
    9934,
    23774,
    10636,
    13660,
    20394,
    18529,
    19444,
    4625,
    19430,
    23853,
    210,
    16056,
    5231,
    940,
    8939,
    22438,
    12988,
    15627,
    3138,
    18219,
    18021,
    19185,
    22208,
    22696,
    15629,
    9052,
    23770,
    18238]
});


#[derive(Deserialize)]
pub struct GameParams {
    mode: Option<String>,
}

pub async fn create_game(
    Query(params): Query<GameParams>,
    ValidatedRequest(body): ValidatedRequest<CreateGameRequest>
) -> impl IntoResponse {
    let connection = &mut establish_db_connection();

    use crate::schema::games::dsl as gdsl;

    // Lookup display-username from registered_users by user_id (now body.user_id)
    let real_username: String = match rudsl::registered_users
        .filter(rudsl::user_id.eq(&body.user_id))
        .select(rudsl::username)
        .first::<Option<String>>(connection)
    {
        Ok(db_username_value_option) => {
            if let Some(name_str) = db_username_value_option {
                name_str
            } else {
                // The user_id was found, but their username column in the DB is NULL.
                return (
                    StatusCode::BAD_REQUEST,
                    format!("User ID '{}' was found, but no username is set for it. Please register a username.", body.user_id),
                )
                .into_response();
            }
        },
        Err(diesel::NotFound) => { // No user record found for the given body.user_id
            return (
                StatusCode::BAD_REQUEST,
                format!("No registered user found for User ID '{}'", body.user_id),
            )
            .into_response();
        }
        Err(e) => { // Some other database error occurred
            event!(Level::ERROR, "Database error when fetching username for User ID {}: {:?}", body.user_id, e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to retrieve user data due to a database error.").into_response();
        }
    };

    let pretest_condition = username.eq(&real_username).and(game_type.eq("pretest"));
    let pretest_count: i64 = gdsl::games
        .filter(pretest_condition)
        .count()
        .get_result(connection)
        .unwrap_or(0);

    let training_condition = username.eq(&real_username).and(game_type.eq("training"));
    let training_count: i64 = gdsl::games
        .filter(training_condition)
        .count()
        .get_result(connection)
        .unwrap_or(0);

    let posttest_condition = username.eq(&real_username).and(game_type.eq("posttest"));
    let posttest_count: i64 = gdsl::games
        .filter(posttest_condition)
        .count()
        .get_result(connection)
        .unwrap_or(0);

    let requested_mode = params.mode.as_deref().unwrap_or("training");

    let allowed = match requested_mode {
        "pretest" => pretest_count == 0,
        "training" => pretest_count > 0 && training_count < 400,
        "posttest" => pretest_count > 0 && training_count >= 400 && posttest_count == 0,
        _ => true,
    };

    if !allowed {
        tracing::debug!(
            "Game creation denied - User ID: {}, Real Username: {}, Mode: {}, Counts - Pretest: {}, Training: {}, Posttest: {}",
            body.user_id,
            real_username,
            requested_mode,
            pretest_count,
            training_count,
            posttest_count
        );

        if (requested_mode == "pretest" && pretest_count > 0) || (requested_mode == "posttest" && posttest_count > 0) {
            let existing_game_id_option: Option<i32> = gdsl::games
                .filter(gdsl::username.eq(&real_username)
                .and(gdsl::game_type.eq(requested_mode)))
                .order(gdsl::id.desc())
                .select(gdsl::id)
                .first::<i32>(connection)
                .ok();
            
            if let Some(existing_id) = existing_game_id_option {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({
                        "error": format!("An active {} game (ID: {}) already exists for this user.", requested_mode, existing_id),
                        "message": format!("Game limit reached or prerequisites not met for {} mode", requested_mode),
                        "existing_game_id": existing_id
                    }))
                ).into_response();
            }
        }

        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": format!("Game limit reached or prerequisites not met for {} mode", requested_mode),
                "message": format!("Game limit reached or prerequisites not met for {} mode", requested_mode)
            }))
        ).into_response();
    }

    let is_test = requested_mode == "posttest" || requested_mode == "pretest";
    let mode = requested_mode.to_string();
    
    let challenges_per_game = if is_test { 50 } else { 20 };

    {
        tracing::debug!("Creating game for user: {}, game mode: {}", real_username, params.mode.as_deref().unwrap_or("uhoh"));
    }

    // create game
    let game = insert_into(games)
        .values((username.eq(real_username.clone()), max_score.eq(challenges_per_game * 5), game_type.eq(&mode)))
        .get_result::<Game>(connection).unwrap();

    // let game = match game {
    //     Ok(game) => {
    //         tracing::debug!("Game created: {:?}", game);
    //         game
    //     }
    //     Err(e) => {
    //         event!(Level::ERROR, "error creating game: {:?}", e);
    //         return (StatusCode::INTERNAL_SERVER_ERROR, "Error creating game").into_response();
    //     }
    // };

    // select 20 random cores and create challenges with them for this game
    let query = if is_test {
        r#"
        insert into challenges (game_id, core_id)
        select $1, id from her2_cores
        where id = ANY($3)
        order by random()
        limit $2
        returning *
        "#
    } else {
        r#"
        insert into challenges (game_id, core_id)
        select $1, id from her2_cores
        where id != ALL($3)
        order by random()
        limit $2
        returning *
        "#
    };

    tracing::debug!("Creating challenges for game: {}", game.id);
    tracing::debug!("Query: {}", query);

    let challenges: Vec<Challenge> = sql_query(query)
        .bind::<Integer, _>(game.id)
        .bind::<Integer, _>(challenges_per_game)
        .bind::<diesel::sql_types::Array<Integer>, _>(&*TEST_IMAGE_IDS)
        .get_results(connection).expect("Error getting challenges");

    tracing::debug!("Number of challenges inserted/returned for game {}: {}", game.id, challenges.len());

    if challenges.is_empty() {
        event!(Level::ERROR, "no HER2 cores found for game {}", game.id);

        diesel::delete(
            diesel::QueryDsl::filter(gdsl::games, gdsl::id.eq(game.id))
        )
            .execute(connection)
            .unwrap();

        return (StatusCode::INTERNAL_SERVER_ERROR, "No HER2 cores found").into_response();
    }

    if challenges.len() < 20 {
        event!(Level::WARN, "less than 20 HER2 cores available ({} found)", challenges.len());
    }

    Json(GameResponse {
        id: game.id,
        user: game.username,
        results: None,
        total_points: None
    }).into_response()
}
