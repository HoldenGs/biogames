use axum::{
    extract::Path,
    Json,
    response::IntoResponse,
    http::StatusCode,
};
use std::collections::HashSet;
use std::fs::File;
use std::io::{BufRead, BufReader};
use tracing;
use lazy_static::lazy_static;
use serde_json::json;

lazy_static! {
    static ref VALID_USERNAMES: HashSet<String> = load_usernames();
}

fn load_usernames() -> HashSet<String> {
    let file = File::open("users.txt").expect("Failed to open users.txt");
    let reader = BufReader::new(file);
    reader.lines()
        .filter_map(Result::ok)
        .collect()
}

pub async fn validate_username(Path(username): Path<String>) -> impl IntoResponse {
    let is_valid = VALID_USERNAMES.contains(&username);
    tracing::info!("Validating username: {}", username);
    tracing::info!("Is valid: {}", is_valid);

    if is_valid {
        (StatusCode::OK, Json(json!({ "username": username })))
    } else {
        (StatusCode::NOT_FOUND, Json(json!({ "error": "Username not found" })))
    }
}
