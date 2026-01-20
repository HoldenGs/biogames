-- Your SQL goes here

ALTER TABLE email_registry ADD COLUMN IF NOT EXISTS email_domain TEXT;

-- make everything in the db so far correspond to Israel domain
-- issue - if we re-rerun this migration... bad