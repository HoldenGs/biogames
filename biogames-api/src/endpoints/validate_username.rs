use axum::{
    extract::{Path, Query},
    Json,
    response::IntoResponse,
    http::StatusCode,
};
use diesel::{ExpressionMethods, QueryDsl, RunQueryDsl};
#[cfg(feature = "training_direct_entry")]
use diesel::{OptionalExtension, BoolExpressionMethods};
#[cfg(feature = "training_direct_entry")]
use diesel::{PgConnection, dsl::insert_into};
use tracing;
use serde_json::json;
use serde::Deserialize;
#[cfg(feature = "training_direct_entry")]
use chrono::Utc;

use crate::{establish_db_connection, schema::{registered_users}};
#[cfg(feature = "training_direct_entry")]
use crate::schema::games;

#[derive(Deserialize)]
pub struct ValidateUsernameQuery {
    context: Option<String>,
}

#[cfg(feature = "training_direct_entry")]
// Helper function to create a dummy pretest game if one doesn't exist
// Removed create_dummy_pretest_if_not_exists function since users must complete real pretest now

pub async fn validate_username(
    Path(user_id_str): Path<String>,
    Query(query_params): Query<ValidateUsernameQuery>
) -> impl IntoResponse {
    tracing::info!("Validating user_id: '{}' with context: {:?}", user_id_str, query_params.context);
    let connection = &mut establish_db_connection();
    
    #[cfg(feature = "training_direct_entry")]
    {
        let user_record_result = registered_users::table
            .filter(registered_users::user_id.eq(&user_id_str))
            .select((registered_users::id, registered_users::username))
            .first::<(i32, Option<String>)>(connection)
            .optional(); // Call optional() on the Result

        let user_record = match user_record_result {
            Ok(record) => record,
            Err(e) => {
                tracing::error!("Database error checking user_id '{}': {:?}", user_id_str, e);
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"}))).into_response();
            }
        };

        match user_record {
            Some((registered_user_db_id, mut username_option)) => { // User exists
                tracing::info!("User_id '{}' found in registered_users. DB ID: {}, Username from DB: {:?}", user_id_str, registered_user_db_id, username_option);
                // Remove the auto-assignment logic since users must set usernames via pretest
                // if query_params.context.as_deref() == Some("training") {
                //     if username_option.is_none() {
                //         tracing::info!("User_id '{}' exists but has NULL username. Context is training. Setting username to user_id.", user_id_str);
                //         if let Err(e) = diesel::update(registered_users::table.find(registered_user_db_id))
                //             .set(registered_users::username.eq(&user_id_str))
                //             .execute(connection)
                //         {
                //             tracing::error!("Failed to update username for existing user '{}': {:?}", user_id_str, e);
                //             return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to update username"}))).into_response();
                //         }
                //         username_option = Some(user_id_str.clone()); // Update local variable
                //     }
                // }
                
                // Only allow training access if user has completed pretest (has a username)
                if query_params.context.as_deref() == Some("training") && username_option.is_none() {
                    tracing::info!("User_id '{}' trying to access training but has no username. Must complete pretest first.", user_id_str);
                    return (StatusCode::BAD_REQUEST, Json(json!({ "error": "Please complete pretest first to set a username" }))).into_response();
                }
                (StatusCode::OK, Json(json!({ "user_id": user_id_str, "status": "exists", "username": username_option }))).into_response()
            }
            None => { // User does not exist
                tracing::info!("User_id '{}' not found in registered_users.", user_id_str);
                // Removed auto-creation logic - users must register via email first
                // if query_params.context.as_deref() == Some("training") {
                //     tracing::info!("Context is training for new user_id '{}'. Creating user and dummy pretest.", user_id_str);
                //     // Create new registered_user with username = user_id
                //     let creation_result = insert_into(registered_users::table)
                //         .values((
                //             registered_users::user_id.eq(&user_id_str),
                //             registered_users::username.eq(&user_id_str),
                //             // email can be NULL
                //         ))
                //         .execute(connection);

                // Since we no longer auto-create users, return 404 for non-existent users
                tracing::info!("User_id '{}' not found. Users must register via email first.", user_id_str);
                (StatusCode::NOT_FOUND, Json(json!({ "error": "User ID not found. Please register via email first." }))).into_response()
            }
        }
    }

    #[cfg(not(feature = "training_direct_entry"))]
    {
        // Standard behavior: simply check if user_id exists.
        let user_exists_query = registered_users::table
            .filter(registered_users::user_id.eq(&user_id_str));
        
        let user_exists_result = diesel::select(diesel::dsl::exists(user_exists_query))
            .get_result::<bool>(connection);

        match user_exists_result {
            Ok(true) => {
                tracing::info!("User_id '{}' found (feature 'training_direct_entry' disabled).
", user_id_str);
                (StatusCode::OK, Json(json!({ "user_id": user_id_str, "status": "exists" }))).into_response()
            }
            Ok(false) => {
                tracing::info!("User_id '{}' not found (feature 'training_direct_entry' disabled). Returning 404.
", user_id_str);
                (StatusCode::NOT_FOUND, Json(json!({ "error": "User ID not found" }))).into_response()
            }
            Err(e) => {
                tracing::error!("Database error checking user_id '{}' (feature 'training_direct_entry' disabled): {:?}", user_id_str, e);
                (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"}))).into_response()
            }
        }
    }
}
