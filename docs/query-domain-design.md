# Granular Query Domain Design

> Design document for migrating from coarse `router.invalidate()` to granular TanStack Query domains.
> Traceability: D121, A64.
>
> **Sync note — 2026-04-22:** The router/query ownership migration remains live, but the earlier three-way split (`core`, `turns`, `entities`) should not be read as the immediate canonical boundary while `/api/specifications/:id` still returns one monolithic specification payload. The current live frontier treats `workflow + landing + turns` as one authoritative specification bundle domain and `entities` as the separately invalidable domain. Use this document for the query-owned routing/invalidation rationale and loader-priming shape, then follow `memory/PLAN.md` and `memory/REFACTOR.md` for the staged execution order.

## Problem

The current client uses `router.invalidate()` as the sole invalidation mechanism after every mutation and SSE-delivered observer update. Because TanStack Router's `invalidate()` re-runs **all active route loaders**, this produces a full-tree re-render cascade on every observer update — including the scroll-bearing center pane — causing the scroll-jank described in A50/D121.

There are **four call sites** that trigger `router.invalidate()` today:

| Call site | File | Trigger |
|-----------|------|---------|
| `useChat.onFinish` | `-interview-controller.ts:239` | Chat stream completes (interviewer turn finalized) |
| `handleDataPart` (observer result) | `-interview-data.ts:35` | SSE data part with `type: 'data-observer-result'` arrives mid-stream |
| `useSubmitTurnResponseMutation` | `interview-mutations.ts:146` | User submits a turn response |
| `useSubmitPhaseIntentMutation` | `interview-mutations.ts:61` | User triggers phase entry or continue |

The observer-result invalidation (`-interview-data.ts:35`) is the primary scroll-jank trigger because it fires during an active chat stream while the user may be reading or scrolling.

## Current Data Architecture

### Route loader hierarchy

```
/specification/$id          → fetchSpecificationWorkspaceLoaderData()
                               Returns: SpecificationState { specification, workflow, landing, turns }
                               Consumers: PhaseNavigationSidebar, interview controller

  /specification/$id/_view  → fetchViewLayoutLoaderData()
                               Returns: EntitiesData { goals, terms, contexts, constraints, ... }
                               Consumers: EntitySidebar, GraphView, InterviewView (entity snapshot)
```

Both loaders fetch from the server on every `router.invalidate()`. The parent loader returns the monolithic `SpecificationState` bundle (specification record + workflow state + all turns), even when only entities changed.

### Data flow for observer updates

```
observer result arrives via SSE data part
  → handleChatData sets captureStatusByTurnId (local state)
  → handleDataPart fires router.invalidate()
  → BOTH loaders re-run
  → SpecificationState re-fetched (specification + workflow + turns)
  → EntitiesData re-fetched (entities)
  → entire route tree re-renders
  → ChatScroll re-renders, scroll position disrupted
```

## Proposed Query Decomposition

### Query key taxonomy

Three independent query domains, all scoped by specification ID:

| Domain | Query key | Data shape | Source endpoint |
|--------|-----------|------------|-----------------|
| **Specification core** | `['specification', specId]` | `{ specification, workflow, landing }` | `/api/specifications/:id` (or new slim endpoint) |
| **Turns** | `['specification', specId, 'turns']` | `SpecificationTurn[]` | `/api/specifications/:id/turns` (new) |
| **Entities** | `['specification', specId, 'entities']` | `EntitiesData` | `/api/specifications/:id/entities?mode=active-path` |

#### Rationale

- **Specification core** changes only on phase transitions (phase entry, phase close, workflow completion) and specification metadata edits. It is the least volatile domain.
- **Turns** change on turn response submission and chat completion (new turn persisted). The interviewer produces a new turn at the end of each chat round.
- **Entities** change only when observer capture completes. This is the domain that currently triggers the scroll-jank cascade.

Separating turns from the specification core allows observer-result events to invalidate only the entities domain without re-fetching the turn list or workflow state.

