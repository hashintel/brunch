# Elicitation Gap Guidance Closure Slices

Frontier: elicitation-gap-guidance
Status:   active
Mode:     slices
Created:  2026-07-01

## Orientation

- Containing seam: the graph-truth / session-state / prompt-context boundary for elicitor guidance; this frontier replaces a persisted spec-global asking register with branch-reconstructed session scratchpad state.
- Relevant frontier item: `elicitation-gap-guidance` / FE-1116, inherited as the Linear issue and branch boundary from `memory/PLAN.md`.
- Volatile handoff state: the design review has been integrated into `docs/design/SESSION_LOCAL_ELICITATION_GAPS.md`; the formerly missing `.pi/extensions/agent-runtime` per-turn world-read consumer and floor helper are now in the ledger.
- Main open risk: recreating the old count/rank agenda engine under a new name; every slice must preserve one carrier, facts-not-judgments seed data, and no readiness scoring by gaps or counts.

Posture: proving (inherited from `elicitation-gap-guidance`)

Frontier-level cross-cutting obligations:

- One asking-agenda substrate only: `brunch.elicitation_scratchpad` custom session entry + one fold projection; no runtime-state duplication, no tool-result-details state.
- Durable truth remains graph-only; scratchpad entries are non-authoritative and never become canonical spec facts by projection side effect (I56-L).
- Readiness is graph facts + latest-expected-band scalar only; no persisted gap table, count coverage, soft readiness score, or floor catalog survives.
- Thin seed facts must not depend on settlement/advisory state (A36-L), even after settlement is materialized later in this frontier.
- Replace consumers before deleting producers; old `elicitation_gaps` machinery must be deleted before the frontier is done, not bridged indefinitely.

## Chain discipline

These cards are sequential within the same frontier/branch. If implementing an earlier card reveals that a later card's boundary is wrong, stop and re-scope rather than carrying the stale card forward.

---

## Card 1 — Band scalar and reference reconciliation

Status: done

### Target Behavior

Every readiness-band code consumer reads a single code-owned `latestExpectedBand(kind)` scalar whose values match the canonical readiness reference table.

### Full-card cold-start reads

- `memory/SPEC.md` — D64-L, D74-L, D94-L, D97-L, I50-L.
- `memory/PLAN.md` — frontier: `elicitation-gap-guidance`.
- `docs/design/SESSION_LOCAL_ELICITATION_GAPS.md` — §Band reconciliation and reference-file ownership split.
- `src/graph/TOPOLOGY.md` — graph schema ownership and enum taxonomy direction.
- `src/agents/contexts/data-model/TOPOLOGY.md` and `src/agents/contexts/data-model/graph/TOPOLOGY.md` — context renderer ownership.

### Boundary Crossings

```text
→ graph schema kind metadata
→ data-model graph-slice renderer
→ agent reference documents
→ focused renderer/reference tests
```

### Risks and Assumptions

- RISK: old array helpers survive because tests only cover the new helper → MITIGATION: add/adjust a negative assertion or grep-level check that `bandsForKind(kind)[0]` is gone from consumers.
- RISK: reference docs drift while code changes → MITIGATION: reconcile `readiness-bands.md`, `data-model.md`, and `question-kinds-per-intent-kind.md` in the same card.
- ASSUMPTION: The confirmed target values are `requirement → projection` and `story → null`.
    → IMPACT IF FALSE: later readiness and seed facts would classify meaningful absence incorrectly.
    → VALIDATE: tests over the scalar table and graph-slice output.
    → memory/SPEC.md: D94-L, A36-L.

### Posture check

This proving slice stabilizes the scalar seam that later slices depend on and closes I50-L's earliest-vs-latest ambiguity. No separate spike is cheaper: the proof is a code+reference reconciliation with tests.

### Acceptance Criteria

✓ `latestExpectedBand(kind)` (or equivalently named scalar helper) returns one band or `null` per node kind, including `requirement → projection` and `story → null`.
✓ Data-model graph-slice rendering no longer reads `bandsForKind(kind)[0]` or exposes earliest-band semantics.
✓ The three reference files follow the ownership split: readiness-band table in `readiness-bands.md`, source-question/role material in `data-model.md`, phrasing catalog in `question-kinds-per-intent-kind.md`.

### Verification Approach

