# Capture Heuristics

This is reasoning prose, not authority. The canonical artifacts:

- **Generated vocabulary tables** — [`src/agents/contexts/references/graph-ontology.md`](../../../contexts/references/graph-ontology.md), projected by `src/graph/schema/generate-ontology-ref.ts` from [`kinds.ts`](../../../../graph/schema/kinds.ts), [`nodes.ts`](../../../../graph/schema/nodes.ts), and [`category-policy.ts`](../../../../graph/policy/category-policy.ts) (D73-L). Regenerate with `npm run generate:ontology`; drift is caught by `npm run check:data-model`.
- **Authored authoring judgment** — [`src/agents/skills/capture/references/graph-heuristics.md`](graph-heuristics.md): the runtime-eligible shared reference cited by `capture` and `commit-graph` (D97-L).
- **Schema leaves** — `src/graph/schema/kinds.ts` (closed enums), `nodes.ts` (`GraphNode`, detail schemas), `edges.ts` (`GraphEdge`), `reconciliation-need.ts`, `elicitation-gaps.ts`; `src/graph/policy/category-policy.ts` (edge-category metadata); `src/graph/projection/labels.ts` + `direction.ts` (anchor-relative phrasing + impact direction).
- **SPEC decisions** — D51-L (closed edge categories + ReconciliationNeed), D54-L (node shape), D55-L (provenance retired → `change_log`), D56-L (13 intent kinds, per-kind rubric, no derived category axis), D57-L (LLM-judged readiness), D61-L (spec = initiative; "claim" is an umbrella over truth-bearing kinds), D62-L (projected codes), D63-L (`basis` = approval directness), D64-L/D94-L (derived readiness bands), D65-L (elicitation_gaps), D73-L (domain owns vocabulary), D87-L/D88-L/D89-L (closure rule, `detail.form`, `spec.kind`), D97-L (cite-don't-inline), D98-L (SPEC/CODE mode-only runtime), D8-L/D29-L (reconciliation substrate).
- **Worked rationale companion** — [`ONTOLOGY_REVIEW_PROTOCOL.md`](../../../../../docs/design/ONTOLOGY_REVIEW_PROTOCOL.md) §6–9 records exactly how the older ontology narrowed into the current one (the closure rule, node/edge deltas, the epistemic triad, the Gherkin validation).

When this draft and a generated table disagree, the generated table wins; this prose is stale and should be fixed.

## The framing

> **A spec is a graph of typed claims.** Each node kind is a *modality* of claim — a stance toward the world — not just a section bucket. 

```pseudo
spec graph
  intent plane     what / why / obligation / uncertainty / examples
  oracle plane     how claims are checked or evidenced
  design plane     how the system is shaped
  plan plane       how the work is sequenced
```

## The four planes and their kinds

> **`kind` drives behavior** — readiness evaluation, edge legality, and the elicitor's questioning strategy

Twenty-four kinds across four planes, in canonical plane order. Codes and bands are generated in [`graph-ontology.md`](../../../contexts/references/graph-ontology.md) (reproduced here for legibility; that file is the source of truth). A band of `—` means the kind carries no readiness band (D94-L); band-less kinds are `example`, `sketch`, `term`.

### Intent plane — what and why (13 kinds)

| Kind          | Code | Modality of claim           | Source-question                                  |
| ------------- | ---- | --------------------------- | ------------------------------------------------ |
| `goal`        | G    | Value / outcome claim       | "What outcome are we after?"                     |
| `thesis`      | TH   | Position / bet claim        | "Who is this for, and why does it matter?"       |
| `term`        | T    | Vocabulary commitment       | "What do we mean by X?"                          |
| `context`     | CTX  | Descriptive claim           | "What is true about the world this lives in?"    |
| `story`       | ST   | Intra-spec grouping         | "What cluster of behavior does this belong to?"  |
| `unknown`     | UNK  | Known-unknown claim         | "What can't we answer yet but must accommodate?" |
| `requirement` | REQ  | Obligation claim            | "What must the system do?"                       |
| `assumption`  | A    | Deferred-falsifiable belief | "What might be false?"                           |
| `constraint`  | CON  | Boundary claim              | "What does this rule out?"                       |
| `invariant`   | INV  | Preservation claim          | "What must never be broken?"                     |
| `decision`    | D    | Choice claim                | "What did we pick among real alternatives?"      |
| `criterion`   | AC   | Oracle claim                | "How will we judge that it holds?"               |
| `example`     | EX   | Witness / disambiguator     | "What concrete case would settle this?"          |

### Oracle plane — how we know (4 kinds)

| Kind            | Code | Role                                                            |
| --------------- | ---- | --------------------------------------------------------------- |
| `check`         | CH   | A concrete verification check (a test, assertion, step-def)     |
| `vv_method`     | VV   | A verification method (prover / solver / golden / probe family) |
| `evidence`      | E    | Observed evidence                                               |
| `vv_obligation` | O    | A proof / verification obligation                               |

The salvaged doc's `criterion` subtypes (`acceptance`, `test`, `manual_review`, `runtime_check`, `proof`, `observability`) are reconstructed here as: **the intent-plane `criterion`** (the oracle *claim* — how we judge a property) plus **oracle-plane nodes** (the concrete machinery). The discrimination the subtypes carried is preserved as the intent/oracle plane boundary, not as a subtype enum. Link a concrete oracle to the claim it judges with a `witness` edge.

### Design plane — how it's shaped (4 kinds)

| Kind        | Code | Role                                                                |
| ----------- | ---- | ------------------------------------------------------------------- |
| `module`    | MOD  | An implementation seam / module                                     |
| `interface` | API  | An interface / contract surface                                     |
| `entity`    | ENT  | A data / domain entity                                              |
| `sketch`    | SKT  | An intentionally lightweight design sketch (advisory, not hardened) |

### Plan plane — how it's sequenced (3 kinds)

| Kind        | Code | Role                                                |
| ----------- | ---- | --------------------------------------------------- |
| `milestone` | M    | A bounded phase                                     |
| `frontier`  | F    | The plan / tracker / branch unit                    |
| `slice`     | S    | The buildable implementation unit inside a frontier |

## The epistemic triad: context / assumption / unknown

The old doc's `context` promotion rules implied a two-way fork between "known" and "might be false." The current model makes this a **three-way informal certainty triad** — a routing heuristic, not a stored `epistemic_status` field (ONTOLOGY_REVIEW_PROTOCOL §6.6):

- `context` — known / stipulated true for this spec.
- `assumption` — believed enough to proceed, but **deferred-falsifiable** ("what might be false").
- `unknown` — a known-unknown; explicitly not known, and the system or plan must accommodate that ignorance.

Do not launder a known-unknown into an assumption to make the graph look complete. Routing for formal work: an **axiom / given → `context` + `detail.form:"given"`** (known *and* load-bearing); load-bearing-ness comes from outgoing `dependency` edges, not from the kind. A **theorem / property → `invariant`** (a preservation claim carrying `witness` edges).

## Promotion rules

| If the descriptive material…                                 | Promote to…                         |
| ------------------------------------------------------------ | ----------------------------------- |
| states the desired outcome or why the work matters           | `goal` or `thesis`                  |
| defines a term or naming commitment                          | `term`                              |
| must be true for success or safety                           | `requirement` or `invariant`        |
| limits acceptable solutions or scope                         | `constraint`                        |
| is believed but might be materially false                    | `assumption`                        |
| is an acknowledged unknown that can't simply be answered now | `unknown`                           |
| chooses among alternatives with durable consequences         | `decision`                          |
| explains how success will be judged                          | `criterion` or an oracle-plane node |
| gives a concrete case, trace, or counterexample              | `example`                           |
| only helps interpretation, no stronger role yet              | keep `context`                      |

# Common Edge relationships

- **`requirement` ↔ `invariant`** — a requirement to *do* X often pairs with an invariant to *preserve* P across the doing of it.
- **`decision` ↔ `invariant`** — the decision captures the choice; the invariant captures the rule that must keep holding after it.
- **`assumption` retirement** — a validated assumption does not become a requirement. It becomes a `decision` (if validation forced a choice) or it is retired as confirmed `context`; dependents stop carrying the assumption dependency.

## Decision-capture criteria

Unchanged judgment, reconciled fields. A claim becomes a `decision` only if **all** hold (the old doc's five tests survive verbatim in spirit):

1. Plausible alternatives existed.
2. The choice is durable — it constrains future design, implementation, or interpretation.
3. The choice is explicit — statable as "we chose A over B/C," not as a description of current behavior.
4. At least one rejected alternative can be named.
5. There is a rationale.

## Classification guide

When the capture sweep turns an answered turn into graph truth, a one-line rule per kind decides how to classify a span. Abstain rather than guess; speculative captures degrade graph signal and should route to an `elicitation_gap` instead.

| Kind          | One-line classification rule                                                        |
| ------------- | ----------------------------------------------------------------------------------- |
| `goal`        | "X so that Y" / "we want Y" — outcome, no implementation committed                  |
| `thesis`      | "this is for X because…" — target user / problem theory / bet                       |
| `term`        | "by X we mean…" — naming commitment                                                 |
| `context`     | descriptive present-tense fact that does not commit the system                      |
| `story`       | "this group of behavior is about…" — intra-spec cluster                             |
| `unknown`     | "a known unknown is…" — can't answer now, must accommodate                          |
| `constraint`  | "must not", "cannot", "out of scope", "only if" — bounds solution space             |
| `assumption`  | "we think", "probably", "if X is true" — material belief that could be wrong        |
| `decision`    | "we chose A over B because" — see decision-capture criteria                         |
| `requirement` | "the system shall" / "must do" — obligation                                         |
| `invariant`   | "always true", "never", "must remain" — preservation across states/transitions      |
| `criterion`   | "we'll know it works when", "tested by", "we'll review for" — oracle for a property |
| `example`     | "for instance", "like when", "what about the case where" — concrete witness         |

## Topology-driven question ranking

Once the graph carries kinds and typed edges, the interviewer ranks the next question by topology rather than template. These are ranking heuristics, not automatic writes; low-confidence material routes to an `elicitation_gap`, never to a speculative node. 

They complement the band-driven qeustion routing suggest *what kind* of question to ask; topology heuristics suggest *which item* to ask about next.

| Signal                                                          | Suggested question shape                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| High-fanout `assumption` with thin evidence                     | "Many claims depend on X. Validate it, or mark the risk?"    |
| `requirement` / `invariant` with no `witness` path              | "How will we know this holds?"                               |
| `criterion` not linked to the claim it judges                   | "Which requirement or invariant does this criterion check?"  |
| Candidate `decision` lacking rejected alternatives or rationale | "What did we consider and rule out before choosing this?"    |
| `exclusion`/constraints disagreeing about one subject           | "These boundaries conflict. Which one wins?"                 |
| `goal`/`thesis` with no path into requirements, design, or plan | "What would satisfy this in the actual system?"              |
| Requirement with no example and high ambiguity                  | "What concrete case would settle this interpretation?"       |
| `unknown` blocking a design or plan edge                        | "Accommodate it, investigate it, or narrow scope around it?" |

This substrate is the `elicitation_gaps` register (D65-L): a flat table of prospective coverage obligations, each with a `predicate` (`presence` is structurally derivable; `field` and `coverage` are not yet supported; `manual` rides disposition), a `band`, an `importance`, and a `disposition` (`open` / `answered` / `not_applicable` / `irrelevant` / `reopened`). Structural coverage is derived from the graph at read time, not stored.

## Translation table — user phrases to kinds

The bridge between user vocabulary and the ontology. Treat these as **strong priors**, not rigid rules; the classification rule still governs the final assignment.

| User phrase pattern                                              | Most likely route                                     |
| ---------------------------------------------------------------- | ----------------------------------------------------- |
| "we want Y" / "X so that Y"                                      | `goal`                                                |
| "this is for X because…"                                         | `thesis`                                              |
| "by X we mean…"                                                  | `term`                                                |
| "true about the environment / repo / domain…"                    | `context` (unless promotable)                         |
| "a known unknown is…"                                            | `unknown`                                             |
| "always true that…" / "should never…" / "must remain"            | `invariant`                                           |
| "valid transition from X to Y"                                   | `invariant` (a transition-flavored one)               |
| "must not" / "cannot" / "out of scope" / "we don't care about X" | `constraint` (with an `exclusion` edge for non-goals) |
| "probably" / "we think" / "if X is true"                         | `assumption`                                          |
| "the system must…"                                               | `requirement`                                         |
| "we picked Y over Z because…"                                    | `decision`                                            |
| "we'll know it works when…" / "tested by"                        | `criterion` or an oracle-plane node                   |
| "for example, when…"                                             | `example` (link `witness:for`)                        |
| "but what about the case where…"                                 | `example` (edge case)                                 |
| "we wouldn't want…" / counterexample                             | `example` + `witness:against`, or `constraint`        |
| "another plausible interpretation is…"                           | `example` (a disambiguating one)                      |
| "module" / "API" / "entity" / "sketch"                           | design-plane kind                                     |
| "test" / "proof" / "evidence" / "verification method"            | oracle-plane kind                                     |
| "milestone" / "frontier" / "slice"                               | plan-plane kind                                       |
