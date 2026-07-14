# Review-cycle proof ask-cutover closure

Frontier: walkthrough-remediation-2
Status:   active
Mode:     slices
Created:  2026-07-14

## Orientation

- **Containing seam:** the `project-graph-review-cycle` probe’s transcript-derived evidence report and its deterministic fixture builders.
- **Frontier:** `walkthrough-remediation-2` (FE-1187 / PR #326) — the ask-only terminal cutover is part of the active `request_*` lexicon-remediation row; this file closes review residue discovered on that cutover.
- **Posture:** proving (inherited from `walkthrough-remediation-2`) — these slices stabilize the deterministic probe oracle rather than introducing a new interaction shape.
- **Main open risk:** `ask` is now a generic carrier, so a mechanically complete rename can still make review-cycle evidence semantically broader than the review flow it claims to witness.

The two cards overlap in the probe test file and are therefore sequential: restore a compiling ask-only fixture first, then discriminate review-terminal evidence.

---

## Card 1 — Complete the review fixture rename — done

### Objective

The project-graph review-cycle probe test suite uses one canonical `askReviewEntry` fixture at every former `request_response` callsite.

### Light-card cold-start reads

```text
- memory/SPEC.md   — D116-L, D123-L; I23-L
- memory/PLAN.md   — frontier: walkthrough-remediation-2
- src/exchanges/schemas/request.ts — canonical request-detail unions
```

### Acceptance Criteria

- ✓ `npm run check` — no duplicate `askReviewEntry` implementation and no unresolved `requestResponseReviewEntry` callsite remains.
- ✓ `src/probes/__tests__/project-graph-review-cycle-proof.test.ts` — the existing review-cycle and scope-handoff cases all run with `ask` toolResult fixtures.

### Verification Approach

- Inner: `npx vitest --run src/probes/__tests__/project-graph-review-cycle-proof.test.ts` — fixture behavior remains green.
- Inner gate: `npm run check` — the type-aware checker proves the rename is complete.
- Outer: none — this is deterministic probe-fixture repair; FE-1187 retains ownership of the existing walkthrough evidence.

### Cross-cutting obligations

- D116-L: `ask` is the only live interactive terminal; preserved `request_*` names remain detail discriminants, not tool names.
- Pre-release/free-rewrite posture: complete the rename directly; add no compatibility helper for the retired fixture name.

### Assumption dependency

None.

### Expected touched paths (tentative)

```text
src/probes/__tests__/
└── project-graph-review-cycle-proof.test.ts  ~
```

---

## Card 2 — Correlate review-terminal evidence — next

### Objective

The project-graph review-cycle report counts only `ask` terminals that carry canonical review details for a matching successful `present_review_set` exchange.

### Light-card cold-start reads

```text
- memory/SPEC.md   — D27-L, D116-L; I15-L, I23-L
- memory/PLAN.md   — frontier: walkthrough-remediation-2
- src/exchanges/schemas/request.ts — zRequestReviewDetails
- src/exchanges/schemas/shared.ts — review tool-meta discriminants
```

### Acceptance Criteria

- ✓ `project-graph-review-cycle-proof.test.ts` — an unrelated standalone `ask` does not increase the review-terminal evidence count.
- ✓ `project-graph-review-cycle-proof.test.ts` — an `ask` with request schema but a non-review `tool_meta` or mismatched `exchange_id` does not count.
- ✓ `project-graph-review-cycle-proof.test.ts` — one canonical `request_review` terminal correlated to its successful `present_review_set` counts exactly once.
- ✓ `project-graph-review-cycle-proof.test.ts` — malformed request details fail classification without throwing or being counted.

### Verification Approach

- Inner: canonical-schema classification tests in `src/probes/__tests__/project-graph-review-cycle-proof.test.ts`.
- Middle: transcript differential fixture — add irrelevant and mismatched asks around the valid tuple and assert the report’s semantic count is unchanged.
- Outer: none — the slice hardens an existing deterministic evidence report.

### Cross-cutting obligations

- The generic request schema alone is not a sufficient discriminator: all ask answer modes share it.
- Correlate on canonical review semantics and exchange provenance; do not fork a second hand-written request-details model in the probe.
- Keep `success` semantics unchanged unless the existing report contract explicitly requires terminal count as a gate; this slice repairs evidence attribution, not the wider proof definition.

### Assumption dependency

None.

### Expected touched paths (tentative)

```text
src/probes/
├── project-graph-review-cycle-proof.ts             ~
└── __tests__/
    └── project-graph-review-cycle-proof.test.ts    ~
```
