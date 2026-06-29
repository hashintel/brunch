# Context slice index

Draft injectable reference. Use this as a selector when composing short-lived LLM context over the graph ontology. Exact vocabulary lives in `graph-ontology.md`; broad graph-authoring judgment lives in `graph-authoring-heuristics.md`.

## Selection rule

Inject the smallest slice that matches the current job. Prefer one topical slice plus `neighborhood-consumption-slice.md` over a full ontology dump.

| Current job | Inject | Avoid |
| --- | --- | --- |
| Capture user/world/spec material into graph truth | `intent-capture-slice.md` | oracle/design/plan slices unless the user gave that material directly |
| Project accepted intent into modules, interfaces, entities, or sketches | `design-projection-slice.md` + relevant neighborhoods | free-floating design guesses with no intent anchor |
| Design verification, criteria, tests, probes, evidence, or proof obligations | `oracle-witness-slice.md` + relevant neighborhoods | claim-level checkability fields or bespoke oracle tools |
| Sequence milestones, frontiers, and buildable slices | `plan-sequencing-slice.md` + relevant neighborhoods | task lists detached from requirements/invariants/design seams |
| Draft a reviewable graph proposal batch | `review-set-drafting-slice.md` + the topical slice | direct graph writes for unsettled or low-confidence material |
| Explain or edit one existing item | `neighborhood-consumption-slice.md` | global kind lists without incident edges |

## Context-stack graph

```pseudo
nodes:
  ontology: generated vocabulary
  authoring: shared judgment
  neighborhood: item-centered context
  intent: spec claim capture
  design: shape projection
  oracle: verification projection
  plan: sequencing projection
  review: human-adjudicated proposal batch

edges:
  ontology   -> authoring
  authoring  -> intent
  intent     -> design
  intent     -> oracle
  intent     -> plan
  design     -> oracle
  design     -> plan
  oracle     -> plan
  neighborhood -> intent, design, oracle, plan, review
  intent, design, oracle, plan -> review

notes:
  - ontology is generated; do not restate its tables in topical slices.
  - topical slices are conduct, not schema. They teach how to use the graph vocabulary.
```

## Mainline use chain

```pseudo
incoming task
  -> read selected spec overview and relevant neighborhoods
  -> choose topical slice from the table above
  -> classify or project material using current graph vocabulary
  -> route unsettled material to gaps or review drafts
  -> commit only settled graph truth through the graph mutation boundary
```

## Draft status

These slices are candidate injectable references. A skill or prompt should cite a slice only when that slice has a concrete reader and improves behavior more than loading the larger `graph-authoring-heuristics.md` reference.
