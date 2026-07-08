# Executor Replanning Web Actions

Frontier: executor-replanning
Linear:   FE-1114
Status:   done
Mode:     slices
Created:  2026-07-08

## Orientation

- Containing seam: executor replanning over run freshness, retry eligibility, recommendation, and bounded explicit run mutations.
- Relevant frontier item: `executor-replanning` / FE-1114 exists as the active card family and Graphite branch (`ka/fe-1114-executor-replanning`); `memory/PLAN.md` currently references it only indirectly through FE-1166, so final tie-off should reconcile PLAN rather than inventing a new frontier.
- Volatile handoff state: FE-1141 (`executor-run-observer`) already owns `/runs` and `/runs/$runId` read surfaces, including lineage and graph/run traceability; this card must extend that surface without making the browser read run-bundle files directly.
- Main open risk: browser actions require a Brunch public RPC mutation seam; `retry_current_step` additionally requires `ExecutionPorts` and model runtime, so it is not the same class as recommendation, regenerate-plan, start-new-run, or abandon.

Posture: proving (inherited from `executor-replanning`).

## Slice 1 — Web-Safe Replanning RPC Mutations

Status: done
Weight: full

### Target Behavior

The public RPC surface exposes the web-safe replanning recommendation and metadata/file mutation helpers as product-shaped execute methods.

### Full-card cold-start reads

- `memory/SPEC.md` — D98-L, D111-L, D112-L, I58-L.
- `memory/PLAN.md` — `executor-run-observer`, `orchestrator-tool-port`, indirect `executor-replanning` branch reference.
- `src/executor/TOPOLOGY.md` — replanning helper boundaries and side-effect rules.
- `src/rpc/TOPOLOGY.md` — execute read-projection surface and web query/mutation mapping table.
- `src/web/TOPOLOGY.md` — web sidecar boundary and query/mutation ownership.

### Boundary Crossings

```text
→ web/RPC client request
→ rpc execute.* public method
→ executor replanning helper or web-safe bounded mutation
→ product update invalidation for execute.runs / execute.run
```

### Risks and Assumptions

- RISK: duplicating Pi tool behavior in RPC causes two action semantics. → MITIGATION: RPC methods delegate to the same executor core helpers used by the tools and assert the same refusal classes in tests.
- RISK: browser write access weakens the read-only observer boundary from FE-1141. → MITIGATION: keep methods narrow, run-scoped, and explicit; no generic executor tool bridge, no graph mutation, no artifact deletion.
- RISK: `retry_current_step` looks like another replanning mutation but actually needs `ExecutionPorts` and model runtime. → MITIGATION: exclude web retry from this slice; expose it only through the existing executor tool until a separate host-authority slice wires execution ports into RPC/web-host context deliberately.
- ASSUMPTION: Web-side replanning actions are product-host mutations, not Pi tool invocations.
  → IMPACT IF FALSE: the browser would need a command broker into the active executor agent rather than direct host RPC methods.
  → VALIDATE: route-level and RPC tests prove the methods work without an active assistant turn.

### Posture check

This is a proving slice: it lights up the first browser-callable executor replanning mutation path and stabilizes which replanning actions are host metadata/file actions versus executor-runtime actions.

### Acceptance Criteria

✓ `src/rpc/methods/__tests__/execute.test.ts` — `execute.replanRecommendation` returns the same recommendation classes as `run-replan-recommendation` for fresh, stale, and terminal fixture runs.
✓ `src/rpc/methods/__tests__/execute.test.ts` — `execute.replanRegeneratePlan`, `execute.replanStartNewRun`, and `execute.replanAbandonRun` refuse disallowed run states with the same typed status as the executor helper/tool path.
✓ `src/rpc/methods/__tests__/execute.test.ts` — `retry_current_step` is not exposed as a web mutation and is documented as requiring executor-runtime authority.
✓ `src/rpc/__tests__/handlers.test.ts` — the new execute replanning methods are discoverable and carry declared side-effect metadata.
✓ Product-update test — successful replanning mutations publish `execute.runs` and exact `execute.run(runId)` invalidations.

