use axum::{extract::Path, http::StatusCode, response::IntoResponse, Json};
use diesel::prelude::*;

use crate::{
    establish_db_connection,
    models::GameCountResponse,
    schema::games
};

pub async fn check_game_type(Path(user_id): Path<String>) -> impl IntoResponse {
    let connection = &mut establish_db_connection();

    tracing::info!("Checking game type for user_id: {}", user_id);
    let game_type = "pretest";
    let game_count_pretest = games::table
        .filter(games::user_id.eq(user_id.clone()))
        .filter(games::game_type.eq(game_type))
        .count()
        .get_result::<i64>(connection);

    let game_type = "posttest";
    let game_count_posttest = games::table
        .filter(games::user_id.eq(user_id.clone()))
        .filter(games::game_type.eq(game_type))
        .count()
        .get_result::<i64>(connection);

    let game_type = "training";
    let game_count_training = games::table
        .filter(games::user_id.eq(user_id.clone()))
        .filter(games::game_type.eq(game_type))
        .count()
        .get_result::<i64>(connection); // get_result returns Result<i64, diesel::result::Error>
    
    let result = game_count_pretest.and_then(|pretest| {
        game_count_posttest.and_then(|posttest| {
            game_count_training.and_then(|training| {
                Ok(GameCountResponse {
                    pretest: pretest,
                    posttest: posttest,
                    training: training
                })
            })
        })
    });

    match result {
        Ok(game_counts) => {
            tracing::info!(
                "Game count for {}: pretest: {}, posttest: {}, training: {}",
                user_id,
                game_counts.pretest,
                game_counts.posttest,
                game_counts.training
            );
            Json(game_counts).into_response()
        }
        Err(e) => {
            tracing::error!("Error retrieving game counts: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal Server Error",
            )
                .into_response()
        }
    }
}
