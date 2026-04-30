-- Optional rider/driver display name for profile management.
-- Canonical column definition also lives on `users` in ../schema.sql .
ALTER TABLE users ADD COLUMN full_name VARCHAR(160) NULL;
