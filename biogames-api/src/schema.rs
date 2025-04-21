// @generated automatically by Diesel CLI.

diesel::table! {
    challenges (id) {
        id -> Int4,
        game_id -> Int4,
        core_id -> Int4,
        guess -> Nullable<Int4>,
        started_at -> Nullable<Timestamptz>,
        submitted_at -> Nullable<Timestamptz>,
        points -> Nullable<Int4>,
    }
}

diesel::table! {
    games (id) {
        id -> Int4,
        #[max_length = 32]
        username -> Varchar,
        started_at -> Timestamptz,
        finished_at -> Nullable<Timestamptz>,
        score -> Nullable<Int4>,
        max_score -> Int4,
        time_taken_ms -> Nullable<Int4>,
        game_type -> Varchar,
    }
}

diesel::table! {
    her2_cores (id) {
        id -> Int4,
        score -> Int4,
        file_name -> Text,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    registered_users (id) {
        id -> Int4,
        user_id -> Text,
        #[max_length = 32]
        username -> Nullable<Varchar>,
    }
}

diesel::joinable!(challenges -> games (game_id));
diesel::joinable!(challenges -> her2_cores (core_id));

diesel::allow_tables_to_appear_in_same_query!(
    challenges,
    games,
    her2_cores,
    registered_users,
);
