# Cross-cut RENDER — preview harness + fixture game plan

Frontier: n/a (cross-cut enabling infrastructure; see `memory/CROSS_CUT_PLAN.md` §Renderer feedback loops)
Status:   active
Mode:     chain
Created:  2026-06-07

## Orientation

- **Why this card exists.** Every CROSS_CUT ● row that emits LLM-facing text (graph slices,
  workspace/session context, snapshots, prompt composition) needs an *eyeball-before-test*
  oracle. The tracer DoD has no slot for it. This card delivers that harness **and** resolves
  its chicken-and-egg prerequisites, so the per-seam renderer cards (graph-slices,
  workspace-context, session-context) can build on solid ground.
- **The chicken-and-egg (why a dedicated card).** A renderer needs a projection to feed it; a
  projection needs a legal, coherent graph to project; we are short on fixtures everywhere.
  Build order is therefore inverted from the layer stack: **fixtures → projections →
  renderers → harness**. This card owns the two *shared enablers* (fixtures + harness); the
  seam cards own their own projection+renderer pairs on top.
- **Seam:** prerequisite oracle for Seam 1 READ (and any later rendered-text row).
- **Frontier item:** none — CROSS_CUT capability-surface infra. No new Linear issue/branch by
  default; attach to whatever branch is active when built.
- **Posture:** proving (`certainty: proving`) — build the smallest harness that makes one
  renderer eyeball-lockable, then reuse; no speculative renderer scaffolding.
- **Execution order: Card B, then Card A** (despite file order). Stand up the harness first
  on an *existing* fixture (visible feedback loop early; B does not need A), then author the
  spread fixtures and eyeball them through the harness as you build them. The two are
  mutually independent — neither blocks the other — so this order is a feedback-loop
  preference, not a hard dependency.

### What already exists (audit — do not reinvent)

Fixture-creation machinery is already a working loop:

```diagram
  seedFixture()              fixture-curation-loop.ts            exportSeedFixture()
  JSON base ──────▶ DB ──────▶ expand via real propose-graph ──────▶ DB ──────▶ fixture JSON
  (explicit basis)            /commit_graph agent path                          (curated truth)
                             validators keep it legal+coherent
```

- `src/graph/seed-fixtures.ts` — `seedFixture(executor, fixture)`; `SeedFixture` JSON contract.
- `src/probes/fixture-curation-loop.ts` — seed → real `propose-graph`/`commit_graph` expansion
  → readback (default seed `bilal-port-variants/macro-view-grounded-intent`).
- `src/graph/export-fixtures.ts` — `exportSeedFixture(db, {specId, projection})` round-trips a
  refined DB graph back to fixture JSON.
- **Validators** (keep generated graphs legal/coherent): `graph/policy/category-policy.ts`,
  `graph/command-executor/commit-graph-batch.ts`, `graph/schema/{nodes,edges,reconciliation-need}.ts`,
  `graph/spec-ownership.test.ts`, `graph/architecture.test.ts`.
- **Render-test style today is invariant-only** (`.toContain(...)`, e.g.
  `renderers/workspace/workspace-snapshot.test.ts`). **No `toMatchFileSnapshot`/golden pattern
  exists yet** — the lock stage is net-new (this card introduces it once).

**Deterministic seeding recipe** (the path a TDD thread uses — no live agent):

```ts
import { createDb } from '../db/connection.js';
import { CommandExecutor } from '../graph/command-executor.js';
import { seedFixture, type SeedFixture } from '../graph/seed-fixtures.js';

const db = createDb(':memory:');                 // or a file path for a script
const executor = new CommandExecutor(db);
const fixture = JSON.parse(/* read .fixtures/seeds/<set>/<slug>.json */) as SeedFixture;
seedFixture(executor, fixture);                  // routes through commitGraph → real validators
// now read via graph/snapshot.ts (getGraphOverview / getNodeNeighborhood) and render
```

`seedFixture` only accepts **`explicit`-basis** fixtures and throws on any structural rejection,
so legality+coherence is guaranteed by the **commit path itself** — deterministically. See
`src/graph/seed-fixtures.test.ts` for the canonical setup.

**Renderer migration state (matters for which renderer to demonstrate on):**
- **Real, in target home:** `renderers/graph/neighborhood.ts` (`formatNeighborhood`) +
  `projections/graph/neighborhood.ts` (`projectNeighborhood`); `renderers/workspace/workspace-snapshot.ts`.
