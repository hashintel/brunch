# Live selected-spec mention autocomplete

Frontier: poc-live-ship-gate
Status:   next
Mode:     single
Created:  2026-06-05

## Orientation

- Containing seam: Brunch Pi product shell `#` autocomplete over the selected-spec graph; this is the adapter edge where Pi autocomplete inserts visible stable graph-code text, not hidden mention metadata.
- Relevant frontier item: `poc-live-ship-gate` because this is a composed-product-path defect visible in a live seeded TUI session. It does **not** advance M7 mention ledger/staleness; it only fixes the current autocomplete source.
- Planning note: the slice is prepared but intentionally parked while `elicitation-backlog` and the remaining temporary elicitor cross-cut work have priority. Return when FE-811 is back on the critical path.
- Volatile handoff state: no `HANDOFF.md`; the projection/rendering topology work has since moved the Pi shell to `src/.pi/brunch-pi-extensions.ts` and mention code to `src/.pi/extensions/mentions/index.ts`. Diagnosis still proves the live TUI menu shows `#D12/#I9/#A10` from `FIXTURE_GRAPH_MENTION_SOURCE` while the selected spec has real graph nodes.
- Main open risk: the build path must delete production fixture-backing without accidentally inventing a broader graph projection layer or coupling autocomplete to DB access.

Posture: proving (inherited from `poc-live-ship-gate`).

Frontier-level cross-cutting obligations this slice carries:

- Preserve D14-L/D62-L: inserted mention text is only `#<projected graph code>` from stable kind + ordinal; labels/descriptions remain UI-only.
- Preserve D52-L: `.pi/extensions/` adapts Pi seams and may consume selected-spec graph readers injected by the product shell; it must not import `db/` or own graph truth.
- Preserve the M7 caveat: no mention ledger, staleness hint, or `prepareNextTurn` machinery is added in this slice.
- Preserve co-tenancy: `src/.pi/brunch-pi-extensions.ts` is the expected shell touch point after the Pi-extension topology move; check `git status` before building because it overlaps common extension-registry work.

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
✓ No mention ledger, staleness hints, DB imports, or new reusable projection module are introduced.

### Verification Approach

- Inner: `npm test -- src/.pi/__tests__/mention-autocomplete.test.ts src/app/brunch-tui.test.ts src/.pi/__tests__/extension-registry.test.ts -t "mention|extension registry"` — proves provider mechanics, shell wiring, and explicit registry behavior against live injected graph overview data.
- Inner: targeted negative assertion — proves `D12/I9/A10` do not appear unless an explicit test fake source supplies them.
- Middle: optional seeded workbench smoke — launch/reload against `.fixtures/workbenches/seeded-dev-rpc` and observe `#` suggestions from `Macro View — grounded intent base` nodes.

### Cross-cutting obligations

- Keep autocomplete as presentation/handle insertion only; ledger/staleness remains M7.
- Keep selected-spec authority explicit through already-bound `graphDeps.reads.getGraphOverview()`.
- Keep projection trivial and local unless another surface needs the same structured candidate shape.

### Assumption dependency

None — this slice builds against already-landed selected-spec graph readers and Pi autocomplete provider seams.

### Expected touched paths (tentative)

```pseudo
src/.pi/
├── __tests__/
│   ├── mention-autocomplete.test.ts              ~
│   └── extension-registry.test.ts                ?
├── extensions/
│   └── mentions/
│       └── index.ts                              ~
└── brunch-pi-extensions.ts                       ~

src/app/
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
