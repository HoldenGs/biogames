use axum::{extract::Path, http::StatusCode, response::IntoResponse};
use diesel::prelude::*;

use crate::{
    establish_db_connection,
    models::{Challenge, Game, GameResponse, GameResultResponse, GameResultsResponse, Her2Core},
    schema::{challenges, games, her2_cores},
    scoring::get_score,
};

pub async fn get_game(Path(game_id): Path<i32>) -> impl IntoResponse {
    let connection = &mut establish_db_connection();

    tracing::info!("Processing game_id: {}", game_id);

    let results = games::table
        .inner_join(challenges::table)
        .inner_join(her2_cores::table.on(her2_cores::id.eq(challenges::core_id)))
        .filter(games::id.eq(game_id))
        .order_by(challenges::id)
        .get_results::<(Game, Challenge, Her2Core)>(connection);

    if let Err(e) = results {
        tracing::error!("Database error: {:?}", e);
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    }

    let results = results.unwrap();

    if results.len() == 0 {
        tracing::warn!("No results found for game_id: {}", game_id);
        return StatusCode::BAD_REQUEST.into_response();
    }

    let (game, _, _) = &results[0];

    // Get completed challenges, whether or not the game score is finalized
    let completed_challenges = results.iter()
        .filter(|(_, ch, _)| ch.guess.is_some())
        .count();

    // If the game has no completed challenges, return error
    if completed_challenges == 0 {
        tracing::warn!("Game {} has no completed challenges", game_id);
        return StatusCode::BAD_REQUEST.into_response();
    }

    // Updated to use the confusion matrix
    fn points(ch: &Challenge, co: &Her2Core) -> i32 {
        if let Some(guess) = ch.guess {
            get_score(guess, co.score)
        } else {
            0 // Default for challenges without guesses
        }
    }

    let game_results = results.iter()
        .filter(|(_, ch, _)| ch.guess.is_some())
        .map(|(_, ch, co)| GameResultResponse {
            challenge_id: ch.id,
            guess: ch.guess.unwrap(),
            correct_score: co.score,
            seconds: (ch.submitted_at.unwrap_or_else(chrono::Utc::now) - 
                     ch.started_at.unwrap_or_else(chrono::Utc::now))
                .num_milliseconds() as f64 / 1000_f64,
            points: points(ch, co)
        })
        .collect::<Vec<_>>();

    let total_points = game_results.iter()
        .map(|r| r.points)
        .sum();

    // Update the categorization code to use actual owned values rather than references
    let severe_mistakes = game_results.iter()
        .filter(|r| r.points <= -3)
        .cloned()
        .collect::<Vec<_>>();
        
    let moderate_mistakes = game_results.iter()
        .filter(|r| r.points == -2)
        .cloned()
        .collect::<Vec<_>>();
        
    let mild_mistakes = game_results.iter()
        .filter(|r| r.points == -1)
        .cloned()
        .collect::<Vec<_>>();
        
    let correct = game_results.iter()
        .filter(|r| r.points == 5)
        .cloned()
        .collect::<Vec<_>>();

    // Update the GameResultsResponse with our categorized results
    let grouped_results = GameResultsResponse {
        severe_mistakes,
        moderate_mistakes,
        mild_mistakes,
        correct,
    };

    // Return the game response regardless of whether game.score is set
    return GameResponse {
        id: game_id,
        user: game.user_id.clone(),
        results: Some(grouped_results),
        total_points: Some(total_points)
    }.into_response();
}
