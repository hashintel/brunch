/**
 * Brunch — opinionated specification-workspace product over pi-coding-agent.
 *
 * This entrypoint is the walking-skeleton bootstrap stub. It does the minimum
 * needed to prove that the Node + TypeScript + tsx + @earendil-works/pi-coding-agent
 * import chain resolves end-to-end. The first scoped slice of the
 * `walking-skeleton` frontier (see memory/PLAN.md) will replace this with a
 * pi-backed TUI session that:
 *
 *   - resolves and scopes durable state to `.brunch/` under cwd,
 *   - mounts the persistent TUI chrome region (cwd / spec / phase / chat-mode),
 *   - gates the agent loop behind the spec-selector overlay (per SPEC.md D11-L).
 *
 * Until then, running `npm run dev` (or `brunch` once the bin shim is wired)
 * prints this banner and exits cleanly.
 */

import process from "node:process"

import {
  createAgentSession as _createAgentSession,
  SessionManager as _SessionManager,
} from "@earendil-works/pi-coding-agent"

// Reference the imports so the type-checker proves they resolve. The first
// scoped walking-skeleton slice will actually invoke createAgentSession with a
// `SessionManager.create(cwd, '.brunch/sessions/')` configuration.
void _createAgentSession
void _SessionManager

function main(): void {
  const cwd = process.cwd()
  process.stdout.write(
    [
      "brunch (walking-skeleton bootstrap stub)",
      `  cwd:           ${cwd}`,
      `  .brunch/ root: ${cwd}/.brunch/  (not created yet)`,
      "",
      "Next: first scoped slice of `walking-skeleton` wires up the TUI",
      "session against pi-coding-agent. See memory/PLAN.md.",
      "",
    ].join("\n"),
  )
}

main()
