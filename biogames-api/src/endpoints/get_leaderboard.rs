use axum::{extract::Query, http::StatusCode, response::IntoResponse};
use diesel::{sql_query, RunQueryDsl};
use diesel::sql_types::{Text, Integer};
use diesel::QueryableByName;

use crate::{
    establish_db_connection,
    models::{
        GetLeaderboardRequest, LeaderboardEntryResponse, LeaderboardResponse
    }
};

#[derive(QueryableByName)]
struct LeaderboardEntry {
    #[diesel(sql_type = Text)]
    username: String,
    #[diesel(sql_type = Integer)]
    avg_score: i32,
    #[diesel(sql_type = Integer)]
    avg_time_taken_ms: i32,
}

pub async fn get_leaderboard(Query(_body): Query<GetLeaderboardRequest>) -> impl IntoResponse {
    let connection = &mut establish_db_connection();

    let query = r#"
            SELECT
                username,
                AVG(score)::integer AS avg_score,
                AVG(time_taken_ms)::integer AS avg_time_taken_ms
            FROM (
                SELECT
                    *,
                    ROW_NUMBER() OVER (
                        PARTITION BY user_id
                        ORDER BY score DESC, time_taken_ms
                    ) AS rank
                FROM games
                WHERE score IS NOT NULL AND time_taken_ms IS NOT NULL AND game_type = 'training'
            ) ranked_games
            WHERE rank <= 1
            GROUP BY user_id
            ORDER BY avg_score DESC, avg_time_taken_ms;
        "#;

    let results = sql_query(query)
        .get_results::<LeaderboardEntry>(connection);

    match results {
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        Ok(entries) => LeaderboardResponse {
            entries: entries.into_iter()
            .map(|entry| LeaderboardEntryResponse {
                username: entry.username,
                score: entry.avg_score,
                time_taken_ms: entry.avg_time_taken_ms as i32,
                // TODO fix timestamp
                timestamp: chrono::offset::Utc::now()
            })
            .collect()
        }.into_response()
    }
}
