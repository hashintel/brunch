# SPEC TA1.3 Extensions

_Date: 2026-04-08_
_Status: design note capturing how the current brunch SPEC reconciles with the broader TA1.3 AI R&D framework, and where obvious extension pressures remain_

## Purpose

Capture the main gaps, tensions, and extension seams that appear when `memory/SPEC.md` is read against the broader TA1.3 AI R&D framework.

This document is not a replacement for `memory/SPEC.md`.

- `memory/SPEC.md` remains the source of truth for the product we are currently building.
- `memory/PLAN.md` remains the source of truth for execution status.
- This note records where the current v1 product is knowingly narrower than the surrounding programme framing, and where that narrowness is likely to produce the next wave of design pressure.

## Current Reconciliation

The current brunch SPEC reconciles best with the TA1.3 overview if brunch is understood as:

- a **specification workbench**
- a partial **governance surface** for specification development
- a partial **orchestration surface** for the interview, extraction, review, and readiness workflow
- not yet the full end-to-end AI R&D system spanning specification, planning, execution, and validation

That reading is coherent with the current product shape:

- the product centers on co-producing a structured specification through one branching interview
- it already models durable semantic artifacts rather than only chat transcript text
- it already treats revisit, review, and readiness as first-class concerns
- it explicitly excludes task planning from the current scope

## Clean Fit With The TA1.3 Overview

Several parts of the broader TA1.3 framing already map well to brunch.

### Specification as a structured artifact

The strongest fit is the overview's specification slice.

Brunch already has:

- a typed knowledge layer rather than only markdown prose
- explicit requirement and criterion concepts, not only free-form notes
- typed relationships between knowledge items
- source-turn provenance for extracted knowledge
- explicit readiness semantics rather than a vague sense of completion

This is already much closer to the TA1.3 notion of a structured, inspectable, operationalizable specification than a typical prompt-to-markdown coding workflow.

### Human/AI co-production

The overview describes specification production as a coproduction between humans and AI assistants. Brunch fits that well.

- the interviewer shapes the interaction
- the observer extracts typed knowledge
- the user confirms closures and review outcomes
- the specification evolves through interaction rather than being generated in one pass

### Living specification and change over time

The turn tree, active path, revisit behavior, and soft invalidation model are a concrete response to the TA1.3 requirement that specifications be living artifacts rather than one-shot kickoff documents.

### Thin horizontal split already exists

Even though brunch is not yet the full TA1.3 system, it already has a thin version of the horizontal layering:

- **governance-like** behavior: user confirmation, closure approval, dashboard visibility
- **orchestration-like** behavior: readiness management, observer invocation, context projection, mode transitions
- **action-like** behavior: interviewer and observer agent calls, tool usage, extraction, export rendering

## Where The Current SPEC Is Narrower

The main gaps are not subtle. They are mostly acknowledged in the current v1 scope, but they are still real.

### 1. Planning is entirely out of scope

The TA1.3 overview treats plan development as a first-class stage linking specification to execution.

Brunch currently does not attempt to model:

- plan artifacts
- task decomposition
- task dependency graphs
- candidate-plan generation
- plan approval
- validation-gate insertion into a plan
- requirement-to-task traceability as an executable plan object

This is the single largest mismatch with the overview.

### 2. Execution is not yet modeled as a first-class workflow layer

The overview expects an execution engine that dispatches work, manages checkpoints, enforces validation gates, records outputs, and routes escalation.

Brunch currently stops at specification readiness and export. It does not yet model:

- task dispatch
- task state beyond interview/readiness state
- produced implementation artifacts as first-class downstream objects
- retry loops for implementation work
- execution checkpoints and checkpoint approvals
- rework triggered by downstream failures

### 3. Geolog is absent from the current product core

The TA1.3 MVP framing makes Geolog central as a datastore or API layer.

The current brunch SPEC is deliberately SQLite + Drizzle centric. That is a pragmatic v1 choice, but it means the current system does not yet prove:

