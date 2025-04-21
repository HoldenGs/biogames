use axum::{
    response::IntoResponse,
    Json,
};
use diesel::{ExpressionMethods, QueryDsl, RunQueryDsl, SelectableHelper};
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::establish_db_connection;
use crate::models::{RegisteredUser, NewRegisteredUser, ValidatedRequest};
use crate::schema::registered_users;

#[derive(Deserialize, Validate)]
pub struct RegisterWithUsernameRequest {
    #[validate(length(min = 1, max = 32, message = "Username must be between 1 and 32 characters"))]
    pub username: String,
    
    #[validate(length(min = 5, message = "User ID is too short"))]
    pub user_id: String,
}

#[derive(Serialize)]
pub struct RegisterWithUsernameResponse {
    pub success: bool,
    pub user_id: String,
    pub username: Option<String>,
    pub message: String,
}

impl IntoResponse for RegisterWithUsernameResponse {
    fn into_response(self) -> axum::response::Response {
        (axum::http::StatusCode::OK, Json(self)).into_response()
    }
}

pub async fn register_with_username(
    ValidatedRequest(payload): ValidatedRequest<RegisterWithUsernameRequest>,
) -> impl IntoResponse {
    let connection = &mut establish_db_connection();
    
    // Check if the user_id already exists
    let user_exists = diesel::dsl::select(diesel::dsl::exists(
        registered_users::table.filter(registered_users::user_id.eq(&payload.user_id)),
    ))
    .get_result::<bool>(connection)
    .unwrap_or(false);
    
    if user_exists {
        // Check if the user already has a username
        let user = registered_users::table
            .filter(registered_users::user_id.eq(&payload.user_id))
            .select(RegisteredUser::as_select())
            .first::<RegisteredUser>(connection);
            
        match user {
            Ok(user) => {
                if user.username.is_some() {
                    return RegisterWithUsernameResponse {
                        success: false,
                        user_id: payload.user_id,
                        username: user.username,
                        message: "User already has a username registered".to_string(),
                    }.into_response();
                }
                
                // Update existing user with the username
                match diesel::update(registered_users::table.find(user.id))
                    .set(registered_users::username.eq(Some(payload.username.clone())))
                    .returning(RegisteredUser::as_returning())
                    .get_result(connection) {
                        Ok(updated_user) => {
                            RegisterWithUsernameResponse {
                                success: true,
                                user_id: updated_user.user_id,
                                username: updated_user.username,
                                message: "Username registered successfully".to_string(),
                            }.into_response()
                        },
                        Err(e) => {
                            eprintln!("Error updating user with username: {}", e);
                            (
                                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                                "Failed to register username".to_string(),
                            ).into_response()
                        }
                    }
            },
            Err(e) => {
                eprintln!("Error retrieving user: {}", e);
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to retrieve user information".to_string(),
                ).into_response()
            }
        }
    } else {
        // Create new user with the user_id and username
        let new_user = NewRegisteredUser {
            user_id: payload.user_id.clone(),
            username: Some(payload.username.clone()),
        };
        
        // Insert into database
        match diesel::insert_into(registered_users::table)
            .values(&new_user)
            .returning(RegisteredUser::as_returning())
            .get_result(connection) {
                Ok(registered_user) => {
                    RegisterWithUsernameResponse {
                        success: true,
                        user_id: registered_user.user_id,
                        username: registered_user.username,
                        message: "User registered successfully with username".to_string(),
                    }.into_response()
                },
                Err(e) => {
                    eprintln!("Error inserting user into database: {}", e);
                    (
                        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                        "Failed to register user with username".to_string(),
                    ).into_response()
                }
            }
    }
} 