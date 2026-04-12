## Problem Statement

The codebase currently has more than one source of truth for several domain and transport types. Shared contracts already exist, but parallel local declarations still appear in server projection code, workflow primitives, client-facing status unions, and fixture/seeding definitions. This creates drift risk at the boundaries where consistency matters most: producer/consumer seams, seed data, export projections, and tests.

The problem is not that local types exist. The problem is that some local types restate an importable or derivable contract. Storage-row types and true local view models are acceptable. Duplicated transport unions and DTO shapes are not.

## Verified Duplication Map (2026-04-12)

| Type | Canonical location | Restated in | Notes |
|------|--------------------|-------------|-------|
| `WorkflowPhaseStatus` | `shared/api-types.ts` (`workflowPhaseStatusSchema`) | `server/db.ts:36` (literal union) | Critical — same union, independent declaration |
| `ReadinessBand` | `shared/api-types.ts` (`readinessBandSchema`) | `server/db.ts:37` (literal union) | Critical — same union, independent declaration |
| `ReviewStatus` | `shared/api-types.ts:100` (`reviewStatusSchema`, **not exported**) | `server/db.ts:529` (literal union, exported) | Shared owns the schema but doesn't export it |
| `Phase` / `PhaseStatus` | `shared/phase-close.ts` (`workflowPhaseSchema`) | `client/components/app-shell.tsx:118-119` (literal unions) | Client view-model restates shared enum |
| `ProjectMode` | `shared/api-types.ts` (`projectModeSchema`) | `server/db.ts:101` (`CreateProjectOptions`), `server/interview.ts:109` (`InterviewerModeOptions`) | Inline `'greenfield' \| 'brownfield'` literals |
| `ManifestTurn.phase` | `shared/phase-close.ts` | `server/fixtures/manifest.ts:32` (inline literal) | Fixture restates |
| `ManifestTurn.impact` | `shared/api-types.ts` (inline in schema, no named export) | `server/fixtures/manifest.ts:36` (inline literal) | No shared named export to import |
| `ManifestKnowledgeItem.kind` | `shared/knowledge.ts` (`KnowledgeKind`) | `server/fixtures/manifest.ts:45` (inline literal) | Shared exists, just not imported |
| `ManifestEdge.relation` | `server/schema.ts:184` (Drizzle enum) | `server/fixtures/manifest.ts:56` (inline literal) | No shared type; schema is only source |
| `InterviewerTools` | — | `server/interview.ts:119` (`& Record<string, Tool<any, any>>`) | Intersection erases optional modifier |
| `CreateProjectInput` | `shared/api-types.ts` (`createProjectRequestSchema`) | `client/mutations/project-mutations.ts:7` (isomorphic local type with extra `cwd`) | Client type wider than actual contract |

### Types that are NOT duplicated (verified OK)

- `Phase` in `db.ts` — derived from `Turn['phase']` which derives from schema. Acceptable.
- `Impact` in `db.ts` — derived from `NonNullable<Turn['impact']>`. Acceptable.
- `ClosureBasis` in `db.ts` — imports `PhaseClosureBasis` from shared, wraps with `| null`. Acceptable.
- `KnowledgeKind` in `shared/knowledge.ts` — single canonical source, widely imported.

## Solution — Parallel Streams

The refactor is structured as one prerequisite commit, then four independent parallel streams, then one cleanup commit. Streams A–D touch non-overlapping file sets and can execute concurrently after the prerequisite lands.

```
                    ┌─── Stream A: server/db.ts
                    │
Prereq (shared/) ───┼─── Stream B: client/app-shell.tsx + stories
                    │
                    ├─── Stream C: server/fixtures/manifest.ts
                    │
                    └─── Stream D: server/interview.ts + client/project-mutations.ts

                              │
                              ▼
                    Cleanup (final sweep)
```

### Prereq: Stabilize shared exports

Export the primitives that consumers need but shared doesn't yet expose:

1. Export `reviewStatusSchema` and its inferred type `ReviewStatus` from `shared/api-types.ts`
2. Extract the inline `z.enum(['high', 'medium', 'low'])` in `projectStateTurnSchema` into a named `impactSchema` constant and export its type `Impact`
3. Add and export `edgeRelationSchema` (the relation enum from `schema.ts:184`) in `shared/api-types.ts` or `shared/knowledge.ts`
4. Re-export `WorkflowPhase` from `shared/phase-close.ts` via `shared/api-types.ts` for discoverability (optional — consumers can import from either)

**Files touched**: `shared/api-types.ts`, possibly `shared/knowledge.ts`
**Verification**: `npm run verify` — existing 274 tests still pass, new exports don't break anything

### Stream A: Collapse server workflow primitives

Replace literal unions in `db.ts` with imports from shared:

