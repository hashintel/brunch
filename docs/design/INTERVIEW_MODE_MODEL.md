# Interview mode model

_Date: 2026-04-07_
_Status: design note backing the current SPEC patch_

## Purpose

Record the revised runtime model surfaced during the flow talkthrough:

- one interview is the throughline
- the interview moves through workflow modes (`scope`, `design`, `requirements`, `criteria`)
- entity capture is broader than `decision` + `assumption`
- entity capture is **capture-anytime, review-in-phase**
- `turn` remains the branching history spine
- readiness needs explicit artifacts rather than only turn-local booleans

## Four-layer model

1. **History spine** — `turn` tree plus `project.active_turn_id`
2. **Workflow mode** — phase/mode on turns plus explicit phase outcomes
3. **Knowledge layer** — durable knowledge items plus graph edges and provenance
4. **Readiness layer** — explicit review and closure state

These layers are related, but should not be collapsed into each other.

## Minimal expanded ontology

### Durable knowledge kinds

- **framing** — contextual truth / intent / problem context
- **constraint** — boundary on acceptable solution space
- **decision** — chosen fork / commitment
- **assumption** — belief that could prove false
- **requirement** — must-do capability
- **criterion** — verifiable success condition

### Suggested subtype examples

- `framing:user-need`
- `framing:problem-statement`
- `constraint:non-goal`
- `criterion:kpi`
- `criterion:benchmark`

Start with `kind + subtype`, not table explosion.

## Core interaction rule

### Capture-anytime, review-in-phase

Any mode may surface any knowledge kind.

Each mode is responsible for **closing** the review state of the item families it owns:

- **scope** owns framing / constraints sufficiency
- **design** owns decision / assumption coherence
- **requirements** owns requirement completeness and approval
- **criteria** owns verification coverage and approval

## Schema direction

### Turn remains central, but becomes more generic

Recommended direction:

- keep `turn` as the versioned, branching checkpoint
- stop forcing all turn semantics into scalar `question` / `answer` columns
- store mode-shaped interaction payloads as typed JSON validated by Zod

### Suggested storage model

#### `project`
- `id`
- `name`
- `active_turn_id`
- timestamps

#### `turn`
- `id`
- `project_id`
- `parent_turn_id`
- `phase`
- `kind` (`interaction | review | system | edit`)
- `prompt_payload`
- `response_payload`
- `user_parts`
- `assistant_parts`
- timestamps

#### `knowledge_item`
- `id`
- `project_id`
- `kind`
- `subtype`
- `content`
- `rationale`
- timestamps

#### `turn_knowledge_item`
- `turn_id`
- `item_id`
- `relation` (`captured | confirmed | edited | invalidated | reviewed`)

#### `knowledge_edge`
- `from_item_id`
- `to_item_id`
- `relation` (`depends_on | derived_from | constrains | verifies | refines`)

#### `phase_outcome`
- `id`
- `project_id`
- `phase`
- `status` (`proposed | confirmed | superseded`)
- `source_turn_id`
- `confirmed_turn_id`
- `invalidated_by_turn_id`
- `summary`
- timestamps

#### `knowledge_review`
- `id`
- `item_id`
- `phase`
- `status` (`pending | approved | edited | rejected | stale`)
- `source_turn_id`
- `superseded_by_turn_id`
- timestamps

## Turn response model

### Minimal response forms

1. **single-select with rationale**
2. **multi-select with rationale**
3. **custom answer / none-of-the-above**
4. **review response** (`approve | edit | reject | add-missing`)

### Design principle

Keep the interviewer’s structured guidance, options, recommendations, and “why this matters” affordance.

Remove the assumption that every answer is a single categorical pick.

## Mode behavior summary

### Scope mode — framing

**Primary job**
- establish a sufficient framing bundle

**Observer bias**
- prefer `framing`, `constraint`, early `requirement`
- do not force framing facts into `assumption`

**Closure**
- enough clarity to enter design without asking identity questions again

### Design mode — commitment / exploration

**Primary job**
- resolve major design forks and expose supporting assumptions

**Observer bias**
- prefer `decision`, `assumption`, plus newly surfaced `constraint`, `requirement`, and framing corrections

**Closure**
- major design forks are resolved enough to synthesize a stable requirement set

### Requirements-review mode — audit / completeness

**Primary job**
- normalize, complete, and confirm the requirement set implied by the whole knowledge layer

**Observer bias**
- prefer new or refined `requirement` plus derivation edges

**Closure**
- requirement set is complete enough for verification work and each in-scope requirement is approved, edited into approval, or explicitly rejected

### Criteria-review mode — verification

**Primary job**
- turn approved requirements into verifiable success conditions

**Observer bias**
- prefer new or refined `criterion` plus `verifies` edges

**Closure**
- every in-scope approved requirement has sufficient verification coverage

## Revisit and invalidation

The turn tree still owns revisitation.

Changing an upstream turn invalidates downstream readiness from that frontier:

- changing framing invalidates design + later review outcomes
- changing design invalidates downstream requirement / criteria review outcomes
- changing requirements invalidates downstream criteria review outcomes
- changing criteria invalidates criteria review completeness, and may escalate upstream if a requirement defect is exposed

This suggests phase outcomes and review records should be invalidated explicitly, not inferred only from `turn.is_resolution` or `reviewed_at` timestamps.

## Export readiness

A project is export-ready only when:

- each mode has a confirmed, non-invalidated active-path phase outcome
- all in-scope requirements are review-complete
- all in-scope criteria are review-complete
- no unresolved upstream staleness remains

## Why this model

This is the smallest model found so far that:

- preserves the elegant turn-tree revisit story
- matches what the interview actually produces in practice
- supports richer later-phase synthesis and review behavior
- avoids table explosion by using `kind + subtype`
- keeps future UI and observer evolution possible without rewriting the history model
