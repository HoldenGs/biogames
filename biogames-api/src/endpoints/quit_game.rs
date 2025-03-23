use axum::{extract::Path, http::StatusCode, response::IntoResponse};
use diesel::{
    result::Error::NotFound, sql_query, sql_types::Integer, Connection, ExpressionMethods, QueryDsl, RunQueryDsl
};
use tracing::{event, Level};

use crate::{
    establish_db_connection,
    schema::games::{*, dsl::games},
    models::Game
};

pub async fn quit_game(Path(game_id): Path<i32>) -> impl IntoResponse {
    let connection = &mut establish_db_connection();

    tracing::info!("Quitting game: {}", game_id);

    let game = match games
        .filter(id.eq(game_id))
        .get_result::<Game>(connection) {
            Ok(g) => g,
            Err(NotFound) => return StatusCode::NOT_FOUND.into_response(),
            Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response()
    };

    if game.score != None || game.time_taken_ms != None {
        // game has already been scored
        return StatusCode::BAD_REQUEST.into_response();
    }

    match connection.transaction(|connection| {
        // Calculate total score without restrictions on negative values
        let query = r#"
            update games set score = (
                select sum(points) from challenges where game_id = $1 and points is not null
            ), time_taken_ms = (
                select floor(extract(epoch from sum(submitted_at - started_at)) * 1000)
                from challenges where game_id = $1 and submitted_at is not null and started_at is not null
            )
            where id = $1;
            "#;

        sql_query(query)
            .bind::<Integer, _>(game.id)
            .execute(connection)?;

        // Remove challenges that haven't been attempted
        let query = r#"
            delete from challenges where game_id = $1 and guess is null;
            "#;

        sql_query(query)
            .bind::<Integer, _>(game.id)
            .execute(connection)?;

        diesel::result::QueryResult::Ok(())
    }) {
        Ok(_) => StatusCode::OK.into_response(),
        Err(e) => {
            event!(Level::ERROR, "{:?}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    }
}
