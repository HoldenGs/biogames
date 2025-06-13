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
// This ensures that check_game_type will correctly identify pretest as completed.
fn create_dummy_pretest_if_not_exists(connection: &mut PgConnection, username_for_game: &str) {
    let pretest_exists_query = games::table
        .filter(games::username.eq(username_for_game))
        .filter(games::game_type.eq("pretest"));
        // Potentially add .filter(games::finished_at.is_not_null()) if "finished" is a strict requirement

    let pretest_exists_result = diesel::select(diesel::dsl::exists(pretest_exists_query))
        .get_result::<bool>(connection);

    let pretest_exists = match pretest_exists_result {
        Ok(exists) => exists,
        Err(e) => {
            tracing::error!("Error checking for existing pretest for username '{}': {:?}. Assuming it doesn't exist.", username_for_game, e);
            false // Proceed to create if unsure
        }
    };

    if !pretest_exists {
        tracing::info!("No existing pretest for username '{}'. Creating dummy pretest game.", username_for_game);
        let insert_result = insert_into(games::table)
            .values((
                games::username.eq(username_for_game),
                games::started_at.eq(Utc::now()),
                games::finished_at.eq(Some(Utc::now())), // Mark as finished
                games::score.eq(Some(0)),             // Dummy score
                games::max_score.eq(1), // Indicates 1 "challenge", effectively complete for a dummy
                // For a 50-challenge pretest, max_score should ideally be 50.
                // However, for a "dummy" completed pretest, 1 might be simpler if check_game_type
                // only cares about existence or finished_at. If it computes completion percentage,
                // then score=50, max_score=50 would be better. Assuming 1 is okay for "dummy".
                games::game_type.eq("pretest"),
                games::time_taken_ms.eq(Some(0)),
            ))
            .execute(connection);

        if let Err(e) = insert_result {
            tracing::error!("Failed to create dummy pretest game for username '{}': {:?}", username_for_game, e);
        }
    } else {
        tracing::info!("Pretest already exists for username '{}'. No action needed.", username_for_game);
    }
}

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
                if query_params.context.as_deref() == Some("training") {
                    if username_option.is_none() {
                        tracing::info!("User_id '{}' exists but has NULL username. Context is training. Setting username to user_id.", user_id_str);
                        if let Err(e) = diesel::update(registered_users::table.find(registered_user_db_id))
                            .set(registered_users::username.eq(&user_id_str))
                            .execute(connection)
                        {
                            tracing::error!("Failed to update username for existing user '{}': {:?}", user_id_str, e);
                            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to update username"}))).into_response();
                        }
                        username_option = Some(user_id_str.clone()); // Update local variable
                    }
                    // Ensure dummy pretest exists for this user (using their now confirmed username)
                    if let Some(ref uname) = username_option { // uname is &String, which is Sized. Coerces to &str for function call.
                        create_dummy_pretest_if_not_exists(connection, uname);
                    } else {
                        // Should not happen if update succeeded or username was already Some
                         tracing::error!("User_id '{}' in training context, but username is still None after checks/updates.", user_id_str);
                    }
                }
                (StatusCode::OK, Json(json!({ "user_id": user_id_str, "status": "exists", "username": username_option }))).into_response()
            }
            None => { // User does not exist
                tracing::info!("User_id '{}' not found in registered_users.", user_id_str);
                if query_params.context.as_deref() == Some("training") {
                    tracing::info!("Context is training for new user_id '{}'. Creating user and dummy pretest.", user_id_str);
                    // Create new registered_user with username = user_id
                    let creation_result = insert_into(registered_users::table)
                        .values((
                            registered_users::user_id.eq(&user_id_str),
                            registered_users::username.eq(&user_id_str),
                            // email can be NULL
                        ))
                        .execute(connection);

                    if let Err(e) = creation_result {
                        tracing::error!("Failed to create new registered_user for user_id '{}': {:?}", user_id_str, e);
                        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create user"}))).into_response();
                    }
                    
                    // Create dummy pretest for this new user (username is same as user_id_str here)
                    create_dummy_pretest_if_not_exists(connection, &user_id_str);
                    
                    (StatusCode::OK, Json(json!({ "user_id": user_id_str, "status": "created", "username": user_id_str }))).into_response()
                } else {
                    // User does not exist, and context is not training
                    tracing::info!("User_id '{}' not found and context is not training. Returning 404.", user_id_str);
                    (StatusCode::NOT_FOUND, Json(json!({ "error": "User ID not found" }))).into_response()
                }
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
