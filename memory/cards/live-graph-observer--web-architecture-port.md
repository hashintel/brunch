# Web architecture port and observer scaffold

Frontier: live-graph-observer | n/a
Status:   active
Mode:     chain
Created:  2026-06-03

## Orientation

- Containing seam: `web/` owns rendering and client-side cache/route orchestration; `rpc/` remains the only product data boundary it speaks.
- Frontier item: `live-graph-observer` (FE-795). This file scopes the web topology lock before the graph panel fills it in.
- Volatile handoff state: the user asked for an inventory/analysis of salvageable web-client parts from `../brunch/src/` before implementation; current `src/web/app.tsx` is still one-file proof code.
- Main open risk: porting the old app wholesale would import stale REST/data models, Tailwind/shadcn/lucide dependency weight, and old knowledge ontology. Salvage architecture patterns, not the old product model.
- Cross-cutting obligations: web remains read-only for F1; it must not read SQLite/Pi JSONL directly; Query owns server truth; route/client local state is only for view controls.

## Port inventory from `../brunch/src/client/`

### Salvage now

```pseudo
src/client/main.tsx
  pattern: StrictMode app boot + optional dev-only Agentation overlay
  adapt: if the feedback-loop card enables annotation capture; this complements browser tooling rather than replacing it

src/client/query-client.ts
  pattern: QueryClient defaults (`staleTime`, `refetchOnWindowFocus: false`)
  adapt: as a factory in brunch-next, not an app-wide singleton

src/client/router.tsx + routes/__root.tsx
  pattern: TanStack Router owns shell/root route; loaders prime data
  adapt: manual tiny route tree is fine; no need for generated route plugin yet

src/client/routes/specification/$id/-specification-data.ts
  pattern: one query-key namespace plus query priming helpers per route/resource
  adapt: RPC query options over Brunch method names; do not copy REST fetchers

src/client/routes/specification/$id/graph.tsx
src/client/routes/specification/$id/-structured-list-view.tsx
src/client/components/knowledge-graph-identity.tsx
  pattern: readable graph identity, grouped items, count badges, empty/populated states
  adapt: to Brunch-next `GraphOverview`/`GraphNode`/`GraphEdge` shapes and plain minimal styling
```

### Do not port in F1

```pseudo
REST API fetchers and `/api/specifications/*` route assumptions
old `EntitiesData` ontology and relationship names
old review/patch/secondary-chat components
Tailwind/shadcn/lucide-heavy visual system unless a later UI slice chooses it
large generated `routeTree.gen.ts` / router plugin setup before a second real route needs it
```

## Card 1 — done — Web client topology is Query/Router/RPC shaped

### Target Behavior

The web client has one spec route whose data comes from Brunch RPC query options.

### Boundary Crossings

```pseudo
→ browser route `/spec/{specId}`
→ TanStack Router loader
→ TanStack Query cache
→ WebSocketRpcClient.request(method, params)
→ Brunch RPC handler
→ canonical projection owner
→ React route/component render
```

### Risks and Assumptions

- RISK: Generated file-routing from the old app adds toolchain weight before this app needs it.
  → MITIGATION: create a tiny manual route tree now; keep route modules named and colocated so adding the plugin later is mechanical.
- RISK: QueryClient singleton leaks state across tests or future SSR-like rendering.
  → MITIGATION: port Query defaults as `createBrunchQueryClient()`, called per `createBrunchWebRuntime`.
- RISK: Stub topology becomes structural theatre.
  → MITIGATION: only add stubs named by current F1/F2 pressure: `query-keys`, `queries/{workspace,session,graph}`, `subscriptions/brunch-updates`, `routes/{root,spec}`, `features/graph`, and optional runtime-state view. Stubs must export real no-op/placeholder behavior used by the app or tests; no empty files.
- ASSUMPTION: One route, `/spec/{specId}` (or the closest TanStack-safe equivalent), is enough for F1.
  → IMPACT IF FALSE: the route tree may need a workspace/root route plus nested spec route earlier.
  → VALIDATE: route test loads workspace snapshot, resolves selected/default spec, and renders spec graph panel.

### Tracer-bullet check

- Proof of life: route loader → Query → RPC request → render path becomes real for the selected spec.
- Invariants: locks web as a rendering/cache layer over Brunch RPC method names, not REST/DB/local JSONL.

### Acceptance Criteria

✓ `createBrunchQueryClient` — QueryClient defaults live outside `app.tsx` and are created per runtime.
✓ `queryKeys` — keys mirror product methods/resources (`workspace.snapshot`, `session.runtimeState`, `graph.overview`, `graph.nodeNeighborhood`), not tables.
✓ `queries/*` — query option helpers call Brunch RPC methods with explicit `{specId, sessionId?}` where needed.
✓ `routes/spec` — a spec route loads through Query `ensureQueryData` and renders with `useSuspenseQuery`/`useQuery` rather than ad hoc requests.
✓ `app.tsx` — becomes app/runtime/router assembly, not the home of every query/component.
✓ Tests — cover route loading without selected session and with selected spec id.

### Verification Approach

- Inner: web route/query tests — expected query keys, RPC method names, loader priming, and no optional session query without session target.
- Middle: `npm run fix` on touched files and focused vitest for `src/web`.

### Cross-cutting obligations

- D10-L: native Brunch React app over one WebSocket RPC client.
- D19-L: named method families only; no generic records or REST fetcher port.
- D33-L: transport attachment is not durable session identity; explicit spec/session targets are carried in params or selected snapshot.

### Expected touched paths (tentative)

```pseudo
src/web/
├── app.tsx                         ~
├── app.test.tsx                    ~
├── query-client.ts                 +
├── query-keys.ts                   +
├── queries/
│   ├── workspace.ts                +
│   ├── session.ts                  +
│   └── graph.ts                    +
├── subscriptions/
│   └── brunch-updates.ts           +
├── routes/
│   ├── root.tsx                    +
│   └── spec.tsx                    +
└── features/
    ├── graph/
    │   └── GraphOverview.tsx       +
    └── session/
        └── RuntimeStatePanel.tsx   ?
```

## Card 2 — next — Read-only graph overview panel

### Objective

The spec route renders an empty or populated selected-spec graph overview from `graph.overview`.

### Acceptance Criteria

✓ Empty graph — panel says no graph nodes yet and shows LSN/counts from the RPC result.
✓ Populated graph — panel lists nodes grouped by plane/kind and shows edge count/category summary without mutating graph state.
✓ Focused read affordance — selecting a node can request `graph.nodeNeighborhood(specId, nodeId, hops)` or the UI names that focused read as pending if the RPC method is not yet implemented in the same card.
✓ Notification invalidation — graph update notifications invalidate the exact graph overview key for the selected spec.

### Verification Approach

- Inner: component/query tests with fake RPC client and notifications.
- Middle: browser smoke after RPC graph methods land.

### Cross-cutting obligations

- Web is read-only for F1; no `commitGraph` or graph mutation UI.
- Render canonical graph reader projections only; do not locally transform old `EntitiesData` into new graph truth.

### Assumption dependency

Depends on: selected-spec graph RPC methods from `live-graph-observer--rpc-event-spine.md` or an equivalent prior card.

### Expected touched paths (tentative)

```pseudo
src/web/features/graph/GraphOverview.tsx       ~
src/web/queries/graph.ts                       ~
src/web/routes/spec.tsx                        ~
src/web/subscriptions/brunch-updates.ts        ~
src/web/app.test.tsx                           ~
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
