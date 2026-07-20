# Addendum 03 — Cursor availability corrected after the run

This addendum corrects the mechanism stated in `cursor-x1/validity-note.md` without
rewriting the immutable lane record or judgment packets.

## Historical run status remains unchanged

At campaign probe time, the Cursor lane did not launch. The actor observed
`Operation not permitted` while invoking both `agent` and `cursor-agent`, so the
best-effort lane was correctly retained as skipped and excluded from judgment.
Nothing in this addendum retroactively supplies a Cursor outcome to
`lockers-r1-20260716`.

## Corrected mechanism

The original note diagnosed a broken symlink / missing installed build. Later host
inspection showed that both launchers pointed to the installed Cursor agent binary,
but the active Safehouse profile allowed `~/.local/bin` without allowing the symlink
target under `~/.local/share/cursor-agent`. The sandbox therefore denied traversal
and execution with exit 126.

After adding `~/.local/share/cursor-agent` to Safehouse's read-only allow-list:

- direct `~/.local/bin/agent --version` succeeded with `2026.07.08-0c04a8a`;
- an `interactive_shell` dispatch of the same command completed successfully with
  exit 0; and
- pi-interactive-shell's Cursor adapter was confirmed to map
  `spawn: { agent: "cursor" }` to `agent --model composer-2-fast`.

## Forward implication

Cursor is now a supported automatable comparison target in this environment. Future
campaigns should attempt it normally. The skipped status and two-lane judgments in
this historical bundle remain unchanged.

Recorded after campaign completion and before the next campaign.
