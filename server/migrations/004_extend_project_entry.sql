-- Migration 004: Add columns for full session storage in project/entry tables
ALTER TABLE "project" ADD COLUMN "prompt" TEXT;
ALTER TABLE "project" ADD COLUMN "model" TEXT;
ALTER TABLE "project" ADD COLUMN "clarifying_state" TEXT;
ALTER TABLE "project" ADD COLUMN "created_at" DATETIME NOT NULL DEFAULT (datetime('now'));
ALTER TABLE "project" ADD COLUMN "updated_at" DATETIME NOT NULL DEFAULT (datetime('now'));
ALTER TABLE "entry" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