- Inner: focused graph schema / graph-slice / reference-renderer tests — scalar values and rendered language.
- Middle: targeted `rg "bandsForKind\(.*\)\[0\]|INTENT_KIND_BANDS" src/agents src/graph` review — no obsolete consumer shape.
- Gate: `npm run fix`; `npm run verify` before committing the card.

### Cross-cutting obligations

- Do not introduce phase/stage language for readiness bands.
- Do not add seed derivation or settlement behavior in this card.

### Expected touched paths (tentative)

```text
src/
├── graph/
│   ├── schema/
│   │   └── nodes.ts                                      ~
│   └── __tests__/                                       ?
├── agents/
│   ├── contexts/data-model/graph/
│   │   ├── graph-slice.ts                               ~
│   │   └── __tests__/                                   ~
│   ├── references/
│   │   ├── readiness-bands.md                           ~
│   │   └── data-model.md                                ~
│   └── skills/elicit/references/
│       └── question-kinds-per-intent-kind.md            ~
└── graph/TOPOLOGY.md                                    ?
```

### Build notes

`readiness-bands.md` and `data-model.md` already matched the target ownership split; only `question-kinds-per-intent-kind.md` needed its duplicated band column and per-kind source-question lines removed. D94-L rejects the array-membership model outright, not just the `[0]` read, so `bandsForKind` was replaced everywhere (not left alongside the new scalar): `src/graph/queries.ts` (`GraphFilter.bands`, the old `derivePresenceCoverage` gap-predicate band check — left in place for Card 4 to delete) and `src/graph/index.ts`'s export, beyond the two paths named above. Updated goldens/expectations that encoded the old earliest-band read: `src/graph/__tests__/{queries,read-api,seed-fixtures}.test.ts`, `graph-slice.test.ts` + its snapshot, and the `origination`/`turn-context`/`spec-context` context-render snapshots (all fed by the same `context`/`constraint`/`requirement` band reclassification).

---

## Card 2 — Session scratchpad carrier and tools

Status: next

### Target Behavior

A Brunch session branch reconstructs one current elicitation scratchpad from `brunch.elicitation_scratchpad` custom entries, and read/write tools operate only through that projection.

### Full-card cold-start reads

- `memory/SPEC.md` — D17-L, D40-L, D65-L, D81-L, D101-L, D102-L, I56-L.
- `memory/PLAN.md` — frontier: `elicitation-gap-guidance`.
- `docs/design/SESSION_LOCAL_ELICITATION_GAPS.md` — §Session-state carrier and consolidation ledger `NEW`/`REPLACE` rows.
- `src/session/TOPOLOGY.md` — transcript-backed session state rules.
- `src/.pi/extensions/TOPOLOGY.md` — adapter-only extension boundary.
- `src/session/runtime-state.ts` — fold-pattern precedent only; do not store scratchpad in runtime state.

### Boundary Crossings

```text
→ Pi session custom entries
→ session/projection fold
→ Brunch data tool adapter
→ tool result content/details
→ focused session-extension tests
```

### Risks and Assumptions

- RISK: state splits between custom entries, runtime state, and tool-result details → MITIGATION: define one fold projection and make both tools call it; tool results describe the write but do not become the state source.
- RISK: scratchpad schema accidentally stores graph truth → MITIGATION: model entries as obligation/disposition/meta only; graph handles are references, not facts.
- ASSUMPTION: Latest-snapshot-wins is sufficient for foreground writes in the current linear session model.
    → IMPACT IF FALSE: concurrent subagent writes would need an op-stream merge model, but branch-correct projection remains the seam.
    → VALIDATE: tests reconstruct after multiple appends and after stale/invalid entries.
    → memory/SPEC.md: A37-L, I56-L.

### Posture check

This is the tracer-bullet seam for D101-L: it proves branch-reconstructed scratchpad state without touching every consumer yet. It scores on proof of life and invariant stabilization.

### Acceptance Criteria

✓ A typed `brunch.elicitation_scratchpad` custom entry schema exists with parse/fold helpers and invalid entries ignored or diagnosed consistently with existing session-state folds.
✓ A read tool returns the folded scratchpad and a write tool appends a full replacement snapshot for add/resolve/update operations.
✓ Tests prove current state is reconstructed from the session branch and not from runtime-state fields or tool-result details.

### Verification Approach

- Inner: unit tests for parse/fold/write/read projection behavior.
- Middle: extension registration tests — new tools are registered and old tool names are not used by the new carrier.
- Gate: `npm run fix`; `npm run verify` before committing the card.

