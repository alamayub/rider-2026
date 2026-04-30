# SQL migrations

Numbered files (`001_*.sql`, `002_*.sql`, …) are applied in order when the API runs `migrateMySql` (via `npm run db:migrate` or server startup). Each file is executed at most once; completion is recorded in the `schema_migrations` table.

**Convention:** keep the **full** desired shape in `sql/schema.sql` (for new environments), and add an **incremental** migration here for existing databases. Prefer idempotent DDL where supported (for example `ADD COLUMN IF NOT EXISTS` on MySQL 8.0.29+).