- a Geolog theory for the brunch knowledge model
- a Geolog representation of readiness or review state
- cross-artifact integrity enforced through Geolog theories
- how brunch artifacts map into the broader TA1.3 data layer

### 4. Validation is present, but assurance is still narrow

Brunch already has `criterion`, readiness, and a serious verification design for its own product development.

But the TA1.3 overview points toward a broader assurance model that brunch does not yet represent explicitly, including:

- validation method as a first-class artifact
- assurance level per requirement
- formal property vs informal requirement
- trusted assumption vs discharged assumption
- proof obligation
- proof result
- evidence lineage linking requirement -> method -> result -> approval

At present, brunch is much stronger at eliciting requirements and criteria than at representing assurance structure.

### 5. Context is under-modeled as a governance object

Brunch has context builders for inference, but the TA1.3 overview asks for stronger context governance.

The broader model wants the system to distinguish between:

- context sources available to the workflow
- context intentionally routed to a task
- context actually accessed during production
- context later inspectable by governance

Brunch currently models context mainly as an internal prompt-construction concern, not yet as a user-visible control and provenance object.

### 6. Permissions are not yet first-class

The overview gives permissions and sandbox policy a major role in safe operation.

Brunch currently does not expose a first-class model for:

- permission policy
- per-task capability grants
- sensitive-context tagging
- approval requirements for elevated access
- revocation on anomaly or policy breach

That is acceptable for a local single-user spec tool, but it is a real extension seam if brunch is to plug into a broader governed workflow.

### 7. Provenance is only partial

Brunch has strong provenance for source turns and extracted knowledge.

The broader TA1.3 model wants a wider provenance surface:

- what produced an artifact
- what context was used
- what permissions governed that production
- what validation checks ran
- what approvals were applied
- what assumptions remained trusted at acceptance time

Brunch is ahead on conversational provenance, but still early on full workflow provenance.

### 8. Approval and change-control policy are still shallow

Brunch already has user-confirmed mode closure and planned review records, but the overview implies a richer governance model around change control.

Missing likely artifacts include:

- approval policy
- auto-approval policy boundaries
- modification policy by knowledge kind or requirement class
- explicit accepted baseline vs proposed branch
- formal change request / supersession records

### 9. Cross-system artifact contracts are still implicit

The current strongest contracts are UI- and chat-centric: typed message parts, SSE events, hydration seams, and sidebar projections.

That is good for the current product, but the broader TA1.3 model will eventually want more machine-operable external contracts for:

- specification export beyond markdown
- planner-facing artifacts
- execution-facing artifacts
- assurance/evidence exchange
- datastore interoperability

## Pressure Points Inside The Current Model

Even if brunch remains intentionally narrow for v1, some tensions are already visible.

### Fire-and-forget export vs living governance artifact

The current concept still speaks partly in terms of a final specification document exported from the active path.

The TA1.3 overview pushes toward a stronger notion of the specification as an ongoing governing artifact that continues to constrain planning, execution, approval, and rework.

That creates pressure to treat export as one projection of a richer state model, not as the terminal product.

### Capture-anytime / review-in-phase vs accepted baselines

The current `capture-anytime, review-in-phase` rule is a strong elicitation model, but downstream planning and execution will need a sharper answer to questions like:

- what exactly is approved right now
- which items are only provisional
- which changes can proceed autonomously
- which changes require explicit acceptance before downstream work continues

As soon as brunch feeds real implementation workflows, this boundary becomes more load-bearing.

### Soft invalidation will get much harder once downstream work exists

Today, soft invalidation mainly affects readiness and review semantics inside the spec tool.

Once plans, executions, tests, and proofs depend on spec items, invalidation will have to propagate into a much larger dependency graph:

- requirement change may invalidate criteria
- requirement or assumption change may invalidate plan tasks
- plan change may invalidate execution records
- upstream change may reopen proof obligations or prior approvals

The current invalidation model is a good seed, but it is not yet carrying that weight.

### The six-kind ontology will likely not be enough forever

`framing`, `constraint`, `decision`, `assumption`, `requirement`, and `criterion` are a good v1 semantic core.