### Cross-cutting obligations

- Preserve branch-correct-by-construction behavior.
- Do not repoint all prompt consumers in this card unless needed to test the tool seam.

### Expected touched paths (tentative)

```text
src/
├── session/
│   ├── elicitation-scratchpad.ts                        +
│   ├── runtime-state.ts                                 ?  (read precedent; avoid storage merge)
│   └── __tests__/                                      +
├── projections/session/
│   ├── elicitation-scratchpad.ts                        +
│   └── __tests__/                                      +
├── .pi/extensions/brunch-data/
│   ├── elicitation/                                    ~
│   └── __tests__/                                      ~
├── agents/contexts/data-model/
│   └── elicitation-scratchpad.ts                       +
└── session/TOPOLOGY.md                                 ?
```

---

## Card 3 — Repoint foreground, context, and subagent consumers

Status: next

### Target Behavior

Foreground prompt composition, launch/turn/spec contexts, and subagent snapshots read graph facts plus the session scratchpad projection instead of persisted agenda rows.

### Full-card cold-start reads

- `memory/SPEC.md` — D45-L, D65-L, D74-L, D81-L, D101-L, D102-L, I56-L.
- `memory/PLAN.md` — frontier: `elicitation-gap-guidance`.
- `docs/design/SESSION_LOCAL_ELICITATION_GAPS.md` — Current topology `.pi/extensions/agent-runtime`, app composition, agents/contexts, and migration order steps 3–4.
- `src/.pi/extensions/TOPOLOGY.md` — extension adapter ownership, including foreground runtime/system-prompt registration.
- `src/agents/contexts/TOPOLOGY.md`, `src/agents/contexts/data-model/spec/TOPOLOGY.md`, `src/agents/contexts/seeds/TOPOLOGY.md` — context ownership.
- `src/.pi/extensions/subagents/TOPOLOGY.md` — subagent prompt assembly boundary.

### Boundary Crossings

```text
→ graph readers + session manager branch
→ foreground world-read cache
→ spec/session/origination context renderers
→ active-tool/transcript allowlists
→ subagent world snapshot and prompt assembly
→ elicitor prompt orientation text
```

### Risks and Assumptions

- RISK: world-read cache remains graph-LSN-only while scratchpad changes without graph mutation → MITIGATION: either keep scratchpad projection outside the graph-LSN cache or include a session-entry watermark in the cached key; test that scratchpad-only updates are visible next turn.
- RISK: thin seed becomes a ranked agenda → MITIGATION: seed only raw facts named in the design doc; no importance/rank/coverage fields.
- RISK: old and new tool names both appear in allowlists → MITIGATION: update active and transcript allowlists in the same card.
- ASSUMPTION: A minimal seed of graph LSN, kind counts, latest expected bands, raw zero-kind absence, open reconciliation needs, and optional recent mutation summary is enough for orientation.
    → IMPACT IF FALSE: the elicitor may need richer prompt interpretation later, but deterministic code still must not infer underanswered areas.
    → VALIDATE: context snapshot tests inspect facts-not-judgments output.
    → memory/SPEC.md: A36-L, D102-L.

### Posture check

This is the main tracer bullet through production prompt composition. It proves that the product wiring, not just isolated tools, uses the new scratchpad seam.

### Acceptance Criteria

✓ `.pi/extensions/agent-runtime/system-prompts/world-reads.ts` no longer pulls `getElicitationGaps`; foreground prompts can see scratchpad-only updates without a graph mutation.
✓ Launch seed, turn context, spec overview/context, and subagent prompt assembly render graph facts + scratchpad projection and never persisted agenda rows.
✓ Active-tool and transcript allowlists advertise the new scratchpad tools and not `read_elicitation_gaps` / `update_elicitation_gaps`.
✓ `elicitor.md` includes the orientation directive: new session establishes orientation and focuses a vein from neutral facts.

### Verification Approach

- Inner: world-reads/cache tests, context renderer snapshot tests, subagent prompt assembly tests.
- Middle: targeted `rg "getElicitationGaps|read_elicitation_gaps|update_elicitation_gaps" src/.pi/extensions/agent-runtime src/session src/agents src/app` review — remaining hits must be producers slated for Card 4 or tests being rewritten.
- Gate: `npm run fix`; `npm run verify` before committing the card.

### Cross-cutting obligations

- Repoint consumers before deleting old producers.
- Keep settlement/advisory state out of the thin seed.

