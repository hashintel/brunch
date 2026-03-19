ALTER TABLE "claude_call" ADD COLUMN "project_id" INTEGER REFERENCES "project"("pk");
CREATE INDEX IF NOT EXISTS "IDX_claude_call_project_id" ON "claude_call"("project_id");