### Hook signatures

```typescript
// Query hooks — all scoped to a specification ID from route params

function useSpecificationCore(specId: string): {
  specification: Specification;
  workflow: WorkflowState;
  landing: SpecificationLanding | null;
}

function useSpecificationTurns(specId: string): SpecificationTurn[]

function useSpecificationEntities(specId: string): EntitiesData
```

These would be thin wrappers around `useSuspenseQuery` (to preserve Suspense boundaries and match current loader behavior):

```typescript
function useSpecificationCore(specId: string) {
  return useSuspenseQuery({
    queryKey: ['specification', specId],
    queryFn: () => fetchSpecificationCore(specId),
    staleTime: 30_000,
  });
}
```

### Derived data stays local

The interview controller currently derives several pieces of state from `SpecificationState`:

- `durableSpecification` (via `createInterviewDurableSpecificationState`)
- `ephemeralChat` (via `createInterviewEphemeralChatState`)
- `phaseTurnIds`, `stablePhaseTurns` (filtered/reconciled per phase)

These derived values stay as local `useMemo` computations inside the controller. They consume data from the query hooks instead of from `useLoaderData`.

### Router loader's reduced role

The router loader becomes a thin existence check that ensures the specification exists and provides the ID for downstream query hooks:

```typescript
// /specification/$id loader — reduced role
loader: async ({ params }) => {
  // Lightweight existence check; actual data comes from query hooks
  const response = await fetch(`/api/specifications/${params.id}/exists`);
  if (!response.ok) throw new Error('Specification not found');
  return { specificationId: params.id };
}
```

Alternatively, `ensureQueryData` can be used in the loader to prime the cache without blocking on stale data:

```typescript
loader: async ({ params, context }) => {
  await context.queryClient.ensureQueryData({
    queryKey: ['specification', params.id],
    queryFn: () => fetchSpecificationCore(params.id),
  });
  return { specificationId: params.id };
}
```

This preserves the current behavior where navigation to a specification shows a skeleton until data is available, but subsequent invalidation of individual domains doesn't trigger the loader or its Suspense boundary.

## Invalidation Triggers

### Per mutation / event

| Trigger | Invalidated domains | Mechanism |
|---------|---------------------|-----------|
| **Turn response submitted** | `turns`, `specification-core` | `queryClient.invalidateQueries({ queryKey: ['specification', specId, 'turns'] })` + core (workflow may update) |
| **Chat stream finishes** (`onFinish`) | `turns`, `specification-core` | Same as above — new turn persisted, workflow state may advance |
| **Observer result** (SSE `data-observer-result`) | `entities` only | `queryClient.invalidateQueries({ queryKey: ['specification', specId, 'entities'] })` |
| **Phase entry / continue** | `specification-core`, `turns` | Phase status changes, new turn may be created |
| **Phase close confirmed** | `specification-core` | Workflow state changes |

### Observer-update invalidation (scroll-jank fix)

The critical change: when a `data-observer-result` SSE data part arrives, only the `entities` query is invalidated:

```typescript
// In handleDataPart (currently -interview-data.ts)
if (dataPart.type === 'data-observer-result') {
  queryClient.invalidateQueries({
    queryKey: ['specification', specId, 'entities'],
  });
}
```

This means:
- The **EntitySidebar** and **GraphView** re-render with fresh entity data.
- The **center pane transcript** (ChatScroll) does **not** re-render because its data (turns, workflow) was not invalidated.
- **No scroll position disruption** because the scroll container's content is stable.

The `captureStatusByTurnId` local state in the interview controller continues to track per-turn capture status independently of the entity query — this is already local state and not affected by query invalidation.

## Server-Side Changes Required

The current `/api/specifications/:id` endpoint returns the monolithic `SpecificationState` bundle. The decomposition requires either:

**Option A — New endpoints** (cleaner, more cacheable):
- `GET /api/specifications/:id/core` → `{ specification, workflow, landing }`
- `GET /api/specifications/:id/turns` → `SpecificationTurn[]`
- `GET /api/specifications/:id/entities?mode=active-path` → `EntitiesData` (already exists)

**Option B — Keep single endpoint, split client-side** (simpler migration):
- Keep `GET /api/specifications/:id` returning `SpecificationState`
- The `useSpecificationCore` and `useSpecificationTurns` hooks share a single query that fetches the full bundle, but use `select` to extract their domain:

```typescript
function useSpecificationCore(specId: string) {
  return useSuspenseQuery({
    queryKey: ['specification', specId, 'bundle'],
    queryFn: () => fetchSpecificationState(specId),
    select: (state) => ({
      specification: state.specification,
      workflow: state.workflow,
      landing: state.landing ?? null,
    }),
  });
}
```

**Recommendation:** Start with Option B for the migration (no server changes), then split to Option A if the bundled fetch becomes a performance concern.

## Migration Path

### Phase 1 — Query infrastructure (no behavior change)

1. Add `@tanstack/react-query` (already in the project as a TanStack Router peer).
2. Create a `QueryClient` and wire it into the router context via `createRootRouteWithContext`.
3. Create the three query hooks (`useSpecificationCore`, `useSpecificationTurns`, `useSpecificationEntities`).
4. Use `ensureQueryData` in route loaders to prime the cache.

### Phase 2 — Replace consumers

1. Replace `useLoaderData({ from: '/specification/$id' })` with `useSpecificationCore` + `useSpecificationTurns` in the interview controller.
2. Replace `useLoaderData({ from: '/specification/$id/_view' })` with `useSpecificationEntities` in the view layout and interview view.
3. Replace `router.invalidate()` calls with targeted `queryClient.invalidateQueries()` per the trigger table above.

### Phase 3 — Remove loader data ownership

1. Simplify the `/specification/$id` loader to an existence check + `ensureQueryData`.
2. Simplify the `/_view` loader to only prime the entities cache.
3. Remove the monolithic `SpecificationState` return from the loader.

### Phase 4 — Server endpoint split (optional)

1. Add `GET /api/specifications/:id/core` and `GET /api/specifications/:id/turns`.
2. Update query hooks to use the new endpoints.
3. Deprecate the monolithic `GET /api/specifications/:id` endpoint.

## What Stays in the Loader vs. Moves to Query Hooks

| Data | Current owner | Target owner | Reason |
|------|--------------|--------------|--------|
| Specification record | Loader (`/specification/$id`) | Query hook (`useSpecificationCore`) | Needs independent invalidation |
| Workflow state | Loader (`/specification/$id`) | Query hook (`useSpecificationCore`) | Needs independent invalidation |
| Landing state | Loader (`/specification/$id`) | Query hook (`useSpecificationCore`) | Part of specification core |
| Turns array | Loader (`/specification/$id`) | Query hook (`useSpecificationTurns`) | Most volatile; must not cascade |
| Entities | Loader (`/_view`) | Query hook (`useSpecificationEntities`) | Observer-update isolation |
| Specification existence | — | Loader (thin check) | Gate navigation |
| Route params (spec ID) | Router | Router | Unchanged |

## Risks

- **Stale data between domains**: If turns and workflow fall out of sync (e.g., a turn is created but workflow status hasn't propagated), the UI may briefly show inconsistent state. Mitigation: invalidate both `turns` and `specification-core` together for mutations that affect both.
- **Query deduplication with SSE**: Multiple rapid observer-result events could trigger redundant entity fetches. Mitigation: TanStack Query's built-in deduplication handles this — concurrent `invalidateQueries` calls for the same key coalesce into one fetch.
- **Suspense boundary changes**: Moving from loader data to query hooks may shift Suspense boundaries. Mitigation: use `useSuspenseQuery` consistently and keep the existing pending/skeleton components.
