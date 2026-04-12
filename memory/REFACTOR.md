## Problem Statement

The codebase currently has more than one source of truth for several domain and transport types. Shared contracts already exist, but parallel local declarations still appear in server projection code, workflow primitives, client-facing status unions, and fixture/seeding definitions. This creates drift risk at the boundaries where consistency matters most: producer/consumer seams, seed data, export projections, and tests.

The problem is not that local types exist. The problem is that some local types restate an importable or derivable contract. Storage-row types and true local view models are acceptable. Duplicated transport unions and DTO shapes are not.

Fixture generation and database seeding are part of this same problem. If the canonical seams change while manifests, scenarios, and seed helpers remain hand-authored and wider than the real contracts, the app becomes correct in production code but loose in its development harness.

## Solution

Establish one explicit rule in the codebase:

- shared transport and domain contracts own API-facing and cross-layer DTO shapes
- storage modules own persistence-row and storage-only input shapes
- UI and controller modules may own true local view models
- fixtures, manifests, scenario builders, and seed helpers must derive from the same canonical shared types rather than restating unions by hand

This refactor stops at the type-boundary level. It is not a behavior change. The target state is:

- server read models project directly into shared transport types
- shared workflow primitives own phase, status, readiness, impact, and review unions
- tests, fixtures, and seeders import or derive those same types
- no duplicated literal unions remain where a canonical type already exists
- no local DTO re-declarations remain where the shared contract is already authoritative

## Commits

1. Add characterization coverage for the contract seams most exposed to this refactor.
2. Extract and stabilize the canonical shared primitive types.
3. Collapse duplicated server workflow DTO types onto the shared contracts.
4. Collapse duplicated entity and relationship DTO types onto the shared contracts.
5. Replace server-side assembled transport-shape aliases with shared turn and project transport types.
6. Align client and shared workflow consumers to the canonical primitives.
7. Narrow review-state consumers to the canonical review-status type.
8. Refactor fixture manifests and scenario builders to derive from shared contracts.
9. Refactor seed helpers to consume only the narrowed shared or derived types.
10. Remove residual duplicate type declarations and simplify tests to assert the shared seam directly.
11. Run the full verification gate and do a final drift sweep focused on fixtures and seeds.

## Decisions

- The shared transport and domain layer becomes the authority for cross-layer DTOs.
- The persistence layer continues to own row types and storage-only input types.
- Local controller and view-model types remain allowed when they model a real local abstraction rather than a transport contract.
- The cleanup intentionally distinguishes projection types from persistence types; not every type moves into one module.
- Workflow primitives should be importable from one shared seam rather than recreated across UI, server, tests, and fixtures.
- Review status should become a first-class shared primitive rather than an ad hoc repeated union.
- Fixture manifests and seed helpers are in scope because they are contract producers and can drift if left wider than runtime code.
- The refactor should prefer derivation over re-declaration whenever a type can be indexed from an existing shared type.
- Runtime behavior, schema layout, and endpoint semantics should remain unchanged.

## Testing Decisions

- Good tests here prove behavioral compatibility at module boundaries, not the existence of particular type aliases.
- The highest-value tests are shared schema parses for current transport payloads, server projection tests for workflow and entity payloads, export projection tests, and seeded scenario round-trips that prove fixtures still hydrate into the same runtime projections.
- The main app and runtime seams already have meaningful coverage, so this is not a blind refactor.
- The weakest coverage relative to this refactor is fixture-generation and manifest or seed narrowness; characterization there should be the first commit.
- If the refactor introduces any new shared primitive seam, tests should prove representative payloads still parse through that seam rather than asserting implementation details.

## Findings from ln-review of slice 14a (2026-04-12)

These findings extend the problem statement above. Slice 14a introduced a new mode/cwd seam that exhibits the same duplication pattern the refactor targets.

1. **`'greenfield' | 'brownfield'` literal union declared in 3 places** — The mode enum lives in `schema.ts` (Drizzle), `api-types.ts` (`projectModeSchema`/`ProjectMode`), and is restated as inline literals in `db.ts` (`CreateProjectOptions`) and `interview.ts` (`InterviewerModeOptions`). The shared `ProjectMode` type should be canonical. Fits commit 2 (extract/stabilize shared primitives) or commit 3 (collapse server DTOs).

2. **`CreateProjectInput` in `project-mutations.ts` restates `CreateProjectRequest`** — The client-local type is isomorphic to the shared request type but includes a `cwd` field the client never sends. Should derive from or import `CreateProjectRequest` and drop `cwd`. Fits commit 5 (replace assembled transport aliases).

3. **`createApp` string-or-object overload** — `dbPathOrOptions?: string | AppOptions` exists for backward compatibility but both real callers now pass objects. Test callers use the string form. Simplify during commit 10 (remove residual duplicates).

4. **`BaseInterviewerTools & Record<string, Tool<any, any>>` widens optionality** — The intersection erases the optional `propose_phase_closure` modifier. A mapped type (`{ [K in string]?: Tool<any, any> }`) would preserve intent. Not strictly a type-duplication issue, but it weakens the contract at the same seam. Fits commit 3 or is a standalone fix.

## Out of Scope

- Changing runtime behavior
- Changing database schema or migration shape
- Reworking the knowledge model itself
- Reworking UI architecture or controller or view-model design beyond import and derivation cleanup
- Eliminating legitimate local view models
- Converting persistence-row types into transport types
- Broad naming cleanup unrelated to source-of-truth type duplication
- Brownfield exploration or other feature work
- Any non-type fixture rewrite beyond narrowing fixtures and seeds to canonical contracts
