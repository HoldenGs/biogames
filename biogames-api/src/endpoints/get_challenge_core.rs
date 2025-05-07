use axum::{
    body::Body, extract::{Path, Query}, http::{header::{CONTENT_TYPE, CACHE_CONTROL, CONTENT_LENGTH}, StatusCode}, response::{AppendHeaders, IntoResponse}
};
use diesel::prelude::*;
use tokio_util::io::ReaderStream;
use once_cell::sync::Lazy;
use serde::Deserialize;


use crate::{
    establish_db_connection,
    models::{Challenge, Her2Core},
    schema::{challenges::{self}, her2_cores}
};

#[derive(Deserialize)]
pub struct ChallengeParams {
    mode: Option<String>,
}

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

pub async fn get_challenge_core(
    Path(challenge_id): Path<i32>,
    Query(params): Query<ChallengeParams>,
) -> impl IntoResponse {
    
    let is_test = params.mode.as_deref() == Some("test");
    let connection = &mut establish_db_connection();

    tracing::info!("Processing challenge_id: {}", challenge_id);
    tracing::info!("is_test: {}", is_test);

    let result = challenges::table
        .inner_join(her2_cores::table)
        .filter(challenges::id.eq(challenge_id))
        .select((Challenge::as_select(), Her2Core::as_select()))
        .first::<(Challenge, Her2Core)>(connection);

    match result {
        Ok((ref challenge, ref core)) => {
            tracing::debug!("Found challenge: {:?}, core: {:?}", challenge, core);
            // Proceed with your logic
        }
        Err(diesel::result::Error::NotFound) => {
            tracing::debug!("No results found for challenge_id: {}", challenge_id);
            return StatusCode::NOT_FOUND.into_response();
        }
        Err(e) => {
            tracing::error!("Database error: {:?}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    }

    let (_challenge, core) = result.unwrap();
    tracing::debug!("core file name: {}", core.file_name);
    let file_path = core.file_name.clone();
    let file = match tokio::fs::File::open(&file_path).await {
        Ok(f) => f,
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response()
    };
    let metadata = match file.metadata().await {
        Ok(m) => m,
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response()
    };
    let file_size = metadata.len();

    diesel::update(challenges::table)
        .filter(challenges::id.eq(challenge_id))
        .filter(challenges::started_at.is_null())
        .set(challenges::started_at.eq(chrono::offset::Utc::now()))
        .execute(connection)
        .unwrap();

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    // Tell browsers to cache these cores for 24h, serve correct mime, and set Content-Length
    let length_value = file_size.to_string();
    (AppendHeaders([
        (CONTENT_TYPE, "image/png"),
        (CONTENT_LENGTH, &length_value),
        (CACHE_CONTROL, "public, max-age=86400, immutable")
    ]), body).into_response()
}
