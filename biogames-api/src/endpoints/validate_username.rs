use axum::{
    extract::Path,
    Json,
    response::IntoResponse,
    http::StatusCode,
};
use diesel::{ExpressionMethods, QueryDsl, RunQueryDsl};
use tracing;
use serde_json::json;

use crate::{establish_db_connection, schema::registered_users};

// This is actually validating a user_id, not a username
pub async fn validate_username(Path(user_id): Path<String>) -> impl IntoResponse {
    tracing::info!("Validating user_id: {}", user_id);

    // TEMPORARY CHANGE FOR TESTING: Allow any user_id
    // The original database check is commented out below.
    // REMEMBER TO REVERT THIS CHANGE AFTER TESTING.
    tracing::info!("TEMPORARY: Allowing user_id '{}' without database validation.", user_id);
    return (StatusCode::OK, Json(json!({ "user_id": user_id })));

    /* Original validation logic:
    let connection = &mut establish_db_connection();
    
    // Check if the user_id exists in the database
    let is_valid = diesel::dsl::select(diesel::dsl::exists(
        registered_users::table.filter(registered_users::user_id.eq(&user_id))
    ))
    .get_result::<bool>(connection)
    .unwrap_or(false);
    
    tracing::info!("Is valid: {}", is_valid);

    if is_valid {
        (StatusCode::OK, Json(json!({ "user_id": user_id })))
    } else {
        (StatusCode::NOT_FOUND, Json(json!({ "error": "User ID not found" })))
    }
    */
}
