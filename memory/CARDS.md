# CARDS.md

Frontier item: **Active → Canonical terminology and record-identity normalization**

## Orientation

- **Containing seam:** the specification identity boundary spanning shared Zod contracts, server projection/helpers, HTTP handlers, and routed workspace URLs where durable storage still speaks in `project` terms but product-facing seams should speak in `specification` terms.
- **Relevant frontier item:** `memory/PLAN.md` Active 1 — **Canonical terminology and record-identity normalization**.
- **Volatile handoff state:** no `HANDOFF.md` is present; the active-plan note says the low-risk client/helper wording slices are done and the remaining work is the higher-risk physical identity migration across transport/storage seams.
- **Main open risk:** a broad rename can couple DB/schema, API payloads, router paths, fixtures, and seeded resume/export flows too tightly; the next slices should cut cleanly at stable projection seams before deciding whether the storage-layer rename is worth doing now.

## Queue

### Card 1 — [done] Full scope card

**Name:** Specification-shaped shared transport projection

#### Target Behavior

Shared state and creation/list payloads cross the app boundary in a canonical `specification` shape.

#### Boundary Crossings

```text
→ server DB/core projection helpers (`src/server/db.ts`, `src/server/core.ts`)
→ shared contract boundary (`src/shared/api-types.ts`, `src/shared/specification.ts`, related tests)
→ Express handlers and client loaders/mutations consuming the projected payloads
```

#### Risks and Assumptions

- RISK: legacy `project`-shaped payload assumptions may be scattered through loaders, fixtures, and tests, causing a partial rename that looks canonical in one layer but leaks old field names elsewhere → MITIGATION: make one authoritative projection seam canonical, then update dependent tests/consumers against that seam instead of ad hoc field-by-field rewrites.
- ASSUMPTION: the existing projection seam (`listSpecifications`, `getSpecificationState`, `createNewSpecification`) is narrow enough to canonicalize outgoing payloads before any DB-table rename → VALIDATE: shared schema tests plus app/core integration tests prove canonical outbound payloads and compatibility where still required.

#### Acceptance Criteria

- ✓ **shared-contract-projection** — outbound list/create/state payloads use `specification`-named shared types/fields at the canonical shared boundary, and any still-accepted legacy `project` input is normalized only at that boundary.
- ✓ **workspace-load-and-create** — dashboard create/list and workspace load flows consume the specification-shaped contract without changing runtime behavior for seeded resume/export scenarios.

#### Verification Approach

- **Inner:** schema/projection round-trip tests — prove canonical outbound contract shape and any narrow compatibility normalization.
- **Middle:** routed API/app integration tests — prove create/list/state handlers and client consumers still interoperate.
- **Outer:** seeded manual resume/export walkthrough — proves persisted local-first state remains truthful after the contract cutover.

### Card 2 — [next] Full scope card

**Name:** Canonical specification-named browser and HTTP paths

#### Target Behavior

The canonical browser and HTTP entry paths identify a specification rather than a project.

#### Boundary Crossings

```text
→ shared route/path helpers (`src/shared/phase-descriptors.ts` and route helpers)
→ TanStack file routes, loaders, and navigation links under `src/client/routes/`
→ Express route registration and fetch targets for workspace, entities, export, and mutations
→ deep-link/reload entry into seeded workspace and export flows
```

#### Risks and Assumptions

- RISK: path renames can break generated route ids, code-split route loading, and existing deep links all at once → MITIGATION: change helper-generated paths first, keep explicit legacy aliases/redirect behavior during the cutover, and prove deep-link entry with router tests.
- ASSUMPTION: router and server seams can support one canonical specification-named path family while preserving temporary compatibility for legacy `/project/...` links long enough to keep seeded/manual flows stable → VALIDATE: route/helper tests, loader tests, and manual deep-link/resume checks.

#### Acceptance Criteria

- ✓ **canonical-route-family** — generated phase paths, workspace links, and fetch targets resolve through a specification-named canonical path family.
- ✓ **legacy-link-compatibility** — existing `/project/...` deep links still reach the same workspace/export truth through an explicit redirect or alias contract until the frontier retires that compatibility.

#### Verification Approach

- **Inner:** router/helper tests — prove generated phase paths, route ids, and navigation links use the canonical family.
- **Middle:** loader/mutation integration tests — prove workspace, entities, export, and response submission still reach the correct server seams.
- **Outer:** seeded manual deep-link/reload/export walkthrough — proves a real resumed specification survives the path cutover.

## Queue stop

Stop the prepared queue here. The next likely work — durable DB/schema identity rename and the decision about whether `scope` should stay an internal key or migrate physically — may change shape based on what compatibility burden remains after Cards 1–2 land, so it should be re-scoped after implementation evidence rather than guessed ahead.
