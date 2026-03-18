-- Migration 001: Create project and entry tables
-- Based on server/model/Project.ts and server/model/Entry.ts

CREATE TABLE IF NOT EXISTS "project" (
    "pk"     INTEGER PRIMARY KEY AUTOINCREMENT,
    "name"   VARCHAR(255),
    "goal"   TEXT,
    "folder" VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS "entry" (
    "pk"          INTEGER PRIMARY KEY AUTOINCREMENT,
    "title"       VARCHAR(255),
    "description" TEXT,
    "test"        TEXT,
    "stage"       TEXT CHECK("stage" IN ('proposal', 'approved', 'completed')),
    "confidence"  REAL CHECK("confidence" >= 0 AND "confidence" <= 1),
    "project_id"  INTEGER REFERENCES "project"("pk") ON DELETE CASCADE,
    "parent_id"   INTEGER REFERENCES "entry"("pk") ON DELETE SET NULL,
    "created_at"  DATETIME NOT NULL DEFAULT (datetime('now')),
    "updated_at"  DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "IDX_entry_project_id" ON "entry"("project_id");
CREATE INDEX IF NOT EXISTS "IDX_entry_parent_id"  ON "entry"("parent_id");
