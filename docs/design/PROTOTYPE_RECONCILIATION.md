# Prototype Reconciliation

_Date: 2026-04-08_
_Status: explanatory design note reconciling an earlier product description with the current prototype shape_

## Purpose

Capture how the current brunch prototype relates to an earlier step-based product description, with a focus on:

- what still maps cleanly from the original concept
- what materially changed in the interaction model
- what materially changed in the data model
- what is already built versus what remains ahead
- what questions are still worth interrogating in a follow-up design grill

This document is a bridge artifact. `memory/SPEC.md` remains the source of truth for requirements, assumptions, decisions, and invariants. `memory/PLAN.md` remains the source of truth for execution status.

## The Earlier Product Description

One original framing of the product described a navigable multi-step flow:

1. goal input
2. clarifying questions
3. assumption review
4. spec generation and review
5. checks
6. surprise generation and gap analysis

That framing was useful early because it made the user journey concrete and legible. But the implementation work surfaced a different underlying shape.

## The Current Prototype Model

The prototype is no longer best understood as a six-step wizard.

The current model is:

- one persistent interview as the throughline
- a branching turn tree as the history spine
- workflow modes layered over that history: `scope`, `design`, `requirements`, `criteria`
- a typed knowledge layer extracted from turns in the background
- a readiness layer that will eventually hold phase outcomes and review state

This is the four-layer model described in `docs/design/INTERVIEW_MODE_MODEL.md`:

1. history spine
2. workflow mode
3. knowledge layer
4. readiness layer

The key conceptual shift is that the product is now modeled as an interview system with review and export consequences, not as a form-like sequence of static spec-generation screens.

## What Pivoted

### 1. From stepper UX to one branching interview

The earlier description implied a left-nav workflow where users could jump among stages.

The current model keeps distinct workflow modes, but they are not primarily separate pages or isolated data-entry windows. They are behavioral modes inside one interview. The branching `turn` tree is the durable spine, and later review or revisit behavior is defined relative to the active path through that tree.

What survived from the original concept:

- the product still has distinct phases of sense-making
- the user is not supposed to be trapped in a purely linear interaction
- revisiting earlier work still matters

What changed:

- revisit is now fundamentally modeled as branching history, not simple step navigation
- the central object is the interview state, not the current wizard step
- mode transitions are expected to become explicit outcomes, not just page changes

### 2. From assumption-centric structuring to a generic knowledge layer

The earlier concept gave assumptions a special, explicit middle step.

The implementation work revealed that the interview naturally produces a broader ontology much earlier than that framing allowed. The current knowledge model includes:

- `framing`
- `constraint`
- `decision`
- `assumption`
- `requirement`
- `criterion`

Instead of pretending these only appear in their named stages, the runtime model is now capture-anytime, review-in-phase.

What survived:

- assumptions remain important
- the system still needs explicit confidence-bearing or review-bearing semantics later

What changed:

- assumptions are now one knowledge kind among several, not the singular bridge between Q&A and spec generation
- requirements and criteria can begin surfacing before formal review modes exist
- the sidebar/dashboard is becoming a projection of a knowledge graph, not just a temporary checklist of assumptions

### 3. From single-choice clarifications to richer turn responses

The earlier concept centered on multi-choice questions with an `other` option.

The current model preserves structured guidance from the interviewer, but it no longer assumes every answer is one categorical pick. A turn response can now support:

- zero selections plus required free text
- one selection plus optional free text
- many selections plus optional free text
- later review-oriented responses

This was a meaningful interaction-model pivot, because the product is increasingly treating turns as structured conversational moves rather than as form controls with a chat skin.

### 4. From early spec editing to later export from reviewed knowledge

The earlier description implied a relatively early moment where the AI would generate a structured spec that the user could directly edit and annotate.

The current direction postpones that. The system is trending toward:

- interview first
- knowledge capture and review second
- export from reviewed knowledge and confirmed phase outcomes later

So the center of gravity moved from "generate the document, then edit it" to "build a durable semantic state, then render/export from it when readiness is satisfied."

### 5. From explicit checks selection to criteria review

The original `checks` step survives in spirit, but the current product language is moving toward `criteria` and verification coverage rather than a simple menu of test types.

That is a deeper model. It ties validation to approved requirements and to knowledge edges, instead of treating checks as a flat optional appendix to the spec.

### 6. Surprise generation is currently deferred

The earlier description included an adversarial surprise-generation and gap-analysis step.

That capability is not in the active near-term build sequence right now. The project has instead prioritized proving the substrate that would make such a step meaningful:

- persistent history
- a richer ontology
- review semantics
- revisit invalidation
- export readiness

## What Is Already Built

As of this note, the prototype has already established a substantial amount of the substrate:

- structured interview entry with streaming chat
- real-time visibility into agent thinking, tool usage, and progress
- persisted turn history in SQLite
- a read-only entity sidebar / dashboard projection
- flexible turn responses beyond single-select answers
- a widened generic knowledge seam for `framing`, `constraint`, `requirement`, and `criterion`
- phase-aware observer widening through scope, design bias, and requirements emergence

In practical terms, the prototype already proves that brunch is not just a speculative product shape anymore. The core interviewing, persistence, streaming, and knowledge-extraction substrate exists.

