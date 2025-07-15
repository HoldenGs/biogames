use axum::{extract::Path, http::StatusCode, response::IntoResponse};
use diesel::{prelude::*,
    sql_query,
    update,
    ExpressionMethods,
    RunQueryDsl,
    sql_types::{Integer, Timestamptz}
};
use tracing::{warn, info, error};

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
    let server_received_time = chrono::offset::Utc::now(); // Record time of request reception

    // get the challenge and its game and core
    let result = challenges::table
        .inner_join(games::table.on(games::id.eq(challenges::game_id)))
        .inner_join(her2_cores::table.on(her2_cores::id.eq(challenges::core_id)))
        .filter(challenges::id.eq(challenge_id))
        .select((challenges::all_columns, games::all_columns, her2_cores::all_columns))
        .first::<(Challenge, Game, Her2Core)>(connection);

    let (ch, g, co) = match result {
        Err(diesel::result::Error::NotFound) => return (StatusCode::NOT_FOUND, "Challenge or related game/core not found").into_response(),
        Err(e) => {
            error!("Error fetching challenge details: {:?}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
        Ok(r) => r
    };

    info!(challenge_id = ch.id, game_id = g.id, server_received_time = %server_received_time.to_rfc3339(), challenge_started_at = ?ch.started_at, "Submit challenge request received.");

    let started_at = match ch.started_at {
        None => {
            warn!(challenge_id = ch.id, "Challenge has not been started.");
            return (StatusCode::BAD_REQUEST, "Challenge not started").into_response();
        }
        Some(s) => s
    };

    let now = chrono::offset::Utc::now(); // This 'now' is used for the 5-second check, as submission time for challenge, and potentially finished_at for game.

    if (now - started_at).num_seconds() < 5 {
        warn!(challenge_id = ch.id, server_time_at_check = %now.to_rfc3339(), challenge_started_at = %started_at.to_rfc3339(), diff_seconds = (now - started_at).num_seconds(), "Submission too early.");
        return (StatusCode::BAD_REQUEST, "Submission too early").into_response();
    }

    let points = get_score(body.guess, co.score);

    let challenge_update_result = update(challenges::table)
        .filter(challenges::id.eq(challenge_id))
        .filter(challenges::guess.is_null())
        .set((
            challenges::guess.eq(body.guess),
            challenges::submitted_at.eq(now),
            challenges::points.eq(points)
        ))
        .execute(connection);

    match challenge_update_result {
        Err(e) => {
            error!("Error updating challenge {}: {:?}", challenge_id, e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
        Ok(0) => {
            warn!("Challenge {} already scored or not found for update.", challenge_id);
            return (StatusCode::BAD_REQUEST, "Challenge already scored or not found").into_response();
        }
        Ok(1) => {
            info!("Challenge {} successfully scored with {} points.", challenge_id, points);

            // Check if this was the last challenge for the game
            // To do this accurately, we need the total number of challenges for this game.
            // This might involve another query or ensuring 'g' (Game model) has total_challenges if it's part of your schema/model.
            // For now, we proceed with the existing logic that updates game score if all challenges have points.

            let game_update_query = r#"
                UPDATE games g
                SET 
                    score = (
                        SELECT SUM(c.points)
                        FROM challenges c
                        WHERE c.game_id = $1
                    ),
                    time_taken_ms = (
                        SELECT FLOOR(EXTRACT(epoch FROM SUM(c.submitted_at - c.started_at)) * 1000)
                        FROM challenges c
                        WHERE c.game_id = $1 AND c.submitted_at IS NOT NULL AND c.started_at IS NOT NULL
                    ),
                    finished_at = $2
                WHERE g.id = $1 AND g.finished_at IS NULL
                AND $1 IN (
                    SELECT game_id 
                    FROM challenges
                    GROUP BY game_id
                    HAVING MIN(COALESCE(points, -9999)) != -9999 -- check all challenges have non-null points
                );
            "#;

            let game_update_execution_result = sql_query(game_update_query)
                .bind::<Integer, _>(g.id)
                .bind::<Timestamptz, _>(now) // Use the same 'now' for consistency
                .execute(connection);

            match game_update_execution_result {
                Ok(rows_affected) => {
                    if rows_affected > 0 {
                        info!("Game {} successfully finalized with score and finished_at timestamp.", g.id);
                    } else {
                        info!("Game {} not yet finalized (all challenges might not be scored or already finished).", g.id);
                    }
                }
                Err(e) => {
                    error!("Error updating game {} with final score/time/finished_at: {:?}", g.id, e);
                    // Not returning an error to client here, as challenge was successfully submitted.
                    // This is an internal data consistency issue if it fails.
                }
            }
            StatusCode::OK.into_response()
        }
        Ok(_) => unreachable!("Updated more than one challenge with the same ID.")
    }
}
