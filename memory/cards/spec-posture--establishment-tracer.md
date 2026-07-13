# Spec posture: persisted row state + deterministic establishment tracer

Frontier: spec-posture
Status:   active
Mode:     single
Created:  2026-07-13

Full scope card — structural (new spec-row fields, new establishment step in the creation/resume flow, A41-L validation vehicle).

Posture: proving (inherited from spec-posture). Stack note: build only after `ln/fe-1187-walkthrough-remediation-2`'s auth-reversal implementation (D123-L) lands below and this branch is restacked — run beats must witness the corrected model/auth surface.

## Target Behavior

A spec's posture — `origin: greenfield | brownfield`, confirmed-not-defaulted `spec.kind`, and an optional relates-to-spec reference — is established exactly once through a deterministic product-owned ask/confirm step at spec creation/resume and is thereafter read (never re-asked, never blank on resume).

## Full-card cold-start reads

```
- memory/SPEC.md   — D118-L (the decision this materializes), A41-L (vocabulary + root-spec bet),
                     D89-L (spec.kind), D99-L (advisory settlement), D102-L (amended situating half),
                     D109-L (juncture family); Lexicon rows "Spec posture", "Spec kind"
- memory/PLAN.md   — frontier: spec-posture (Group 2, FE-1196)
- TESTING_PLAN.md  — Concern 2 "Workspace/spec posture orientation and capture logic" — its
                     decision-tree matrix is the behavioral contract for this card
- src/session/TOPOLOGY.md — runtime posture coverage ledger + the "cwd identity /
                     workspace.json live in workspace/" ownership note
- src/db/TOPOLOGY.md, src/.pi/components/TOPOLOGY.md — layout rules for the two write-heavy homes
- docs/design/SPEC_INITIATIVE_MODEL.md — deferred spec-to-spec claim model; read to know
                     what NOT to pull forward (A41-L reference-only bet)
```

## Boundary Crossings

```
→ workspace-dialog preflight (J2 session_start / J6 consult; src/.pi/components/workspace-dialog/)
→ establishment branch: workspace populated vs bare; create vs resume (workspace-session-coordinator.ts)
→ CommandExecutor.createSpec / spec row persistence (src/graph/command-executor.ts → src/db/schema.ts)
→ posture readers: kick assembly seed (src/agents/contexts/seeds/origination.ts) + question-skip on resume
→ TUI transcript (questions appear once at establishment; resume shows none)
```

## Risks and Assumptions

```
- RISK: question-peppering at entry (the 0.x failure D118-L names) → MITIGATION: skip anything
  inferable — bare cwd infers greenfield (confirm only), populated cwd gets one combined
  kind+origin ask; Concern 2 matrix rows are the contract for which questions may appear where.
- RISK: workspace-dialog seam collision with FE-1187 remediation rows (PLAN pickup note:
  "coordinate if parallel") → MITIGATION: restack after FE-1187's relevant commits land;
  diff the dialog seam before building.
- RISK: confirmed-not-defaulted `kind` breaks non-dialog createSpec callers/tests that rely on
  the `'product'` default (`command-executor.ts:168`) → MITIGATION: keep the DB-layer default;
  confirmation is establishment-flow behavior, not a schema NOT-NULL-without-default; specs
  created outside the dialog remain posture-unestablished and get the establishment step at
  next resume (D118-L covers creation *and* resume). Regenerate fixtures per pre-release posture.
- ASSUMPTION: A41-L — reference-only relates-to-spec (plain reference, no spec-to-spec claim
  model) suffices, and `function` survives as the third kind term.
    → IMPACT IF FALSE: schema rework on the specs table + routing back through ln-spec before
      the D61-L Future Direction is pulled forward; queued Group 2 cards unaffected.
    → VALIDATE: this slice IS the validation — exercise the reference-only shape on a real
      multi-spec workspace fixture; if cross-spec claim reads become necessary, stop and route
      to ln-spec (do not improvise a claim model).
    → memory/SPEC.md §Assumptions A41-L
- ASSUMPTION: FE-1187's auth reversal is landed below at build time.
    → IMPACT IF FALSE: outer run beats witness a superseded surface; inner/middle unaffected.
    → VALIDATE: `gt log` shows the implementation commits on the parent before build.
```

## Posture check (proving)

Scores on all three axes: **proof of life** — lights the full new path dialog-ask → persisted spec row → kick-assembly read; **invariants** — locates the establishment seam (product-owned, deterministic, pre-agent: dialog + coordinator, never the agent); **uncertainty** — retires A41-L's reference-only bet and answers the peppering question with a witnessable question sequence. Build it; no spike is cheaper than this tracer.

## Acceptance Criteria

