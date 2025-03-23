create table her2_cores (
    id serial primary key,
    score integer not null,
    file_name text not null,
    created_at timestamp with time zone not null default (now() at time zone 'utc')
)
