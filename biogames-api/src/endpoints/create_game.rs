use axum::{http::StatusCode, response::IntoResponse};
use diesel::{insert_into, sql_query, sql_types::Integer, ExpressionMethods, RunQueryDsl, QueryDsl};
use diesel::BoolExpressionMethods;
use tracing::{event, Level};
use axum::extract::Query;
use once_cell::sync::Lazy;
use serde::Deserialize;
use axum::Json;
use crate::schema::registered_users::dsl as rudsl;
use crate::schema::challenges::dsl as ccdsl;
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
    
    let mut challenges_per_game = if is_test { 50 } else { 20 };

    {
        tracing::debug!("Creating game for user: {}, game mode: {}", real_username, params.mode.as_deref().unwrap_or("uhoh"));
    }

    // create game
    let game = insert_into(games)
        .values((username.eq(real_username.clone()), max_score.eq(challenges_per_game * 5), game_type.eq(&mode)))
        .get_result::<Game>(connection).unwrap();

    let mut final_challenges: Vec<Challenge> = Vec::new();

    if let Some(initial_core_id) = body.initial_her2_core_id {
        if challenges_per_game == 0 { // Should not happen with current numbers, but good check
            event!(Level::ERROR, "challenges_per_game is 0, cannot insert initial challenge for game {}", game.id);
            // Consider deleting the game record here if no challenges can be added
            return (StatusCode::INTERNAL_SERVER_ERROR, "Cannot create a game with zero challenges").into_response();
        }

        // Insert the initial challenge directly
        match diesel::insert_into(ccdsl::challenges)
            .values((ccdsl::game_id.eq(game.id), ccdsl::core_id.eq(initial_core_id)))
            .get_result::<Challenge>(connection) 
        {
            Ok(initial_challenge) => {
                final_challenges.push(initial_challenge);
                challenges_per_game -= 1; // Decrement count for remaining challenges
            }
            Err(e) => {
                event!(Level::ERROR, "Failed to insert initial challenge with core_id {}: {:?} for game {}", initial_core_id, e, game.id);
                // Rollback game creation or handle error appropriately
                // For now, delete the created game record
                let _ = diesel::delete(games.filter(id.eq(game.id))).execute(connection);
                return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to set initial challenge").into_response();
            }
        }
    }

    if challenges_per_game > 0 { // If we still need to fetch more challenges
        let query_remaining = if is_test {
            // For test modes, select from TEST_IMAGE_IDS, excluding initial_core_id if it was one of them
            // AND id != $INITIAL_ID (if initial_core_id was provided and is in TEST_IMAGE_IDS, this is implicitly handled by not re-selecting it)
            // More robustly, explicitly exclude it:
            if body.initial_her2_core_id.is_some() {
                 r#"
                INSERT INTO challenges (game_id, core_id)
                SELECT $1, id FROM her2_cores
                WHERE id = ANY($3) AND id != $4 
                ORDER BY random()
                LIMIT $2
                RETURNING *
                "#
            } else { // No initial_core_id, select all from TEST_IMAGE_IDS
                 r#"
                INSERT INTO challenges (game_id, core_id)
                SELECT $1, id FROM her2_cores
                WHERE id = ANY($3)
                ORDER BY random()
                LIMIT $2
                RETURNING *
                "#
            }
        } else {
            // For training mode, select NOT from TEST_IMAGE_IDS, excluding initial_core_id
            if body.initial_her2_core_id.is_some() {
                r#"
                INSERT INTO challenges (game_id, core_id)
                SELECT $1, id FROM her2_cores
                WHERE id != ALL($3) AND id != $4 
                ORDER BY random()
                LIMIT $2
                RETURNING *
                "#
            } else { // No initial_core_id, select all not in TEST_IMAGE_IDS
                r#"
                INSERT INTO challenges (game_id, core_id)
                SELECT $1, id FROM her2_cores
                WHERE id != ALL($3)
                ORDER BY random()
                LIMIT $2
                RETURNING *
                "#
            }
        };

        tracing::debug!("Creating {} remaining challenges for game: {}", challenges_per_game, game.id);
        tracing::debug!("Query for remaining: {}", query_remaining);

        let remaining_challenges_result = if let Some(initial_id) = body.initial_her2_core_id {
             sql_query(query_remaining)
                .bind::<Integer, _>(game.id)
                .bind::<Integer, _>(challenges_per_game) // Use updated count
                .bind::<diesel::sql_types::Array<Integer>, _>(&*TEST_IMAGE_IDS)
                .bind::<Integer, _>(initial_id) // Bind the initial_id to exclude
                .get_results::<Challenge>(connection)
        } else {
             sql_query(query_remaining)
                .bind::<Integer, _>(game.id)
                .bind::<Integer, _>(challenges_per_game)
                .bind::<diesel::sql_types::Array<Integer>, _>(&*TEST_IMAGE_IDS)
                .get_results::<Challenge>(connection)
        };

        match remaining_challenges_result {
            Ok(mut fetched_challenges) => {
                final_challenges.append(&mut fetched_challenges);
            }
            Err(e) => {
                event!(Level::ERROR, "Error fetching remaining challenges for game {}: {:?}", game.id, e);
                 // If initial challenge was inserted, it's still there.
                 // If no challenges at all, game might be invalid.
                if final_challenges.is_empty() {
                    let _ = diesel::delete(games.filter(id.eq(game.id))).execute(connection);
                    return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch any challenges for the game").into_response();
                }
            }
        }
    }
    
    // Replace the old `challenges` variable with `final_challenges`
    let challenges = final_challenges;

    tracing::debug!("Total number of challenges for game {}: {}", game.id, challenges.len());

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
