use axum::{extract::Path, http::StatusCode, response::IntoResponse};
use diesel::{prelude::*,
    sql_query,
    update,
    ExpressionMethods,
    RunQueryDsl,
    sql_types::Integer
};
use tracing::warn;

use crate::{
    establish_db_connection,
    models::{Game, Challenge, Her2Core, SubmitChallengeRequest, ValidatedRequest},
    schema::{games, challenges, her2_cores},
    scoring::get_score,
};

pub async fn submit_challenge(
    Path(challenge_id): Path<i32>,
    ValidatedRequest(body): ValidatedRequest<SubmitChallengeRequest>) -> impl IntoResponse {
    let connection = &mut establish_db_connection();

    // get the challenge and its game and core
    let result = challenges::table
        .inner_join(games::table)
        .inner_join(her2_cores::table.on(her2_cores::id.eq(challenges::core_id)))
        .filter(challenges::id.eq(challenge_id))
        .first::<(Challenge, Game, Her2Core)>(connection);

    let (ch, g, co) = match result {
        Err(diesel::result::Error::NotFound) => return StatusCode::NOT_FOUND.into_response(),
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        Ok(r) => r
    };

    let started_at = match ch.started_at {
        // challenge hasn't been started
        None => return StatusCode::BAD_REQUEST.into_response(),
        Some(s) => s
    };

    let now = chrono::offset::Utc::now();

    if (now - started_at).num_seconds() < 5 {
        // user has to wait a minimum of 5 seconds before submitting
        return StatusCode::BAD_REQUEST.into_response();
    }

    // calculate score using confusion matrix
    let points = get_score(body.guess, co.score);

    // set score and submission time
    let result = update(challenges::table)
        .filter(challenges::id.eq(challenge_id))
        .filter(challenges::guess.is_null())
        .set((
            challenges::guess.eq(body.guess),
            challenges::submitted_at.eq(now),
            challenges::points.eq(points)
        ))
        .execute(connection);

    match result {
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        // no challenges affected; this one has already been scored
        Ok(0) => return StatusCode::BAD_REQUEST.into_response(),
        Ok(1) => {
            // set the game's final score and time taken to the sum of the
            // challenge scores/times, IF all challenges have been submitted
            let query = r#"
                update games g
                set score = (
                    select sum(c.points)
                    from challenges c
                    where c.game_id = $1
                    and $1 in (
                        select game_id from challenges
                        group by game_id
                        having min(coalesce(points, -1)) != -1
                )), time_taken_ms = (
                    select floor(extract(epoch from sum(c.submitted_at - c.started_at)) * 1000)
                    from challenges c
                    where c.game_id = $1
                    and $1 in (
                        select game_id from challenges
                        group by game_id
                        having min(coalesce(points, -1)) != -1
                ))
                where g.id = $1;
                "#;

            if let Err(_) = sql_query(query)
                .bind::<Integer, _>(g.id)
                .execute(connection) {
                warn!("error saving score for game {}", g.id);
            }

            return StatusCode::OK.into_response()
        },
        // should be impossible for two challenges to have the same ID
        Ok(_) => unreachable!()
    }
}
