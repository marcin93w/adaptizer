-- Schema and seed data for the `adaptizer` D1 database.
--
-- This mirrors the live production database as of 2026-08-07. It is
-- idempotent, so it can be replayed against a local or a fresh remote
-- database without clobbering existing rows.
--
--   Local:  npm run db:schema:local
--   Remote: npm run db:schema

CREATE TABLE IF NOT EXISTS [songs] (
  "id" integer PRIMARY KEY,
  "author" text,
  "album" text,
  "name" text,
  "storage_location" text
);

-- `storage_location` is a prefix in the public `adaptizer` R2 bucket; the
-- client resolves it to {mediaBaseUrl}/{storage_location}/manifest.mpd.
INSERT OR IGNORE INTO [songs] ("id", "author", "album", "name", "storage_location")
VALUES (1, 'Wednesday Habits', 'Demo', 'Adaptizer Sample', 'Sample');
