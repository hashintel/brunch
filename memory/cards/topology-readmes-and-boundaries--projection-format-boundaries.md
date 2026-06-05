# Projection and format boundary cleanup

Frontier: topology-readmes-and-boundaries
Status:   active
Mode:     single
Created:  2026-06-05

## Orientation

- Containing seam: source topology boundary between read snapshots, reusable product projections, and final LLM/UI text formatting across `graph/`, `session/`, and structured-exchange code.
- Relevant frontier item: `topology-readmes-and-boundaries`; this is not part of the current mention-autocomplete fix and should ride only after active structured-exchange FE-809 schema-lock work has landed or been retired.
- Volatile handoff state: no `HANDOFF.md`; there is an active scope file `memory/cards/project-graph-review-cycle--structured-exchange-schema-lock.md` and current uncommitted FE-809 edits touching structured-exchange files, so this card is **not parallel-safe** today.
- Main open risk: over-correcting a naming smell into a broad architectural rewrite. The cleanup should delete indirection where current call sites prove it is hollow, not impose a new universal layer taxonomy.

Posture: proving (inherited from `topology-readmes-and-boundaries`).

Frontier-level cross-cutting obligations this slice carries:

- Preserve D52-L: graph/session/.pi boundaries remain directed; `graph/` may import `db/`, `.pi` adapts Pi seams, and session owns transcript projection.
- Preserve topology README authority: if directory ownership changes, update the nearest `src/**/README.md` rather than leaving stale topology claims.
- Preserve bridge-as-nonpermanence: delete or move obsolete paths directly under pre-release/free-rewrite posture; do not add compatibility barrels unless they are tiny and removed in the same slice.
- Preserve overlap discipline: do not build this while FE-809 structured-exchange schema-lock is actively modifying the same files.

## Card 1 — Collapse hollow `project/` layers and relocate structured-exchange ownership

Status: deferred until FE-809 schema-lock is done or abandoned
Weight: full

### Target Behavior

The source tree has one clear convention for read snapshots, reusable projections, and final text formatting, and structured-exchange helpers live under the owner of their model.

### Boundary Crossings

```pseudo
→ existing `**/project/*` and `**/format/*` call sites
→ topology ownership decision per directory
→ file moves/deletions for hollow intermediate projections
→ imports/tests updated by breakage-driven repair
→ topology READMEs updated to describe the surviving convention
```

### Working convention to test, not assume

```pseudo
PULL
└── snapshot/read modules
    -> DB/session transcript/domain reads
    -> typed domain snapshots

FORMAT
└── format/*.ts
    -> domain snapshot or product payload
    -> final markdown/text/LLM-friendly output

PROJECT
└── only when a non-text DTO is reused by multiple surfaces
    -> web/RPC/TUI/session all consume same structured shape
    x> otherwise delete and let format consume the source shape directly

STRUCTURED-EXCHANGE
├── if model is Pi-tool-details-owned:
│   └── move project/format helpers under src/.pi/extensions/structured-exchange/
└── if model is product/session-owned:
    └── invert ownership so .pi imports src/session or src/structured-exchange model, not the reverse
```

### Risks and Assumptions

- RISK: Some `project/*` modules are doing real truncation/normalization used by more than one consumer.
  → MITIGATION: audit call sites first; keep or rename only projections with multiple non-text consumers or independently useful structured contracts.
- RISK: `src/structured-exchange/` may be mid-migration under FE-809 and moving it now could fight schema-lock changes.
  → MITIGATION: sequence this card after FE-809; use breakage-driven repair once that scope is stable.
- ASSUMPTION: Most current `project -> format` pairs are one-consumer DTO layers and can be collapsed without changing runtime behavior.
  → IMPACT IF FALSE: the slice becomes a narrower topology README/rename cleanup rather than deletion.
  → VALIDATE: import/call-site audit plus focused tests before moving files.

### Posture check

This proving slice should tell us whether `project/` is a useful convention or a naming smell in the current codebase. It scores on:

- Invariants: clarifies which layer owns read shape vs reusable DTO vs text formatting.
- Topology: materializes or deletes a directory convention instead of leaving ambiguous twin concepts.
- Deletion: removes hollow projection files and stale README claims where the audit proves no current need.

### Acceptance Criteria

✓ Every surviving `**/project/*` file has a named non-text consumer contract or multiple consumers; hollow one-consumer `project -> format` pairs are collapsed.
✓ `format/*` modules directly consume domain snapshots/payloads when no reusable projection contract exists.
✓ `src/structured-exchange/` no longer has unexplained ownership that imports `.pi/extensions/structured-exchange/shared/model`; either helpers move under `.pi/extensions/structured-exchange/` or model ownership is inverted and documented.
✓ `src/graph/README.md`, `src/session/README.md`, `src/.pi/README.md`, and any new/retained structured-exchange README describe the surviving convention accurately.
✓ Tests pass without compatibility barrels preserving both old and new import paths.

### Verification Approach

- Inner: file-scoped tests for moved/collapsed modules — proves behavior-equivalent formatting/projection output.
- Inner: import-boundary grep/architecture checks where existing tests already protect topology — proves `.pi`/graph/session direction is preserved.
- Middle: `npm run check` or targeted `npm run test -- <affected tests>` after file moves — catches stale import paths without mutating unrelated files.
- Review oracle: call-site audit summary in the build report — names each retained `project/` file and why it earns existence.

### Cross-cutting obligations

- Do not change structured-exchange runtime schema semantics while cleaning topology; schema changes belong to FE-809 or a separate schema card.
- Do not build a new abstraction layer for mention autocomplete or other one-consumer maps.
- Delete stale docs/imports rather than aliasing old locations under free-rewrite posture.

### Expected touched paths (tentative)

```pseudo
src/graph/
├── README.md                                      ~
├── project/
│   ├── commit-result.ts                           ?
│   ├── neighborhood.ts                            ?
│   ├── overview.ts                                ?
│   └── reconciliation-needs.ts                    ?
└── format/
    ├── commit-result.ts                           ?
    ├── neighborhood.ts                            ~
    ├── overview.ts                                ?
    └── reconciliation-needs.ts                    ?

src/session/
├── README.md                                      ~
├── project/
│   └── transcript-context.ts                      ?
└── format/
    └── transcript.ts                              ?

src/.pi/
├── README.md                                      ~
├── __tests__/
│   ├── structured-exchange-present-request.test.ts ?  ! overlaps FE-809 active scope
│   └── structured-exchange.test.ts                ?
└── extensions/
    └── structured-exchange/
        ├── README.md                              +?
        ├── format/                                +?
        ├── project/                               +?
        └── *.ts                                   ?  ! overlaps FE-809 active scope

src/structured-exchange/                           -? ! delete/move only after owner decision
├── project/                                       -?
└── format/                                        -?

src/agents/contexts/
├── graph.ts                                       ?
└── node.ts                                        ?

src/render/
└── markdown.ts                                    ?
```
