# Executor run observer — first tracer sequence

Frontier: executor-run-observer
Status:   active
Mode:     slices
Created:  2026-07-06

Sequence rationale: four commit-sized cards lighting the artifacts → RPC → web path end-to-end.
Card contracts (DTO shape, query keys, topic names) are fixed here at scope time; no card depends
on implementation findings from an earlier card. Posture: proving (inherited from
executor-run-observer) — cards 2+3 are the proof-of-life tracer; cards 1+4 stabilize the seams the
tracer aims from.

Shared contract (fixed at scope time):

- RPC methods: `execute.runs` (list) and `execute.run` (detail), both `access: 'read'`.
- `RunSummary`: `{ runId, specId, status, completedSliceIds?, activeSliceId? }` + presence flags.
- `RunDetail`: `RunSummary` + `{ planPath, reportsTail: RunReportEvent[], reportsTotal }`.
- Presence flags: `{ worktree, reports, petri, promotion }` booleans derived while reading the bundle.
- Query keys: `['execute.runs']`, `['execute.run', runId]`.
- Topics: `execute.runs`, `execute.run` (new `ProductUpdateTopic` members, carry `runId`).
- Display semantics: `reports.jsonl` is progression truth; `run.json` is a lagging snapshot —
  never assert their consistency, render both honestly.

---

## Card 1 — atomic run-metadata write (light) · status: done (2026-07-06)

### Objective

Close the torn-read class at its choke point: `persistRunMetadata` writes temp-file-then-rename, and
`createRun`'s direct `writeFile` folds through it, so any concurrent reader of `run.json` sees a
complete JSON document or the previous one — never a truncated file.

### Light-card cold-start reads

```
- memory/PLAN.md — frontier: executor-run-observer (Spike finding 2026-07-06)
- src/executor/TOPOLOGY.md — run.ts ownership + side-effect discipline
```

### Acceptance Criteria

```
✓ persistRunMetadata writes to a same-directory temp file and renames over run.json
✓ createRun persists metadata via persistRunMetadata (no direct writeFile remains)
✓ no temp-file residue after success or failure; side-effect report unchanged (write_file/overwrite)
✓ existing executor step tests stay green (write ordering within steps unchanged)
```

### Verification Approach

```
- Inner: unit tests on persistRunMetadata (content, rename semantics, no residue)
- Middle: full executor test suite green (npm run verify)
```

### Cross-cutting obligations

- One-explicit-side-effect-per-tool report shape is unchanged — this alters the write mechanics, not the reported effect.

### Assumption dependency

None — spike evidence (2026-07-06) settled the mechanics.

### Expected touched paths (tentative)

```
src/executor/
├── run.ts               ~
└── __tests__/           ~ (persist/create coverage)
```

---

## Card 2 — execute.* run read projections (full) · status: done (2026-07-06)

### Target Behavior

`execute.runs` and `execute.run` RPC methods return tolerant, presence-flagged projections of run
bundles under `.brunch/cook/runs/**` without leaking raw artifact file shapes.

### Full-card cold-start reads

```
- memory/PLAN.md — frontier: executor-run-observer (acceptance + spike finding)
- memory/SPEC.md — D23-L, D84-L, D98-L; one-writer/many-observer POC dashboard corollary
- src/executor/TOPOLOGY.md — bundle layout, path helpers, readRunMetadata precedent
- src/rpc/TOPOLOGY.md — method naming/registration conventions
- memory/cards/executor-run-observer--tracer.md — shared contract block above
```

### Boundary Crossings

```
→ src/rpc/methods/execute.ts (method definitions, thin)
→ src/executor observer-read helpers (bundle fs reads + DTO projection)
→ .brunch/cook/runs/** (read-only)
```

### Risks and Assumptions

```
- RISK: listing cost grows with run count → MITIGATION: readdir + per-run metadata read only;
  ceiling: O(runs) scan per list call, index/cache if run dirs grow past a few hundred
- ASSUMPTION: card 1 landed (atomic run.json writes)
    → IMPACT IF FALSE: naive parse can throw on torn reads
    → VALIDATE: sequence order; reader still treats unparseable run.json as unreadable-run, not a crash
- ASSUMPTION: reports.jsonl lines are single-write complete lines
    → IMPACT IF FALSE: tail parse drops valid events
    → VALIDATE: spike evidence 2026-07-06; partial-tail skip covers the residual window
```

### Posture check

Proving: proof of life for the artifacts→RPC leg; stabilizes the projection firewall seam
(`execute.*` DTOs) that card 3 and all future observer work aim from.

### Acceptance Criteria

```
✓ execute.runs — lists run summaries with presence flags; unreadable run.json yields an
  explicitly-marked unreadable entry, never a thrown error
✓ execute.run — returns RunDetail with reports tail (line-wise parse, partial trailing line
  skipped, tail-limited with reportsTotal)
✓ projection firewall — DTO fields are the shared contract above; no raw artifact pass-through
✓ registry — both methods registered access:'read', discoverable, duplicate-guard green
✓ executor core purity — no rpc/web imports in src/executor; boundary test or lint stays green
```

### Verification Approach

```
- Inner: unit tests over fixture bundles (fresh, mid-crank, torn run.json, partial tail line,
  completed with petri/promotion) proving DTO shape, tolerance, presence flags
- Middle: rpc method registry/discovery test; executor boundary rules
```

### Cross-cutting obligations

- Read-only sidecar: both methods `access: 'read'`.
- Events-lead-metadata: DTO carries both without reconciling them.
- Reports tail-limit from day one (`ceiling:` comment naming the upgrade trigger).

### Expected touched paths (tentative)

