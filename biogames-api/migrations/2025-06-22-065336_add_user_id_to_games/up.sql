-- Your SQL goes here

ALTER TABLE games ADD COLUMN user_id VARCHAR(32);

UPDATE games SET user_id = username WHERE user_id IS NULL;

ALTER TABLE games ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE games ALTER COLUMN username DROP NOT NULL;
