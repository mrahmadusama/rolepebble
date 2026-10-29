-- The waitlist, in the Cloudflare D1 database bound to the site as DB.
-- Run once: npx wrangler d1 execute rolepebble-waitlist --remote --file site/schema.sql

CREATE TABLE IF NOT EXISTS waitlist (
  email TEXT PRIMARY KEY,
  -- Which form on the page: "hero" or "footer".
  source TEXT,
  created_at TEXT NOT NULL
);
