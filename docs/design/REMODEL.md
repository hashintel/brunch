# Domain Model

Target domain model for Brunch. This is the product of an ideation process examining what the tool actually does vs. what the current schema and terminology imply. See REFACTORS.md for the structural/technical refactors.

## What this tool is

A spec elicitation tool that takes a natural-language project goal and, through an AI-driven interview process, produces a structured specification document. The output is a fire-and-forget artifact — a detailed spec intended to be consumed by an implementation harness (human or agent). The tool does not manage execution, task orchestration, or runtime state.

## Scope line

**Building now (high-certainty pathway):**
The process assumes the user has a reasonably well-defined goal. The tool's job is to reduce remaining uncertainty to the point where the spec is actionable.

**Acknowledged but not built:**
- An ambiguity-first pathway for projects where the goal itself is unclear (research, spikes, invariant discovery). This would produce a refined goal + resolved invariants that feed into the high-certainty pathway.
- Task planning, execution DAGs, waves/epics. These are consumers of the spec, not part of spec elicitation.
- Runtime propagation of belief invalidation. In a fire-and-forget model, the spec captures the dependency structure (which decisions rest on which assumptions) but doesn't manage what happens if a belief is later falsified.

## Process

Three phases, all driven by the same interaction primitive (the interview exchange).

### Phase 1 — Scope Establishment

User states intent. LLM interviews to establish boundaries, surface hard requirements, and gauge certainty. Outputs: refined goal, scope (inclusions, exclusions, constraints), initial hard requirements. Acceptance criteria begin accumulating in the background.

### Phase 2 — Design Tree Exploration

LLM works down the design tree, interviewing the user on every aspect — implicit and explicit — of how things should work. Every question is a fork; the user's answer resolves it. The LLM provides at least two options per question, with a recommendation where possible, plus an open-ended "something else" option. Acceptance criteria continue accumulating.

This phase may include:
- **Feature exploration** (shape-up style) — breadboarding affordances, fat-marker sketching of how a feature works, where it lives, how the user reaches it
- **Module design** — defining application boundaries and interfaces among technical components

These are the same interaction pattern (interview exchange → decision), applied through different lenses.

### Phase 3 — Acceptance Criteria Validation

All criteria gathered (explicit + background) are surfaced and validated with the user. The LLM proposes additional criteria, walks through risks, failure modes, caveats, and suggests hardening of rules and contracts.

## Entities

### Interview Exchange

The universal interaction primitive. Used across all three phases.

| Field | Type | Description |
|---|---|---|
| id | uuid | |
| project_id | FK → Project | |
| phase | enum | `scope`, `design`, `criteria` |
| lens | enum? | `general`, `feature`, `architecture`, `data_model`, etc. (Phase 2) |
| question | text | What the LLM asked |
| why | text | Why this question matters |
| options | json | At least two alternatives |
| recommendation | text? | Which option the LLM recommends, if any |
| answer | text | What the user chose or typed |
| sort_order | int | Sequence within phase |

### Project

Identity and metadata only. Not a junk drawer.

| Field | Type | Description |
|---|---|---|
| id | uuid | |
| name | text | |
| raw_input | text | What the user originally typed |
| model | text | Selected LLM model |
| pathway | enum | `high_certainty` (default). Future: `exploratory`, `hybrid` |
| phase | enum | `scope`, `design`, `criteria`, `complete` |
| created_at | datetime | |
| updated_at | datetime | |

### Goal

The refined statement of intent. Distinct from raw input.

| Field | Type | Description |
|---|---|---|
| id | uuid | |
| project_id | FK → Project | |
| text | text | Current formulation |
| version | int | Refinement counter |
| created_at | datetime | |

### Scope

Boundaries around the goal.

| Field | Type | Description |
|---|---|---|
| id | uuid | |
| project_id | FK → Project | |
| type | enum | `inclusion`, `exclusion`, `constraint` |
| text | text | The scope statement |
| source_exchange | FK → InterviewExchange? | Which exchange surfaced this |

### Requirement

What the system must do. User-stated or elicited.

| Field | Type | Description |
|---|---|---|
| id | uuid | |
| project_id | FK → Project | |
| text | text | The requirement statement |
| rationale | text | Why this matters |
| priority | enum | `must`, `should`, `could` |
| source | enum | `user_stated`, `elicited` |
| source_exchange | FK → InterviewExchange? | Which exchange surfaced this |

### Decision

A resolved fork in the design tree. Tree-structured.

| Field | Type | Description |
|---|---|---|
| id | uuid | |
| project_id | FK → Project | |
| question | text | The design question |
| options | json | Alternatives considered |
| recommendation | text? | LLM's recommendation |
| chosen | text | What the user chose |
| rationale | text | Why |
| lens | enum | `feature`, `architecture`, `data_model`, `integration`, `ux`, etc. |
| source_exchange | FK → InterviewExchange | The exchange that resolved this |
| sort_order | int | |


### Assumption

