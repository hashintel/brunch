# Planning Persistence Model

> Status: **working design proposal**.
> Date: 2026-05-20.
> Scope: the recommended persistence and branching model for planning/spec data as the Brunch development workflow converges with the product architecture.
>
> Companion: [`SPEC_INITIATIVE_MODEL.md`](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/SPEC_INITIATIVE_MODEL.md). That note defines **what** specs and claims are. This note defines the recommended persistence posture for storing, branching, materializing, and projecting them.

## Why this note exists

Once specs are treated as initiative/problem lifecycle objects and claims are treated as truth-bearing units, the current persistence model looks increasingly temporary:

- [`memory/SPEC.md`](file:///Users/lunelson/Code/hashintel/brunch-next/memory/SPEC.md) and [`memory/PLAN.md`](file:///Users/lunelson/Code/hashintel/brunch-next/memory/PLAN.md) are useful human-facing projections
- but they are weak as the long-term **canonical** persistence layer
- especially when planning truth needs to branch and merge alongside code
- and when multiple developers may concurrently revise overlapping planning state

The question is not just where data lives. It is how planning truth should:

- branch with code
- merge semantically rather than rhetorically
- support local fast queries and UI surfaces
- remain inspectable and diffable in the repo
- converge with Brunch's product-native graph thinking without prematurely requiring a networked collaboration system

## Landed recommendation

The synthesized recommendation is:

> Use a **repo-native canonical planning model** for specs/claims/planning changes, with **local SQLite as a materialized state and query index**, and **markdown docs as human-oriented projections**.

In shorthand:

- **canonical history** = repo-native structured planning data
- **working store** = local SQLite materialization
- **human re-entry views** = markdown projections

This is the recommended middle path between two bad extremes:

- keeping singleton markdown docs as the true source forever
- jumping too early to a network-first collaborative planning service

## The three layers

### 1. Canonical planning history

This is the authoritative representation of planning/spec truth.

It should be:

- committed in the repo
- branchable with code
- mergeable with Git workflows
- structured enough for semantic diff/merge
- stable-ID based rather than prose-block based

This layer is where `Spec`, `Claim`, and associated references/relations should eventually live.

### 2. Local materialized state

This is the operational/query layer.

It should be:

- local to the developer's workspace
- cheap to rebuild or refresh from canonical history
- optimized for UI, search, graph traversal, and validation
- disposable or reproducible if corruption occurs

SQLite is the recommended fit here.

### 3. Projected views

These are the human-facing re-entry surfaces.

Examples:

- [`memory/SPEC.md`](file:///Users/lunelson/Code/hashintel/brunch-next/memory/SPEC.md)
- [`memory/PLAN.md`](file:///Users/lunelson/Code/hashintel/brunch-next/memory/PLAN.md)
- future `ABOUT` / `CONTEXT` style projections
- perhaps cards/queue views later

These views are important, but they should increasingly be understood as **projections over canonical state**, not the final authority themselves.

## The rejected extremes

### Rejected shape 1 — markdown-as-canonical forever

This means:

- markdown docs are the true source of planning/spec truth
- any graph/index layer is only derived convenience

This is attractive because it is simple and familiar, but it fails under pressure:

- weak merge semantics
- weak structured collaboration
- document-level conflicts instead of claim-level conflicts
- hard to branch/merge semantically with code changes
- encourages singleton-doc thinking

### Rejected shape 2 — network-first collaborative planning store now

This means:

- planning truth lives in a shared service first
- repo state becomes only one integration boundary

This might eventually suit the product, but it is not the right immediate workflow architecture because it introduces:

- operational complexity
- a second branch/sync model too early
- multi-user distributed-systems concerns before the core planning ontology is settled

## Why the middle path wins

The repo-native + materialized-local + projected-views model gets the key benefits of structure without requiring premature infrastructure.

### It preserves Git as the top-level branch model

Planning truth can branch with code because canonical planning state lives in the repo.

### It enables semantic merge later

Because the canonical form is structured, future merge/diff tooling can reason about:

- stable spec IDs
- stable claim IDs
- supersession edges
- status changes
- frontier references

rather than only line-level markdown diffs.

### It fits Brunch's product direction

The product already wants:

- graph-native structures
- explicit coherence/reconciliation
- durable IDs
- turn-boundary synchronization
- multiple views over shared truth

The recommended persistence model converges with that direction without requiring the development workflow to become a network service immediately.

### It keeps docs useful

`SPEC.md` and `PLAN.md` remain valuable because they are excellent projections for:

- fast re-entry
- human review
- compact context for agents
- repo legibility

The recommendation is not to eliminate docs, but to stop demanding that they carry the full canonical burden forever.

## Recommended canonical shape

The strongest current recommendation is:

> Canonical planning history should be represented as **structured repo-native changes over stable entities**, not only as mutable monolithic documents.

This leaves one important open design choice: what exactly is the canonical unit of change?

## Candidate canonical forms

Three broad options are plausible.

### Option A — full entity snapshots

Examples:

- one file per `Spec`
- one file per `Claim`
- commits update full current-state representations

Advantages:

- easy to inspect
- easy to regenerate projections from current state
- conceptually simple

Weaknesses:

- harder to reason about history as intentional operations
- semantic merge can still be clumsy if multiple writers touch the same entity snapshot
- current state is clear, but lineage of *how* it changed is weaker

### Option B — patch / changeset model

Examples:

- changesets that add, revise, adopt, supersede, retire, or invalidate entities
- materializer applies ordered changesets to build current state

Advantages:

- strong fit for branch/merge thinking
- preserves intentional operations
- good basis for semantic diff and audit
- closer to how code changes already work

Weaknesses:

- materialization logic becomes mandatory
- more moving parts than raw snapshots

### Option C — append-only event log

Examples:

- every planning mutation is an immutable event
- current truth is built by replay

Advantages:

- strongest historical trace
- clean event-sourcing discipline

Weaknesses:

- likely too heavy for the current workflow
- invites event-model complexity before the domain is settled
- requires stronger replay and compaction discipline from day one

## Recommended canonical unit of change

The current recommendation is:

> Prefer a **changeset / patch model** over pure full-snapshot or full event-sourcing approaches.

Why:

- it aligns with branching and merge workflows
- it records intentional semantic operations
- it can still materialize efficient current-state views
- it is simpler than going fully event-sourced

In other words: keep the canonical layer operation-aware, but do not force the entire system into a heavy event-sourcing worldview too early.

## Proposed layering in practice

```diagram
╭──────────────────────────────────────╮
│ Canonical repo-native history        │
│ - structured spec/claim changesets   │
│ - stable IDs                         │
│ - branchable with code               │
╰───────────────────┬──────────────────╯
                    │ materialize
                    ▼
╭──────────────────────────────────────╮
│ Local SQLite working store           │
│ - current state                      │
│ - query index                        │
│ - graph traversal                    │
│ - validation / coherence helpers     │
╰───────────────────┬──────────────────╯
                    │ project
                    ▼
╭──────────────────────────────────────╮
│ Human-facing projections             │
│ - memory/SPEC.md                     │
│ - memory/PLAN.md                     │
│ - ABOUT/CONTEXT style views          │
╰──────────────────────────────────────╯
```

## Recommended data responsibilities

### Canonical layer responsibilities

- durable entity identity
- lineage and supersession
- branchable semantic history
- mergeable change units
- replay into current state

### SQLite materialization responsibilities

- fast local query
- graph traversal
- search/filter/indexing
- validation/coherence support
- UI/runtime read performance

### Projection layer responsibilities

- compact narrative summary
- human review surfaces
- agent re-entry context
- planning coordination views

## Branching and merge implications

This model should let planning data evolve with code in the same branch stack.

### Desired workflow

- a developer modifies code and planning changes together on a branch
- both are committed together
- another branch may independently evolve overlapping planning state
- merge/rebase brings both code and planning changes together
- semantic tooling resolves or highlights planning conflicts at the entity/change level

### What semantic merge likely needs

At minimum:

- stable IDs for specs and claims
- explicit operation types such as `create`, `adopt`, `supersede`, `retire`, `invalidate`
- explicit scope information
- explicit status transitions
- explicit conflict surfaces rather than silent overwrite

### What not to do

Do not reduce merge semantics to:

- file timestamp wins
- latest markdown edit wins
- blind line-based conflict resolution for planning truth

That would bring the workflow right back to the same single-doc weaknesses under a more elaborate shell.

## Relationship to the current docs

### `memory/SPEC.md`

Recommended future role:

- compact projection of project contract and live architecture register
- not the sole canonical storage location for all spec/claim truth

### `memory/PLAN.md`

Recommended future role:

- rolling frontier / delivery projection
- branch-sized coordination view
- not the only place where frontier/spec relationships are stored

### Future `ABOUT` / `CONTEXT`

Recommended future role:

- stable frame view over enduring project identity
- complementary to the evolving multi-spec set

## Relationship to the product's own persistence model

The product architecture already has a split between:

- graph truth
- `change_log`
- `coherence_state`
- `reconciliation_need`

The workflow persistence model recommended here does not need to be identical immediately, but it should rhyme with it.

The intended convergence is:

- repo-native changesets are the development workflow's canonical truth history
- local SQLite materialization rhymes with the product's graph/query substrate
- human projections rhyme with the product's need for multiple views over shared truth

This means the workflow and the product converge conceptually before they converge mechanically.

## Recommended next architectural split

If this persistence model is adopted, the next important split to formalize is:

- **entity model** — `Spec`, `Claim`, `Frontier`, maybe `ContextFrame`
- **changeset model** — how those entities are created and revised over time
- **projection model** — how `SPEC.md`, `PLAN.md`, and future views are generated

That is likely a better next design step than prematurely choosing exact file formats.

## Open design questions

### 1. File granularity

Should canonical planning changes live as:

- one file per changeset
- batched files by branch/workspace
- one file per entity with embedded patch history

Recommendation: defer final choice, but optimize for inspectability plus semantic merge.

### 2. Materialization boundary

Should SQLite be:

- purely rebuildable cache
- partly authoritative local store with export back to canonical files

Recommendation: prefer rebuildable materialization first; keep canonical authority in repo-native structured history.

### 3. Projection freshness

How eagerly should markdown projections refresh?

- on every material change
- on demand
- at commit time

Recommendation: enough automation to prevent drift, but not so much that human-facing docs become noisy or fragile.

### 4. Branch-local truth vs adopted truth

Two branches may each establish valid local planning changes.

Recommendation: represent branch-local state distinctly from adopted/mainline truth rather than pretending every branch mutation is immediately project-canonical.

### 5. Relationship to future networked collaboration

Could this model later back a networked multi-user system?

Recommendation: yes, but only after the repo-native ontology is proven. The current recommendation is explicitly to avoid paying distributed-systems costs too early.

## Working recommendation for the near term

Until the richer model exists, the practical posture should be:

- keep using [`memory/SPEC.md`](file:///Users/lunelson/Code/hashintel/brunch-next/memory/SPEC.md) and [`memory/PLAN.md`](file:///Users/lunelson/Code/hashintel/brunch-next/memory/PLAN.md) as canonical working projections
- increasingly design them as **projections over a future structured model**, not as the eternal shape of truth
- design new planning/lifecycle ideas with repo-native branching and semantic merge in mind
- treat local SQLite as the likely materialization substrate when the workflow starts becoming graph-native

That captures the synthesized recommendation without prematurely overcommitting to a final file format or service topology.
