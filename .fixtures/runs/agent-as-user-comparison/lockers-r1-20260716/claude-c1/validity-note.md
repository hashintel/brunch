# claude-c1 — validity note

**Status: LAUNCH FAILURE (environment) — attempt retained; no target interaction occurred.**

## What happened

The lane was launched through the actor recipe's structured spawn seam
(`spawn: { agent: "claude" }`) at 2026-07-16T18:31Z. The spawned command resolved
`claude` through a cmux CLI shim on PATH
(`<external-source>/cmux-cli-shims/…/claude`), whose wrapper
(`/Applications/cmux.app/Contents/Resources/bin/cmux-claude-wrapper`) failed with
`Operation not permitted`; the process exited with code 126 after ~2 s.

## Validity findings

1. **No mission delivery occurred.** The target never started; the prompt was never
   seen by a Claude Code session. No budget was consumed and no reveal was made.
2. **Root cause is environment, not target performance.** The real Claude Code binary
   (`~/.local/bin/claude`, v2.1.211) is installed and working; the failure is PATH
   interception by a cmux shim whose wrapper is not executable in the overlay spawn
   context.
3. **Attempt retained** per the frozen retention rule; this note is its record.

## Correction

`addendum-02-claude-c2.md` (campaign root) declares attempt `claude-c2`: identical
mission, budgets, reveal policy, and target cwd family, launched through
`interactive_shell` as a plain command with the explicit real binary path, bypassing
the broken shim. The launch mechanism is the only change; the overlay seam
(hands-free PTY, rendered readback, named keys) is unchanged.
