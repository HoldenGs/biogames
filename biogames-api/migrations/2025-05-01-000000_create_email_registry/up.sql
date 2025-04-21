CREATE TABLE email_registry (
    id SERIAL PRIMARY KEY,
    email_hash TEXT NOT NULL UNIQUE
); 