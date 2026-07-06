# Stack review: local hygiene comments

Frontier: n/a
Status:   active
Mode:     slices
Created:  2026-07-06

## Orientation

- Containing concern: open PR-review hygiene comments from #290/#291 that do not justify a generative audit.
- Current branch: `ln/fe-1152-refinements` stack tip; `memory/PLAN.md` duplicate `capture-ingest-throughline` block from PR #291 is already absent on the current top branch and should remain a no-op unless it reappears.
- Posture: earned/local hardening; these are tiny clarity and drift repairs inside settled docs/tests.
- Main risk: widening a local cleanup into unrelated doc/test rewrites. Do only the named comments.

## Card 1 — align topology sketch with runtime directory contents

Status: done
Weight: light

### Objective

Make `src/agents/runtime/TOPOLOGY.md` accurately sketch the runtime subtree it owns.

### Light-card cold-start reads

- `memory/SPEC.md` — D40-L, D52-L, D98-L.
- `memory/PLAN.md` — `execute-entry-readiness` runtime authority notes.
- `src/agents/runtime/TOPOLOGY.md` — current sketch.

### Acceptance Criteria

✓ `src/agents/runtime/TOPOLOGY.md` mentions `elicitor/__tests__/` and `elicitor/__snapshots__/` (or otherwise truthfully represents them), resolving the sibling asymmetry in one consistent direction — the sketch currently expands `executor/__tests__/` while collapsing `elicitor/`, which has the larger subtree.
✓ The sketch still stays short and ownership-oriented; no rationale duplication from SPEC/PLAN.

### Verification Approach

- Inner: read-only path check by reviewer / `npm run check:markdown-links` if markdown links are touched.
- Gate: `npm run fix`; `npm run verify` before commit.

### Cross-cutting obligations

- Topology files own current materialized state, not decision rationale.

### Assumption dependency

None.

### Expected touched paths (tentative)

```pseudo
src/agents/runtime/TOPOLOGY.md ~
```

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Card 2 — make capture-contract test wording and file I/O honest

Status: next
Weight: light

### Objective

Make the FE-1135 proof test comments and RPC receipt assertion mechanics match what the tests actually do.

### Light-card cold-start reads

- `memory/SPEC.md` — I57-L and structured-exchange capture contract notes.
- `memory/PLAN.md` — `exchange-capture-contract` closure notes.
- `src/probes/__tests__/exchange-capture-contract-proof.test.ts` — marker phrase oracle.
- `src/rpc/__tests__/handlers.test.ts` — review approval receipt assertion.

### Acceptance Criteria

✓ `exchange-capture-contract-proof.test.ts` comment acknowledges exact marker phrases are pinned, or the assertions are deliberately made flexible — covering both `it` blocks (the second also pins exact phrases, including a full sentence, under the same file comment).
✓ `handlers.test.ts` reads the session file once for the adjacent `request_review` and `requirement-draft → REQ1` assertions (lines 1349-1350; the only true duplicate — other paired reads are before/after comparisons, leave them).
✓ `memory/PLAN.md` remains free of duplicate `capture-ingest-throughline` headings; no edit needed if already true.

### Verification Approach

- Inner: focused test run for the touched test files if cheap, otherwise `npm run fix`.
- Gate: `npm run verify` before commit.

### Cross-cutting obligations

- Do not turn this into a broad prose-sentinel audit; the wider oracle concerns are scoped in `memory/cards/dev--stack-review-exchange-contracts.md`.

### Assumption dependency

None.

### Expected touched paths (tentative)

```pseudo
src/probes/__tests__/exchange-capture-contract-proof.test.ts ~
src/rpc/__tests__/handlers.test.ts                         ~
memory/PLAN.md                                             ?  # only if duplicate block reappears
```

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?