- **Topology stubs (`export {}`):** `renderers/graph/{overview,commit-result,reconciliation-needs}.ts`
  and `projections/graph/overview.ts`. Their real code still lives in
  `src/.pi/extensions/graph/command-adapter.ts` (`formatGraphOverview` etc.), pending migration.
  **Do not demonstrate the harness on these** — pick a renderer already in its target home.

### Coverage matrix (the permuted "what we need")

`✓` exists · `~` partial/close · `✗` missing. Fixture column = is there fixture data rich
enough to *exercise* this row.

| Row (● = POC-required) | Fixture | Projection | Renderer |
| --- | --- | --- | --- |
| graph overview ● | ✓ | ✓ | ✓ |
| graph neighborhood ● | ✓ | ✓ | ✓ |
| graph list-by-kind ● | ~ | ✗ | ✗ |
| graph list-by-band ● | ~ | ✗ | ✗ |
| graph find-related-to-anchor ● | ~ | ~ (neighborhood ≠) | ✗ |
| graph IS_NOT / absence ● | ✗ | ✗ | ✗ (Q1) |
| workspace tree + file counts ● | n/a (fs) | ✗ (cwd stub) | ✗ |
| workspace specs-overview ● | ✗ (need multi-spec) | ✗ | ✗ |
| workspace sessions-overview ● | ✗ (need multi-session) | ✗ | ✗ |
| session context (binding + runtime frame) ● | ~ | ✓ (runtime-state) | ✗ |
| session transcript | ✓ | ✓ | ✓ |

**Existing fixtures** (`bilal-port`, `bilal-port-variants`) are **single-spec, single-session**
graphs. The gaps they cannot exercise: full kind/band spread, varied edge category/direction,
absence cases (thesis-with-no-proof), and **multi-spec / multi-session workspaces**.

---

## Card A — fixture game plan (cover the matrix gaps) — `next`

### Objective

Produce a small, reusable set of legal+coherent fixtures as **hand-authored `SeedFixture`
JSON** seeded through `seedFixture` (the real `commitGraph` validator path), sufficient to
exercise every ● renderer row above — deterministically, with no live agent.

### Acceptance Criteria

```
✓ a "kind/band spread" fixture: ≥1 node of every plane×kind likely needed, spanning all
  three readiness bands (grounding | elicitation | commitment)
✓ an "edge spread" fixture: covers each D51-L edge category in both directions, plus at
  least one absence case (e.g. a thesis with no proof edge) for the future IS_NOT row
✓ a "workspace spread" set: ≥2 specs in one workspace, ≥2 sessions with differing turn
  counts/grades, to exercise specs-overview and sessions-overview
✓ each fixture is hand-authored explicit-basis SeedFixture JSON under .fixtures/seeds/<set>/,
  seeded via seedFixture(executor, fixture) — legality+coherence guaranteed by the commit
  path's validators (seedFixture throws on any structural rejection). NO live propose-graph
  agent needed; that loop is optional later enrichment, not a build requirement here.
✓ npm run seed loads the new sets without error
```

### Verification Approach

```
- Inner: graph/seed-fixtures.test.ts — new sets seed cleanly; node/edge counts as expected
  (extend the existing in-memory `createDb`/`CommandExecutor`/`seedFixture` test setup)
- The commit path itself is the validator: a structurally-illegal fixture makes seedFixture
  throw, so a clean seed IS the legality proof (category-policy, commit-graph-batch, spec-ownership)
```

### Cross-cutting obligations

```
- legality+coherence comes from the commit path (seedFixture → commitGraph validators), not
  from hand-forging rows; fixtures are explicit-basis only (seedFixture rejects other bases)
- fixtures live under .fixtures/seeds/<set>/ with a README per the probe-first convention
- absence cases are expressed by OMITTING edges (absence is the default), never by deletion
```

### Assumption dependency

Depends on: `seedFixture` + `CommandExecutor` + `createDb(':memory:')` (all have; see recipe in
Orientation). Low risk — pure deterministic data authoring through an existing validated path.
The live `fixture-curation-loop` / `exportSeedFixture` round-trip is available for richer content
later but is explicitly **not** on this card's path.

### Expected touched paths (tentative)

