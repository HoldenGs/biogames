use axum::{extract::Path, http::StatusCode, response::IntoResponse};
use diesel::prelude::*;

use crate::{
    establish_db_connection,
    models::{Challenge, CurrentChallengeResponse, Her2Core},
    schema::{challenges, her2_cores}
};

pub async fn get_current_challenge(Path(game_id): Path<i32>) -> impl IntoResponse {
    let connection = &mut establish_db_connection();

    let results = challenges::table
        .inner_join(her2_cores::table)
        .filter(challenges::game_id.eq(game_id))
        .select((Challenge::as_select(), Her2Core::as_select()))
        .order_by(challenges::id)
        .get_results::<(Challenge, Her2Core)>(connection);

    if let Err(_) = results {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    }

    let results = results.unwrap();

    let total_challenges = results.len() as i32;

    let completed_challenges = results.iter()
        .filter(|(ch, _)| ch.guess != None)
        .count() as i32;

    let current_challenge_id = results.iter()
        .map(|(ch, _)| ch)
        .filter(|ch| ch.guess == None)
        .map(|ch| ch.id)
        .nth(0);

    return CurrentChallengeResponse {
        id: current_challenge_id,
        completed_challenges,
        total_challenges
    }.into_response();
}
