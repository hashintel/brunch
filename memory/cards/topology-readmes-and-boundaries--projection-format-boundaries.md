# Top-level projections and formatters topology

Frontier: topology-readmes-and-boundaries
Status:   active
Mode:     chain
Created:  2026-06-05

## Orientation

- Containing seam: source topology after FE-809 made projection and formatting real cross-cutting seams rather than local helper folders.
- Relevant frontier item: `topology-readmes-and-boundaries`; this supersedes the earlier local cleanup card that framed `project/` vs `format/` mostly as hollow-layer deletion.
- Volatile handoff state: `HANDOFF.md` remains untracked review context; FE-809 schema/emission closure has landed, so this card no longer needs to defer around dirty structured-exchange work.
- Main open risk: top-level `projections/` and `formatters/` could become vague utility buckets. The migration must define them as narrow boundary layers with import rules, not as places to put any reusable function.

Posture: proving (inherited from `topology-readmes-and-boundaries`).

Frontier-level cross-cutting obligations this slice carries:

- Preserve D52-L dependency direction: graph owns graph truth and may import `db/`; session owns Pi JSONL/session semantics; `.pi`, `rpc`, and app entrypoints adapt product seams rather than owning domain logic.
- Preserve D37-L/D41-L structured-exchange schema lock: details construction remains Zod/projector-owned; markdown remains formatter-owned; `.pi` remains adapter/UI registration.
- Preserve topology README authority: every moved directory with a README gets updated in the same commit that changes its ownership or layout.
- Preserve free-rewrite posture: move imports directly and delete old paths; do not leave compatibility barrels for old `project/` / `format/` locations unless removed in the same slice.
- Preserve overlap discipline: this card touches broad topology and is not parallel-safe with other cards moving `src/{graph,session,structured-exchange,.pi}` files.

## Target topology sketch

```pseudo
src/
├── app/              [product entrypoints and host wiring]
├── workspace/        [cwd/package/workspace identity]
├── scripts/          [local executable utilities]
├── graph/            [graph truth, mutation, readers, policy]
├── session/          [Pi JSONL/session semantics]
├── projections/      [structured DTOs derived from domain/session/tool facts]
│   ├── graph/
│   ├── session/
│   ├── workspace/
│   └── structured-exchange/
├── formatters/       [lossy text/markdown/toon/tool content]
│   ├── markdown.ts
│   ├── toon.ts       ? [only if current code already needs it]
│   ├── graph/
│   ├── session/
│   └── structured-exchange/
├── .pi/              [Pi adapters]
├── rpc/              [JSON-RPC transport/method handlers]
├── web/              [React client]
├── agents/           [prompt/resource composition]
├── probes/           [product-path probes]
└── db/               [persistence substrate]
```

Layer rules to prove during build:

```pseudo
rules:
  graph/          -> db/                  [allowed]
  projections/*   -> graph/, session/      [read/domain imports allowed]
  formatters/*    -> projections/, graph/, session/ as needed for input types
  .pi/, rpc/, app/ -> graph/, session/, projections/, formatters/, agents/
  graph/, session/ x> .pi/, rpc/, app/, web/
  projections/    x> .pi/, rpc/, app/, web/
  formatters/     x> .pi/, rpc/, app/, web/
```

## Card 1 — Lock the top-level topology decision

Status: next
Weight: full

### Target Behavior

The canonical topology documentation names `app/`, `workspace/`, `scripts/`, `projections/`, and `formatters/` as first-class source layers.

### Boundary Crossings

```pseudo
→ current D52-L / src README topology
→ new top-level layer contract and import rules
→ stale local projection/format cleanup card language
→ architecture/topology tests if they assert old root layout
```

### Risks and Assumptions

- RISK: Documentation gets ahead of code and creates a false topology claim.
  → MITIGATION: mark the migration state explicitly: layers are canonical target, with later cards materializing files.
- RISK: `projectors` vs `projections` naming remains unsettled.
  → MITIGATION: choose `projections/` unless the build uncovers an existing convention that makes `projectors/` materially clearer; update docs once, not both.
- ASSUMPTION: Top-level projection/formatter layers improve navigation more than domain-local `project/` / `format/` subtrees now that multiple domains share the pattern.
  → IMPACT IF FALSE: later cards should stop after docs and keep local folders, leaving only root-entrypoint cleanup.
  → VALIDATE: import/call-site audit included in this card's build report before moving code.

### Posture check

This proving slice establishes the target topology and makes the migration auditable before moving files. It scores on invariants and uncertainty: if the import audit shows the top-level layers would be bucket-like rather than boundary-like, the chain stops here.

### Acceptance Criteria

