use axum::{http::StatusCode, response::IntoResponse};
use diesel::{insert_into, query_dsl::methods::FilterDsl, sql_query, sql_types::Integer, ExpressionMethods, RunQueryDsl};
use tracing::{event, Level};
use axum::extract::Query;
use once_cell::sync::Lazy;
use serde::Deserialize;
use axum::Json;

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
    let is_test = params.mode.as_deref() == Some("posttest") || params.mode.as_deref() == Some("pretest");
    let mode = params.mode.as_deref().unwrap_or("training").to_string();
    
    let challenges_per_game = if is_test { 50 } else { 20 };

    {
        tracing::debug!("Creating game for user: {}, game mode: {}", body.username, params.mode.as_deref().unwrap_or("uhoh"));
    }

    // create game
    let game = insert_into(games)
        .values((username.eq(body.username.clone()), max_score.eq(challenges_per_game * 5), game_type.eq(&mode)))
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

    if challenges.is_empty() {
        event!(Level::ERROR, "no HER2 cores found");

        diesel::delete(games.filter(id.eq(game.id)))
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
