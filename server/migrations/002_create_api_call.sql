-- Migration 002: Track API call history

CREATE TABLE IF NOT EXISTS "api_call" (
    "pk"            INTEGER PRIMARY KEY AUTOINCREMENT,
    "method"        TEXT NOT NULL,
    "path"          TEXT NOT NULL,
    "status_code"   INTEGER,
    "model"         TEXT,
    "session_id"    TEXT,
    "request_body"  TEXT,
    "response_body" TEXT,
    "duration_ms"   INTEGER,
    "error"         TEXT,
    "created_at"    DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "IDX_api_call_path"       ON "api_call"("path");
CREATE INDEX IF NOT EXISTS "IDX_api_call_session_id"  ON "api_call"("session_id");
CREATE INDEX IF NOT EXISTS "IDX_api_call_created_at"  ON "api_call"("created_at");