✓ `memory/SPEC.md` D52-L (or the current topology decision) describes `app/`, `workspace/`, `scripts/`, `projections/`, and `formatters/` with dependency direction.
✓ `src/README.md` matches the new target topology and names any not-yet-moved directories as migration state rather than current truth.
✓ This scope file no longer asks builders to merely collapse `project/` layers; it scopes a top-level topology migration.
✓ A call-site audit in the build summary identifies which current `project/` and `format/` files will move, collapse, or remain intentionally local.

### Verification Approach

- Inner: docs/readme review — proves topology claims are precise and do not overclaim completed moves.
- Inner: grep/import audit — proves the proposed moved sets are finite and not mixed with adapter-only code.
- Middle: `npm run check` — catches formatting/lint drift from documentation edits.

### Cross-cutting obligations

- Do not move source files in Card 1 except to satisfy a failing topology test.
- Do not introduce compatibility aliases.
- Do not rename the graph/session/.pi authority layers themselves.

### Expected touched paths (tentative)

```pseudo
memory/
├── SPEC.md                                             ~
└── PLAN.md                                             ?

src/
└── README.md                                           ~

memory/cards/
└── topology-readmes-and-boundaries--projection-format-boundaries.md ~
```

## Card 2 — Move root entrypoints into app/workspace/scripts

Status: next
Weight: full

### Target Behavior

No product entrypoint, workspace identity helper, or local executable utility source file remains directly under `src/` root.

### Boundary Crossings

```pseudo
→ src root entrypoint files
→ app/ product host module imports
→ workspace/ identity helper imports
→ scripts/ print snapshot imports
→ package/bin/test import paths
→ topology READMEs
```

### Risks and Assumptions

- RISK: Build/package entrypoints assume `src/brunch.ts` or `src/brunch-tui.ts` paths.
  → MITIGATION: follow TypeScript/test failures and update package scripts or bin imports directly; no root aliases.
- RISK: `package-identity` is actually session-owned rather than workspace-owned.
  → MITIGATION: move it to `workspace/` only if call sites use it as cwd/package identity; otherwise stop and rescope that file.
- ASSUMPTION: Root-level `brunch*`, `print-snapshot*`, and `package-identity*` files are entrypoint/workspace/script concerns, not domain modules.
  → IMPACT IF FALSE: affected file remains in its domain owner and the acceptance criterion is narrowed in the card update.
  → VALIDATE: call-site audit before file moves.

### Posture check

This slice materializes the `app/`, `workspace/`, and `scripts/` layer names without touching graph/session semantics. It scores on topology and deletion: root-level source ambiguity disappears.

### Acceptance Criteria

✓ `src/app/` owns Brunch product entrypoints and their tests.
✓ `src/workspace/` owns package/workspace identity source and tests if call-site audit confirms that ownership.
✓ `src/scripts/` owns print-snapshot utility source and tests.
✓ `src/README.md` and any new directory README accurately describe these layers.
✓ No root-level `src/brunch*`, `src/print-snapshot*`, or `src/package-identity*` source/test file remains.

### Verification Approach

- Inner: moved file tests — proves import-path repair preserved entrypoint behavior.
- Middle: `npm run check` and targeted tests for brunch/print/package identity.
- Gate: `npm run verify` if build scripts or package entrypoints changed.

### Cross-cutting obligations

- Keep `app/` as wiring/entrypoint code, not a new domain layer.
- Keep `workspace/` scoped to cwd/package/workspace identity; session/spec selection remains in `session/` unless a separate design changes it.
- Delete old root paths directly; do not create compatibility barrels.

### Expected touched paths (tentative)

```pseudo
src/
├── brunch.ts                                           -
├── brunch.test.ts                                      -
├── brunch.smoke.test.ts                                -
├── brunch-tui.ts                                       -
├── brunch-tui.test.ts                                  -
├── print-snapshot.ts                                   -
├── print-snapshot.test.ts                              -
├── package-identity.test.ts                            -
├── app/                                                +
│   ├── README.md                                       +
│   ├── brunch.ts                                       +
│   ├── brunch.test.ts                                  +
│   ├── brunch.smoke.test.ts                            +
│   ├── brunch-tui.ts                                   +
│   └── brunch-tui.test.ts                              +
├── workspace/                                          +
│   ├── README.md                                       +
│   ├── package-identity.ts                             +?
│   └── package-identity.test.ts                        +
├── scripts/                                            +
│   ├── README.md                                       +
│   ├── print-snapshot.ts                               +
│   └── print-snapshot.test.ts                          +
└── README.md                                           ~

package.json                                            ?
bin/                                                    ?
tsconfig*.json                                          ?
```

## Card 3 — Hoist reusable projections and formatters

Status: next
Weight: full

### Target Behavior

Reusable projection and formatting modules live under top-level `src/projections/` and `src/formatters/` instead of domain-local `project/` and `format/` folders.

### Boundary Crossings

