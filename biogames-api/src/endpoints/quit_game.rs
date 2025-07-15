use axum::{extract::Path, http::StatusCode, response::IntoResponse};
use diesel::{
    result::Error::NotFound, sql_query, sql_types::{Integer, Timestamptz}, Connection, ExpressionMethods, QueryDsl, RunQueryDsl
};
use tracing::{event, Level};
use chrono::Utc;

use crate::{
    establish_db_connection,
    schema::games::{self as games_schema, dsl::games},
    models::Game
};

pub async fn quit_game(Path(game_id): Path<i32>) -> impl IntoResponse {
    let connection = &mut establish_db_connection();

    tracing::info!("Quitting game: {}", game_id);

    let game = match games
        .filter(games_schema::id.eq(game_id))
        .get_result::<Game>(connection) {
            Ok(g) => g,
            Err(NotFound) => return StatusCode::NOT_FOUND.into_response(),
            Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response()
    };

    // It's okay to quit a game that was already scored/finished by other means,
    // but we primarily expect this for games that are not yet fully completed.
    // The main action here is to ensure finished_at is set.

    let now_utc = Utc::now();

    match connection.transaction(|connection| {
        // Calculate total score and time if not already set
        // This part attempts to salvage scores if the game was partially played before quitting.
        // If game.score is already Some, this update for score/time_taken_ms might be skipped or have no effect based on DB behavior for already set values.
        let score_update_query = r#"
            UPDATE games 
            SET 
                score = COALESCE(score, (SELECT SUM(points) FROM challenges WHERE game_id = $1 AND points IS NOT NULL)),
                time_taken_ms = COALESCE(time_taken_ms, (SELECT FLOOR(EXTRACT(epoch FROM SUM(submitted_at - started_at)) * 1000) 
                                            FROM challenges 
                                            WHERE game_id = $1 AND submitted_at IS NOT NULL AND started_at IS NOT NULL)),
                finished_at = $2
            WHERE id = $1 AND finished_at IS NULL; -- Only update if not already finished
            "#;

        sql_query(score_update_query)
            .bind::<Integer, _>(game.id)
            .bind::<Timestamptz, _>(now_utc)
            .execute(connection)?;

        // If the above didn't run because finished_at was already set, 
        // or if we just want to be absolutely sure finished_at is set if it was somehow missed:
        // However, the COALESCE and `AND finished_at IS NULL` should handle most cases gracefully.
        // A simpler alternative if we just want to mark as finished NOW regardless of prior state:
        // diesel::update(games.filter(games_schema::id.eq(game.id)))
        //     .set(games_schema::finished_at.eq(now_utc))
        //     .execute(connection)?;


        // Remove challenges that haven't been attempted (guess is null)
        // This is fine to run even if the game was already technically finished.
        let delete_unattempted_challenges_query = r#"
            DELETE FROM challenges WHERE game_id = $1 AND guess IS NULL;
            "#;

        sql_query(delete_unattempted_challenges_query)
            .bind::<Integer, _>(game.id)
            .execute(connection)?;

        diesel::result::QueryResult::Ok(())
    }) {
        Ok(_) => {
            tracing::info!("Game {} marked as quit/finished at {}.", game_id, now_utc);
            StatusCode::OK.into_response()
        },
        Err(e) => {
            event!(Level::ERROR, "Error during quit_game transaction for game {}: {:?}", game_id, e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    }
}
