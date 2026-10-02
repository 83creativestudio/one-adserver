CREATE TABLE assets (
  id TEXT PRIMARY KEY, original_name TEXT NOT NULL, stored_name TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
  byte_size INTEGER NOT NULL, created_at TEXT NOT NULL
);
