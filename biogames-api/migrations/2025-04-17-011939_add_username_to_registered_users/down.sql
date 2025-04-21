-- This file should undo anything in `up.sql`

-- Drop username column from registered_users table
ALTER TABLE registered_users DROP COLUMN username;
