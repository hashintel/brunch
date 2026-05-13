# Substrate Strangler Coordination

> Status: **working design proposal / coordination note**, 2026-05-13.
>
> Purpose: keep FE-705 / FE-700 / FE-701 substrate work and parallel frontend/product-surface work moving without forcing an early frontend cutover. Canonical sequencing remains in `memory/PLAN.md`; this document records lane boundaries, collision zones, and the migration rule of thumb.

## Coordination principle

Treat the capability / changeset substrate as a **strangler migration**, not a frontend rewrite.

```text
Frontend today
  → existing REST / SSE routes
      → shared application handlers
          → db stores / schema

Agent / future capability clients
  → capability dispatcher / JSONL adapter
      → same shared application handlers
          → db stores / schema
```

The frontend should not have to switch substrates until the backend has already made the old route substrate an adapter over the new authority. Existing UI routes stay stable while their internals migrate toward shared command/query handlers and changeset-backed semantic writes.

## Non-goals for the coordination window

- Do not require current frontend routes to call the central capability adapter.
- Do not expose new changeset fields in user-facing DTOs until a product slice needs them.
- Do not let external agents or probe harnesses write durable graph truth through ORM helpers.
- Do not widen FE-701 into the full ontology expansion; FE-701 needs enough relation-policy directionality to make mutation history safe.

## Lane split

### Substrate lane

Best owned by the agent working on FE-705 / FE-701 backend authority.

Owns:

- shared application-service / command-handler seam under existing routes and new capability adapters
- capability parity tests for route path vs capability path
- minimal relation-policy directionality needed by cascade and changesets
- `changeset` / `change` schema and stores
- `specification.latest_changeset_id`
- proposal-turn opened/base changeset identity
- `reconciliation_need.caused_by_changeset_id` replacing the historical `caused_by_patch_id` placeholder
- hidden changeset creation under existing semantic mutations before frontend DTO cutover

Acceptance posture:

- existing UI behavior and API shapes remain stable unless a scoped product slice explicitly changes them
- semantic writes pass through a shared handler that can be called by both route adapters and capability adapters
- old DB helper access remains internal; capability ids name product operations, not persistence primitives

### Frontend / product-artifact lane

Best owned by the colleague working on future-facing UI and low-collision product surfaces.

Owns:

- continuous workspace / phase-addressable host work against current read models
- fixture-backed candidate bundle cards and graph-review finding cards
- review status badges and proposal-artifact presentation states
- read-only graph/workspace improvements
- mocked or artifact-only scenario-options UI probes

Acceptance posture:

- no canonical graph mutation from candidate/proposal UI until FE-701 changesets exist
- frontend work consumes stable current read models or fixtures, not transitional internal stores
- UI prototypes may model future statuses, but acceptance/apply flows stay disabled, mocked, or explicitly proposal-only

## High-conflict files and seams

Coordinate before touching these:

- `src/server/schema.ts`
- `drizzle/*`
- `src/server/db/*`
- `src/server/knowledge-relationship-policy.ts`
- semantic mutation handlers and edit/reconciliation routes
- turn completion / chat transition logic
- shared API types when changing existing frontend DTOs
- prompt/context pack contracts that become canonical mutation inputs

Lower-conflict frontend work usually lives in:

- `src/client/components/*`
- Ladle stories and fixtures
- read-only graph/workspace route presentation
- candidate/proposal/graph-review renderers backed by static artifacts

## Backend migration sequence

1. Keep current route contracts stable and add regression/parity tests around important UI-facing reads/writes.
2. Extract or name shared application handlers underneath existing Express routes.
3. Point capability/JSONL operations at those same handlers instead of ORM helpers.
4. Add minimal relation-policy directionality needed for direct-edit cascade and reconciliation cause semantics.
5. Add FE-701 changeset/change ledger as hidden substrate.
6. Route existing semantic writes through changeset creation while preserving existing response DTOs.
7. Expose changeset/proposal/staleness fields only through probe/debug/capability surfaces first.
8. Cut over frontend flows one at a time after parity is proven.

## Frontend-safe work before cutover

The colleague can work independently on:

- layout shells, navigation, scroll/focus, and phase section rendering
- read-only graph visibility and status affordances
- candidate bundle and graph-review cards using static fixtures
- `reviewed_clean` / `reviewed_with_issues` / `blocked` visual states as non-mutating artifacts
- storybook/Ladle coverage for future proposal surfaces

Avoid implementing real `accept`, `accept with issues`, `apply`, or `resolve` UI flows against ad hoc route writes. Those should wait for FE-701 handlers or remain mocked.

## Cutover rule

A frontend flow may switch to the new substrate only when all are true:

1. existing route behavior has a parity test or compatibility assertion;
2. the new handler is the authority behind both route and capability entry points;
3. semantic mutations, if any, produce changeset/change rows atomically;
4. proposal or candidate acceptance has a clear user/HITL authority boundary;
5. rollback/failure behavior leaves graph truth and process debt coherent.

## Relationship to existing docs

- `AGENT_MUTATION_SURFACE.md` owns operation naming and agent authority classes.
- `MULTI_CHAT.md` owns shipped chat/reconciliation schema rationale.
- `PATCH_LEDGER.md` owns changeset/change algorithmic pressure under historical patch vocabulary.
- `CONVERSATIONAL_WORKSPACE_RUNTIME.md` owns the umbrella runtime synthesis.
- `memory/PLAN.md` owns actual frontier ordering.
