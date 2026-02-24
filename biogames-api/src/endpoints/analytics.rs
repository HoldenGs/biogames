use axum::{
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::{BigInt, Int4, Nullable, Text, Timestamp};
use serde::Serialize;

use crate::establish_db_connection;

// -------------------------
// Row structs (one per table)
// -------------------------

#[derive(QueryableByName, Debug, Serialize)]
struct GamesRow {
    #[diesel(sql_type = Int4)]
    id: i32,

    #[diesel(sql_type = Nullable<Text>)]
    username: Option<String>,

    #[diesel(sql_type = Nullable<Timestamp>)]
    started_at: Option<chrono::NaiveDateTime>,

    #[diesel(sql_type = Nullable<Timestamp>)]
    finished_at: Option<chrono::NaiveDateTime>,

    #[diesel(sql_type = Nullable<Int4>)]
    score: Option<i32>,

    #[diesel(sql_type = Nullable<Int4>)]
    max_score: Option<i32>,

    // Often BIGINT in Postgres; if it's INT4 in your schema, swap to Nullable<Int4> + Option<i32>.
    #[diesel(sql_type = Nullable<BigInt>)]
    time_taken_ms: Option<i64>,

    #[diesel(sql_type = Nullable<Text>)]
    game_type: Option<String>,

    #[diesel(sql_type = Nullable<Text>)]
    user_id: Option<String>,
}

#[derive(QueryableByName, Debug, Serialize)]
struct ChallengesRow {
    #[diesel(sql_type = Int4)]
    id: i32,

    #[diesel(sql_type = Int4)]
    game_id: i32,

    // If this is nullable in your DB, change to Nullable<Int4> + Option<i32>.
    #[diesel(sql_type = Int4)]
    core_id: i32,

    #[diesel(sql_type = Nullable<Text>)]
    guess: Option<String>,

    #[diesel(sql_type = Nullable<Timestamp>)]
    started_at: Option<chrono::NaiveDateTime>,

    #[diesel(sql_type = Nullable<Timestamp>)]
    submitted_at: Option<chrono::NaiveDateTime>,
}

#[derive(QueryableByName, Debug, Serialize)]
struct RegisteredUsersRow {
    #[diesel(sql_type = Int4)]
    id: i32,

    #[diesel(sql_type = Text)]
    user_id: String,

    #[diesel(sql_type = Nullable<Text>)]
    username: Option<String>,

    #[diesel(sql_type = Nullable<Text>)]
    email: Option<String>,
}

#[derive(QueryableByName, Debug, Serialize)]
struct EmailRegistryRow {
    #[diesel(sql_type = Int4)]
    id: i32,

    #[diesel(sql_type = Text)]
    email_hash: String,

    #[diesel(sql_type = Nullable<Text>)]
    email_domain: Option<String>,
}

// -------------------------
// SQL strings
// -------------------------

const SQL_GAMES: &str = r#"
SELECT
  id,
  username,
  started_at,
  finished_at,
  score,
  max_score,
  time_taken_ms,
  game_type,
  user_id
FROM games
ORDER BY id;
"#;

const SQL_CHALLENGES: &str = r#"
SELECT
  id,
  game_id,
  core_id,
  guess,
  started_at,
  submitted_at
FROM challenges
ORDER BY id;
"#;

const SQL_REGISTERED_USERS: &str = r#"
SELECT
  id,
  user_id,
  username,
  email
FROM registered_users
ORDER BY id;
"#;

const SQL_EMAIL_REGISTRY: &str = r#"
SELECT
  id,
  email_hash,
  email_domain
FROM email_registry
ORDER BY id;
"#;

// -------------------------
// CSV helper
// -------------------------

fn csv_response<T: Serialize>(filename: &str, rows: Vec<T>) -> Response {
    let mut wtr = csv::Writer::from_writer(Vec::new());

    for row in rows {
        if let Err(e) = wtr.serialize(row) {
            eprintln!("[analytics] csv serialize failed: {:?}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    }

    let data = match wtr.into_inner() {
        Ok(d) => d,
        Err(e) => {
            eprintln!("[analytics] csv finalize failed: {:?}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, "text/csv; charset=utf-8".parse().unwrap());
    headers.insert(header::CACHE_CONTROL, "no-store".parse().unwrap());
    headers.insert(
        header::CONTENT_DISPOSITION,
        format!("attachment; filename=\"{}\"", filename)
            .parse()
            .unwrap(),
    );

    (StatusCode::OK, headers, data).into_response()
}

// -------------------------
// Handlers
// -------------------------

pub async fn games_csv() -> Response {
    let conn = &mut establish_db_connection();

    let rows: Vec<GamesRow> = match sql_query(SQL_GAMES).load(conn) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[analytics] games query failed: {:?}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    csv_response("games.csv", rows)
}

pub async fn challenges_csv() -> Response {
    let conn = &mut establish_db_connection();

    let rows: Vec<ChallengesRow> = match sql_query(SQL_CHALLENGES).load(conn) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[analytics] challenges query failed: {:?}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    csv_response("challenges.csv", rows)
}

pub async fn registered_users_csv() -> Response {
    let conn = &mut establish_db_connection();

    let rows: Vec<RegisteredUsersRow> = match sql_query(SQL_REGISTERED_USERS).load(conn) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[analytics] registered_users query failed: {:?}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    csv_response("registered_users.csv", rows)
}

pub async fn email_registry_csv() -> Response {
    let conn = &mut establish_db_connection();

    let rows: Vec<EmailRegistryRow> = match sql_query(SQL_EMAIL_REGISTRY).load(conn) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[analytics] email_registry query failed: {:?}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    csv_response("email_registry.csv", rows)
}