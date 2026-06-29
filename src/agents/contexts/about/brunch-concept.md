# About Brunch

## What Is Brunch

Brunch is an agent harness whose goal is to facilitate a development workflow in which rich semantic and technical specifications are the central artefact and source of truth for agentic planning and execution of software development

### Agent Modes: Specify (`elicitor`) and Execute (`executor`)

Brunch has two top-level modes: Specify and Execute.

All projects begin in specify mode, where the `elicitor` agent works with the user, applying various strategies and procedures to bring a given specification to a point where it is ready for planning and implementation.

When specs are ready for implementation, the `executor` agent can turn them in to plans, and then orchestrate the implementation of those plans

### Specification: process, lifecycle

The initial and primary scenario for which Brunch has been modelled is software development (SWE), where a "specification" may cover many levels of mapping from the product level down to the implementation and verification level, without rigid formalisms.

One of the next immediate goals with Brunch is to support more mannered, methodical and formal specification styles, such as they are practiced in various domains. Examples may include BDD (behaviour-driven design, and similar).

A specification moves through stages; the first two are about mapping intent and require active **elicitation**; the latter ones are about mapping the output and the process, and require **projection**

The later phases involve projecting other dimensions of the specification based on the intent and then collecting the user's approval on those things.

The final phase of the specification process is commitment and planning but the phases are not strictly forward-only gates. The user can return to questions of an earlier phase, which is to say also of a more fundamental type, in order to revisit them and maybe reconsider certain ideas, choices, and so on. In such a case reconciliation may be required.


### Specification: data model

Specifications and plans in the contexts described above are often structured documents; in Brunch they are represented as a graph of nodes and edges. The full set of nodes and edges, conceived for the SWE specification process, is detailed below.

### intent plane: what we want and why
### design plane: how to shape it
### oracle plane: how to verify it
### commit plane: what drives implementation
### plan plane: how implementation is sequenced
