# Standalone-web reload and cleanup repair

Frontier: post-hardening-alpha-validation
Status:   active
Mode:     slices
Created:  2026-08-11

## Orientation

- The containing seam is the production standalone-web session route, canonical JSONL projection, and per-target writer lifecycle.
- FE-1348's `Standalone-web driven session` row produced a real provider/browser witness but remains `partial` on SW1.
- The retained workbench is evidence, not a repair target; rerun from a fresh row-owned target after both fixes.
- Main risk: weakening fail-closed projection or writer exclusion to make the walkthrough green.

Posture: proving (inherited from `post-hardening-alpha-validation`).

Cross-cutting obligations:

- Canonical Pi JSONL remains session truth; React and RPC remain projections.
- Malformed structured-exchange details fail closed.
- Per-target writer authority remains fail-closed and releases only for the runtime that owns it.

## Card 1 — project non-exchange tool validation failures

Status: `done`

### Objective

A standalone-web reload projects the valid active-branch transcript even when the provider previously emitted an `ask` invocation rejected by tool-input validation.

### Light-card cold-start reads

- `memory/SPEC.md` — D141-L; I64-L, I65-L
- `memory/PLAN.md` — frontier: `post-hardening-alpha-validation`
- `src/app/TOPOLOGY.md` — standalone-web runtime composition
- `src/rpc/TOPOLOGY.md` — hosted-session projection contract
- `TESTING_FINDINGS.md` — SW1
- `testing/walkthroughs/2026-08-10/standalone-web-driven-session.md` — retained failing evidence

### Acceptance Criteria

- ✓ `src/projections/session/__tests__/session-presentation.test.ts` — an active-branch `ask` tool result with `status: validation_failed` is treated as a failed tool invocation, not a malformed structured exchange, and surrounding valid entries still project `ready`.
- ✓ `src/projections/session/__tests__/session-presentation.test.ts` — malformed details that claim a structured-exchange terminal still return `malformed_detail`.
- ✓ `src/web/__tests__/session-route.test.tsx` or the existing real-entry route oracle — the repaired projection no longer collapses the route to `Session transcript cannot be displayed.`

### Verification Approach

- Inner: focused session-presentation tests pin classification.
- Middle: focused session-route or standalone real-entry test pins reload-visible behavior.
- Outer: FE-1348 reruns the real-browser row after Card 2.

### Cross-cutting obligations

- Do not ignore arbitrary malformed `ask` details; exempt only the already-classified tool-input validation failure shape.
- Do not add an alternate transcript store or browser-only recovery path.

### Assumption dependency

None.

### Expected touched paths (tentative)

```tree
src/projections/session/
├── session-presentation.ts                          ~
└── __tests__/session-presentation.test.ts           ~
src/web/__tests__/session-route.test.tsx             ?
```

### Completion evidence

Root cause: `projectSessionPresentation` treated every `ask` result that failed the structured-terminal
schemas as malformed. The provider-facing `ask` tool's strict input validator intentionally emits a distinct
`{status: "validation_failed", tool: "ask", diagnostics}` failure envelope, so one rejected invocation
collapsed the whole otherwise-valid transcript projection on reload.

Red:

- `npx vitest --run src/projections/session/__tests__/session-presentation.test.ts` — 1 failed / 12 passed;
  the new regression received `malformed_detail` for `invalid-ask` instead of `ready`.

Green:

- `npx vitest --run src/projections/session/__tests__/session-presentation.test.ts src/web/__tests__/session-route.test.tsx`
  — 2 files passed, 40 tests passed.

| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| Validation-failed `ask` does not collapse valid surrounding transcript | met | `ignores an ask input-validation failure without collapsing surrounding transcript projection` |
| Malformed structured-exchange terminals remain fail-closed | met | `classifies malformed review-set offers and terminals instead of leaking them`; `classifies malformed Brunch ask details instead of leaking them` |
| Repaired ready projection remains renderable rather than showing the transcript error | met | focused `session-route.test.tsx` suite, including durable hydration/recovery, passed |
| Exemption is limited to the canonical validation-failure envelope | met | production guard requires exact top-level keys, `status`, `tool`, and string diagnostic fields; existing arbitrary-malformed tests remain green |
| No alternate store or browser-only recovery path | met | change is confined to the shared JSONL presentation projection |

Skipped-test-count delta versus parent: `0` (one active regression added; no tests skipped, parked, or
narrowed).

Divergence: `src/web/__tests__/session-route.test.tsx` needed no edit; its existing ready/error route coverage
passed against the repaired projection contract. Outer real-browser rerun remains intentionally owned after
Card 2.

Canonical reconciliation: no SPEC, PLAN, or topology update is warranted; this repair preserves the existing
D141-L/I65-L projection seam and changes no boundary, design decision, invariant, or directory topology.

## Card 2 — close standalone host on termination signals

Status: `next`

### Objective

A source or packaged standalone-web process receiving a bounded termination signal closes its host and releases every owned writer before exiting.

### Light-card cold-start reads

- `memory/SPEC.md` — D141-L; I64-L, I65-L
- `memory/PLAN.md` — frontier: `post-hardening-alpha-validation`
- `src/app/TOPOLOGY.md` — TUI and standalone-web lifecycle ownership
- `TESTING_FINDINGS.md` — SW1
- `testing/walkthroughs/2026-08-10/standalone-web-driven-session.md` — retained stale-owner evidence

### Acceptance Criteria

- ✓ focused app process-lifecycle test — after standalone web opens a target, `SIGTERM` closes the listener and removes that target's writer owner before process exit.
- ✓ focused app lifecycle test — repeated or concurrent shutdown requests are idempotent and do not release another runtime's authority.
- ✓ existing `src/app/brunch-web.test.ts` and authority slow test — graceful close ordering, disposal-failure fail-closed behavior, and TUI writer transfer remain green.

### Verification Approach

- Inner: process-level signal regression using a fresh temporary workspace and real source web entry point.
- Middle: existing standalone host and authority suites preserve close ordering and exclusion.
- Outer: FE-1348 reruns the same agent-browser journey from a fresh row-owned target and verifies reload plus cleanup without manual repair.

### Cross-cutting obligations

- Signal cleanup must await the production host close path; do not delete lock files independently of runtime disposal.
- `SIGKILL` remains outside the graceful-cleanup claim.

### Assumption dependency

None.

### Expected touched paths (tentative)

```tree
src/app/
├── brunch.ts                                        ~
├── brunch-web.ts                                    ?
└── __tests__/                                       ~
```
