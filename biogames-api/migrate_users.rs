use std::fs::File;
use std::io::{BufRead, BufReader};
use diesel::prelude::*;
use dotenvy::dotenv;
use std::env;

mod schema {
    table! {
        registered_users (id) {
            id -> Int4,
            user_id -> Text,
            username -> Nullable<Varchar>,
        }
    }
}

use schema::registered_users;

// Define necessary models
#[derive(Debug, Queryable, Selectable)]
#[diesel(table_name = registered_users)]
struct RegisteredUser {
    id: i32,
    user_id: String,
    username: Option<String>,
}

#[derive(Insertable)]
#[diesel(table_name = registered_users)]
struct NewRegisteredUser {
    user_id: String,
    username: Option<String>,
}

fn establish_connection() -> PgConnection {
    dotenv().ok();

    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
    PgConnection::establish(&database_url)
        .expect(&format!("Error connecting to {}", database_url))
}

fn main() {
    let connection = &mut establish_connection();
    
    // Open the users.txt file
    let file = match File::open("users.txt") {
        Ok(file) => file,
        Err(e) => {
            eprintln!("Error opening users.txt: {}", e);
            return;
        }
    };
    
    let reader = BufReader::new(file);
    let mut migrated_count = 0;
    let mut skipped_count = 0;
    
    // Read each line and insert into the database if it doesn't exist
    for line in reader.lines() {
        let user_id = match line {
            Ok(id) => id.trim().to_string(),
            Err(e) => {
                eprintln!("Error reading line: {}", e);
                continue;
            }
        };
        
        if user_id.is_empty() {
            continue;
        }
        
        // Check if the user already exists in the database
        let exists = diesel::dsl::select(diesel::dsl::exists(
            registered_users::table.filter(registered_users::user_id.eq(&user_id))
        ))
        .get_result::<bool>(connection)
        .unwrap_or(false);
        
        if exists {
            println!("User already exists in database: {}", user_id);
            skipped_count += 1;
            continue;
        }
        
        // Insert the new user
        let new_user = NewRegisteredUser {
            user_id: user_id.clone(),
            username: None,
        };
        
        match diesel::insert_into(registered_users::table)
            .values(&new_user)
            .execute(connection) {
                Ok(_) => {
                    println!("Successfully migrated user: {}", user_id);
                    migrated_count += 1;
                },
                Err(e) => {
                    eprintln!("Error inserting user {}: {}", user_id, e);
                }
            }
    }
    
    println!("Migration complete!");
    println!("  Users migrated: {}", migrated_count);
    println!("  Users skipped (already in database): {}", skipped_count);
} 