Implemented 2026-07-08 as `execute.replanRecommendation`, `execute.replanRegeneratePlan`, `execute.replanStartNewRun`, and `execute.replanAbandonRun`. `execute.replanRetryCurrentStep` remains intentionally unexposed through web RPC because it requires `ExecutionPorts` and executor runtime context. Verification: `npm run test -- src/rpc/methods/__tests__/execute.test.ts src/rpc/__tests__/handlers.test.ts`; `npm run fix`.

### Verification Approach

- Inner: focused RPC method tests over temp run bundles — proves method shape, refusal parity, and update publication.
- Middle: existing executor core/tool tests — prove helpers remain the single semantic source.

### Cross-cutting obligations

- Preserve I58-L side-effect honesty: every mutation has one explicit run-bundle side effect and no graph mutation.
- Preserve FE-1141 projection firewall: browser receives product-shaped RPC results, never raw `.brunch/cook/runs/**` path contracts.
- Preserve replanning evidence honesty: never rewrite a run plan after execution evidence exists; supersession creates a linked run.
- Preserve executor-runtime authority: web retry is out of this slice unless `ExecutionPorts` are deliberately added to RPC context by a later card.

### Expected touched paths (tentative)

```text
src/rpc/
├── methods/
│   ├── execute.ts                         ~
│   └── __tests__/execute.test.ts          ~
├── __tests__/handlers.test.ts             ~
├── product-updates.ts                     ~
└── TOPOLOGY.md                            ~
src/web/
├── queries/execute.ts                     ~
└── query-keys.ts                          ?
```

## Slice 2 — Run Detail Replanning Panel

Status: done
Weight: light

### Objective

Show the replanning diagnosis and explicit allowed actions on `/runs/$runId` so a human can choose a safe recovery path from the run observer.

### Light-card cold-start reads

- `memory/SPEC.md` — D98-L, D111-L, D112-L, I58-L.
- `memory/PLAN.md` — `executor-run-observer`; indirect `executor-replanning` branch reference.
- `src/web/TOPOLOGY.md` — `/runs/$runId` route ownership and web sidecar rules.
- This scope file — Slice 1 RPC method names and result shape.

### Acceptance Criteria

✓ `/runs/$runId` renders recommendation status, diagnosis text, recommended action, and allowed alternatives when the recommendation method succeeds.
✓ `/runs/$runId` renders disabled/explanatory states for actions not in `allowedActions` or not web-callable, including `retry_current_step`.
✓ Clicking a web-callable allowed action calls the matching RPC mutation, invalidates/refetches run list/detail, and leaves the user on a readable result state.
✓ Route tests cover fresh retry, stale early regenerate, stale started start-new-run, and abandon flows using fixture-shaped RPC responses.

Implemented 2026-07-08 on `/runs/$runId` as a replanning panel that renders diagnosis, recommended action, allowed actions, and web-callable mutation buttons. `retry_current_step` renders disabled with executor-runtime copy. Verification: `npm run test -- src/web/__tests__/runs-route.test.tsx`; `npm run fix`.

### Verification Approach

- Inner: `src/web/__tests__/runs-route.test.tsx` route/component tests with fake RPC client responses.
- Middle: optional `src/web/__tests__/app.test.tsx` integration route test if query/mutation wiring crosses route loader assumptions.
- Outer: manual browser smoke per `docs/praxis/manual-testing.md` on one fixture or scratch run after Slice 1 lands.

### Cross-cutting obligations

- Browser remains a product RPC client only; no direct filesystem reads and no generic tool bridge.
- UI copy must make replanning evidence-preserving behavior explicit: stale started runs create linked runs instead of rewriting old evidence.

### Assumption dependency

None — this slice depends on Slice 1's RPC surface, not on a live SPEC assumption.

### Expected touched paths (tentative)

```text
src/web/
├── routes/runs.tsx                    ~
├── queries/execute.ts                 ~
├── __tests__/runs-route.test.tsx      ~
├── __tests__/app.test.tsx             ?
└── TOPOLOGY.md                        ~
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
