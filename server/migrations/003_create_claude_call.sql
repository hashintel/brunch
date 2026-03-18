-- Migration 003: Track Claude SDK calls

CREATE TABLE IF NOT EXISTS "claude_call" (
    "pk"              INTEGER PRIMARY KEY AUTOINCREMENT,
    "model"           TEXT NOT NULL,
    "caller"          TEXT NOT NULL,
    "prompt"          TEXT,
    "response"        TEXT,
    "input_tokens"    INTEGER,
    "output_tokens"   INTEGER,
    "turns"           INTEGER,
    "duration_ms"     INTEGER,
    "status"          TEXT NOT NULL DEFAULT 'success',
    "error"           TEXT,
    "cwd"             TEXT,
    "created_at"      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "IDX_claude_call_model"      ON "claude_call"("model");
CREATE INDEX IF NOT EXISTS "IDX_claude_call_caller"     ON "claude_call"("caller");
CREATE INDEX IF NOT EXISTS "IDX_claude_call_created_at" ON "claude_call"("created_at");
