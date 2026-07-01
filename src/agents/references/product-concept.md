# About Brunch

## What Is Brunch

Brunch is an agent harness whose goal is to facilitate a development workflow in which rich semantic and technical specifications are the central artefact and source of truth for agentic planning and execution of software development

## Agent Modes: Specify (`elicitor`) and Execute (`executor`)

Brunch has two top-level modes: Specify and Execute.

All projects begin in specify mode, where the `elicitor` agent works with the user through focused questions, proposal/review exchanges, and graph-backed capture to bring a specification to a point where it is ready for planning and implementation.

When specs are ready for implementation, the `executor` agent can turn them in to plans, and then orchestrate the implementation of those plans

## Specification: process, lifecycle

The initial and primary scenario for which Brunch has been modelled is software development (SWE), where a "specification" may cover many levels of mapping from the product level down to the implementation and verification level, without rigid formalisms.

One of the next immediate goals with Brunch is to support more mannered, methodical and formal specification styles, such as they are practiced in various domains. Examples may include BDD (behaviour-driven design, and similar).

A specification moves through stages; the first two are about mapping intent and require active 

## Specification: conceptual model

> **A spec is a graph of typed claims.** Each node kind is a *modality* of claim — a stance toward the world — not just a section bucket. 

```pseudo
spec graph
  intent plane     what / why / obligation / uncertainty / examples
  oracle plane     how claims are checked or evidenced
  design plane     how the system is shaped
  plan plane       how the work is sequenced
```

## Execution: process, lifecycle

TBD
