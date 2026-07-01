# Session-local elicitation gaps from a graph-derived seed

> Status: **landed** (2026-07-01) — frontier `elicitation-gap-guidance` ([FE-1116](https://linear.app/hash/issue/FE-1116/session-local-elicitation-gaps-from-a-graph-derived-seed)), branch `ln/fe-1116-elicitation-gap-guidance` onto `ln/fe-1108-structured-exchange-affordance`. All six cards in `memory/cards/elicitation-gap-guidance--closure-slices.md` are done; this document's residue is reconciled into the co-located `TOPOLOGY.md` files it names below and `memory/SPEC.md`/`memory/PLAN.md`.
> Date: 2026-07-01.
> Scope: the elicitation-gap **substrate** and the readiness-band **source of truth**. This document is the long-form topology + consolidation ledger for a single-branch redesign: move "what still needs asking" out of a spec-global persisted table into session-local evolving state, seed it from thin graph facts, and collapse readiness to graph-fact reads over one band scalar. It **folds in settlement materialization** (advisory/settled), previously planned as a separate frontier, as a later slice of the same branch.
> Posture: `prototype` + `stakes: high` (`memory/POSTURE.md`). Pre-release — old data models, fixtures, and compatibility shims are deleted, not migrated. One clean model; every old/temp/stub/naive version goes.
> Governs / refines: `memory/SPEC.md` **D45-L, D63-L, D65-L, D74-L, D75-L, D81-L, D94-L, D97-L, D99-L, D101-L, D102-L**; **A36-L**; **I31-L, I50-L, I52-L, I53-L**. Out of scope but adjacent: **D24-L / A37-L** (branching).
> SPEC is the authoritative register; this document is rationale, topology, and the delete/centralize/harmonize ledger for the frontier. Durable residue reconciles into SPEC + co-located `TOPOLOGY.md` files when the frontier lands.

## Why this note exists

Today "what to ask" lives in a spec-global persisted table (`elicitation_gaps`) with count-based coverage scoring. Two problems:

1. **Cross-session interference.** Different sessions pursue different veins of one spec, but they all read and grow the same global agenda. A new session opens pre-biased toward another session's gaps.
2. **Weak reasoning in code.** Readiness is derived by counting nodes against a `minimum` (`Math.min(1, count / minimum)`) and averaging gap "coverage" per band. This is exactly the count-as-reasoning we are rejecting.

The redesign makes the graph the only durable truth, moves the asking agenda into **session-local evolving state** (the Pi `todo.ts` pattern: state reconstructed from the session branch, so it is branch-correct by construction), seeds each session from **thin graph facts** (never scores), and lets a prompt **orientation directive** turn that neutral seed into a session-specific vein. Readiness becomes a just-in-time judgment over graph facts and a single **latest-expected-band scalar**.

## Model shift

```pseudo
## Current
elicitation_gaps (SQLite, spec-global)
  seeded at spec creation from a fixed catalog
  grown by agent action: spawn / set_disposition (probes label this spawn_gap)
  coverage = count(nodes matching predicate) / minimum   [weak reasoning]
  readiness = importance-weighted mean of gap coverage    [weak reasoning]
  shared across all sessions of the spec                   [cross-session bias]

## Desired
graph (SQLite, durable)          = the only persisted spec truth
session gap scratchpad (session-local, non-authoritative, I53-L)
  seeded per session from thin graph FACTS (absence, not scores)  [?A36-L derivation]
  evolved turn-by-turn by the agent (resolve / add)
  reconstructed from the session branch via one custom entry + one projection (branch-correct)
  low-confidence "noticed but not truth" routes HERE, not the graph (D81-L)
readiness = just-in-time judgment over graph facts + latest-expected-band scalar
  no counting anywhere
reconciliation_needs                = unchanged (retrospective repair stays persisted)
```

## Session-state carrier — one entry type, one projection

The scratchpad has exactly **one** authoritative carrier. The danger to avoid is two disagreeing "current gap states" (runtime-state duplication, or state split between a custom entry and tool-result `details`).

Brunch already has the precedent to reuse — `session/runtime-state.ts` (`BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE` + `latestValidBrunchAgentStateEntryData` fold). `todo.ts` contributes only the *principle* (reconstruct-from-branch ⇒ branch-correct), **not** its storage mechanism (tool-result `details`).

```data-shape
carrier decision:
  entry:      one custom type `brunch.elicitation_scratchpad`
  append via: appendCustomEntry            (out-of-band; model never sees raw entries,
                                            same class as brunch.continuity / runtime-state / watermark)
  NOT:        appendCustomMessageEntry     (provider-visible) — the tool result already shows the write
  NOT:        tool-result details          (todo.ts mechanism) — would be a second state
  fold:       one projection, latest-snapshot-wins (mirrors latestValidBrunchAgentStateEntryData)
  reads:      context seed, read tool, subagent snapshot ALL go through that one projection
  write tool: update_* appends a new snapshot entry (add / resolve → new full list)
_rules:
  - no parallel state in runtime-state + details
  - exactly one function reconstructs current scratchpad state from the branch
  # ceiling: snapshot-latest-wins per write; switch to append-only op stream only if
  #          concurrent-subagent merge becomes real
```

## Current topology

Everything currently wired into the elicitation-gap register and the readiness-band model. Grouped by layer; `!` marks weak-reasoning code that must not survive; `~` marks a shape that is fixed in place rather than deleted.

```graph
# persistence / graph plane
db/schema.ts                                 -> elicitation_gaps table (20 cols)
db/row-schemas.ts                            -> gap row shape
graph/schema/elicitation-gaps.ts            -> ElicitationGap, GapPredicate, gapPredicateSupport
graph/schema/elicitation-gap-fixtures.ts    -> groundingFloorGaps, conservativeUncoveredFloorGaps
graph/schema/kinds.ts                        -> READINESS_BANDS, GAP_DISPOSITIONS, GAP_PREDICATE_KINDS, LENS_AFFINITIES
graph/schema/nodes.ts                       ~> INTENT_KIND_BANDS (array), bandsForKind, BAND_LESS_KINDS
graph/queries.ts                            !> getElicitationGaps, rowToElicitationGap, deriveGapCoverage, derivePresenceCoverage (count/minimum)
graph/command-executor.ts                    -> SEEDED_ELICITATION_GAPS, seed/repair, createElicitationGap, setElicitationGapDisposition
graph/command-executor/command-types.ts      -> gap command input/result types
graph/command-executor/command-validation.ts -> gap command validation
graph/elicitation-driver.ts                  -> sortElicitationGapsForAsking, selectElicitationGap (band+importance+coverage+affinity rank)
graph/workspace-store.ts                     -> getElicitationGaps on spec readers
graph/index.ts                               -> re-exports getElicitationGaps, ElicitationGap

# projections / session
projections/session/readiness-estimate.ts   !> readinessEstimate (importance-weighted band coverage)
projections/session/transcript-context.ts    -> read/update_elicitation_gaps in transcript tool allowlist
session/specification-overview-context.ts    -> getElicitationGaps + sortElicitationGapsForAsking
session/originate-assistant-turn.ts          -> getElicitationGaps in launch seed

# agents / contexts
agents/contexts/data-model/elicitation-gaps.ts        -> formatElicitationAgenda, formatElicitationUpdateResult
agents/contexts/data-model/session/readiness-estimate.ts !> renderSoftReadinessEstimate (duplicate indirection)
agents/contexts/data-model/spec/spec-context.ts        -> renderGaps, renderSoftReadinessEstimate consumer
agents/contexts/data-model/graph/graph-slice.ts       !> bandsForKind(kind)[0]  (earliest-band read; I50-L)
agents/contexts/seeds/origination.ts                   -> top-ranked gaps framing
agents/contexts/seeds/turn-context.ts                  -> gaps + renderSoftReadinessEstimate

# runtime / tools / prompts
agents/runtime/elicitor/active-tools.ts      -> allowlist: read_elicitation_gaps, update_elicitation_gaps
.pi/extensions/brunch-data/elicitation/index.ts -> read_elicitation_gaps + update_elicitation_gaps tools (action: spawn / set_disposition)
.pi/extensions/agent-runtime/system-prompts/world-reads.ts !> per-turn world pull: queryGraph + getElicitationGaps
.pi/extensions/agent-runtime/runtime/index.ts !> conservativeUncoveredFloorGaps definition + obsolete gap parameter to activeToolNamesForBrunchAgentState
agents/prompts/elicitor.md                   ~> no orientation directive yet

# app composition + subagents
app/pi-extensions.ts                         !> getElicitationGaps wiring
app/brunch-tui.ts                            -> getElicitationGaps wiring (x2)
app/pi-subagents.ts                          -> subagent world snapshot: gaps = getElicitationGaps(specId)
.pi/extensions/subagents/prompt-assembly.ts  -> renders world.gaps into subagent prompt
.pi/extensions/subagents/index.ts            -> subagent wiring

# session-state substrate (the NEW home)
session/runtime-state.ts                     ~> BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE custom-entry fold precedent to mirror

# probes
src/probes/capture-quality-loop.ts (+ test)  -> spawn_gap expectedOutcome outlet
src/probes/public-rpc-parity-proof.ts        -> coverage/readiness assertions

# tests asserting the current model (migrate or delete)
graph/__tests__: queries, elicitation-driver, capture-commitment-gradient-gate, seed-fixtures,
                 command-executor, observed-shapes-coverage, workspace-store, read-api
projections/session/__tests__: readiness-estimate
session/__tests__: originate-assistant-turn
agents/contexts/**/__tests__: graph-slice, spec-context, elicitation-gaps, node-neighborhood
app/__tests__: brunch-tui
dev/__tests__: faux-harness, tier-2-scaffold, tier-2-harness
.pi/extensions/__tests__: brunch-data-elicitation, registry, agent-runtime-system-prompts
.pi/extensions/agent-runtime/system-prompts/__tests__/world-reads.test.ts: cached per-turn gap pull
```

## Consolidation ledger

`DELETE` = gone, no replacement. `REPLACE` = moves to session-local. `HARMONIZE` = fixed in place to one model. `NEW` = thin addition.

| Disposition | Artifact | Destination / resolved coverage |
| --- | --- | --- |
| DELETE | `elicitation_gaps` table + row shape (`db/schema.ts`, `db/row-schemas.ts`) | drizzle migration drops the table; no persisted gap store remains |
| DELETE | `ElicitationGap` / `GapPredicate` / `gapPredicateSupport` (`graph/schema/elicitation-gaps.ts`) | file removed; gap shape lives only in the session extension |
| DELETE | fixed gap fixtures (`graph/schema/elicitation-gap-fixtures.ts`) | file removed; no seeded catalog |
| DELETE | `getElicitationGaps`, `rowToElicitationGap`, `deriveGapCoverage`, `derivePresenceCoverage` (`graph/queries.ts`) | **all count-based coverage removed** (D45-L, I31-L) |
| DELETE | `SEEDED_ELICITATION_GAPS`, seed/repair/create/setDisposition + gap command types/validation (`command-executor*`) | no fixed seed catalog (D75-L); no command-layer gap writes |
| DELETE | `sortElicitationGapsForAsking`, `selectElicitationGap` (`graph/elicitation-driver.ts`) | file removed; ranking is the agent's job over session state |
| DELETE | `readinessEstimate` (`projections/session/readiness-estimate.ts`) + `renderSoftReadinessEstimate` (`agents/contexts/data-model/session/readiness-estimate.ts`) | both readiness-estimate files removed; **no soft count-based readiness** |
| DELETE | `formatElicitationAgenda` / `formatElicitationUpdateResult` (`agents/contexts/data-model/elicitation-gaps.ts`) | replaced by the session-gap render |
| DELETE | `conservativeUncoveredFloorGaps` fail-closed floor (`.pi/extensions/agent-runtime/runtime/index.ts`) | no floor needed once the register is gone; `activeToolNamesForBrunchAgentState` no longer accepts gap input |
| DELETE | `spawn_gap` expected-outcome outlet (`src/probes/capture-quality-loop.ts`) | low-confidence noticings route to session state (D81-L) |
| REPLACE | `read_elicitation_gaps` / `update_elicitation_gaps` tools (`.pi/extensions/brunch-data/elicitation`) | new session-gap read/write tools on the session extension; old `action: 'spawn'` is gone |
| REPLACE | tool allowlists (`active-tools.ts`, `transcript-context.ts`, `.pi/extensions/agent-runtime/runtime/index.ts`) | new tool names swapped in; runtime policy no longer carries gap/floor inputs |
| REPLACE | foreground world reads (`.pi/extensions/agent-runtime/system-prompts/world-reads.ts`) | per-turn prompt composition pulls graph facts + session scratchpad projection, never persisted agenda rows |
| REPLACE | subagent snapshot `gaps` + prompt render (`pi-subagents.ts`, `subagents/prompt-assembly.ts`) | session gap state travels in the world snapshot (verified requirement) |
| REPLACE | launch seed + context renders (`originate-assistant-turn.ts`, `seeds/origination.ts`, `seeds/turn-context.ts`, `data-model/spec/spec-context.ts`, `specification-overview-context.ts`) | thin graph-fact seed + session gap render |
| HARMONIZE | band model: `INTENT_KIND_BANDS` array + `bandsForKind` + `graph-slice` `[0]` read | single scalar `latestExpectedBand(kind)`; earliest-band read removed (D94-L, I50-L) |
| HARMONIZE | `requirement` band = `commitment` (code) → `projection` | **confirmed** 2026-07-01: target `projection` |
| HARMONIZE | `story` band = `elicitation` (code) → band-less | **confirmed** 2026-07-01: target band-less |
| HARMONIZE | reference files (`readiness-bands.md`, `data-model.md`, `question-kinds-per-intent-kind.md`) | ownership split (below); duplicated band + source-question columns removed (D97-L) |
| NEW | session gap scratchpad: `brunch.elicitation_scratchpad` custom entry + fold projection + read/write tools | one carrier, one projection (see §Session-state carrier); non-authoritative (I53-L, D101-L) |
| NEW | thin graph-fact neutral seed per session | facts, not scores; no settlement dependency (D102-L, A36-L); shape in §Open design point `[?derivation open]` |
| NEW | `elicitor.md` orientation directive | "new session → establish orientation → focus a vein" turns the neutral seed into a session agenda (D102-L) |

## Band reconciliation

One code-owned scalar, `latestExpectedBand(kind): ReadinessBand | null`, whose values match the canonical `readiness-bands.md` table. Consumers read the scalar (never `bandsForKind(...)[0]`).

```data-shape
latestExpectedBand:
  grounding:    goal, thesis
  elicitation:  context, constraint, assumption, decision, invariant, unknown
  projection:   requirement, module, interface, entity, check, vv_method, evidence, vv_obligation
  commitment:   criterion, milestone, frontier, slice
  null:         example, story, term, sketch
_changes_from_code:  (confirmed 2026-07-01)
  requirement:  commitment -> projection
  story:        elicitation -> band-less
  read-shape:   array + [0] earliest -> scalar latest
```

Every other kind's scalar-latest already equals its code array's last element; only `requirement` and `story` change value.

## Reference-file ownership split

```matrix
file                                 owns                                   removes
readiness-bands.md                   band model, latest-expected table,     (canonical band home)
                                     settlement terms, capability-readiness
data-model.md                        kind -> source-question + role/modality  latest-band column (-> readiness-bands.md)
question-kinds-per-intent-kind.md    open phrasings / facets per kind        band column + per-kind source-question line
                                                                            (-> readiness-bands.md / data-model.md)
```

## Settlement materialization (landed)

Folded from the former `settlement-materialization` frontier — it materializes D99-L / I52-L so capability-readiness can consult real settlement state. `settlement` is a graph-item dimension **orthogonal to `basis`** (I52-L).

```data-shape
graph item:
  basis:       explicit | implicit          # approval strength (unchanged, D63-L)
  settlement:  advisory | settled           # NEW, orthogonal (D99-L, I52-L)
_rules:
  - advisory capture persists with settlement: advisory (reviewed, not harmonized)
  - projection / plan / commitment readers MUST NOT read advisory as settled (I52-L)
  - only a command-layer mutation promotes / rewrites / supersedes / reconciles advisory -> settled
  - the thin session seed still must NOT depend on settlement (A36-L)
```

Acceptance: schema carries `settlement` separate from `basis`; CommandExecutor validation + promotion/rewrite/supersede/reconcile paths enforce I52-L; context/projection rendering exposes settlement so capability-readiness (D74-L) can consult it; capture reference material updated; tests cover advisory-vs-settled read discipline. Touch homes: `src/graph/schema/**`, `src/graph/command-executor.ts`, `src/projections/**`, `src/agents/contexts/**`.

## Migration order

Replace consumers before deleting producers (oracle guidance — keep the tree green each step). **No bridge:** under `prototype` + `stakes: high`, do not add `elicitation_gaps` aliases, compatibility shims, dual read paths, or migration-preserving abstractions. If atomic removal is too large, slice it internally, but the old machinery is deleted within this frontier — not left as a permanent second path.

```chain
1. band scalar + fix graph-slice + reconcile 3 ref docs        [independent, safe first]
2. session gap extension: state model + read/write tools
3. repoint consumers -> session state / thin seed
     foreground world-reads cache, subagent snapshot, launch seed,
     spec/turn/origination contexts, transcript allowlist,
     active-tools/runtime-policy allowlists
4. elicitor.md orientation directive + thin graph-fact seed
5. delete persisted register
     tools, driver, queries coverage, seed/command methods,
     schema type, fixtures, table (+ migration), agent-runtime floor helper,
     readiness-estimate x2, agenda render
6. settlement (folded): advisory/settled dimension on graph items,
     command-layer enforcement, projection/context surfacing
7. update/delete tests + probes; reconcile TOPOLOGY.md files
```

## Complete & resolved coverage

The frontier is done only when all of these hold — one model, no residue:

- exactly one asking-agenda substrate: session-local, non-authoritative (I53-L, D101-L)
- exactly one readiness basis: graph facts + band scalar; **no counting anywhere** (D45-L, I31-L)
- exactly one band source: `latestExpectedBand` scalar, read consistently (D94-L, I50-L)
- graph is the only durable spec truth; gaps are never persisted spec-globally (D65-L)
- low-confidence noticings route to session state, not the graph (D81-L)
- subagents see the same session gap state as the foreground
- branch-correct by construction (state reconstructed from the session branch)
- three reference files carry no duplicated band / source-question content (D97-L)
- `reconciliation_needs` untouched (retrospective repair stays persisted)
- settlement materialized: `settlement` (advisory/settled) is a graph dimension orthogonal to `basis`; advisory is never read as settled by projection/plan/commitment readers (D99-L, I52-L)
- co-located `TOPOLOGY.md` updated: `graph`, `db`, `session`, `projections`, `.pi/extensions` (including agent-runtime notes), `agents/references`, `agents/skills`, `agents/contexts/{data-model,data-model/session,data-model/graph,data-model/spec,seeds}`

### Anti-regression oracles

Tests must prove the old attractor is **gone**, not only that the new scratchpad works — otherwise the count/agenda model sneaks back in. Negative oracles:

- no registered `read_elicitation_gaps` / `update_elicitation_gaps` tools; `update_elicitation_gaps` no longer accepts `action: 'spawn'`; `spawn_gap` expected-outcome outlet absent
- no readiness score / count / coverage language in any prompt or context output
- readiness resolves when the session scratchpad is **empty** (readiness never depends on scratchpad contents)
- latest-expected-band comes from the graph-fact scalar, never from gap coverage
- foreground world-read prompts, context prompts, and subagent prompts receive graph facts + scratchpad projection, never persisted agenda rows
- a stale session scratchpad entry never becomes canonical spec truth (I53-L)
- `getElicitationGaps`, `derivePresenceCoverage`, `readinessEstimate`, `elicitation-driver`, `SEEDED_ELICITATION_GAPS` no longer exist (grep-level absence)

## Explicitly out of scope (separate frontier)

- **session-branching** (D24-L reversal, A37-L): branch-aware continuity/coherence. Horizon. The session-local model is already branch-correct by construction, so it does not block this frontier and does not require branching to be finished first.

> Settlement materialization was formerly here as a separate frontier; per the 2026-07-01 review + user decision it is **folded into this frontier** (see §Settlement materialization). The thin seed still must not depend on settlement state (A36-L).

## Open design point

**Thin graph-fact neutral seed derivation (A36-L, D102-L).** Not yet well-defined. A deterministic derivation from graph topology is unlikely to be rich or meaningful on its own. The seed provides **facts, not judgments** — the `elicitor.md` orientation directive + the agent's first turn interpret them into a session-specific vein. Deterministic code must not recreate the old agenda engine under a new name.

```matrix
safe seed facts (raw)                          risky (banned — reintroduces the agenda engine)
current graph LSN                              "this is underanswered"
node / edge counts by kind                     "this must be asked next"
latest-expected-band per node kind             "this area is insufficient" / "coverage is low"
missing grounding kinds as raw absence         any score / rank / importance / readiness grade
open reconciliation_needs                      advisory needs (depends on settlement — excluded per A36-L)
recent graph-mutation summary (optional)
```

The seed lists raw absence (which kinds have zero nodes), not "meaningful absence." **Shape confirmed 2026-07-01.**
