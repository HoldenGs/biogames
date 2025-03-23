use std::env;

use diesel::{Connection, PgConnection};
use dotenvy::dotenv;

pub mod endpoints;
pub mod models;
pub mod schema;
pub mod scoring;

pub fn establish_db_connection() -> PgConnection {
    dotenv().ok();
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL not set");
    PgConnection::establish(&db_url)
        .unwrap_or_else(|_| panic!("Error connecting to {}", db_url))
}