### Expected touched paths (tentative)

```text
src/
├── .pi/extensions/
│   ├── agent-runtime/
│   │   ├── system-prompts/world-reads.ts                ~
│   │   └── system-prompts/__tests__/world-reads.test.ts ~
│   └── subagents/
│       ├── prompt-assembly.ts                           ~
│       └── __tests__/                                   ~
├── session/
│   ├── specification-overview-context.ts                ~
│   ├── originate-assistant-turn.ts                      ~
│   └── __tests__/                                      ~
├── projections/session/
│   └── transcript-context.ts                            ~
├── agents/
│   ├── contexts/
│   │   ├── data-model/spec/spec-context.ts              ~
│   │   ├── seeds/origination.ts                         ~
│   │   ├── seeds/turn-context.ts                        ~
│   │   └── **/__tests__/                                ~
│   ├── prompts/elicitor.md                              ~
│   └── runtime/elicitor/active-tools.ts                 ~
└── app/
    ├── pi-subagents.ts                                  ~
    ├── pi-extensions.ts                                 ~
    └── brunch-tui.ts                                    ~
```

---

## Card 4 — Delete persisted gap register and count readiness

Status: next

### Target Behavior

The persisted `elicitation_gaps` register, fixed seed catalog, gap sorter, count coverage, and soft readiness estimate are absent from production code.

### Full-card cold-start reads

- `memory/SPEC.md` — D45-L, D65-L, D75-L, D86-L, D101-L, I31-L.
- `memory/PLAN.md` — frontier: `elicitation-gap-guidance`.
- `docs/design/SESSION_LOCAL_ELICITATION_GAPS.md` — consolidation ledger `DELETE` rows, anti-regression oracles, and migration order step 5.
- `src/db/TOPOLOGY.md`, `src/graph/TOPOLOGY.md`, `src/projections/TOPOLOGY.md` — persistence/query/projection ownership.
- `src/.pi/extensions/TOPOLOGY.md` — runtime floor helper and tool-policy boundary inside the extension adapter tree.

### Boundary Crossings

```text
→ DB schema and row parsing
→ graph schema/query/command executor
→ runtime policy fallback
→ projection/readiness modules
→ old tool registrar and tests
→ probes that expected spawn_gap
```

### Risks and Assumptions

- RISK: deleting query helpers breaks a hidden consumer missed by grep → MITIGATION: compiler/test failures drive local rewrites only inside FE-1116 scope; do not reintroduce compatibility aliases.
- RISK: migration deletes table while local dev data still contains rows → MITIGATION: prototype posture permits deletion; no compatibility migration beyond schema drop unless tests require a clean Drizzle migration shape.
- RISK: `activeToolNamesForBrunchAgentState` keeps a dead gap parameter/floor path → MITIGATION: remove the parameter and `conservativeUncoveredFloorGaps` definition together.
- ASSUMPTION: No external public API is contracted on `elicitation_gaps` rows.
    → IMPACT IF FALSE: API compatibility would require an explicit user-approved bridge, contrary to current posture.
    → VALIDATE: public RPC/tool discovery tests and grep-level absence.

### Posture check

This closure slice retires obsolete topology and prevents bridge-as-permanence. It is required before the frontier can claim one model.

### Acceptance Criteria

✓ `elicitation_gaps` table/row/schema files, fixed gap fixtures, `elicitation-driver.ts`, gap command paths, and count coverage helpers are deleted or rewritten away.
✓ `readinessEstimate` / `renderSoftReadinessEstimate` no longer exist, and no prompt/context output says readiness is a score, coverage, or count.
✓ `.pi/extensions/agent-runtime/runtime/index.ts` no longer defines `conservativeUncoveredFloorGaps` or accepts gap/floor input in active-tool policy.
✓ Old tools are unregistered: no `read_elicitation_gaps`, `update_elicitation_gaps`, or update action `'spawn'` remains.
✓ Probe expectations no longer use `spawn_gap`; low-confidence noticings point at the session scratchpad outlet.

### Verification Approach

- Inner: graph/query/command/projection/tool tests rewritten or deleted to prove the new absence contract.
- Middle: grep-level negative oracle for `getElicitationGaps`, `derivePresenceCoverage`, `readinessEstimate`, `elicitation-driver`, `SEEDED_ELICITATION_GAPS`, `read_elicitation_gaps`, `update_elicitation_gaps`, `action: 'spawn'`, and `spawn_gap`.
- Gate: `npm run fix`; `npm run verify` before committing the card.

