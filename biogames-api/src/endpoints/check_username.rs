use axum::{
    extract::Path,
    response::IntoResponse,
    Json, http::StatusCode
};
use diesel::{QueryDsl, ExpressionMethods, RunQueryDsl, result::Error as DieselError};
use serde::Serialize;

use crate::{establish_db_connection, schema::registered_users};

#[derive(Serialize)]
pub struct CheckUsernameResponse {
    pub has_username: bool,
    pub username: Option<String>
}

pub async fn check_username(
    Path(user_id): Path<String>,
) -> impl IntoResponse {
    let connection = &mut establish_db_connection();
    
    let result = registered_users::table
        .filter(registered_users::user_id.eq(&user_id))
        .select(registered_users::username)
        .first::<Option<String>>(connection);
    
    match result {
        Ok(username_option) => {
            // User ID exists. username_option is Some(String) if an actual username is set, 
            // or None if the username column is NULL for that user_id.
            Json(CheckUsernameResponse {
                has_username: username_option.is_some(),
                username: username_option,
            }).into_response()
        },
        Err(DieselError::NotFound) => {
            // User ID itself was not found in the database.
            // Return 200 OK with has_username: false, as this means no username is associated because the user doesn't exist.
            (StatusCode::OK, Json(CheckUsernameResponse {
                has_username: false,
                username: None,
            })).into_response()
        },
        Err(e) => {
            // Some other unexpected database error.
            eprintln!("[check_username] Database query failed for user_id '{}': {:?}", user_id, e);
            // Return a 500 error. The client should ideally handle this gracefully and not proceed with registration.
            (StatusCode::INTERNAL_SERVER_ERROR, Json(CheckUsernameResponse {
                has_username: false, // Indicate failure/unknown state
                username: Some(format!("Server error checking user_id")) // Generic error hint
            })).into_response()
        }
    }
} 