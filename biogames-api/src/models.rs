use axum::async_trait;
use axum::{
    extract::{rejection::JsonRejection, Request, FromRequest},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json};
use chrono::{DateTime, Utc};
use diesel::{AsChangeset, Insertable, Queryable, QueryableByName, Selectable};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use thiserror::Error;
use validator::Validate;

#[derive(Debug, Queryable, QueryableByName, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = crate::schema::games)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Game {
    pub id: i32,
    pub username: Option<String>,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub score: Option<i32>,
    pub max_score: i32,
    pub time_taken_ms: Option<i32>,
    pub game_type: String,
    pub user_id: String
}

#[derive(Debug, Queryable, QueryableByName, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = crate::schema::challenges)]
#[diesel(belongs_to(Game))]
#[diesel(belongs_to(Her2Core))]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Challenge {
    pub id: i32,
    pub game_id: i32,
    pub core_id: i32,
    pub guess: Option<i32>,
    pub started_at: Option<DateTime<Utc>>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub points: Option<i32>
}

#[derive(Debug, Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = crate::schema::her2_cores)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Her2Core {
    pub id: i32,
    pub score: i32,
    pub file_name: String,
    pub created_at: DateTime<Utc>
}

#[derive(Debug, Queryable, Selectable)]
#[diesel(table_name = crate::schema::registered_users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct RegisteredUser {
    pub id: i32,
    pub user_id: String,
    pub username: Option<String>
}

#[derive(Debug, Insertable)]
#[diesel(table_name = crate::schema::registered_users)]
pub struct NewRegisteredUser {
    pub user_id: String,
    pub username: Option<String>
}

#[derive(Clone, Copy, Default)]
pub struct ValidatedRequest<T>(pub T);

#[async_trait]
impl<T, S> FromRequest<S> for ValidatedRequest<T>
where
    T: DeserializeOwned + Validate,
    S: Send + Sync,
    Json<T>: FromRequest<S, Rejection = JsonRejection>
{
    type Rejection = ServerError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let Json(value) = Json::<T>::from_request(req, state).await?;
        value.validate()?;
        Ok(ValidatedRequest(value))
    }
}

#[derive(Debug, Error)]
pub enum ServerError {
    #[error(transparent)]
    ValidationError(#[from] validator::ValidationErrors),

    #[error(transparent)]
    AxumJsonRejection(#[from] JsonRejection)
}

impl IntoResponse for ServerError {
    fn into_response(self) -> Response {
        match self {
            ServerError::ValidationError(_) => {
                let message = format!("Input validation error: [{self}]").replace('\n', ", ");
                (StatusCode::BAD_REQUEST, message)
            }
            ServerError::AxumJsonRejection(_) => (StatusCode::BAD_REQUEST, self.to_string()),
        }
        .into_response()
    }
}

#[derive(Deserialize, Validate)]
pub struct CreateGameRequest {
    #[validate(length(min = 1, max = 32, message = "Must be between 1 and 32 characters"))]
    pub user_id: String,
    pub initial_her2_core_id: Option<i32>,
}

#[derive(Serialize)]
pub struct GameResponse {
    pub id: i32,
    pub user: Option<String>,
    pub results: Option<GameResultsResponse>,
    pub total_points: Option<i32>
}

#[derive(Serialize)]
pub struct GameCountResponse {
    pub pretest: i64,
    pub posttest: i64,
    pub training: i64
}

#[derive(Serialize)]
pub struct GameResultsResponse {
    pub severe_mistakes: Vec<GameResultResponse>,
    pub moderate_mistakes: Vec<GameResultResponse>,
    pub mild_mistakes: Vec<GameResultResponse>,
    pub correct: Vec<GameResultResponse>
}

#[derive(Serialize)]
#[derive(Clone)]
pub struct GameResultResponse {
    pub challenge_id: i32,
    pub guess: i32,
    pub correct_score: i32,
    pub seconds: f64,
    pub points: i32
}

impl IntoResponse for GameResponse {
    fn into_response(self) -> Response {
        (StatusCode::OK, axum::Json(self)).into_response()
    }
}

#[derive(Serialize)]
pub struct CurrentChallengeResponse {
    pub id: Option<i32>,
    pub core_id: Option<i32>,
    pub completed_challenges: i32,
    pub total_challenges: i32
}

impl IntoResponse for CurrentChallengeResponse {
    fn into_response(self) -> Response {
        (StatusCode::OK, axum::Json(self)).into_response()
    }
}

#[derive(Deserialize, Validate)]
pub struct SubmitChallengeRequest {
    #[validate(range(min = 0, max = 3, message = "Must be between 0 and 3"))]
    pub guess: i32
}

#[derive(Deserialize, Validate)]
pub struct GetLeaderboardRequest {
    // TODO pagination
    //pub game_id: i32
}

#[derive(Serialize)]
pub struct LeaderboardResponse {
    pub entries: Vec<LeaderboardEntryResponse>
}

#[derive(Serialize)]
pub struct LeaderboardEntryResponse {
    pub username: String,
    pub score: i32,
    pub time_taken_ms: i32,
    pub timestamp: DateTime<Utc>
}

impl IntoResponse for LeaderboardResponse {
    fn into_response(self) -> Response {
        (StatusCode::OK, axum::Json(self)).into_response()
    }
}

#[derive(Deserialize, Validate)]
pub struct RegisterUserRequest {
    #[validate(length(min = 1, max = 32, message = "Username must be between 1 and 32 characters"))]
    pub username: String
}

#[derive(Serialize)]
pub struct RegisterUserResponse {
    pub success: bool,
    pub user_id: String,
    pub username: Option<String>
}

impl IntoResponse for RegisterUserResponse {
    fn into_response(self) -> Response {
        (StatusCode::OK, axum::Json(self)).into_response()
    }
}