```
src/executor/
├── observer-read.ts        +   (bundle → RunSummary/RunDetail projection)
├── __tests__/observer-read.test.ts +
└── TOPOLOGY.md             ~
src/rpc/
├── methods/execute.ts      +
├── methods/__tests__/      ~
├── handlers.ts             ~   (registry assembly)
└── TOPOLOGY.md             ~
```

---

## Card 3 — /runs web routes (full) · status: next

### Target Behavior

The web sidecar renders a runs list at `/runs` and a run detail at `/runs/$runId` (crank position,
slice progression, reports timeline, presence flags, honest "agent running…" / "verify running…"
indicators) from the `execute.*` projections.

### Full-card cold-start reads

```
- memory/PLAN.md — frontier: executor-run-observer (objective + acceptance)
- src/web/TOPOLOGY.md — route/loader/query-key contract, framework rules
- memory/cards/executor-run-observer--tracer.md — shared contract block above
```

### Boundary Crossings

```
→ src/web/routes (TanStack Router loaders)
→ src/web/queries/execute.ts (query options over rpc client)
→ WS /rpc → execute.* methods (card 2)
```

### Risks and Assumptions

```
- RISK: long agent/verify states read as "stuck" → MITIGATION: state-aware indicator copy for
  slice_execution_requested / test-pending states; no fake progress
- ASSUMPTION: card 2's DTO contract is sufficient for the views
    → IMPACT IF FALSE: DTO revision ripples into card 2's tests
    → VALIDATE: contract fixed in the shared block; views render only contract fields
```

### Posture check

Proving: completes the proof-of-life tracer — first end-to-end read path from run bundle to
rendered browser view.

### Acceptance Criteria

```
✓ /runs loader primes ['execute.runs']; renders summaries incl. unreadable-run marking
✓ /runs/$runId loader primes ['execute.run', runId]; renders crank status, slice progression,
  reports timeline, presence flags
✓ long-state honesty — running indicators shown for in-flight states; no invented progress
✓ freshness — refetch on navigation (staleTime 0 per web defaults); no polling loop added
✓ query keys mirror method names exactly (query-key contract in web TOPOLOGY)
```

### Verification Approach

```
- Inner: route/loader tests (loaders call expected queryOptions), component render tests for
  list/detail states incl. unreadable + in-flight fixtures
- Middle: web route cache-ownership tests per src/web TOPOLOGY testing expectations
```

### Cross-cutting obligations

- Read-only: query options only, no mutation hooks.
- Server truth lives in Query cache entries; only transient UI state is local.

### Expected touched paths (tentative)

```
src/web/
├── routes/runs.tsx         +   (list + $runId detail; split per router convention if needed)
├── routes/root.tsx         ~   (nav entry)
├── queries/execute.ts      +
├── query-keys.ts           ~
├── features/runs/          +?  (extract components if routes grow)
└── TOPOLOGY.md             ~
```

---

## Card 4 — run-scoped update topics (full) · status: queued

### Target Behavior

Executor lifecycle state advances publish run-scoped `brunch.updated` topics that invalidate the
exact `execute.*` query keys in attached web clients.

### Full-card cold-start reads

```
- memory/SPEC.md — D84-L (process-local relay/publisher seam)
- src/rpc/product-updates.ts — topic union + publisher contract
- src/web/subscriptions/brunch-updates.ts — notification → invalidation mapping
- src/.pi/extensions/brunch-data/graph/index.ts — publisher-injection precedent
- memory/cards/executor-run-observer--tracer.md — shared contract block above
- docs/praxis/pi-types.md — before typing extension seams
```

### Boundary Crossings

```
→ src/.pi/extensions/agent-runtime/execute-* (publish after tool side effect)
→ src/rpc/product-updates.ts (ProductUpdateTopic union + run-scoped update shape)
→ src/web/subscriptions/brunch-updates.ts (exact-key invalidation)
```

### Risks and Assumptions

```
- RISK: publisher not currently threaded into agent-runtime execute tools → MITIGATION: follow the
  graph/workspace/commands injection precedent; prefer one choke point in the shared execute-tool
  registration over per-tool wiring (exact site is build-time)
- ASSUMPTION: one-writer/many-observer — runs crank in the same host process as the web host
    → IMPACT IF FALSE: updates missed for cross-process cranks
    → VALIDATE: SPEC bans multi-writer per cwd; card 3's refetch-on-navigation is the accepted fallback
```

### Posture check

Proving: stabilizes the run-scoped update seam (topic union + exact invalidation) that later
observer slices (worker tails, streaming) will aim from.

### Acceptance Criteria

```
✓ ProductUpdateTopic union gains execute.runs / execute.run; updates carry runId
✓ each execute_* state-advancing tool publishes after its side effect succeeds (no publish on
  failed/unadvanced steps)
✓ web subscription maps execute.run updates to exact ['execute.run', runId] invalidation and
  execute.runs to the list key; unrelated keys untouched
✓ no publish → no invalidation regression for existing topics (union extension is additive)
```

### Verification Approach

```
- Inner: publisher-call tests at the extension seam (advance publishes, failure does not);
  subscription mapping tests (notification → exact keys)
- Middle: existing brunch-updates + extension suites green
```

### Cross-cutting obligations

- Poll-on-hint model only: topics hint invalidation; no frame payloads, no streaming (that lane
  stays with web-driver-streaming).

### Expected touched paths (tentative)

```
src/rpc/product-updates.ts                      ~
src/web/subscriptions/brunch-updates.ts         ~
src/web/subscriptions/*.test.ts                 ~
src/.pi/extensions/agent-runtime/execute-*/     ~?  (publish site — prefer shared registration choke point)
src/.pi/extensions/agent-runtime/__tests__/     ~
```