```
✓ schema round-trip — src/db/row-schemas.test.ts (extend or create): specs insert/select
  round-trips `origin` ('greenfield'|'brownfield', nullable until established) and a nullable
  relates-to-spec reference; enum literals live in src/graph/schema/kinds.ts beside SPEC_KINDS;
  drizzle migration generated
✓ createSpec persists posture — src/graph/command-executor test suite (extend): creating a spec
  with posture input records origin + confirmed kind + optional relatesToSpecId
✓ deterministic establishment branching — workspace-dialog establishment tests (new, co-located
  with model.ts tests): populated cwd → combined kind ask + brownfield confirm; bare cwd →
  greenfield confirm only; each Concern 2 matrix row (no-specs/create, resume, new-spec-populated,
  new-spec-bare) maps to one parameterized case
✓ never re-asked — workspace-session-coordinator test (extend): resuming a spec with stored
  posture emits zero establishment questions; resuming a posture-unestablished spec emits them once
✓ kick assembly reads posture — src/agents/contexts/seeds origination test (extend): a resumed
  spec's context seed carries its posture (resume is not a blank restart)
✓ A41-L probe — multi-spec workspace fixture exercises the reference-only relates-to shape;
  outcome recorded against A41-L in memory/SPEC.md at reconciliation (validated, or routed to ln-spec)
```

## Invariants preserved

```
- Workspace-level posture stub in .brunch/workspace.json is UNCHANGED (D118-L states this
  explicitly) — guarded by: existing src/workspace/workspace-state-store tests staying green
- Existing workspace-dialog preflight selections (resumeSpec etc.) keep working — guarded by:
  existing workspace-dialog/model tests; if the flow has no tests today, pin the current
  selection behavior in the new establishment tests rather than rewriting the model
- D99-L advisory→settled monotonic settlement semantics untouched — guarded by: src/graph
  settlement tests staying green (this card adds no capture-conduct behavior)
- Agent never establishes posture (D118-L: product-owned establishment; agent reads only) —
  stop-the-line: if an implementation path needs the agent to write posture, that is a respec
  signal, not a workaround
```

## Verification Approach

```
- Inner: unit tests above + npm run fix — proves schema, persistence, branching, and skip logic
- Middle: deterministic create/resume flow through workspace-session-coordinator over populated
  vs bare fixture workspaces — the Concern 2 matrix as parameterized cases; proves the
  decision tree end-to-end without a live agent
- Outer: manual walkthrough beats per TESTING_PLAN.md Concern 2 — the populated-cwd
  brownfield-confirm run and the bare-workspace orientation run (PLAN's "run D"/"run B";
  resolve exact run ids against TESTING_PLAN at build). Owned by THIS frontier (FE-1196):
  run on this branch after restack onto the landed auth reversal, before branch tie-off —
  they are the peppering-question verdict and may not ride a later lane.
```

## Cross-cutting obligations

```
- TESTING_PLAN.md Concern 2 matrix is the behavioral contract — update its check items to
  reflect what landed; do not fork a second posture matrix
- src/session/TOPOLOGY.md runtime posture coverage ledger + workspace/-vs-db ownership:
  spec-row posture is spec-row state (src/db); workspace posture stays in workspace/ — keep
  the boundary and update the ledger/topology notes touched
- Keep the question sequence minimal (D118-L) — a new question is admissible only if its
  answer is not inferable from cwd state or stored posture
- Out of scope, stays with frontier FE-1196: the capture-conduct posture reader (brownfield
  facts gating per D99-L) and richer workspace-level posture persistence (deferred) — do not
  pull them into this slice
```

## Expected touched paths (tentative)

```
src/db/
├── schema.ts                          ~  (specs: + origin, + relates-to reference)
└── row-schemas.ts                     ~  (+ co-located test extension)
drizzle/
└── 0009_*.sql (+ meta)                +  (generated migration)
src/graph/
├── schema/kinds.ts                    ~  (+ SPEC_ORIGINS literals)
└── command-executor.ts                ~  (createSpec posture input; + test extension)
src/.pi/components/workspace-dialog/
├── model.ts                           ~  (establishment ask/confirm branch)
└── establishment.ts (+ test)          +? (only if model.ts outgrows its boundary — fractal rule)
src/session/
├── workspace-session-coordinator.ts   ~  (create/resume wiring; resume skip; + test extension)
├── session-orientation.ts             ~? (orientation choice reads posture)
└── TOPOLOGY.md                        ~  (posture coverage ledger note)
src/agents/contexts/seeds/
└── origination.ts                     ~  (seed carries posture; + test extension)
TESTING_PLAN.md                        ~  (Concern 2 check items)
memory/SPEC.md                         ~  (at reconciliation: A41-L outcome; D118-L current-state
                                           pointer moves from "no code home yet" to the code home)
memory/PLAN.md                         ~  (frontier status/pointer)
```
