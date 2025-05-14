use axum::{
    extract::Query,
    http::StatusCode,
    response::{IntoResponse, Json},
};
use diesel::prelude::*;
use diesel::sql_types::Integer; // For RANDOM() if id is integer
use serde::{Deserialize, Serialize};

use crate::{
    establish_db_connection,
    schema::her2_cores, // Assuming schema is here
};

#[derive(Deserialize)]
pub struct PreviewParams {
    #[serde(alias = "mode")]
    _mode: Option<String>, // Mode is not used yet, but captured for future use
}

#[derive(Serialize)]
pub struct PreviewCoreIdResponse {
    her2_core_id: i32,
}

pub async fn get_preview_core_id(
    Query(_params): Query<PreviewParams>,
) -> impl IntoResponse {
    let connection = &mut establish_db_connection();

    match her2_cores::table
        .select(her2_cores::id)
        .order(diesel::dsl::sql::<Integer>("RANDOM()")) // PostgreSQL specific for random row
        .first::<i32>(connection)
    {
        Ok(core_id) => Json(PreviewCoreIdResponse {
            her2_core_id: core_id,
        })
        .into_response(),
        Err(diesel::NotFound) => {
            eprintln!("No Her2Cores found in the database.");
            (StatusCode::NOT_FOUND, "No Her2Cores available for preview").into_response()
        }
        Err(e) => {
            eprintln!("Error fetching random Her2Core ID: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
} 