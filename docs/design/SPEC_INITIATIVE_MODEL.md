# Spec Initiative Model

> Status: **vocabulary locked (D61-L); richer model deferred as Future Direction**.
> Date: 2026-05-20.
> Scope: the horizon model for how Brunch should represent specifications, claims, planning lifecycles, and collaboration over time.
>
> This note captures a design conclusion that emerged while pressure-testing the current `ln-*` workflow against the product direction in [`docs/architecture/prd.md`](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md), [`docs/architecture/pi-seam-extensions.md`](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md), and [`memory/SPEC.md`](file:///Users/lunelson/Code/hashintel/brunch-next/memory/SPEC.md): a **single start-to-finish spec for the whole product** is a naive and impractical model.
>
> The spec-as-initiative identity and the spec↔claim vocabulary are now locked in [`memory/SPEC.md`](file:///Users/lunelson/Code/hashintel/brunch-next/memory/SPEC.md) (D61-L, plus Lexicon `Spec` / `Claim`). The richer model below — cross-spec claim survival/adoption, initiative-status lifecycle, spec-to-spec relationships, current-truth-as-projection — remains a deferred directional bet (SPEC §Future Direction → Spec initiative & claim model), not yet product contract.

## Why this note exists

The current planning workflow still centers a pair of singleton project documents:

- [`memory/SPEC.md`](file:///Users/lunelson/Code/hashintel/brunch-next/memory/SPEC.md)
- [`memory/PLAN.md`](file:///Users/lunelson/Code/hashintel/brunch-next/memory/PLAN.md)

That is useful for re-entry, but it is not a realistic long-horizon model for product development.

Real projects accumulate:

- multiple overlapping specification efforts
- work at different stages of readiness and completion
- reconsidered answers to earlier problems
- multiple developers working concurrently
- planning data that should branch and merge with code

The product architecture itself already points toward richer structures: graph planes, explicit reconciliation needs, turn-boundary updates, durable IDs, and coherence as first-class state. This note asks how the **development workflow** could converge toward that same realism without prematurely jumping into a networked collaborative system.

## Landed positions

The following are the design conclusions this note treats as already landed.

### 1. A spec is not a territory

A spec is **not** fundamentally:

- a product-area doc
- an architectural-seam doc
- a domain doc
- the one master source of truth for the whole product lifecycle

Those things may be addressed by a spec, but they do not define its identity.

### 2. A spec is an initiative answering a problem

The best current definition is:

> A **spec** is a scoped initiative record that exists to answer a problem well enough to guide coordinated work, and that can reach a done-state even though the product, domains, and architecture continue evolving.

This means:

- the spec's identity is its initiative and problem-answering purpose
- seams, areas, and domains are things it touches, not what it is
- a spec can complete even if later specs revisit the same areas from new angles

### 3. Multiple specs are normal

In real practice, projects have multiple specs:

- at different stages of readiness
- with different degrees of authority
- with or without overlap
- sometimes as priors, sometimes as siblings, sometimes as superseders

The collection of these specs constitutes the evolving project state more realistically than any single monolithic spec could.

### 4. Truth should not be "latest update wins"

Timestamps matter, but they are not sufficient truth semantics.

`updated_at` is useful for:

- sorting
- recency heuristics
- UI cues
- weak tie-breaking

But it is not enough to determine which spec should win when claims conflict. A newer edit to an old spec may be clerical, branch-local, or narrow in scope. Real precedence needs explicit lineage and status.

### 5. Specs and claims are different things

This is the most important conceptual split in the note.

- A **spec** is an initiative-lifecycle container.
- A **claim** is a truth-bearing entity created, refined, adopted, or superseded by specs.

This distinction solves several problems at once:

- specs can complete
- claims can survive after their parent spec is done
- later specs can supersede only the overlapping claims they replace
- conflict detection can happen at the claim level instead of the whole-document level

## The core model

```diagram
╭─────────╮
│ Project │
╰────┬────╯
     │
     ▼
╭──────────────────╮
│ About / Context  │  enduring frame
╰──────────────────╯
     │
     ▼
╭────────────────────────────────────╮
│ Specs = initiative/problem records │
│                                    │
│  S1 answers P1                     │
│  S2 answers P2                     │
│  S3 revises answer to P1           │
│  S4 depends on S3 and answers P3   │
╰────────────────────────────────────╯
     │
     ▼
╭─────────────────────╮
│ Claim Graph         │  truth-bearing items and relations
╰────┬────────────────╯
     │
     ▼
╭─────────────────────╮
│ Current Truth View  │  projected surviving/adopted claims
╰────┬────────────────╯
     │
     ▼
╭─────────────────────╮
│ Frontier / Delivery │
╰────┬────────────────╯
     │
     ▼
╭─────────────────────╮
│ Sessions / Turns    │
╰─────────────────────╯
```

## Project frame vs specs

The model still benefits from one central, stable frame document, but it must be intentionally small.

### About / Context

This layer should hold enduring project identity, such as:

- product thesis
- stable lexicon
- long-lived non-goals
- broad strategic direction
- references to active spec clusters

It should **not** try to restate all active scoped truth. If it becomes the place where all live design and planning must be harmonized manually, it simply recreates the giant-spec problem at a higher level.

### Specs

Specs carry initiative-scoped problem answers. They are where the project does concrete epistemic work.

Examples of things a spec may touch:

- one or more product areas
- several architectural seams
- multiple domains or personas
- specific frontiers or delivery bets
- verification obligations

But these are touched dimensions, not the spec's identity.

## Spec as first-class entity

The following shape is recommended for a future graph-native spec model.

| Field | Purpose |
| --- | --- |
| `spec_id` | Stable identity |
| `title` | Human-readable handle |
| `problem_statement` | The problem this initiative exists to answer |
| `initiative_kind` | What kind of initiative this is (discovery, architecture, delivery, migration, hardening, etc.) |
| `status` | Lifecycle state |
| `created_at` | Creation time |
| `updated_at` | Last material update time |
| `done_at` | Completion time, if done |
| `outcome` | Summary of what was answered or established |
| `supersedes[]` | Prior specs intentionally replaced for overlapping scope |
| `informed_by[]` | Priors used for context, not replacement |
| `parallel_to[]` | Sibling spec efforts in adjacent work |
| `depends_on[]` | Specs whose answers are assumed here |
| `frontier_refs[]` | Delivery frontiers affected or created |
| `claims[]` | Claims created, adopted, revised, or superseded |
| `affected_areas[]` | Product areas touched |
| `affected_seams[]` | Architectural seams touched |
| `affected_domains[]` | Domains/personas/jobs touched |

### Recommended status model

The following statuses seem sufficient for a first cut:

- `proposed`
- `drafting`
- `active`
- `adopted`
- `done`
- `superseded`
- `abandoned`

`done` is important. A spec should be allowed to complete when its initiative has reached a coherent answer, even if the product continues evolving.

## Claim as first-class entity

Claims are the actual truth-bearing units. This is where conflicts, supersession, and current truth should primarily be resolved.

The existing language in [`memory/SPEC.md`](file:///Users/lunelson/Code/hashintel/brunch-next/memory/SPEC.md) already points toward claim-like units:

- requirements
- assumptions
- decisions
- invariants
- constraints / non-goals
- future-direction items

The stronger future model would make these graph-native and explicitly owned by one or more specs.

### Recommended claim fields

| Field | Purpose |
| --- | --- |
| `claim_id` | Stable identity |
| `claim_kind` | Requirement / assumption / decision / invariant / constraint / evidence-backed observation / etc. |
| `statement` | The truth-bearing content |
| `status` | Proposed / adopted / retired / superseded / invalidated |
| `authority` | Source or basis of the claim |
| `epistemic_status` | Observed / asserted / assumed / inferred |
| `created_by_spec` | Spec that first introduced it |
| `adopted_by_specs[]` | Specs that continue to rely on it |
| `supersedes[]` | Prior claims intentionally replaced |
| `conflicts_with[]` | Claims in unresolved contradiction |
| `scope` | Where the claim is meant to hold |
| `frontier_refs[]` | Delivery work affected |
| `updated_at` | Last material modification |

### Why claims matter

Without claim-level modeling, every revision pressure becomes document-level pressure:

- update whole spec
- compare whole spec
- merge whole spec
- supersede whole spec

That is exactly the giant-spec trap.

With claim-level modeling:

- a later spec can reuse many old claims
- supersede only the ones it replaces
- export unresolved contradictions as reconciliation needs
- let an old spec be done without freezing its claims forever

## Relationship between specs and claims

The cleanest model is:

- specs **create** claims
- specs **adopt** claims from priors
- specs **revise** claims
- specs **supersede** claims
- specs may also **retire** or **invalidate** claims

This implies that a spec's practical output is not just a prose document. Its output is a set of claim operations.

### Example

```diagram
╭────────────╮        creates        ╭─────────────╮
│ Spec S1    │──────────────────────▶│ Claim C1    │
│ "Answer P1"│                      │ requirement │
╰────────────╯                       ╰─────────────╯

╭────────────╮        adopts         ╭─────────────╮
│ Spec S2    │──────────────────────▶│ Claim C1    │
│ "Extend P2"│                      ╰─────────────╯
╰────────────╯

╭────────────╮      supersedes       ╭─────────────╮
│ Spec S3    │──────────────────────▶│ Claim C1    │
│ "Revise P1"│                      ╰─────────────╯
╰──────┬─────╯
       │ creates
       ▼
   ╭─────────────╮
   │ Claim C7    │
   │ new answer  │
   ╰─────────────╯
```

This lets the project say:

- `S1` is done
- `C1` existed and mattered
- `S3` later replaced `C1` with `C7`
- the project's current truth includes `C7`, not `C1`

## Current truth is a projection

The project's current truth should not be defined as:

- the newest spec
- the newest document update
- the highest branch timestamp

Instead, it should be a projection over surviving claims.

### Recommended precedence rules

1. If claim supersession is explicit, the superseding claim wins for overlapping scope.
2. If spec status differs, claims from `adopted` / `active` / `done` specs outrank claims from `drafting` or `abandoned` specs.
3. If two active claims overlap and conflict without explicit supersession, surface a reconciliation need; do not silently pick a winner.
4. `updated_at` may assist sorting and weak tie-breaking, but does not define truth by itself.

This is consistent with the broader Brunch posture of explicit coherence and explicit reconciliation rather than silent overwrite.

## Spec-to-spec relationships

Spec relationships should be few and semantically distinct.

### Recommended relationship set

| Relationship | Meaning |
| --- | --- |
| `informed_by` | This spec used another as prior context |
| `supersedes` | This spec intentionally replaces another for overlapping problem-answer space |
| `parallel_to` | These specs are adjacent or sibling efforts |
| `depends_on` | This spec assumes answers established elsewhere |
| `conflicts_with` | Unresolved contradiction between initiatives |

The point is to avoid collapsing all references into a generic "related" edge.

## Planning lifecycle realism

The single-spec model is unrealistic partly because it confuses:

- enduring frame
- initiative lifecycle
- truth-bearing claims
- active delivery work
- local working context

The model recommended here separates them.

### Proposed hierarchy

```diagram
╭─────────╮
│ Project │
╰────┬────╯
     │
     ▼
╭───────────────╮
│ About/Context │  stable frame
╰────┬──────────╯
     │
     ▼
╭─────────╮
│ Specs   │  initiative/problem lifecycle units
╰────┬────╯
     │
     ▼
╭─────────╮
│ Claims  │  truth-bearing units
╰────┬────╯
     │
     ▼
╭─────────╮
│ Frontier│  branch-sized delivery unit
╰────┬────╯
     │
     ▼
╭─────────╮
│ Session │  one conversational working context
╰─────────╯
```

### What this changes

- Specs can be born, mature, complete, and later be superseded.
- Claims can outlive their parent specs.
- Frontiers become delivery commitments downstream of specs and claims, not the same thing.
- Sessions become working contexts, not containers for canonical truth.

## Collaboration, branching, and merge

This design points toward a workflow where planning truth can branch and merge with code without requiring a centralized live service.

### Strong recommendation

Prefer a **repo-native canonical planning model** over either:

- singleton markdown docs forever, or
- a network-first collaborative planning store too early

The likely convergence shape is:

- canonical planning history represented as structured, mergeable repo-native data
- local SQLite as materialized state / query index / working store
- markdown docs such as `SPEC.md` and `PLAN.md` as projections for human re-entry

This is a middle path:

- much more realistic than prose-only truth
- much cheaper than introducing a networked multi-user system immediately

### Implications for multi-developer work

If specs and claims are structured and repo-native:

- developers can branch planning data with code
- claims and spec lineage can be diffed semantically
- merge can happen on entities/operations, not only prose blocks
- frontier work can reference the exact spec/claim changes it implements

### What should merge semantically

At minimum, future merge logic likely needs to reason about:

- spec identity and status
- claim identity and status
- explicit supersession
- explicit conflicts
- frontier references

Simple timestamp-based precedence is not enough.

## Recommendations

### Recommendation 1 — treat spec as initiative lifecycle container

This should become explicit in the product lexicon and eventually the graph model.

### Recommendation 2 — treat claim as the unit of truth conflict

This is the main way to avoid giant-document reconciliation.

### Recommendation 3 — keep one small central frame document

Have an `ABOUT` / `CONTEXT` layer, but do not let it grow into the one document where all live truth must be manually harmonized.

### Recommendation 4 — project current truth from surviving claims

Do not model current truth as "the most recently updated spec."

### Recommendation 5 — let specs complete

Specs need a real done-state. If they are the unit of initiative lifecycle, then completion is meaningful and should be represented.

### Recommendation 6 — keep delivery downstream of spec/claim truth

Frontiers, cards, and sessions are all real, but they are not the same layer as specs and claims.

## Open design questions

These are the next questions that still need real design work.

### 1. What is the canonical unit of planning change?

Plausible options:

- full entity state replacements
- patch operations
- append-only events

Recommendation: favor changesets or patch-like operations that can be materialized into current state rather than only whole-entity state replacements.

### 2. Which claim kinds deserve first-class status?

The current likely candidates are:

- requirement
- assumption
- decision
- invariant
- constraint / non-goal
- evidence-backed observation
- maybe obligation / validation method / check once oracle-plane concerns are folded in

Recommendation: begin with the existing `SPEC` units and extend cautiously.

### 3. What is the scope model for supersession?

Does a claim supersede another:

- globally
- within one problem lineage
- within one project area
- within one delivery horizon

Recommendation: tie supersession to explicit scope metadata rather than global replacement.

### 4. How should projections work?

Likely projections include:

- project frame view (`ABOUT` / `CONTEXT`)
- current truth view
- `SPEC` projection for human re-entry
- `PLAN` projection for near-horizon delivery
- maybe cards/queue projections later

Recommendation: make markdown projections first-class outputs of the model, not permanent substitutes for it.

### 5. How should branch-local vs adopted truth be shown?

Two developers may each produce valid branch-local spec/claim changes.

Recommendation: represent branch-local truth distinctly from adopted project truth, rather than forcing every branch-local spec into immediate project authority.

### 6. How does planning truth relate to Brunch's existing planes?

This note introduces spec and claim as lifecycle/truth concepts. The existing architecture already includes intent, oracle, design, and plan planes.

Recommendation: a future model probably needs to answer whether:

- a spec owns claim sets across several planes
- claims are plane-specific
- or spec/claim is a meta-layer over the existing four-plane truth model

That question is still open.

## Working recommendation for the near term

Until the product model is ready to absorb this fully, the practical working posture should be:

- keep [`memory/SPEC.md`](file:///Users/lunelson/Code/hashintel/brunch-next/memory/SPEC.md) as the compact projection of project contract and active architecture
- keep [`memory/PLAN.md`](file:///Users/lunelson/Code/hashintel/brunch-next/memory/PLAN.md) as the rolling frontier projection
- treat both as projections over a future richer model, not as the eternal final form
- when design work refers to "specs," increasingly mean **initiative/problem-scoped records**, not territorial documents

That will let the workflow and the product converge conceptually before they converge mechanically.