The TA1.3 overview suggests likely future pressure for additional artifact kinds or adjacent records such as:

- approval
- policy
- validation method
- formal property
- proof obligation
- proof result
- evidence
- context source
- permission grant
- execution artifact

This does not mean the ontology should expand immediately. It means the current design should expect pressure at that seam.

### UI-message-centered seams are not the same as system contracts

The current architecture is wisely optimized around the AI SDK chat boundary because that is what makes the product real now.

But if brunch becomes an upstream component in a larger TA1.3 workflow, typed UI message parts will not be sufficient as the only stable contract surface. The system will need contracts for artifact exchange independent of the web chat runtime.

### Single-user local wedge vs multi-actor orchestration

The current single-user, local SQLite, Anthropic-only scope is justified.

But the broader TA1.3 framing assumes a more composable system boundary with multiple actors, stores, services, and governance checkpoints. That means brunch may eventually need a clearer answer to whether it remains:

- a local-first product with export hooks
- a front-end onto a shared workflow backend
- or a spec-native subsystem inside a larger orchestration platform

## Likely Extension Seams

These look like the most natural places for future extension once the current v1 semantics are real.

### 1. Machine-operable spec contract

Keep markdown export, but add an explicit machine-facing representation of:

- knowledge items
- typed relationships
- review state
- phase outcomes
- readiness state
- supersession / invalidation state

### 2. Geolog mapping

Define how brunch's current domain model maps into Geolog.

At minimum this likely means:

- a theory for knowledge items and edges
- a theory for readiness and review state
- integrity rules for active-path semantics and invalidation
- a bridge between local development storage and TA1.3 datastore semantics

### 3. Approval and change-control layer

Make governance state explicit rather than leaving it implicit in UI affordances.

Likely future records:

- accepted baseline
- proposed changes
- approval decision
- approval scope
- auto-approval policy
- escalation trigger

### 4. Validation and assurance model

Extend the semantic core around `criterion` so the system can represent more than surface-level checks.

Likely additions:

- validation method
- evidence record
- assurance level
- formal property
- trusted boundary
- proof obligation / result

### 5. Spec-to-plan handoff contract

Even if brunch does not own planning, the broader system will need an explicit seam from specification artifacts to plan artifacts.

That seam likely needs to express:

- which requirement or assumption a task addresses
- what validation method gates completion
- what inputs and outputs are expected
- what context and permissions are required

### 6. Context and permissions as inspectable artifacts

Move some context and permission logic out of invisible prompt/runtime plumbing and into explicit workflow records.

Likely future concepts:

- context source
- context grant
- context actually accessed
- permission policy
- permission grant
- sensitive-data boundary

## Working Interpretation For Now

For the current v1, the cleanest stance is:

- brunch should continue to optimize for being an excellent specification workbench
- the TA1.3 end-to-end system should be treated as the wider frame brunch may plug into, not the full scope brunch must absorb immediately
- extension pressure should be recorded explicitly so the v1 product can stay narrow without pretending the missing seams are imaginary

That preserves focus while keeping the architecture honest.

## Open Design Questions Worth Reopening Later

These are not blockers for the current build, but they are obvious future grill topics.

1. Is brunch ultimately a standalone spec product, or a front-end onto a broader governed orchestration system?
2. Which missing artifacts belong inside brunch's own ontology, and which should remain downstream concerns?
3. When should `criterion` split into richer assurance concepts rather than continuing to absorb everything validation-shaped?
4. When does soft invalidation need to become a more explicit cross-artifact invalidation engine?
5. What is the minimum useful Geolog mapping that proves interoperability without prematurely rebuilding the whole product around it?
6. What is the smallest spec-to-plan handoff contract that would let other TA1.3 components consume brunch output productively?

## Summary

The current SPEC is not in conflict with the TA1.3 overview. It is a deliberately narrower, more concrete wedge into it.

Brunch is already a serious answer to the overview's specification problem. It is not yet an answer to the overview's planning, execution, assurance, context-governance, permissions, or full provenance problems.

Those are not failures of the current SPEC. They are the next design horizon.
