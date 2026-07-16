# Addendum 02 — attempt claude-c2 (deviation record)

The manifest is immutable; this addendum names the deviation per its own rule.

- **Deviation:** the Claude Code lane gets a second attempt, `claude-c2`, after
  attempt `claude-c1` failed at launch (exit 126: cmux CLI shim on PATH intercepted
  `claude` and its wrapper was not executable in the overlay spawn context — see
  `claude-c1/validity-note.md`). No target interaction, mission delivery, or reveal
  occurred in `claude-c1`; it is retained in full.
- **Unchanged:** mission `fictional-library-lockers-v1` verbatim, matched budgets
  (3 questions / 8 turns / 20 min / 1 intervention), frozen reveal policy and key,
  acquisition rule (Claude authors `locker-pickup-spec.md` in its target cwd),
  validity rules, target cwd `<ephemeral-workspace>` (untouched — the target
  never started, so it is not contaminated).
- **Changed:** launch mechanism only — `interactive_shell` plain command with the
  explicit real binary path (`~/.local/bin/claude`, v2.1.211) instead of the
  `spawn: { agent: "claude" }` seam, bypassing the broken cmux shim. Hands-free
  overlay settings identical (quietThreshold 3000 / updateInterval 30000 /
  autoExitOnQuiet false).
- **Cross-lane fairness:** the reveal-count treatment adopted in
  `brunch-b2/validity-note.md` applies — a grounding question matching multiple
  reveal conditions receives all matched facts in one response.
- **Why this is not a selective rerun:** the target never ran; there is no outcome
  to shop against. The failed launch stays visible in scratch and in any promoted
  bundle.

Declared 2026-07-16T18:34Z, before `claude-c2` launch.
