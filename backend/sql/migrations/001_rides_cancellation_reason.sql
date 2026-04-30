-- Rider/driver free-text reason when a ride is cancelled.
-- Canonical column definition also lives on `rides` in ../schema.sql .
ALTER TABLE rides ADD COLUMN cancellation_reason VARCHAR(500) NULL;
