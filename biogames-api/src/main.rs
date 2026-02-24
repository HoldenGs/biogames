mod scoring;

use std::net::SocketAddr;

use axum::Router;
use axum::routing::{get, post};

use axum_server::Server;
use axum::http::Method;

use tower_http::cors::Any;
use tower_http::cors::CorsLayer;

use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use tracing_subscriber::{
    layer::SubscriberExt,
    util::SubscriberInitExt
};

use biogames_api::{
    endpoints::{
        create_game::*,
        get_game::*,
        quit_game::*,
        get_current_challenge::*,
        submit_challenge::*,
        get_challenge_core::*,
        get_leaderboard::*,
        validate_username::validate_username,
        check_game_type::check_game_type,
        check_username::check_username,
        generate_user_id::generate_user_id,
        register_with_username::register_with_username,
        get_preview_core_id::*,
        get_her2_core_image::*,
        analytics::*,
    },
    establish_db_connection
};

#[tokio::main]
async fn main() {
    let mut connection = establish_db_connection();
    const MIGRATIONS: EmbeddedMigrations = embed_migrations!("./migrations");
    connection.run_pending_migrations(MIGRATIONS)
        .unwrap_or_else(|_| panic!("Error running migrations"));

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "biogames_api=debug,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Log a message to confirm the logger is working
    tracing::debug!("Tracing initialized");

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers(Any);

    let app = Router::new()
        .route("/games", post(create_game))
        .route("/games/:id", get(get_game))
        .route("/games/:id/challenge", get(get_current_challenge))
        .route("/games/:id/quit", post(quit_game))
        .route("/challenges/:id", post(submit_challenge))
        .route("/challenges/:id/core", get(get_challenge_core))
        .route("/leaderboard", get(get_leaderboard))
        .route("/validate-username/:username", get(validate_username))
        .route("/check-game-type/:user_id", get(check_game_type))
        .route("/check-username/:user_id", get(check_username))
        .route("/generate-user-id", post(generate_user_id))
        .route("/register-with-username", post(register_with_username))
        .route("/api/preview_core_id", get(get_preview_core_id))
        .route("/api/her2_core_images/:her2_core_id", get(get_her2_core_image))
        .route("/analytics/analytics.csv", get(analytics_csv))
        .layer(cors);


    // let config = RustlsConfig::from_pem_file(
    //     PathBuf::from("cert").join("cert.pem"),
    //     PathBuf::from("cert").join("key.pem")
    // )
    // .await
    // .unwrap();

    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    tracing::debug!("listening on {}", addr);
    Server::bind(addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
    // axum_server::bind_rustls(addr, config)
    //     .serve(app.into_make_service())
    //     .await
    //     .unwrap();
}
