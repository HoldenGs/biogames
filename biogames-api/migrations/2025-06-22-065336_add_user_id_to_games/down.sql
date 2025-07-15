-- This file should undo anything in `up.sql`
ALTER TABLE games DROP COLUMN user_id;

ALTER TABLE games ALTER COLUMN username SET NOT NULL;