```
.fixtures/seeds/
├── <kind-band-spread>/      +   (new set + README)
├── <edge-spread>/           +
└── <workspace-spread>/      +
src/probes/fixture-curation-loop.ts   ?   (parameterize seed set / target if needed)
src/graph/seed-fixtures.test.ts       ~   (load new sets)
```

---

## Card B — render preview→lock→formalize harness — `done`

### Objective

A dev loop that renders a chosen renderer over a chosen fixture to a reviewable file
(sketch), promotes that file to a golden master (lock), and backs it with invariant asserts
(formalize) — establishing the net-new `toMatchFileSnapshot` pattern once.

### Acceptance Criteria

```
✓ src/scripts/render-preview.ts: given (renderer, fixture) loads the seeded spec via
  seedFixture and writes rendered output to a reviewable, diffable file
✓ npm run render wired (script-only; --watch deferred)
✓ demonstrated end-to-end on a renderer already in its target home — graph NEIGHBORHOOD
  (`projectNeighborhood` → `formatNeighborhood`), NOT the stubbed overview: sketch file →
  toMatchFileSnapshot lock co-located with the renderer test → ≥1 invariant assert
✓ golden artifacts co-locate with the renderer test (src/renderers/<domain>/__previews__/...),
  NOT under .fixtures/ (reserved for probe-first/transcript convention)
✓ exploration produces no failing tests (sketch is outside the test run)
```

### Verification Approach

```
- Inner: src/renderers/graph/neighborhood.test.ts (new sibling) — toMatchFileSnapshot golden +
  invariant asserts using getNodeNeighborhood → projectNeighborhood → formatNeighborhood;
  proves the pattern on a real renderer
- Use an EXISTING seed fixture (e.g. bilal-port) — B runs before A, so do NOT depend on
  Card A's spread fixtures here; they get their own locks once A lands
- Manual: npm run render writes the preview file; eyeball; re-run on edit
```

### Cross-cutting obligations

```
- dependency direction: scripts → renderers → projections; never reversed (renderers/README, D52-L)
- the file-snapshot golden is human-readable and PR-diffable; invariant asserts encode meaning
  (projected codes not raw ids; active_context omits superseded; no dangling-endpoint edges)
- harness is generic over (renderer, fixture); not special-cased per renderer
```

### Assumption dependency

Depends on: Card A fixtures (something worth rendering), `src/renderers/` layer (have), vitest 4
`toMatchFileSnapshot` (have), `src/scripts/` home (have, D52-L). Low risk.

### Expected touched paths (tentative)

```
src/scripts/render-preview.ts                +   (sketch driver)
package.json                                 ~   (+ "render" script)
src/renderers/graph/neighborhood.test.ts     +   (demonstrate lock + formalize; real renderer)
src/renderers/graph/__previews__/            +   (golden artifacts, co-located)
```

---

## Hand-off boundary (what this card does NOT own)

- The **missing projections + renderers themselves** for graph slices, workspace context, and
  session context belong to their seam cards (`crosscut-read--graph-slices.md` and the deferred
  workspace/session context siblings). This card delivers the **fixtures they project from** and
  the **harness they lock against** — not their projection/renderer code.
- **Q1 / IS_NOT** stays deferred; Card A only seeds the *absence fixture* so the row is testable
  once that micro-decision lands.
- **prompt-composition** rendering can reuse Card B's harness later; not exercised here.

## Relationship to `dev-seed-fixtures--semantic-graph-mutations`

Soft, directional — **not a build dependency**. That card adds patch/delete + a dev curation
RPC for editing *existing* graph items in place; Card A here only *creates new* fixtures, which
is **additive** (seed → propose-graph expansion → export, all present today). The additive path
covers every Card A case without patch/delete: absence fixtures = simply omit the edge (absence
is the default); multi-spec/multi-session = additive creation.

Where they meet, for coordination:
- **Shared output surface** — both write `.fixtures/seeds/**` via `exportSeedFixture`. Coordinate
  in a shared worktree (that card flags `command-executor.ts` / `export-fixtures.ts` churn).
- **Thematic overlap** — that card's follow-on #2 ("capture curated reference seed set") is the
  same activity as Card A, reached via the patch/delete *curation* path instead of additive
  *generation*. If in-place repair of a generated fixture ever beats regeneration, Card A may
  *use* the semantic-mutation command once it lands — but must not block on it.
- **Consistent stance** — both keep agent `commit_graph` creation-only (that card's follow-on #4
  = CROSS_CUT ledger Q5). No conflict.
