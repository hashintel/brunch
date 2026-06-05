# Live selected-spec mention autocomplete

Frontier: poc-live-ship-gate
Status:   active
Mode:     single
Created:  2026-06-05

## Orientation

- Containing seam: Brunch Pi product shell `#` autocomplete over the selected-spec graph; this is the adapter edge where Pi autocomplete inserts visible stable graph-code text, not hidden mention metadata.
- Relevant frontier item: `poc-live-ship-gate` because this is a composed-product-path defect visible in a live seeded TUI session. It does **not** advance M7 mention ledger/staleness; it only fixes the current autocomplete source.
- Volatile handoff state: no `HANDOFF.md`; diagnosis proved the live TUI menu shows `#D12/#I9/#A10` from `FIXTURE_GRAPH_MENTION_SOURCE` while the selected spec has real graph nodes.
- Main open risk: the build path must delete production fixture-backing without accidentally inventing a broader graph projection layer or coupling autocomplete to DB access.

Posture: proving (inherited from `poc-live-ship-gate`).

Frontier-level cross-cutting obligations this slice carries:

- Preserve D14-L/D62-L: inserted mention text is only `#<projected graph code>` from stable kind + ordinal; labels/descriptions remain UI-only.
- Preserve D52-L: `.pi/extensions/` adapts Pi seams and may consume selected-spec graph readers injected by the product shell; it must not import `db/` or own graph truth.
- Preserve the M7 caveat: no mention ledger, staleness hint, or `prepareNextTurn` machinery is added in this slice.
- Preserve co-tenancy: `src/.pi/pi-extension-shell.ts` is currently modified by adjacent FE-809 work; coordinate before building this card on the same worktree.

## Card 1 — Replace fixture-backed mention candidates with live selected-spec nodes

Status: next
Weight: light

### Objective

Typing `#` in a Brunch TUI session lists graph nodes from the currently selected specification instead of the hard-coded fixture identifiers.

### Acceptance Criteria

✓ Product shell default mention source is live graph-backed when selected-spec graph deps are present.
✓ Production code no longer exports or defaults to `FIXTURE_GRAPH_MENTION_SOURCE` / `#D12 #I9 #A10` fixture candidates.
✓ Autocomplete suggestions include projected codes built from live `overview.nodes` (`formatGraphNodeCode(node.kind, node.kindOrdinal)`) and insert only `#CODE`.
✓ When graph deps are absent, mention autocomplete yields no Brunch graph candidates rather than falling back to dummy data.
✓ No mention ledger, staleness hints, DB imports, or new `graph/project/*` projection module are introduced.

### Verification Approach

- Inner: `npm test -- src/.pi/__tests__/mention-autocomplete.test.ts src/brunch-tui.test.ts -t mention` — proves provider mechanics and shell wiring against live injected graph overview data.
- Inner: targeted negative assertion — proves `D12/I9/A10` do not appear unless an explicit test fake source supplies them.
- Middle: optional seeded workbench smoke — launch/reload against `.fixtures/workbenches/seeded-dev-rpc` and observe `#` suggestions from `Macro View — grounded intent base` nodes.

### Cross-cutting obligations

- Keep autocomplete as presentation/handle insertion only; ledger/staleness remains M7.
- Keep selected-spec authority explicit through already-bound `graphDeps.snapshots.getGraphOverview()`.
- Keep projection trivial and local unless another surface needs the same structured candidate shape.

### Assumption dependency

None — this slice builds against already-landed selected-spec graph snapshots and Pi autocomplete provider seams.

### Expected touched paths (tentative)

```pseudo
src/.pi/
├── __tests__/
│   └── mention-autocomplete.test.ts              ~
├── extensions/
│   └── mention-autocomplete.ts                   ~
└── pi-extension-shell.ts                         ~  ! concurrent FE-809 edits present

src/
├── brunch-tui.test.ts                            ~
└── brunch-tui.ts                                 ?  # only if shell cannot derive source from graph deps alone
```

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?
