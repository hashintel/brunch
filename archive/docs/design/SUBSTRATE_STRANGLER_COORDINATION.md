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
- minimal relation-policy directionality needed by cascade, context snapshots, and changesets
- endpoint-relative relation labels for dependency/dependent snapshot rendering
- item/neighborhood/economic graph context snapshot builders
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
- UI rendering for snapshot artifacts and endpoint-relative dependency/dependent groups when backed by server fixtures

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
- context snapshot artifact schemas and mention-resolution contracts

Lower-conflict frontend work usually lives in:

- `src/client/components/*`
- Ladle stories and fixtures
- read-only graph/workspace route presentation
- candidate/proposal/graph-review renderers backed by static artifacts
- context snapshot artifact renderers backed by server-generated fixtures

## Upcoming substrate waves and expected interfaces

This section is a coordination forecast, not an implementation commitment. The rule remains: existing frontend REST/SSE contracts stay stable until a scoped product slice cuts over. The backend work should first produce server-owned functions and capability contracts that the frontend can treat as future affordances, static fixtures, or debug/probe inputs.

### Wave 1 — Intent graph semantics and relation policy

What the substrate lane should provide first:

| Interface shape | Projected names | Expected use |
| --- | --- | --- |
| Server relation-policy functions | `getRelationPolicy(relation)`, `validateIntentEdge(input)`, `renderIntentEdgeEndpoint(edge, anchorItemId)`, `bucketIntentEdgeForSnapshot(edge, anchorItemId)` | Frontend/context packs can display mixed-direction edges without guessing from `from_item_id` / `to_item_id`. |
| Server graph read/query helpers | `readIntentGraph(specificationId)`, `readIntentItemsById(specificationId, itemIds)`, `readIntentNeighborhood(input)` | Read-only graph and snapshot builders; no mutation authority. |
| Capability contracts | `intentGraph.validateEdge`, later `intentGraph.query`, `intentGraph.renderNeighborhood` | Agent/probe tools for graph reads and edge validation. |

Frontend expectation: relation wording, dependency/dependent grouping, and reconciliation direction should come from server policy or fixtures generated by that policy. UI code should not hard-code inverse labels such as “is constrained by” by reversing the verb.

### Wave 2 — Context snapshot builders for chats

What the substrate lane should provide around chat context:

| Interface shape | Projected names | Expected use |
| --- | --- | --- |
| Item snapshot builder | `buildIntentItemContextSnapshot({ specificationId, itemIds })` | `#` mentions and explicit item inclusion. |
| Neighborhood snapshot builder | `buildIntentNeighborhoodContextSnapshot({ specificationId, anchorItemIds, mode })` where `mode` starts with `immediate`, `dependencies`, `dependents`, `evidence`, `reconciliation` | Side-chat turn-zero, graph-launched QA, edit-impact previews, reconciliation context. |
| Economic graph snapshot builder | `buildEconomicIntentGraphContextSnapshot({ specificationId, budget })` | New unanchored secondary chats in an existing spec. |
| Snapshot renderer | `renderContextSnapshotArtifact(snapshot)` / context-pack renderer | Produces transcript-visible turn artifacts and compact prompt text. |
| Mention resolver | `resolveIntentItemReferences({ specificationId, refs })` | Server-owned resolution for `#D7` / reference-code mentions. |

Frontend expectation: new chats or mentions should request/receive replayable snapshot artifacts, not mutate a hidden chat-context table. Whole-graph snapshots are historical context only; they should not create handles for every graph item. Item handles and stale refresh wait for real item versions from the changeset ledger.

### Wave 3 — Changeset ledger and mutation tools

What the substrate lane should provide once semantic mutations become first-class:

| Interface shape | Projected names | Expected use |
| --- | --- | --- |
| Changeset application handlers | `submitChangeset(input)`, `applyAcceptedChangeset(input)`, `readLatestChangeset(specificationId)` | One semantic mutation spine for graph edits, proposal acceptance, reconciliation, and future agent edits. |
| Change variants | `intentItem.create`, `intentItem.updateContent`, `intentItem.retire`, `intentEdge.create`, `intentEdge.delete`, later `contextHandle.refresh` only as process/replay state if needed | Frontend submits product intent, not raw DB updates. |
| Capability contracts | `changeset.submit`, later `changeset.apply`, `changeset.get`, `reconciliationNeed.list`, `reconciliationNeed.proposeResolution`, `reconciliationNeed.applyResolution` | Agent tools stay proposal-only until user/HITL acceptance applies truth. |
| Version reads | `getIntentItemVersion(itemId)` backed by latest applied changeset / item revision | Enables chat handles to refresh only changed subjects. |
| Historical neighborhood builders | `buildHistoricalIntentNeighborhoodSnapshot({ itemId, basis: 'original_capture' | 'last_update' })` | Revives the graph context around the changeset that captured or last updated an item. |

Frontend expectation: do not implement real `accept`, `apply`, `resolve`, or agent graph-edit flows against ad hoc route writes. Once this wave lands, accepted semantic mutations should return changeset identity, updated graph projection, and any created/updated reconciliation needs.

### Wave 4 — Agent-facing tool projection

Capability contracts should project the same server handlers used by routes. Likely agent tool families:

| Tool family | Authority | Notes |
| --- | --- | --- |
| `intentGraph.*` reads / validation / snapshot rendering | `read_only` | Safe for probes and chat context. |
| `chat.*` start/read/ensure/submit operations | `read_only` / `commit_truth` depending on operation | Existing `chat.getPrimary`, `chat.read`, `chat.ensureReady`, and `turn.submitResponse` are the current foundation. Secondary-chat start/focus should follow this shape. |
| `changeset.submit` | `proposal_only` initially | Lets agents propose graph mutations without committing truth. |
| `changeset.apply` / reconciliation apply tools | `commit_truth` / `commit_process_debt` | Should require explicit user/HITL authority. |
| `workspace.*` / `web.*` context tools | `read_only` | Existing capability registry already names these as safe adapter targets. |

Adapters may expose different tool names for AI SDK, JSONL, Pi, or CLI ergonomics, but those names must remain projections over Brunch-owned capability ids.

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
- `INTENT_GRAPH_SEMANTICS.md` owns relation-policy directionality, endpoint-relative labels, and neighborhood snapshot modes.
- `memory/PLAN.md` owns actual frontier ordering.
