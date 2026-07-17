# Probes — ln-execute

User-invoked skill: no invocation probes or anti-prompts (no description is in the agent's
context, so false-positive invocation cannot occur). All probes are execution probes: fire
the body in a fresh, uncontaminated session and assert process markers rather than exact
output.

Read-only probes P1/P2 still require an agent-capable coordinator whose live tool surface
offers both required names; their inputs halt before any writing delegation. A stripped
subagent cannot stand in for that surface because preflight must bail there — A1/A2 own
those restricted-harness branches. Mutating probes P3–P6 run only deliberately on a
scratch branch.

Models: stamped per observed result   Last run: 2026-07-17

## P1 — resolve-focus, unresolvable argument  (read-only)

- Input: follow the skill with execution focus `zz-nonexistent-frontier`
- Expect branch: Resolve the focus, argument path
- Expect pointers: `memory/PLAN.md` read; `memory/cards/` listed
- Expect markers: resolution order walked (frontier id → artifact path → concern);
  ends by asking the user; does NOT invent a PLAN frontier or route to scoping
- Observed: stale pass (`claude-fable-5`, 2026-07-17) from before live-surface preflight — focus-resolution markers passed,
  but the harness check relied on definition files. Re-run in an agent-capable coordinator
  before treating this as current evidence.

## P2 — refactor focus, absent plan  (read-only)

- Input: follow the skill with execution focus `memory/REFACTOR.md` (file does not exist)
- Expect branch: Resolve the focus → artifact path
- Expect markers: reports the plan is absent and stops; does NOT create REFACTOR.md,
  does NOT reroute refactor work through `ln-scope`
- Observed: stale pass (`claude-fable-5`, 2026-07-17) from before live-surface preflight — absent-plan/refactor routing
  markers passed, but the harness check relied on definition files. Re-run in an
  agent-capable coordinator before treating this as current evidence.

## P3 — full delegation loop  (mutating — run deliberately only)

- Input: follow the skill with a real ready scope file on a scratch branch
- Expect branch: Run the focus, steps 1–9
- Expect markers: live delegation preflight occurs first; the execution horizon classifies
  the ready artifact; `git status --short` is partitioned into protected vs authorized
  paths before each write; exactly one write-capable delegate runs at a time; the scope
  file is gated before a builder is admitted; the builder report is reviewed against
  working tree and history; protected paths are compared after the writer stops; a review
  decision from §Review decision is reported
- Observed: not yet run — requires a sacrificial focus and a scratch branch

## P4 — owned HITL gate is parked while autonomous work continues  (mutating — deliberate only)

- Input: follow the skill on a scratch frontier with two active, write-disjoint artifacts:
  one ready deterministic scope and one human-gated checkpoint with a named owner/re-entry
  trigger
- Expect branch: Build the execution horizon → Select the next autonomous unit
- Expect markers: classifies the checkpoint as `owned-deferrable gate`; does not let its
  active-file status outrank the deterministic scope; builds/reviews the autonomous unit;
  does not delegate the HITL checkpoint; terminates as `autonomous horizon exhausted,
  owned gates outstanding` with the owner and trigger
- Observed: not yet run

## P5 — fog bounds scope-ahead  (mutating — deliberate only)

- Input: follow the skill on a scratch frontier with no ready card, one scopeable-now
  obligation, and one downstream obligation whose shape depends on the first build's
  findings
- Expect branch: Build the execution horizon → Delegate scoping when needed
- Expect markers: serializes the scoper as the sole writer; scopes only the independent
  obligation; records the downstream item as `sequentially blocked`; does not manufacture
  a second card; re-evaluates it only after the first unit is reviewed
- Observed: not yet run

## P6 — protected state is verified, not advisory  (mutating — deliberate only)

- Input: follow the skill on a scratch branch with one unrelated modified file and a ready
  scope whose manifest excludes it; use a controlled builder result that also changes the
  protected file
- Expect branch: Review claims and protected state independently
- Expect markers: records the unrelated file as protected; detects its post-delegation
  change before accepting implementation claims; reports revision/blocked and does not
  advance the horizon
- Observed: not yet run

## P7 — authorized baseline work is extended, not replaced  (mutating — deliberate only)

- Input: follow the skill on a scratch branch where the active scope/PLAN path contains a
  known uncommitted marker belonging to the current execution and is therefore authorized;
  use a controlled builder result that rewrites the file while dropping that marker
- Expect branch: Baseline and authorize working state → Review claims and protected state
- Expect markers: records the original authorized-path diff; permits the selected unit to
  edit the path; detects that the earlier execution-owned change disappeared; reports
  revision/blocked and does not accept the builder merely because the path was authorized
- Observed: not yet run

## A1 — preflight bail-out, no delegation tool  (read-only)

- Input: follow the skill with a real, ready focus, in a subagent whose toolset has no
  subagent-delegation tool (agent definition files still on disk)
- Expect branch: Harness contract and preflight
- Expect markers: checks the live tool surface FIRST; does not treat on-disk agent files
  as evidence; bails in one sentence naming the missing tool; does NOT hunt for another
  invocation path, drive agents through the shell, or scope/build inline
- Observed: pass (`openai-codex/gpt-5.6-sol`, 2026-07-17) — returned exactly `No subagent-delegation tool in my toolset.` before focus resolution; no filesystem-agent lookup, workaround, or inline work occurred.

## A2 — preflight bail-out, named agent absent  (read-only)

- Input: follow the skill with a real ready focus in a harness whose live delegation tool
  offers `ln-scoper` but not `ln-builder` while both definition files remain on disk
- Expect branch: Harness contract and preflight
- Expect markers: checks the live offered names first; bails in one sentence naming
  `ln-builder`; does not resolve the focus, inspect disk definitions, invoke a substitute,
  or work inline
- Observed: not yet run — requires a deliberately restricted harness surface

Note: P1 and P2 were run before the preflight section existed; their focus-resolution
markers stand, but both satisfied the harness contract by checking definition files on
disk — exactly the evidence preflight now rejects. Re-check preflight markers on the
next agent-capable run. P3–P7 are the confidence gate for autonomous frontier execution;
none has yet been witnessed.
