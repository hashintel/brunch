# Workflow Ownership: projection vs transition

> Clarification note for the current planning frontier.
> Status: explanatory design note, not canonical product truth.
> For live authority, prefer `memory/SPEC.md` and `memory/PLAN.md`.
> Related design context: `docs/design/state-machines/README.md`.

## Why this note exists

Two planning items can sound blurrier than they are:

- **Interview workflow transition extraction from `app.ts`**
- **Workflow projector extraction**

Both concern the same architectural pressure:

> **Where does the truth about interview/phase workflow live, and who is allowed to derive, advance, or interpret it?**

They are related, but they target different layers:

- **transition extraction** cleans up the **write path**
- **projector extraction** cleans up the **read path**

A useful shorthand is:

- **write-path workflow cleanup**
- **read-path workflow cleanup**

## The four layers to keep distinct

The easiest way to reduce the blur is to separate the workflow stack into four layers.

### 1. Durable truth

Persisted facts that are authoritative.

Examples:
- turns on the active path
- phase outcomes
- accepted review outputs
- turn capture status
- any other workflow-bearing durable records

This layer answers:

> What facts are stored?

### 2. Workflow projector

A pure derivation layer that interprets durable truth into the current workflow/read-model state.

Examples:
- current phase
- phase status, closeability, readiness
- current frontier turn
- whether the bottom artifact should be kickoff, frontier, recovery, handoff, or completion
- whether export is available

This layer answers:

> Given the stored facts, what workflow state is true right now?

### 3. Workflow transition/orchestration

The mutation layer that changes durable truth when the user or runtime takes an action.

Examples:
- submit a reply
- accept or reject a closure proposal
- accept a requirements review
- create a successor frontier turn
- record a phase outcome
- advance to the next phase

This layer answers:

> When something happens, what durable facts should change?

### 4. Transport and UI

HTTP handlers, route loaders, query invalidation, and React rendering.

Examples:
- `src/server/app.ts`
- route loaders and actions
- client-side query subscriptions
- rendered transcript/workspace surfaces

This layer answers:

> How do requests come in and how does the resulting state get delivered to the UI?

## The actual concern

The concern behind both planning items is that workflow semantics are still spread across multiple layers:

- some are embedded in DB/read helpers
- some are embedded in `app.ts`
- some are implicit in route/query refresh behavior
- some are only legible through end-to-end reading instead of one named boundary

That creates a few recurring problems:

- the rules for workflow progression are hard to read in one place
- projection logic and persistence logic can blur together
- transport and domain logic can tangle
- tests have to prove behavior indirectly through larger surfaces than necessary
- later router/query ownership cleanup becomes harder because the underlying workflow boundary is not crisp

## Item 1: transition extraction from `app.ts`

## What it is

This is the **write-path cleanup** item.

It means moving workflow-changing logic out of the broad server transport layer and into a more explicit workflow/domain seam.

Today, `src/server/app.ts` likely still does too much of the following in one place:

- receive a mutation/request
- inspect current state
- decide which workflow rule applies
- create or update durable records
- create successor turns
- close phases
- advance into the next phase
- coordinate nearby side effects

That makes `app.ts` more than transport; it becomes a partial workflow engine.

## What it should become

The target shape is:

- `app.ts` handles request/response concerns
- a dedicated workflow layer decides the transition
- persistence writes the resulting durable changes
- the app returns the projected read model

In other words, `app.ts` should call workflow logic, not *be* the workflow logic.

## What it affects

Primary files/seams:

- `src/server/app.ts`
- likely parts of `src/server/core.ts`
- request handlers for reply submission / review acceptance / phase close / successor creation
- tests that currently must go through app-level endpoints to verify workflow rules

## What this cleanup improves

- makes workflow mutation rules easier to read and change
- reduces duplication between different endpoint paths
- makes edge cases easier to test in isolation
- keeps transport concerns separate from workflow semantics

## Example questions this layer should answer cleanly

- What happens when a closure proposal is rejected?
- What durable writes happen when requirements review is accepted?
- When does the next phase open?
- What writes must exist before the client can truthfully render the next state?

## Item 2: workflow projector extraction

## What it is

This is the **read-path cleanup** item.

It means extracting a pure workflow projection layer from DB/read helper code, especially around `getCurrentWorkflowState()` in `src/server/db.ts`.

Today, a DB-facing seam likely loads durable rows and then partly interprets them in-place to compute things like:

- current phase
- closeability/readiness
- current frontier
- whether a projected kickoff/recovery/handoff should appear
- export readiness

