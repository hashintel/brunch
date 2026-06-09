# Graph taxonomy ownership leaf (close the web→drizzle bundle leak)

Frontier: n/a (graph/db shared-seam hardening)
Status:   active
Mode:     single
Created:  2026-06-09

## Orientation

- **Seam:** the `db/ ↔ graph/ ↔ web/` taxonomy boundary. Domain enum `const` arrays
  (`INTENT_KINDS`, `EDGE_CATEGORIES`, `NODE_BASES`, readiness/lens/backlog enums, …)
  currently live in [`src/db/schema.ts`](file:///Users/lunelson/Code/hashintel/brunch-next-chi/src/db/schema.ts)
  and flow *outward* (D52-L, I26-L: `graph/index.ts` re-exports them so other layers
  avoid importing `db/` directly).
- **Frontier item:** none — this is a shared-seam hardening fix, not a PLAN frontier.
  Governing decisions: **D52-L** (source topology / dependency direction) and **I26-L**
  (schema-library import scoping + "no direct `db/` imports outside `graph/`").
- **Open risk / why now:** [`src/web/components/node-card.tsx`](file:///Users/lunelson/Code/hashintel/brunch-next-chi/src/web/components/node-card.tsx#L1-L6)
  value-imports `NODE_KIND_METADATA` / `formatGraphNodeCode` from
  [`graph/schema/nodes.ts`](file:///Users/lunelson/Code/hashintel/brunch-next-chi/src/graph/schema/nodes.ts#L11),
  which value-imports the `*_KINDS` arrays from `db/schema.ts`, which imports `drizzle-orm`
  and evaluates `sqliteTable(...)`. Result: **drizzle is in the browser bundle** —
  confirmed: `dist-web/assets/brunch-web.js` matches `drizzle|sqliteTable`. Under
  `verbatimModuleSyntax: true`, even type-only `import {}` lines are emitted at runtime.
- **Posture:** earned. The design is settled — user approved **Option A** (domain owns
  taxonomy; db is a consumer) over the cheap `import type` patch and over inline-duplication.
  Closure move: materialize a drizzle-free taxonomy leaf and invert the one db edge.

## Target Behavior

The web build target transitively contains no Drizzle/persistence code because all domain
enum taxonomy lives in a drizzle-free `src/graph/schema/kinds.ts` leaf that both `db/` and
`graph/` import, and `db/schema.ts` no longer owns or exports any enum `const` array.

## Boundary Crossings

```
→ src/graph/schema/kinds.ts          (new drizzle-free leaf: zero imports)
→ src/db/schema.ts                   (imports enums from kinds.ts for column constraints)
→ src/graph/schema/{nodes,edges,elicitation-backlog}.ts  (derive types from kinds.ts)
→ src/graph/index.ts                 (re-export enums from kinds.ts, not db/schema.ts)
→ graph runtime consumers            (command-executor*, review-set, rpc/methods/dev-graph)
→ src/web/components/node-card.tsx   (unchanged source; leak closes transitively)
→ src/graph/architecture.test.ts     (new guards)
```

## Risks and Assumptions

```
- RISK: db/schema.ts importing from graph/schema/kinds.ts introduces a layer cycle.
    → MITIGATION: kinds.ts is a pure zero-import leaf (constants only, no `graph/atoms`,
      no drizzle). graph/* → db/schema → kinds is acyclic because kinds is a sink. Add a
      leaf-purity guard test asserting kinds.ts has zero import statements.
- RISK: db now depends on graph/ — contradicts D52-L's "graph imports from db; no other
    layer imports db directly" clause and db/README's "enums flow outward from db".
    → MITIGATION: this is the approved decision change. Refine D52-L + I26-L + both READMEs
      in the same slice so the inversion is recorded, and constrain db→graph to the single
      kinds.ts edge via a guard test.
- ASSUMPTION: every enum array currently in db/schema.ts is domain taxonomy, not a storage
    concept, so all of them belong in kinds.ts (node kinds, NODE_BASES, EDGE_CATEGORIES,
    EDGE_STANCES, READINESS_GRADES, READINESS_BANDS, LENS_AFFINITIES,
    ELICITATION_BACKLOG_STATUSES) plus a named NODE_PLANES (currently inlined 3× as
    ['intent','oracle','design','plan']).
    → IMPACT IF FALSE: an array that is genuinely storage-only would be miscategorized;
      low blast radius (move it back, db re-owns it).
    → VALIDATE: each is consumed by a graph domain type or validator (confirmed:
      command-executor.ts, schema/{nodes,edges,elicitation-backlog}.ts), and db uses them
      only as `text({ enum })` column constraints.
```

## Posture check (earned)

- **Closes:** the architectural fork from the prior thread (Option A vs `import type` vs
  inline) and the active web→drizzle bundle leak.
- **Materializes:** the "domain owns taxonomy, db is a consumer" decision into topology
  (`graph/schema/kinds.ts`).
- **Canonicalizes:** one source of truth for domain enum vocabulary, at a drizzle-free path.
- **Deletes/retires:** the enum `const` array definitions in `db/schema.ts`; the inlined
  `['intent','oracle','design','plan']` plane triplication.
- **Locks in:** web build target is drizzle-free (new invariant + guard).

## Acceptance Criteria

```
✓ kinds-leaf-purity (architecture.test) — src/graph/schema/kinds.ts contains zero import statements
✓ db-imports-only-kinds (architecture.test) — db/ imports from graph/ only via graph/schema/kinds.ts
✓ no-enum-arrays-in-db (architecture.test or grep) — db/schema.ts exports no `*_KINDS`/`EDGE_*`/`NODE_BASES`/readiness/lens/backlog const array
✓ web-bundle-drizzle-free — after `npm run build:web`, dist-web bundle contains no `drizzle`/`sqliteTable`
✓ existing graph suite green — command-executor, seed-fixtures, role-named-edge, category-policy tests pass with enums sourced from kinds.ts/graph index
✓ existing I26-L boundary test still green — no src/ module outside graph/ imports from db/
✓ npm run verify green (oxlint type-aware + oxfmt + vitest + build)
```

## Verification Approach

```
- Inner: unit/architecture grep tests — kinds.ts leaf purity; db→graph edge constrained to
  kinds.ts; db/schema.ts exports no enum arrays; existing I26-L boundary test unchanged-green.
- Middle: `npm run build:web` then assert dist-web JS has no `drizzle|sqliteTable` match
  (the regression oracle for the leak). Consider a small scripted check so it runs in CI.
- Outer: none required (read-only presentation already covered by web suite).
```

## Cross-cutting obligations

```
- Preserve I26-L: non-graph layers still must not import db/ directly; they consume enum
  taxonomy via graph/index.ts (now sourced from kinds.ts) — keep architecture.test green.
- Preserve D52-L's other directed edges; only the db→graph/schema/kinds taxonomy edge is new.
- Preserve D62-L canonical node reference codes (NODE_KIND_METADATA + kindOrdinal) — do not
  relocate NODE_KIND_METADATA out of nodes.ts; only the raw kind/plane/basis arrays move.
- Keep NODE_KIND_METADATA, formatGraphNodeCode, parseGraphNodeCode, intentKindCategory in
  nodes.ts (web depends on them; they are derivations, not raw taxonomy).
- Pre-release posture (free-rewrite): repoint all consumers; do not leave compatibility
  re-exports of the moved arrays in db/schema.ts.
```

## Required canonical reconciliation (land atomically with the code)

This slice changes a load-bearing decision, so SPEC/READMEs update in the same commit:

```
- D52-L: add that src/graph/schema/kinds.ts is a drizzle-free, zero-import taxonomy leaf;
  canonical domain enum vocabulary lives there (not db/schema.ts); db/ may import from it
  as its single sanctioned graph-ward edge; reaffirm web/ is a standalone drizzle-free build.
- I26-L (or a new invariant): the enum re-export seam sources from kinds.ts; the web build
  target transitively contains no Drizzle code (guarded).
- src/db/README.md: replace "enums flow outward from db/schema.ts; db owns the shared enum
  const arrays" with "domain taxonomy is owned by graph/schema/kinds.ts; db imports the enums
  it persists."
- src/graph/README.md: record kinds.ts ownership in the layout/dependency notes.
```

## Expected touched paths (tentative)

```
src/graph/schema/
├── kinds.ts              +
├── nodes.ts              ~
├── edges.ts              ~
└── elicitation-backlog.ts ~
src/graph/
├── index.ts              ~
├── command-executor.ts   ~
├── review-set.ts         ~
├── architecture.test.ts  ~
├── README.md             ~
└── command-executor/
    └── create-graph-batch.ts ~
src/rpc/methods/dev-graph.ts   ~
src/db/
├── schema.ts             ~
└── README.md             ~
src/graph/seed-fixtures.test.ts                       ~
src/graph/policy/category-policy.test.ts              ~
src/graph/command-executor/role-named-edge-draft.test.ts ~
memory/SPEC.md            ~
memory/PLAN.md            ? (frontier note only if needed)
```

## Traceability

- Refines: **D52-L** (dependency direction), **I26-L** (import scoping).
- Preserves: D54-L, D56-L, D62-L, D63-L, D64-L (taxonomy semantics unchanged; only location moves).
- Origin: cross-thread architecture review (omega builder + this thread), user-approved Option A 2026-06-09.
