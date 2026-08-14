-- Schema and seed data for the `adaptizer` D1 database.
--
-- This is the canonical schema for local and fresh remote databases. It is
-- idempotent, so it can be replayed without clobbering existing rows.
--
--   Local:  npm run db:schema:local
--   Remote: npm run db:schema
--
-- Existing-database upgrade: this file only ever *creates* the schema, so a
-- `db:schema` run against a database created from an older version is a no-op
-- and will not add the `dimension` column. Run the ALTER below once for such a
-- database. Its `NOT NULL DEFAULT 'intensity'` backfills every existing row to
-- `intensity` automatically:
--
--   npx wrangler d1 execute adaptizer --remote \
--     --command="ALTER TABLE songs ADD COLUMN dimension TEXT NOT NULL DEFAULT 'intensity'"
--
-- The ALTER is deliberately kept out of this replayed body: SQLite has no
-- `ADD COLUMN IF NOT EXISTS`, so a second run would fail on the duplicate
-- column and break the idempotence this file guarantees.

CREATE TABLE IF NOT EXISTS [songs] (
  "id" integer PRIMARY KEY,
  "author" text,
  "album" text,
  "name" text,
  "storage_location" text,
  -- The song's adaptation dimension (see CONTEXT.md). The default lets a row omit
  -- it and backfills the pre-existing row; served opaquely, never validated here.
  "dimension" text NOT NULL DEFAULT 'intensity'
);

-- `storage_location` is a prefix in the public `adaptizer` R2 bucket; the
-- client resolves it to {mediaBaseUrl}/{storage_location}/manifest.mpd.
-- `dimension` is omitted here so the row takes the column default, `intensity`.
INSERT OR IGNORE INTO [songs] ("id", "author", "album", "name", "storage_location")
VALUES (1, 'Wednesday Habits', 'Demo', 'Adaptizer Sample', 'Sample');
