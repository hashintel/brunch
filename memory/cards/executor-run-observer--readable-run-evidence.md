# Executor Run Observer Readable Evidence

Frontier: executor-run-observer
Status:   done
Mode:     slices
Created:  2026-07-07

## Orientation

- Containing seam: executor run observation over `execute.run` projections and the web `/runs/$runId` route.
- Relevant frontier item: `executor-run-observer` (FE-1141). The original run observer is code-complete, but live walkthrough evidence showed the log/evidence surface is too raw to diagnose a failed run.
- Volatile handoff state: `executor-replanning--web-inspect-metadata.md` overlaps this UI surface and is superseded by this broader card; do not build both separately.
- Main open risk: the current projection may not expose enough graph handles for node-level backlinks without widening `execute.run` or adding a small run-index projection.

Posture: proving (inherited from executor-run-observer)

## Sequence Discipline

This file is a short sequence because both slices stay inside the run-observer frontier, are independently testable, and do not depend on implementation discoveries from each other. Stop after slice 1 if the stream normalization needs a new artifact schema rather than a web/projection presentation layer.

## Cross-cutting obligations

- Preserve web observer read-only authority: no run control, retry, promotion acceptance, or graph mutation from these UI affordances.
- Preserve the `execute.*` projection firewall: the browser renders product-shaped projections, not `.brunch/cook/runs/**` file paths or raw artifact schemas as navigation contracts.
- Preserve executor core purity: any new shaping belongs in `observer-read.ts` / RPC / web, not in lifecycle side-effect helpers unless the artifact writer already owns that fact.
- Keep raw evidence available behind disclosure controls; readability must not hide failures or invent progress.

---

## Slice 1 — Readable Run Evidence Panels

Status: done

### Target Behavior

`/runs/$runId` presents worker, verify, and lifecycle evidence as compact diagnostic panels with deduplicated readable logs and failure-first verify output.

### Full-card cold-start reads

- `memory/SPEC.md` — D23-L, D84-L, D112-L, I58-L; §Verification Policy; §Design Notes projection-handler discipline.
- `memory/PLAN.md` — frontier: `executor-run-observer`; note the `web-driver-streaming` boundary for live streaming vs read projection.
- `src/executor/TOPOLOGY.md` — `observer-read.ts`, stream artifacts, run lifecycle helpers, executor purity boundary.
- `src/rpc/TOPOLOGY.md` — public RPC read projection boundary and `execute.run` surface.
- `src/web/TOPOLOGY.md` — web read-only/query ownership and `/runs/$runId` route ownership.

### Boundary Crossings

```text
.brunch/cook/runs/** reports + stream artifacts
→ src/executor/observer-read.ts projection
→ rpc execute.run schema
→ web query cache
→ /runs/$runId evidence panels
```

### Risks and Assumptions

- RISK: collapsing worker stream deltas could hide important partial output. → MITIGATION: collapse only consecutive exact duplicates and obvious prefix-growth supersession, and keep raw expanded rows available.
- RISK: stripping ANSI could remove useful pass/fail signal. → MITIGATION: preserve semantic channel (`stdout` / `stderr` / `status`) and add failure-first summary from stderr/final verify status.
- ASSUMPTION: presentation-layer normalization is sufficient; stream artifact format does not need to change.
    → IMPACT IF FALSE: this slice becomes a projection-shape change and should stop before widening artifact writers.
    → VALIDATE: route tests use existing `agentStreamTail` / `verifyStreamTail` shapes and prove the UI output is readable.

### Posture check

This is a proving tracer because it turns the built run-observer substrate into usable evidence: a failed executor run should explain itself without requiring a human to inspect raw JSONL or ANSI dumps.

### Acceptance Criteria

✓ Web route test — consecutive duplicate worker messages render once with a repeat count and raw rows remain expandable.
✓ Web route test — incremental worker message fragments render as the final useful message instead of dozens of prefixes.
✓ Web route test — verify stdout/stderr ANSI escape codes are not displayed literally.
✓ Web route test — stderr failure excerpts render before noisy passing stdout lines.
✓ Web route test — lifecycle reports are grouped by slice with `started → agent → verify → completed` style progression while raw events remain accessible.

### Verification Approach

- Inner: focused `src/web/__tests__/runs-route.test.tsx` cases over fixture-shaped run detail objects.
- Middle: `src/rpc/methods/__tests__/execute.test.ts` only if projection shaping moves out of the web component.
- Gate: `npm run fix`; targeted route/RPC tests; `npm run verify` before commit unless unrelated environment failures block.

### Build Note

Implemented 2026-07-07 in `src/web/routes/runs.tsx` with presentation-layer normalization only: duplicate/prefix stream compaction, ANSI stripping, verify failure summary, raw stream disclosure, and grouped lifecycle progression. Verification: `npm run test -- src/web/__tests__/runs-route.test.tsx`; `npm run fix`.

### Expected touched paths (tentative)