A falsifiable belief the spec rests on. Not a design choice (that's a Decision).

| Field | Type | Description |
|---|---|---|
| id | uuid | |
| project_id | FK → Project | |
| text | text | The belief statement |
| confidence | enum | `high`, `medium`, `low` |
| status | enum | `stated`, `validated`, `assumed` |
| impact_if_wrong | text | What breaks if this is false |
| source_exchange | FK → InterviewExchange? | Which exchange surfaced this |

### Decision ↔ Assumption (join)

Many-to-many. A decision may depend on multiple assumptions; an assumption may underpin multiple decisions.

| Field | Type | Description |
|---|---|---|
| decision_id | FK → Decision | |
| assumption_id | FK → Assumption | |

### Decision → Decision (dependency join)

DAG structure. A decision may depend on multiple prior decisions. Edges are backward references: the LLM cites relevant upstream decisions when posing each new question. See REFACTORS.md for rationale and prior art (IBIS, QOC, DRL, ADRs).

| Field | Type | Description |
|---|---|---|
| decision_id | FK → Decision | The decision that depends |
| depends_on_id | FK → Decision | The upstream decision |


### Acceptance Criterion

A testable condition verifying a requirement. Gathered progressively, validated in Phase 3.

| Field | Type | Description |
|---|---|---|
| id | uuid | |
| project_id | FK → Project | |
| requirement_id | FK → Requirement? | What this verifies (linked in Phase 3) |
| text | text | The testable statement |
| status | enum | `draft`, `proposed`, `validated` |
| verification_type | enum | `automated_test`, `benchmark`, `human_review`, `static_analysis`, `contract_check` |
| source_exchange | FK → InterviewExchange? | Which exchange surfaced this |

### Risk

A failure mode surfaced during Phase 3.

| Field | Type | Description |
|---|---|---|
| id | uuid | |
| project_id | FK → Project | |
| description | text | What could go wrong |
| severity | enum | `high`, `medium`, `low` |
| likelihood | enum | `high`, `medium`, `low` |
| mitigation | text | How to address it |

### Risk ↔ Decision / Criterion (joins)

Risks may link to the decisions that introduced them and the criteria that guard against them.

| Field | Type | Description |
|---|---|---|
| risk_id | FK → Risk | |
| decision_id | FK → Decision? | |
| criterion_id | FK → AcceptanceCriterion? | |

### Spec Output

The generated document. Stored as rendered output, regenerated as the underlying entities evolve. No confidence score — spec readiness is a function of workflow state (has the process completed?) and assumption risk (are low-confidence assumptions resolved?). Both are computable from the underlying entities, not a separate stored value.

| Field | Type | Description |
|---|---|---|
| id | uuid | |
| project_id | FK → Project | |
| content | text | Markdown spec |
| version | int | Regeneration counter |
| created_at | datetime | |

## Relationships summary

```
Project
├── Goal (1:many, versioned)
├── Scope (1:many)
├── InterviewExchange (1:many, ordered by phase + sort_order)
├── Requirement (1:many)
│   └── AcceptanceCriterion (1:many)
├── Decision (1:many, DAG via decision_dependency)
│   ├── → Decision (many:many, via decision_dependency)
│   └── ←→ Assumption (many:many)
├── Assumption (1:many)
├── Risk (1:many)
│   ├── → Decision (many:many)
│   └── → AcceptanceCriterion (many:many)
└── SpecOutput (1:many, versioned)
```

## What this replaces in the current schema

| Current | Becomes | Notes |
|---|---|---|
| `project` (junk drawer) | `Project` (identity) + `Goal` + `SpecOutput` | Phase/workflow state on Project, not scattered across boolean flags |
| `assumption` table | `Decision` | Current "assumptions" are design choices with alternatives |
| `entry` table | `Requirement` + `AcceptanceCriterion` | Splits "what" from "how we verify" |
| `goal_iteration` | `Goal` (versioned) + `InterviewExchange` | Goal refinement is interview-driven, not a separate mechanism |
| `clarifying_state` JSON blob | Eliminated | All state lives in proper tables |
| `current_questions` / `current_answers` JSON columns | `InterviewExchange` rows | Structured, not stuffed into project |
| No risk model | `Risk` entity | First-class, linked to decisions and criteria |
| No assumption→decision links | `decision_assumption` join | Traces which beliefs underpin which choices |
| No real `Assumption` entity | `Assumption` (falsifiable beliefs) | Distinct from decisions |

## North star (not built now)

- **Exploratory pathway**: for ambiguous projects where the goal itself needs discovery. Would produce invariants + refined goal → feed into high-certainty pathway.
- **Task/planning layer**: tasks, waves/epics, execution DAG. Tasks would reference assumptions (spikes validate them; predicated tasks depend on them). Belief falsification would cascade through the decision tree and invalidate dependent tasks. Many-to-many between tasks and assumptions, with two relationship types: `validates` (spike) and `predicated_on` (depends on belief holding).
- **Orchestration harness output**: rather than a fire-and-forget spec document, the tool would output a live data structure that an agent orchestration layer queries at runtime — checking belief validity, task preconditions, and decision dependencies.

These concerns are only relevant if the tool becomes an orchestration harness rather than a spec generator. The entity model is designed so that adding tasks/planning is additive (new tables referencing existing entities via foreign keys), not a rewrite.