### Cross-cutting obligations

- No compatibility shims, aliases, or dual read paths.
- `reconciliation_needs` remains untouched.

### Expected touched paths (tentative)

```text
src/
├── db/
│   ├── schema.ts                                         ~
│   ├── row-schemas.ts                                    ~
│   └── migrations/ or drizzle artifacts                  ?
├── graph/
│   ├── schema/
│   │   ├── elicitation-gaps.ts                           -
│   │   ├── elicitation-gap-fixtures.ts                   -
│   │   └── kinds.ts                                      ~
│   ├── queries.ts                                        ~
│   ├── command-executor.ts                               ~
│   ├── command-executor/                                 ~
│   ├── elicitation-driver.ts                             -
│   ├── workspace-store.ts                                ~
│   ├── index.ts                                          ~
│   └── __tests__/                                        ~/-
├── projections/session/
│   ├── readiness-estimate.ts                             -
│   └── __tests__/                                        -/~
├── agents/contexts/data-model/
│   ├── elicitation-gaps.ts                               -
│   ├── session/readiness-estimate.ts                     -
│   └── **/__tests__/                                     ~/-
├── .pi/extensions/
│   ├── brunch-data/elicitation/                          -/~
│   ├── agent-runtime/runtime/index.ts                    ~
│   └── __tests__/                                        ~
├── app/
│   ├── pi-extensions.ts                                  ~
│   └── brunch-tui.ts                                     ~
└── probes/
    ├── capture-quality-loop.ts                           ~
    ├── public-rpc-parity-proof.ts                        ~
    └── __tests__/                                        ~
```

---

## Card 5 — Settlement materialization

Status: next

### Target Behavior

Graph items carry command-enforced `settlement: advisory | settled` orthogonal to `basis`, and projection/plan/commitment readers never treat advisory as settled.

### Full-card cold-start reads

- `memory/SPEC.md` — D63-L, D74-L, D81-L, D94-L, D99-L, I52-L, A36-L.
- `memory/PLAN.md` — frontier: `elicitation-gap-guidance`, folded settlement slice.
- `docs/design/SESSION_LOCAL_ELICITATION_GAPS.md` — §Settlement materialization.
- `src/graph/TOPOLOGY.md` and `src/graph/schema/TOPOLOGY.md` if present — graph item schema and command ownership.
- `src/projections/TOPOLOGY.md`, `src/agents/contexts/TOPOLOGY.md` — reader/projection discipline.

### Boundary Crossings

```text
→ graph node/edge schema and persistence
→ CommandExecutor validation/mutation paths
→ projection/context readers
→ capture/reference docs
→ settlement-specific tests
```

### Risks and Assumptions

- RISK: `basis` is overloaded to imply settlement → MITIGATION: schema and type tests require both dimensions and projection tests cover all four combinations where meaningful.
- RISK: advisory material leaks into plan/projection/commitment readiness as settled → MITIGATION: focused reader tests for advisory exclusion or explicit labeling.
- RISK: thin seed starts reading settlement after it exists → MITIGATION: Card 3 seed tests stay green; add a regression assertion if needed.
- ASSUMPTION: Settlement can be added as a flat item dimension without needing per-plane bespoke status types.
    → IMPACT IF FALSE: command/result types would need a broader design pass.
    → VALIDATE: schema + command tests across create/promote/rewrite/supersede/reconcile paths.

### Posture check

This slice materializes the folded D99-L/I52-L frontier obligation and closes the planning split without creating a second frontier.

### Acceptance Criteria

✓ Graph schema/types persist `settlement` separately from `basis` for relevant graph items.
✓ CommandExecutor paths enforce advisory-vs-settled transitions and do not allow projections/plans/commitments to read advisory as settled.
✓ Context/projection output exposes settlement clearly enough for capability-readiness to consult it.
✓ Capture references/docs explain advisory capture and settlement promotion without changing the thin seed dependency rule.

### Verification Approach

- Inner: schema/command/projection unit tests over advisory and settled items.
- Middle: context snapshot tests proving advisory is labeled or excluded where required.
- Gate: `npm run fix`; `npm run verify` before committing the card.

### Cross-cutting obligations

- Settlement is graph truth; session scratchpad is still non-authoritative.
- Thin seed must not depend on settlement state.

### Expected touched paths (tentative)

