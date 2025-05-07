use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use diesel::prelude::*;
use diesel::{OptionalExtension, SelectableHelper};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use validator::Validate;

use crate::models::{EmailRegistry, NewEmailRegistry, ValidatedRequest};
use crate::schema::email_registry;
use crate::PgPool;

#[derive(Deserialize, Validate)]
pub struct StoreEmailHashRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
}

#[derive(Serialize)]
pub struct StoreEmailHashResponse {
    pub success: bool,
}

pub async fn store_email_hash(
    State(pool): State<PgPool>,
    ValidatedRequest(payload): ValidatedRequest<StoreEmailHashRequest>,
) -> impl IntoResponse {
    let mut conn = match pool.get() {
        Ok(conn) => conn,
        Err(e) => {
            tracing::error!("Error getting connection from pool: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(StoreEmailHashResponse { success: false }));
        }
    };

    // Hash the email
    let mut hasher = Sha256::new();
    hasher.update(payload.email.as_bytes());
    let hash = format!("{:x}", hasher.finalize());

    // Check if this email hash already exists
    let exists = email_registry::table
        .filter(email_registry::email_hash.eq(&hash))
        .select(EmailRegistry::as_select())
        .first(&mut conn)
        .optional();

    match exists {
        Ok(Some(_)) => {
            // Email hash already exists
            (StatusCode::OK, Json(StoreEmailHashResponse { success: true }))
        }
        Ok(None) => {
            // Email hash doesn't exist, create it
            let new_email = NewEmailRegistry { email_hash: hash };
            match diesel::insert_into(email_registry::table)
                .values(&new_email)
                .execute(&mut conn)
            {
                Ok(_) => (StatusCode::OK, Json(StoreEmailHashResponse { success: true })),
                Err(e) => {
                    tracing::error!("Error inserting email hash: {}", e);
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(StoreEmailHashResponse { success: false }))
                }
            }
        }
        Err(e) => {
            tracing::error!("Error checking if email hash exists: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(StoreEmailHashResponse { success: false }))
        }
    }
} 