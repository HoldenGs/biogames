use axum::{
    extract::Path,
    response::IntoResponse,
    Json, http::StatusCode
};
use diesel::{QueryDsl, ExpressionMethods, RunQueryDsl};
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
    
    // Query the database to check if the user_id exists and has a username
    let result = registered_users::table
        .filter(registered_users::user_id.eq(&user_id))
        .select(registered_users::username)
        .first::<Option<String>>(connection);
    
    match result {
        Ok(username) => {
            // User exists, check if they have a username
            Json(CheckUsernameResponse {
                has_username: username.is_some(),
                username,
            }).into_response()
        },
        Err(_) => {
            // User doesn't exist
            (StatusCode::NOT_FOUND, "User not found").into_response()
        }
    }
} 