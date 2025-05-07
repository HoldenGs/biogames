use axum::{extract::{Path, Query}, http::StatusCode, response::IntoResponse};
use diesel::prelude::*;
use serde::Deserialize;

use crate::{
    establish_db_connection,
    models::{Challenge, CurrentChallengeResponse, Her2Core},
    schema::{challenges, her2_cores}
};

// Define a struct for the query parameters
#[derive(Deserialize)]
pub struct GetCurrentChallengeParams {
    completed_count: Option<i32>, // 0-indexed rank of the uncompleted challenge to fetch
}

pub async fn get_current_challenge(
    Path(game_id): Path<i32>,
    Query(params): Query<GetCurrentChallengeParams>, // <-- Use the new params struct
) -> impl IntoResponse {
    let connection = &mut establish_db_connection();

    let results = challenges::table
        .inner_join(her2_cores::table)
        .filter(challenges::game_id.eq(game_id))
        .select((Challenge::as_select(), Her2Core::as_select()))
        .order_by(challenges::id) // Ensure consistent order
        .get_results::<(Challenge, Her2Core)>(connection);

    if let Err(e) = results {
        eprintln!("Error fetching challenges: {:?}", e); // Log the error
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    }

    let all_challenges_for_game = results.unwrap();
    let total_challenges = all_challenges_for_game.len() as i32;

    // Calculate the actual number of challenges with a guess in the DB
    let actual_completed_in_db = all_challenges_for_game.iter()
        .filter(|(ch, _)| ch.guess.is_some())
        .count() as i32;

    // Determine which uncompleted challenge to target based on completed_count param
    // Defaults to 0, meaning the first uncompleted challenge.
    let target_uncompleted_index = params.completed_count.unwrap_or(0);

    // Get the ID of the target uncompleted challenge
    let target_challenge_id = all_challenges_for_game.iter()
        .filter(|(ch, _)| ch.guess.is_none()) // Only consider un-guessed challenges
        .map(|(ch, _)| ch.id)               // Select their IDs
        .nth(target_uncompleted_index as usize); // Get the Nth one (0-indexed)

    CurrentChallengeResponse {
        id: target_challenge_id,
        completed_challenges: actual_completed_in_db, // Always return actual completed count from DB
        total_challenges,
    }.into_response()
}