```text
src/
├── db/
│   ├── schema.ts                                         ~
│   └── migrations/ or drizzle artifacts                  ?
├── graph/
│   ├── schema/                                          ~
│   ├── command-executor.ts                               ~
│   ├── command-executor/                                 ~
│   ├── queries.ts                                        ~
│   └── __tests__/                                        ~
├── projections/                                         ~
├── agents/
│   ├── contexts/                                        ~
│   └── references/                                      ~
└── probes/ or fixtures                                  ?
```

---

## Card 6 — Frontier closure oracles and topology reconciliation

Status: next

### Target Behavior

The FE-1116 frontier has grep-level negative oracles, updated probes/tests, and topology docs proving one clean model with no old gap-counting residue.

### Full-card cold-start reads

- `memory/SPEC.md` — D45-L, D65-L, D74-L, D75-L, D94-L, D97-L, D99-L, D101-L, D102-L, I31-L, I50-L, I52-L, I56-L.
- `memory/PLAN.md` — frontier: `elicitation-gap-guidance`, acceptance and traceability lists.
- `docs/design/SESSION_LOCAL_ELICITATION_GAPS.md` — Complete & resolved coverage and anti-regression oracles.
- All touched `TOPOLOGY.md` files named in the design doc completion checklist.
- `docs/praxis/ln-skills.md` — topology/check discipline if modifying canonical topology docs.

### Boundary Crossings

```text
→ regression tests and probes
→ grep-level absence checks
→ co-located TOPOLOGY.md reconciliation
→ canonical planning docs if frontier status changes
```

### Risks and Assumptions

- RISK: tests prove only the new happy path, not absence of the old attractor → MITIGATION: add explicit negative oracles for old names and old language.
- RISK: topology docs still mention retired paths → MITIGATION: reconcile named topology homes after code lands, not before.
- ASSUMPTION: Cards 1–5 have landed or been consciously reshaped.
    → IMPACT IF FALSE: closure oracles will fail or encode stale expectations.
    → VALIDATE: run grep/test suite after prior cards.

### Posture check

This is an earned-style closure card inside a proving frontier: it locks in the invariant bundle and prevents residue from surviving after the tracer path works.

### Acceptance Criteria

✓ Negative oracles prove absence of old names: `getElicitationGaps`, `derivePresenceCoverage`, `readinessEstimate`, `elicitation-driver`, `SEEDED_ELICITATION_GAPS`, `read_elicitation_gaps`, `update_elicitation_gaps`, `action: 'spawn'`, and `spawn_gap`.
✓ Prompt/context snapshots contain no readiness score/count/coverage language and still render useful graph facts with an empty scratchpad.
✓ Foreground and subagent contexts receive the same scratchpad projection for the same session branch.
✓ All co-located topology files named in the design doc agree with the final materialized state.
✓ `docs/design/SESSION_LOCAL_ELICITATION_GAPS.md`, `memory/SPEC.md`, and `memory/PLAN.md` are reconciled or thinned if implementation changed the planned shape.

### Verification Approach

- Inner: focused negative-oracle tests and context/subagent snapshot tests.
- Middle: `rg` absence script/check in tests or documented closure command.
- Gate: `npm run verify`; optionally `npm run check` if the final doc state should be read-only verified.

### Cross-cutting obligations

- Do not expand into session-branching; D24-L/A37-L remains horizon.
- Delete obsolete tests/fixtures instead of preserving aliases for compatibility.

### Expected touched paths (tentative)

```text
src/
├── **/__tests__/                                      ~/-
├── graph/TOPOLOGY.md                                 ~
├── db/TOPOLOGY.md                                    ~
├── session/TOPOLOGY.md                               ~
├── projections/TOPOLOGY.md                           ~
├── .pi/extensions/TOPOLOGY.md                        ~
├── agents/references/TOPOLOGY.md                     ~
├── agents/skills/TOPOLOGY.md                         ~
└── agents/contexts/
    ├── data-model/TOPOLOGY.md                        ~
    ├── data-model/session/TOPOLOGY.md                ~
    ├── data-model/graph/TOPOLOGY.md                  ~
    ├── data-model/spec/TOPOLOGY.md                   ~
    └── seeds/TOPOLOGY.md                             ~
docs/design/SESSION_LOCAL_ELICITATION_GAPS.md         ~
memory/
├── SPEC.md                                           ?
├── PLAN.md                                           ?
└── cards/elicitation-gap-guidance--closure-slices.md ~
```