```text
src/web/
├── routes/runs.tsx                 ~ evidence panel rendering, grouping, raw details
├── __tests__/runs-route.test.tsx   ~ readability and failure-first assertions
└── TOPOLOGY.md                     ~ update route ownership note if panel semantics move
src/executor/
├── observer-read.ts                ? only if stream tails need derived display fields
└── __tests__/observer-read.test.ts ? only if projection shaping moves here
src/rpc/
├── methods/execute.ts              ? only if RPC schema adds shaped evidence fields
└── methods/__tests__/execute.test.ts ? matching schema/projection tests
```

---

## Slice 2 — Graph Run Traceability Links

Status: done

### Target Behavior

The graph/spec view and run-detail view cross-link executable graph nodes to the runs, slices, requirements, and criteria that exercised them.

### Full-card cold-start reads

- `memory/SPEC.md` — D56-L, D72-L, D84-L, D98-L, D100-L, D103-L, D112-L; I35-L, I58-L.
- `memory/PLAN.md` — frontier: `executor-run-observer`; context from `executor-replanning` only for supersession/abandonment metadata, not mutation actions.
- `src/graph/TOPOLOGY.md` — graph read projection boundaries and node-code semantics.
- `src/executor/TOPOLOGY.md` — run observer projection and plan `derived_from` mapping.
- `src/rpc/TOPOLOGY.md` — named product projection rule; avoid a generic run records API.
- `src/web/TOPOLOGY.md` — graph view and run route ownership.

### Boundary Crossings

```text
run plan derived_from / criterion verifies / reports verdicts
→ execute.run / execute.runs product projection
→ web run detail requirements panel
→ web graph structured list node cards
→ route links between /spec/$specId and /runs/$runId
```

### Risks and Assumptions

- RISK: loading every run in the graph view could be slow or noisy. → MITIGATION: start with a bounded read projection/index from existing run summaries/details; add a dedicated `execute.runTraceIndex` only if tests show graph badges require it.
- RISK: graph node references may drift if only `REQ1` / `AC5` strings are carried. → MITIGATION: prefer explicit node handles in the projection when available; otherwise keep the first slice to stable node-code refs and do not fabricate node ids.
- ASSUMPTION: plan `spec.requirements[].item_id`, `spec.criteria[].verifies`, and slice `derived_from` are sufficient for initial requirement/criterion traceability.
    → IMPACT IF FALSE: graph badges may need provenance added at plan projection time, not just observer reads.
    → VALIDATE: fixture-shaped run projection maps `REQ*` and `AC*` nodes to slice/run links in web tests.

### Posture check

This is a proving tracer because it closes the evidence loop the run observer opened: a user can start from graph intent and see whether it executed, or start from a failed run and jump back to the graph node whose requirement/criterion produced that evidence.

### Acceptance Criteria

✓ Projection/RPC test — run detail exposes requirement/criterion trace fields without exposing raw artifact file shape.
✓ Web route test — `/runs/$runId` requirement rows show status, mapped slices, criteria chips, `view in graph`, and `view slice log` affordances.
✓ Web route test — replanning lineage fields already scoped by `executor-replanning--web-inspect-metadata.md` are rendered in the run list/detail when present, or explicitly left absent without breaking existing rows.
✓ Graph route/component test — executable graph nodes (`REQ*`, `AC*`) show compact run badges such as `latest failed`, `task-8 failed`, or `2 runs` when run evidence exists.
✓ Graph route/component test — run badges link to `/runs/$runId` focused enough for the user to find the mapped requirement/slice.

### Verification Approach

- Inner: focused projection tests for trace mapping and focused web tests with synthetic run+graph fixtures.
- Middle: route integration test through `BrunchWebApp` proving `/spec/$specId` and `/runs/$runId` can both render the same trace facts.
- Outer: manual browser walkthrough against a failed `cook-layered-todo` run, confirming graph node → run evidence → raw log path is understandable.

### Build Note

Implemented 2026-07-07 with `execute.runTraceIndex`, graph-node run badges, and run-detail backlinks to `/spec/$specId` plus slice-log anchors. Verification: `npm run test -- src/rpc/methods/__tests__/execute.test.ts`; `npm run test -- src/web/__tests__/runs-route.test.tsx src/web/__tests__/app.test.tsx`.

### Expected touched paths (tentative)

```text
src/executor/
├── observer-read.ts                  ~ trace fields / run evidence index if needed
└── __tests__/observer-read.test.ts    ~ trace mapping coverage
src/rpc/
├── methods/execute.ts                ~ schema if trace fields are added
└── methods/__tests__/execute.test.ts  ~ projection contract
src/web/
├── query-keys.ts                      ? only if a new run-trace query is added
├── queries/execute.ts                 ? only if a new run-trace query is added
├── routes/runs.tsx                    ~ run-detail backlinks and lineage rows
├── routes/spec.tsx                    ? pass run trace projection into graph view
├── features/graph/structured-list-view.tsx ~ node run badges
├── components/node-card.tsx           ? reusable run/trace badge primitive
├── __tests__/runs-route.test.tsx      ~ run detail traceability
└── __tests__/graph-route.test.tsx     ? graph badge/link coverage if existing route tests live elsewhere
src/web/TOPOLOGY.md                    ~ document graph/run traceability surface
src/rpc/TOPOLOGY.md                    ~ document any new read projection, if added
```

## Routing

Recommended next command: `ln-build memory/cards/executor-run-observer--readable-run-evidence.md`.
