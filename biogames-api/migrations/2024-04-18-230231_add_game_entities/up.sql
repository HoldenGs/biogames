create table games (
    id serial primary key,
    username varchar(32) not null,
    started_at timestamp with time zone not null default (now() at time zone 'utc'),
    finished_at timestamp with time zone,
    score integer,
    max_score integer not null,
    time_taken_ms integer
);

create table challenges (
    id serial primary key,
    game_id integer not null references games(id),
    core_id integer not null references her2_cores(id),
    guess integer,
    started_at timestamp with time zone,
    submitted_at timestamp with time zone,
    points integer
);
