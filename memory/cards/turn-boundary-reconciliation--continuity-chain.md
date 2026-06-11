# Turn-Boundary Reconciliation Closure

Frontier: turn-boundary-reconciliation
Status:   active
Mode:     chain
Created:  2026-06-11

## Orientation

- Seam: FE-847 Tier-2 turn-boundary reconciliation over real boot/resume; the domain helpers exist, but the frontier still closes through skipped scaffold rows in `src/dev/tier-2-harness.test.ts`.
- Frontier: `turn-boundary-reconciliation`; assistant-visible watermark projection, `prepareNextTurn`, and mention-ledger mechanics landed, but the frontier is not done until Tier-2 and compaction invariants replace the scaffold.
- Volatile state: unit tests in `src/projections/session/assistant-visible-watermark.test.ts`, `src/session/prepare-next-turn.test.ts`, and `src/session/mention-ledger.test.ts` already prove local logic; the missing proof is end-to-end ownership through the real runtime and resume seams.
- Main risk: closing I45/I47 may require evolving the Tier-2 harness and compaction anchor contract, not merely unskipping tests; keep the one-writer seam intact and do not reintroduce ad hoc continuity insertion points.
- Cross-cutting obligations: `prepareNextTurn` stays the single continuity writer, `before_provider_request` stays a guard only, continuity facts remain Brunch custom entries, watermark comparisons stay `{specId, lsn}` only, and the latest watermark carrier must survive compaction/resume.
- Posture: proving (inherited from `turn-boundary-reconciliation`)
- 2026-06-11 ln-induct fold (PR #201/#202 review comments, user-routed to this branch): the live pipeline currently diverges from the tested helpers at three points — `registerBrunchContinuityGuard` plain-throws instead of delegating to `guardBeforeProviderRequest` (D77-L append-once-then-retry), and `prepareNextTurnForGraph` passes neither `mentions` nor `drains`, so staleness hints and drain delivery are dead live. Cards 1 and 2 below now name these explicitly; they were already implicitly required by the "prove through the real path" acceptance.

## Card 1 - Flip the I45 watermark/world-update scaffold live through Tier-2

Status: done (2026-06-11)

### Objective

The real Tier-2 boot/resume harness proves assistant-visible watermark and `worldUpdate` behavior across seed, overview, foreign-write, and same-session-capture cases by replacing the skipped I45 scaffold rows with live assertions.

### Light-card cold-start reads

- `memory/SPEC.md` — D76-L, D77-L, I4-L, I45-L, I47-L
- `memory/PLAN.md` — frontier: `turn-boundary-reconciliation` (definition + Context §Turn-boundary choreography carry the scaffold edge-case list)
- `src/dev/README.md` — Tier-2 harness ownership ledger
- `src/session/README.md` — turn-boundary choreography seam ownership
- `src/projections/README.md` — assistant-visible-watermark row and continuity classifier ownership

### Acceptance Criteria

✓ The skipped Tier-2 rows for seed/full-overview carriers vs narrow reads, strict-greater `worldUpdate`, same-session capture surfacing, and foreign-write-during-seed all run live against the real boot/resume harness.

✓ The proof uses `{specId, lsn}` and set semantics, not payload-order goldens or bare-LSN comparisons.

✓ Any helper or lower-fidelity test kept after this slice still proves a local derivation unavailable from Tier-2; duplicate wiring-only proof is retired.

✓ The live `before_provider_request` hook delegates to `guardBeforeProviderRequest` (append-once-then-retry per D77-L); a raised error remains only for drift that survives the single retry, and the Tier-2 proof covers the recoverable-drift path, not just the clean path.

### Verification Approach

- Inner: retain focused unit/property tests for projection and `prepareNextTurn` local semantics.
- Middle: flip the corresponding `src/dev/tier-2-harness.test.ts` I45 scaffold rows live through real boot/resume fixtures.

### Cross-cutting obligations

- Do not move watermark truth into stored mutable state.
- Same-session submit/capture writes must still surface by `worldUpdate` when they were not already assistant-visible.
- If the Tier-2 harness needs new helpers, keep them runtime-facing and delete-oriented rather than adding a parallel faux path.

### Assumption dependency

None — this slice is itself the frontier-closing proof for the remaining I45-L uncertainty.

### Expected touched paths (tentative)

```text
src/dev/
├── tier-2-harness.ts ~
└── tier-2-harness.test.ts ~
src/session/
├── prepare-next-turn.ts ?
└── prepare-next-turn.test.ts ?
src/projections/session/
├── assistant-visible-watermark.ts ?
└── assistant-visible-watermark.test.ts ?
src/.pi/
├── brunch-pi-extensions.ts ?
└── extensions/session/lifecycle.ts ?
```

## Card 2 - Prove mention resolution and staleness through the real submit path

### Objective

Submitting a user message through the real session path appends stable-id `brunch.mention` facts at submit time and surfaces only genuinely stale mentions at the next turn boundary.

### Light-card cold-start reads

- `memory/SPEC.md` — D14-L, D49-L, D77-L, I9-L, I45-L
- `memory/PLAN.md` — frontier: `turn-boundary-reconciliation`
- `src/session/README.md` — mention-ledger / turn-boundary ownership
- `src/rpc/README.md` — `session.submitMessage` ownership and transcript effects

### Acceptance Criteria

✓ A real submit path appends `brunch.mention` facts from stable graph ids at submit time, not autocomplete time or later reconciliation.

✓ The next turn boundary emits `brunch.mention_staleness_hint` only for entities whose current LSN exceeds the stored `seen_lsn`.

✓ The mid-level proof owns this behavior; any older mock-only assertion kept after the slice still proves a narrower local helper rather than the same submit-path wiring.

✓ The live adapter (`prepareNextTurnForGraph` in `src/.pi/brunch-pi-extensions.ts`) threads transcript-projected `mentions` and side-task/reviewer `drains` into `prepareNextTurn` — the staleness and drain seams run in the production pipeline, not only in direct-call tests (closes the dead-seam finding from PR #202).

### Verification Approach

- Inner: keep local mention-ledger tests for parsing and staleness derivation.
- Middle: add a real submit/resume assertion path (Tier-2 or equivalent selected-spec session harness) that proves the ledger append plus next-turn staleness output.

### Cross-cutting obligations

- Mention resolution stays bound to submit-time transcript truth.
- Staleness remains advisory continuity output, not hidden session state.

### Assumption dependency

None.

### Expected touched paths (tentative)

```text
src/dev/
├── tier-2-harness.ts ~
└── tier-2-harness.test.ts ~
src/.pi/
└── brunch-pi-extensions.ts ~
src/rpc/methods/
└── session.ts ?
src/session/
├── mention-ledger.ts ?
└── mention-ledger.test.ts ?
```

## Card 3 - Preserve the latest watermark carrier across compaction and resume

### Objective

Compaction and resume preserve the latest watermark-carrying continuity entry per spec so the projected watermark cannot regress and spuriously re-emit `worldUpdate`.

### Light-card cold-start reads

- `memory/SPEC.md` — D43-L, D76-L, I47-L
- `memory/PLAN.md` — frontier: `turn-boundary-reconciliation`
- `src/.pi/extensions/compaction/index.ts` — current anchor contract
- `src/session/README.md` — turn-boundary choreography seam

### Acceptance Criteria

✓ The compaction anchor contract explicitly preserves the latest watermark carrier family needed for D76-L projection, not just `worldUpdate` alone.

✓ A compaction-plus-resume proof shows the projected watermark does not regress and no spurious `worldUpdate` is emitted after restart.

✓ The corresponding skipped I47 scaffold row is live after this slice.

### Verification Approach

- Inner: anchor-contract tests or direct unit assertions over carrier selection.
- Middle: resume-through-compaction proof via the Tier-2 harness or a compaction-focused session fixture test.

### Cross-cutting obligations

- Preserve continuity as transcript truth; do not add hidden flags or out-of-band watermark persistence.
- Keep the preserved-carrier rule spec-local.

### Assumption dependency

None.

### Expected touched paths (tentative)

```text
src/.pi/extensions/compaction/
└── index.ts ~
src/dev/
└── tier-2-harness.test.ts ~
src/session/
└── jsonl-session-viability.test.ts ?
```
