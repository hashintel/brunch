#!/usr/bin/env node
import process from "node:process"

import { verifyWorkspaceSessionStores } from "./workspace-session-coordinator.js"

const cwd = process.argv[2]
const expectedSessionCount = process.argv[3]
  ? Number(process.argv[3])
  : undefined

if (!cwd || Number.isNaN(expectedSessionCount)) {
  process.stderr.write(
    "Usage: tsx src/check-workspace-session-stores.ts <cwd> [expected-session-count]\n",
  )
  process.exit(2)
}

const result = await verifyWorkspaceSessionStores(
  expectedSessionCount === undefined ? { cwd } : { cwd, expectedSessionCount },
)
if (!result.ok) {
  process.stderr.write(`${result.errors.join("\n")}\n`)
  process.exit(1)
}

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      specId: result.specId,
      sessionCount: result.sessions.length,
      sessions: result.sessions.map((session) => ({
        file: session.file,
        sessionId: session.sessionId,
        specId: session.binding.specId,
      })),
    },
    null,
    2,
  )}\n`,
)