1. `WorkflowPhaseStatus` (line 36) → import from `shared/api-types.ts` and re-export
2. `ReadinessBand` (line 37) → import from `shared/api-types.ts` and re-export
3. `ReviewStatus` (line 529) → import from `shared/api-types.ts` and re-export
4. `CreateProjectOptions.mode` → type as `ProjectMode` imported from shared

Re-export all four so downstream server files that import from `db.ts` don't need to change.

**Files touched**: `server/db.ts`
**Verification**: `npm run verify` — all 274 tests pass unchanged

### Stream B: Collapse client primitives

Replace literal unions in `app-shell.tsx` with imports from shared:

1. `Phase` (line 118) → import `WorkflowPhase` from `shared/phase-close.ts`, re-export as `Phase` (or rename to match shared lexicon)
2. `PhaseStatus` (line 119) → import `WorkflowPhaseStatus` from `shared/api-types.ts`, re-export as `PhaseStatus`
3. Update `app-shell.stories.tsx` if the type names change (currently imports `Phase` and `PhaseStatus`)

**Files touched**: `client/components/app-shell.tsx`, `client/components/app-shell.stories.tsx`
**Verification**: `npm run verify` — all tests pass, Ladle stories still build

### Stream C: Narrow fixture manifests

Replace inline literal unions in `manifest.ts` with shared types:

1. `ManifestTurn.phase` → use `WorkflowPhase` from shared
2. `ManifestTurn.impact` → use `Impact` from shared (after prereq exports it)
3. `ManifestKnowledgeItem.kind` → use `KnowledgeKind` from `shared/knowledge.ts`
4. `ManifestEdge.relation` → use the edge relation type from shared (after prereq exports it)
5. `ManifestKnowledgeItem.reviewAction` → evaluate whether `'reviewed' | 'rejected'` should derive from shared `ReviewStatus` (it's a different union — probably a legitimate local type)

**Files touched**: `server/fixtures/manifest.ts`
**Verification**: `npm run verify` — manifest.test.ts (3 tests) + all fixture-dependent tests pass

### Stream D: Collapse 14a interview + mutation types

Fix the type duplication introduced in slice 14a:

1. `InterviewerModeOptions.mode` in `interview.ts` → type as `ProjectMode` imported from shared
2. `InterviewerTools` intersection type → use `{ [K in string]?: Tool<any, any> }` instead of `Record<string, Tool<any, any>>` to preserve optionality
3. `CreateProjectInput` in `project-mutations.ts` → derive from `Omit<CreateProjectRequest, 'cwd'>` or replace with `CreateProjectRequest` directly (client never sends cwd)
4. Remove the dead `cwd` field from `CreateProjectInput`

**Files touched**: `server/interview.ts`, `client/mutations/project-mutations.ts`
**Verification**: `npm run verify` — interview.test.ts (14 tests) + ProjectList.test.tsx (4 tests) pass

### Cleanup: Final sweep

After all streams merge:

1. Remove `createApp` string overload if all tests have been updated to pass objects (or leave as-is per YAGNI)
2. Search for any remaining inline literal unions that match a shared type
3. Run `npm run verify` one final time
4. Delete this `REFACTOR.md` file

**Files touched**: varies (sweep)

## Decisions

- The shared transport and domain layer becomes the authority for cross-layer DTO shapes
- `db.ts` re-exports shared types (instead of removing its exports) so downstream server imports don't cascade
- `app-shell.tsx` can alias shared types to its local naming convention if the shared names are awkward for the component context
- Fixture manifests derive from shared types but may keep local interface wrappers for fields that don't correspond to shared contracts (e.g. `capturedAtTurn`, `isProposal`)
- The `createApp` string overload is low-priority — don't force-migrate test callers unless it's trivial
- Edge relation type gets promoted to shared because fixtures and schema both use it

## Testing Decisions

- This is a type-only refactor with 274 passing tests as the safety net
- No new characterization tests needed — existing db.test.ts, app.test.ts, interview.test.ts, manifest.test.ts, api-types.test.ts, and ProjectList.test.tsx cover the affected seams
- Each stream runs `npm run verify` independently before merge
- The cleanup commit runs the full suite one final time

## Agent Execution Notes

Each stream should be executed as a separate agent with `isolation: "worktree"`:

- **Prereq** must land on the branch first (sequential)
- **Streams A–D** can run in parallel after prereq (four concurrent agents)
- **Cleanup** runs after all streams merge (sequential)

Each agent should:
1. Read this file for its stream's scope
2. Make the described changes
3. Run `npm run verify`
4. Commit with message `refactor: [stream description]`

## Out of Scope

- Changing runtime behavior
- Changing database schema or migration shape
- Reworking the knowledge model itself
- Reworking UI architecture beyond import and derivation cleanup
- Converting persistence-row types into transport types
- Broad naming cleanup unrelated to source-of-truth type duplication
