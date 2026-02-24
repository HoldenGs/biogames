use axum::{
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
};
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::{Int4, Nullable, Text, Timestamp};
use serde::Serialize;

use crate::establish_db_connection;

#[derive(QueryableByName, Debug, Serialize)]
struct TrainingRunRow {
    #[diesel(sql_type = Text)]
    user_id: String,

    #[diesel(sql_type = Text)]
    username: String,

    #[diesel(sql_type = Nullable<Int4>)]
    pretest: Option<i32>,
    #[diesel(sql_type = Nullable<Timestamp>)]
    pretest_started_at: Option<chrono::NaiveDateTime>,
    #[diesel(sql_type = Nullable<Timestamp>)]
    pretest_finished_at: Option<chrono::NaiveDateTime>,

    #[diesel(sql_type = Nullable<Int4>)]
    posttest: Option<i32>,
    #[diesel(sql_type = Nullable<Timestamp>)]
    posttest_started_at: Option<chrono::NaiveDateTime>,
    #[diesel(sql_type = Nullable<Timestamp>)]
    posttest_finished_at: Option<chrono::NaiveDateTime>,

    #[diesel(sql_type = Int4)]
    game_id: i32,

    #[diesel(sql_type = Int4)]
    training_score: i32,

    #[diesel(sql_type = Nullable<Timestamp>)]
    run_started_at: Option<chrono::NaiveDateTime>,
    #[diesel(sql_type = Nullable<Timestamp>)]
    run_submitted_at: Option<chrono::NaiveDateTime>,
}

const SQL: &str = r#"
WITH training_runs AS (
  SELECT
    g.username,
    g.id AS game_id,
    g.score AS training_score,
    MIN(c.started_at)   AS run_started_at,
    MAX(c.submitted_at) AS run_submitted_at
  FROM games g
  JOIN challenges c
    ON c.game_id = g.id
  WHERE g.game_type = 'training'
    AND g.username IS NOT NULL
    AND g.score IS NOT NULL
  GROUP BY g.username, g.id, g.score
),

pretest AS (
  SELECT
    g.username,
    MAX(g.score)       AS pretest,
    MAX(g.started_at)  AS pretest_started_at,
    MAX(g.finished_at) AS pretest_finished_at
  FROM games g
  WHERE g.game_type = 'pretest'
    AND g.username IS NOT NULL
  GROUP BY g.username
),

posttest AS (
  SELECT
    g.username,
    MAX(g.score)       AS posttest,
    MAX(g.started_at)  AS posttest_started_at,
    MAX(g.finished_at) AS posttest_finished_at
  FROM games g
  WHERE g.game_type = 'posttest'
    AND g.username IS NOT NULL
  GROUP BY g.username
)

SELECT
  tr.username,

  pre.pretest,
  pre.pretest_started_at,
  pre.pretest_finished_at,

  post.posttest,
  post.posttest_started_at,
  post.posttest_finished_at,

  tr.game_id,
  tr.training_score,
  tr.run_started_at,
  tr.run_submitted_at

FROM training_runs tr
LEFT JOIN pretest pre
  ON pre.username = tr.username
LEFT JOIN posttest post
  ON post.username = tr.username

ORDER BY tr.username, tr.run_started_at;
"#;

pub async fn analytics_csv() -> impl IntoResponse {
    let conn = &mut establish_db_connection();

    let rows: Vec<TrainingRunRow> = match sql_query(SQL).load(conn) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[analytics] query failed: {:?}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

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
        "attachment; filename=\"analytics.csv\"".parse().unwrap(),
    );

    (StatusCode::OK, headers, data).into_response()
}