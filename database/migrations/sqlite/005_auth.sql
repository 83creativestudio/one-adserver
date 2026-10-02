CREATE TABLE admin_sessions(token_hash TEXT PRIMARY KEY, credential_version TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT);
CREATE INDEX session_expiry ON admin_sessions(expires_at);
CREATE TABLE login_attempts(key_hash TEXT PRIMARY KEY, window_started_at TEXT NOT NULL, attempts INTEGER NOT NULL);
