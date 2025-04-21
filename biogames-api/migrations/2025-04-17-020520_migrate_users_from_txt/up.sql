-- Your SQL goes here

-- Directly insert users from users.txt
-- Only insert if they don't already exist in the database

-- UCLA_stain20
INSERT INTO registered_users (user_id)
SELECT 'UCLA_stain20'
WHERE NOT EXISTS (SELECT 1 FROM registered_users WHERE user_id = 'UCLA_stain20');

-- UCLA_biology98
INSERT INTO registered_users (user_id)
SELECT 'UCLA_biology98'
WHERE NOT EXISTS (SELECT 1 FROM registered_users WHERE user_id = 'UCLA_biology98');

-- UCLA_test94
INSERT INTO registered_users (user_id)
SELECT 'UCLA_test94'
WHERE NOT EXISTS (SELECT 1 FROM registered_users WHERE user_id = 'UCLA_test94');

-- UCLA_tissue68
INSERT INTO registered_users (user_id)
SELECT 'UCLA_tissue68'
WHERE NOT EXISTS (SELECT 1 FROM registered_users WHERE user_id = 'UCLA_tissue68');

-- UCLA_slide22
INSERT INTO registered_users (user_id)
SELECT 'UCLA_slide22'
WHERE NOT EXISTS (SELECT 1 FROM registered_users WHERE user_id = 'UCLA_slide22');
