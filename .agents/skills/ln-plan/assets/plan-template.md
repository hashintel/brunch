<!-- PLAN.md — single source of truth for WHAT'S NEXT.
     Created by ln-plan · Read by all skills · Updated by ln-build, ln-sync, and ln-spike.
     Authority: active frontier, near-horizon ordering, and dependencies that still matter.

     Frontier item = canonical plan/Linear/branch unit.
     Slice = scoped execution unit from ln-scope/ln-build, often inside one frontier.

     Keep this file light. Archive older completed work to docs/archive/PLAN_HISTORY.md.
     Edit Sequencing for ordering/status churn; keep Frontier Definitions relatively stable.
     Do not spread retired work history across handoff files, refactor plans, or ad hoc status notes. -->

# Plan

## Context

[Short rolling narrative for fresh-thread re-entry: where the product/initiative stands, which arc is active, and what the next coordination bottleneck is.]

## Sequencing

### Active

1. `[frontier-id]` — [status: not-started|in-progress|branch-complete|blocked] — [one-line current state]

### Next

1. `[frontier-id]` — [why it follows the active work]

### Parallel / Low-conflict

- `[frontier-id]` — [why it can proceed independently]

### Horizon

- `[frontier-id]` — [future item, intentionally loose]

## Frontier Definitions

### frontier-id

- **Name:** [Human-readable frontier name]
- **Linear:** [FE-XXX if known, or `unassigned`]
- **Kind:** [structural | bounded feature | hardening | bugfix | refactor]
- **Status:** [not-started | in-progress | branch-complete | blocked | done]
- **Objective:** [what this frontier changes]
- **Why now / unlocks:** [why this belongs on the frontier and what it unlocks]
- **Acceptance:** [observable frontier-level outcome]
- **Verification:** [inner / middle / outer summary]
- **Cross-cutting obligations:** [optional: subsystem / invariant / verification-layer obligations this frontier must preserve or establish]
- **Traceability:** [→ SPEC.md requirement / assumption / decision / invariant if needed]
- **Design docs:** [links if relevant]
- **Current execution pointer:** [optional: active scope file path(s) under `memory/cards/` for this frontier — list all active; omit when not needed]

## Recently Completed

- [YYYY-MM-DD] `[frontier-id]` — Done: [shipped outcome]. Verified: [command / manual step]. Watch: [residual risk or none].
- [YYYY-MM-DD] `[frontier-id]` — Done: [shipped outcome]. Verified: [command / manual step]. Watch: [residual risk or none].

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
[ASCII diagram of blocking relationships among Active / Next frontier ids]
```