## What Is Not Built Yet

The remaining work is concentrated in higher-order workflow semantics rather than first-principles plumbing.

Still ahead:

- explicit phase outcomes and user-confirmed mode closure
- full design mode behavior on top of the widened model
- requirements-review mode
- criteria-review mode
- generalized revisit with downstream readiness invalidation
- editable knowledge review lifecycle from the sidebar
- export gated by reviewed knowledge and active-path readiness
- final `npx` packaging and CLI distribution

This means the project is roughly halfway in an important sense: the substrate is real, but the final product semantics are not yet fully assembled.

## Clean Mapping: Original Concept vs Current Direction

| Original concept                   | Current direction                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Goal input                         | Still present, but now as the opening of one durable interview                         |
| Clarifying questions               | Still present, but not limited to single-choice clarification cards                    |
| Assumption review                  | Reframed into a broader knowledge/review model                                         |
| Spec generation and review         | Deferred toward export from reviewed knowledge                                         |
| Checks                             | Reframed as criteria review and verification coverage                                  |
| Surprise generation / gap analysis | Not yet in the active implementation sequence                                          |
| Jump between steps via left nav    | Reframed as branch/revisit and mode transitions over one interview                     |
| AI help chat at any point          | Largely absorbed into the main interaction loop rather than a secondary helper surface |

## Why The Pivots Make Sense So Far

This section is intentionally provisional.

Observed from the current artifacts, the pivots appear to have happened because the implementation kept surfacing truths that the earlier step model flattened:

- the interview naturally produces mixed kinds of knowledge earlier than expected
- revisit behavior wants history semantics, not only navigation semantics
- user responses do not fit a single-choice worldview
- a durable semantic state is a better long-term export substrate than early document generation
- readiness and invalidation need their own layer rather than being implicit in the last turn seen

These are not yet the final reasons. They are the working explanation that best matches the current code-and-plan story.

## Emerging Product Thesis From The Grill

The follow-up grill sharpened the product thesis beyond the earlier reconciliation.

### 1. Brunch is not trying to serve the whole planning spectrum

Projects sit somewhere on a spectrum between two poles:

- high-uncertainty epistemic work against moving or unstable targets
- high-certainty operative work against well-defined fixed targets

Most AI planning demos and product narratives emphasize the second pole. They show impressive decomposition and execution once the target is already stable. That work is real, but it tends to understate how often the harder problem is upstream: clarifying what the target even is, what is actually known, and which commitments are justified.

Brunch does not claim to cover that whole spectrum evenly, but it assumes that most projects sit somewhere between these two poles, and aims to do a better job than typical planning tools for that case, i.e. where building clarity and certainty are a necessary part of the process

### 2. The real output is a calibrated handoff, not fake closure

The current direction suggests that brunch should export a specification-like artifact that is a variable composition of:

- assumptions
- decisions
- questions
- constraints
- targets
- requirements
- criteria

The exact ontology and naming are still in motion, but the core idea is already clear: the output should tell a downstream implementing agent not only what to do, but what kind of project state it is entering.

In other words, the handoff should make legible the balance between:

- epistemic progress already achieved
- operative progress already tenable
- unresolved questions that still need disciplined downstream handling

### 3. Truthfulness about unresolvedness is a feature, not a defect

One implication of that thesis is that the export should not launder uncertainty into false certainty.

The failure mode here is not merely a weak spec. It is a spec-shaped artifact that pretends the project is uniformly settled when it is not, causing downstream humans or agents to decompose confidently against unresolved premises.

So the likely standard is not "resolve everything before handoff." It is closer to "export the most truthful, structured, implementation-useful account of what is known, chosen, constrained, required, and still open."

### 4. Brunch v1 stops at a strong starting point

This first version does not yet extend into continued downstream management during implementation.

That work still matters. A mixed epistemic/operative project requires disciplined handling after the initial handoff as implementation changes the evidence landscape. But the current product boundary is earlier than that. Brunch v1 aims to produce a reasonable, structured starting point for implementation rather than to own the whole lifecycle.

## Remaining Open Questions

Questions still worth pressure-testing next:

1. Which kinds of unresolvedness are legitimate to preserve in the export, and which kinds count as failure?
2. Is `spec` still the right name for the output artifact, or is that already too certainty-coded?
3. Which ontology terms should become canonical for the export surface: assumptions, decisions, questions, constraints, targets, requirements, criteria, or some revised mapping?
4. Do we still want a visibly staged experience in the UI, even if the runtime model is a single interview and branching history?
5. Is `assumption review` still a useful user-facing concept, or should it disappear into a broader commitment-review model?
6. When we eventually add adversarial review or surprise generation, where does it belong: as a mode, as a readiness lens, or as an optional side pass?
7. What should the eventual handoff boundary be between brunch and downstream implementation-management tooling?

## Suggested Use Of This Note

Use this note when explaining the project to someone who only knows the earlier product description.

It is especially useful for saying:

- the project did not abandon the original idea
- the project found a stronger underlying model beneath the original idea
- the shipped work so far is concentrated in substrate and semantics, not just surface polish
- several of the most product-visible features are still ahead because they depend on that substrate being correct