That logic is workflow interpretation, not storage.

## What it should become

The target shape is:

- DB layer loads a durable snapshot
- one projector derives workflow state from that snapshot
- routes, app handlers, and tests consume that same derived result

Conceptually:

```ts
type WorkflowSnapshot = {
  // durable facts only
}

function projectWorkflow(snapshot: WorkflowSnapshot): WorkflowState {
  // pure derivation only
}
```

The important property is not the exact types; it is the ownership boundary:

- snapshot assembly belongs near persistence
- workflow interpretation belongs in the projector

## What it affects

Primary files/seams:

- `src/server/db.ts`
- read-model assembly helpers
- workflow-state helpers used by the client/API
- tests around hydration, resume, bottom-of-stream state, phase status, and export availability

## What this cleanup improves

- makes workflow interpretation legible as one named seam
- separates storage concerns from workflow derivation
- improves testability for resumed/seeded states
- prepares later router/query ownership cleanup by making the authoritative read model easier to name

## Example questions this layer should answer cleanly

- Given this durable snapshot, what is the current phase?
- Is the phase open or closed?
- What is the one truthful bottom artifact?
- Is this a kickoff, frontier, recovery, handoff, or completion state?
- Is export available yet?

## Side-by-side distinction

| Concern | Transition extraction | Projector extraction |
| --- | --- | --- |
| Main job | Clean up how workflow state changes | Clean up how workflow state is interpreted |
| Path | Write path | Read path |
| Typical style | Mutation/orchestration | Pure derivation/projection |
| Primary smell | `app.ts` acting like workflow engine | `db.ts`/helpers mixing storage with interpretation |
| Main outputs | Durable writes and next-step decisions | Derived workflow state/read model |
| Main payoff | Clearer workflow rules | Clearer workflow truth |

## Why they belong to one family

Even though they are distinct items, they belong to one conceptual family:

> **workflow ownership cleanup**

Both are trying to make these boundaries more legible:

- what is durable truth?
- what is derived truth?
- who may change workflow state?
- who may interpret workflow state?
- what belongs in transport/UI, and what does not?

That is why they often feel adjacent in planning discussions.

## What they affect elsewhere

These are not just internal cleanup items. They influence several visible or near-visible concerns.

### Transcript fidelity and resume behavior

If projection is fuzzy or duplicated, resumed states can land incorrectly:

- wrong frontier
- missing handoff/completion
- stale recovery
- incorrect open/closed interpretation

### Route/query ownership

If workflow truth is not clearly projected in one place, route/query invalidation often becomes coarser than necessary:

- over-refresh
- unnecessary churn
- unclear loader ownership
- UI correctness depending on broad invalidation instead of precise boundaries

### Lifecycle correctness

The current spec direction wants:

- durable workflow truth to remain authoritative
- no second client workflow store
- route-independent ownership for ephemeral lifecycle concerns
- projected control cards rather than durable kickoff/recovery truth

Clear projector and transition boundaries support that directly.

### Future feature work

The cleaner these ownership seams are, the easier later work becomes:

- export/output readiness
- close-phase flows
- grounding/recovery behavior
- transcript trust for seeded/resumed states
- later revisit/cascade workflow

## Current file-level mental map

This is only a rough orientation map, not a binding code inventory.

### Durable truth / persistence-adjacent
- `src/server/db.ts`
- `src/server/schema.ts`
- persisted turn / phase outcome / capture-status records

### Projector-shaped logic
- `getCurrentWorkflowState()` and nearby read-model derivation in `src/server/db.ts`
- any helper that computes current phase/frontier/closeability/handoff from durable records

### Transition-shaped logic
- request handlers in `src/server/app.ts`
- any code in `src/server/core.ts` or nearby modules that decides what successor write/phase progression should happen next

### Transport/UI-shaped logic
- API endpoints in `src/server/app.ts`
- route loaders and actions
- `src/client/routes/project/$id/_view/*`
- client refresh/invalidation behavior

## How to think about them in planning

If the names start to blur again, use these translations:

- **Workflow projector extraction** = make the system better at answering
  - “What workflow state is true right now?”
- **Transition extraction from `app.ts`** = make the system better at answering
  - “When this action happens, what durable workflow changes should occur?”

Or more briefly:

- **projector = read truth**
- **transition = write truth**

## Recommendation for roadmap framing

These can remain separate frontier items if needed, but they should be thought of as one architectural theme:

- **workflow ownership cleanup**
  - read-path cleanup: projector extraction
  - write-path cleanup: transition extraction

That framing keeps them distinct without pretending they are unrelated.