```pseudo
→ graph/session/structured-exchange project/format modules
→ top-level projections/formatters import rules
→ .pi/rpc/agents/probes call sites
→ topology READMEs
→ architecture/source-boundary tests
```

### Risks and Assumptions

- RISK: Some domain-local files are not reusable boundary projections and should collapse into their only caller instead of moving.
  → MITIGATION: apply the same test as the old card: a file moves only if it has a named DTO/text boundary; otherwise collapse it in place.
- RISK: Structured-exchange `project/*` imports `.pi` schema types, which may make `projections/structured-exchange` look adapter-dependent.
  → MITIGATION: preserve the current schema-lock direction until a separate schema-ownership card changes it; document this as current migration state if needed.
- RISK: Large import churn hides behavior changes.
  → MITIGATION: move one family at a time inside the card and run focused tests after each family.
- ASSUMPTION: Current `graph/project`, `session/project`, and `structured-exchange/project` modules are projection-layer concerns, while current `*/format` modules are formatter-layer concerns.
  → IMPACT IF FALSE: move only the confirmed subset and mark the remainder as stale for rescoping.
  → VALIDATE: call-site audit from Card 1 and compiler/test failures during breakage-driven repair.

### Posture check

This slice materializes the projection/formatter boundary in code. It scores on invariants, topology, and deletion: old local `project/` / `format/` folders disappear unless a local owner still has a current reason to keep one.

### Acceptance Criteria

✓ `src/projections/{graph,session,structured-exchange}/` owns every surviving reusable non-text projection module.
✓ `src/formatters/{graph,session,structured-exchange}/` owns every surviving text/markdown formatter module, and `src/formatters/markdown.ts` replaces `src/render/markdown.ts` if that helper is still needed.
✓ Old `src/**/project/` and `src/**/format/` folders touched by this card are deleted unless a README names why a local folder remains.
✓ `.pi`, `rpc`, `agents`, `session`, `graph`, and probes import from the new top-level layers without compatibility barrels.
✓ Boundary tests or README rules make it clear that projections/formatters must not import adapters, app entrypoints, web, or RPC handlers.

### Verification Approach

- Inner: TypeScript import repair — proves no stale old paths remain.
- Inner: focused tests for graph formatting, session transcript formatting, structured-exchange formatting, and boundary tests.
- Middle: `npm run check` plus targeted `npm run test -- structured-exchange graph session` as applicable.
- Gate: `npm run verify` before commit.

### Cross-cutting obligations

- Do not change structured-exchange details schemas, graph command semantics, or session exchange projection semantics while moving files.
- Do not use barrels to preserve old import paths.
- Do not move web-specific formatting into top-level formatters unless it is shared outside web.

### Expected touched paths (tentative)

```pseudo
src/
├── projections/                                         +
│   ├── README.md                                        +
│   ├── graph/                                           +
│   │   ├── commit-result.ts                             +?
│   │   ├── neighborhood.ts                              +?
│   │   ├── overview.ts                                  +?
│   │   └── reconciliation-needs.ts                      +?
│   ├── session/                                         +
│   │   └── transcript-context.ts                        +?
│   └── structured-exchange/                             +
│       ├── present-options.ts                           +
│       ├── present-question.ts                          +
│       ├── present-review-set.ts                        +
│       ├── request-answer.ts                            +
│       ├── request-choice.ts                            +
│       ├── request-choices.ts                           +
│       └── request-review.ts                            +
├── formatters/                                          +
│   ├── README.md                                        +
│   ├── markdown.ts                                      +?
│   ├── graph/                                           +
│   │   ├── commit-result.ts                             +?
│   │   ├── neighborhood.ts                              +?
│   │   ├── overview.ts                                  +?
│   │   └── reconciliation-needs.ts                      +?
│   ├── session/                                         +
│   │   └── transcript.ts                                +?
│   └── structured-exchange/                             +
│       ├── present-options.ts                           +
│       ├── present-question.ts                          +
│       ├── present-review-set.ts                        +
│       ├── request-answer.ts                            +
│       ├── request-choice.ts                            +
│       ├── request-choices.ts                           +
│       └── request-review.ts                            +
├── render/                                              -?
├── graph/                                               ~
│   ├── README.md                                        ~
│   ├── project/                                         -?
│   └── format/                                          -?
├── session/                                             ~
│   ├── README.md                                        ~
│   ├── project/                                         -?
│   └── format/                                          -?
├── structured-exchange/                                 -?
│   ├── project/                                         -?
│   └── format/                                          -?
├── .pi/                                                 ~
├── rpc/                                                 ~
├── agents/                                              ~
└── probes/                                              ~

src/.pi/__tests__/structured-exchange-boundaries.test.ts ~
src/README.md                                           ~
memory/SPEC.md                                          ~
memory/PLAN.md                                          ?
```
