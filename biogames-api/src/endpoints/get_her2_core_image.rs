use axum::{
    extract::Path,
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
};
use diesel::prelude::*;
use std::fs;
use std::path::PathBuf;

use crate::{
    establish_db_connection,
    schema::her2_cores,
};

pub async fn get_her2_core_image(Path(her2_core_id): Path<i32>) -> impl IntoResponse {
    let connection = &mut establish_db_connection();

    match her2_cores::table
        .filter(her2_cores::id.eq(her2_core_id))
        .select(her2_cores::file_name)
        .first::<String>(connection)
    {
        Ok(image_path_str) => {
            let image_path = PathBuf::from(image_path_str);
            if !image_path.exists() {
                eprintln!("Image file not found at path: {:?}", image_path);
                return (StatusCode::NOT_FOUND, "Image file not found").into_response();
            }

            match fs::read(&image_path) {
                Ok(image_data) => {
                    let mut headers = HeaderMap::new();
                    let mime_type = mime_guess::from_path(&image_path)
                        .first_or_octet_stream()
                        .to_string();
                    headers.insert(header::CONTENT_TYPE, mime_type.parse().unwrap());
                    headers.insert(header::CACHE_CONTROL, "public, max-age=3600".parse().unwrap());
                    (StatusCode::OK, headers, image_data).into_response()
                }
                Err(e) => {
                    eprintln!("Error reading image file {:?}: {:?}", image_path, e);
                    StatusCode::INTERNAL_SERVER_ERROR.into_response()
                }
            }
        }
        Err(diesel::NotFound) => {
            eprintln!("Her2Core with ID {} not found.", her2_core_id);
            (StatusCode::NOT_FOUND, format!("Her2Core ID {} not found", her2_core_id)).into_response()
        }
        Err(e) => {
            eprintln!("Database error fetching image path for Her2Core ID {}: {:?}", her2_core_id, e);
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
} 
