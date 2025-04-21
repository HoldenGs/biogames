-- Your SQL goes here

-- Add username column to registered_users table
ALTER TABLE registered_users ADD COLUMN username VARCHAR(32);
