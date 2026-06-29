# Slice: node-kind selection

> Draft injectable context slice (scratch; not wired). Inject when an agent is about to write graph truth and must pick a node `kind`. Source of truth for the exact kind list/codes/bands is [`graph-ontology.md`](../references/graph-ontology.md); authoring judgment is [`graph-authoring-heuristics.md`](../references/graph-authoring-heuristics.md). This slice is a compact decision aid, not authority.

Pick the `kind` by the **role the material plays**, not the words the user used. `kind` drives behavior (readiness band, edge legality, the source-question you answer next). When support is weak, do not guess a kind — route to an elicitation gap (see `slice-promotion-capture.md`).

## Intent kinds — modality and source-question

| Kind | Code | Modality of claim | Answer this | Band |
| --- | --- | --- | --- | --- |
| `goal` | G | value / outcome | "What outcome are we after?" | grounding |
| `thesis` | TH | position / bet | "Who is this for, and why does it matter?" | grounding |
| `term` | T | vocabulary commitment | "What do we mean by X?" | — |
| `context` | CTX | descriptive | "What is true about the world this lives in?" | grounding, elicitation |
| `story` | ST | intra-spec grouping | "What cluster of behavior is this part of?" | elicitation |
| `unknown` | UNK | known-unknown | "What can't we answer yet but must accommodate?" | elicitation |
| `requirement` | REQ | obligation | "What must the system do?" | commitment |
| `assumption` | A | deferred-falsifiable belief | "What might be false?" | elicitation |
| `constraint` | CON | boundary | "What does this rule out?" | grounding, elicitation |
| `invariant` | INV | preservation | "What must never be broken?" | elicitation |
| `decision` | D | choice | "What did we pick among real alternatives?" | elicitation |
| `criterion` | AC | oracle | "How will we judge that it holds?" | commitment |
| `example` | EX | witness / disambiguator | "What concrete case would settle this?" | — |

Other planes (use when the material is no longer intent capture): oracle — `check` (CH), `vv_method` (VV), `evidence` (E), `vv_obligation` (O); design — `module` (MOD), `interface` (API), `entity` (ENT), `sketch` (SKT); plan — `milestone` (M), `frontier` (F), `slice` (S).

## Signal → kind (first-match)

`context` is the broadest attractor, so it sits last: try every sharper kind before filing as `context`.

```
policy: first-match
context: classifying one span of settled material

rule | signal in the material                                  | -> kind
-----|--------------------------------------------------------|------------------
R1   | "we chose A over B because…" (real alternatives ruled out) | decision
R2   | "the system must / shall…"                              | requirement
R3   | "always / never / must remain true while it runs"       | invariant
R4   | "must not / cannot / out of scope / we don't care about"| constraint
R5   | "we'll know it works when / tested by / reviewed for"   | criterion
R6   | "for instance / like when / the case where / counterexample" | example
R7   | "probably / we think / assuming / if X holds" (could be false) | assumption
R8   | "we don't know yet / open question / TBD" (must accommodate) | unknown
R9   | "by X we mean / call it X" (naming commitment)          | term
R10  | "this is for <user> because…" (target + problem theory) | thesis
R11  | "we want / so that…" (outcome, no implementation)       | goal
R12  | "this group of behavior is about…" (mid-level cluster)  | story
R13  | otherwise descriptive, aids interpretation only         | context

notes:
  - R3 vs R4: invariant = a property preserved across operation/evolution; constraint = a bound on the solution space. Invariants take dependency/witness edges; constraints take exclusion edges.
  - R1: if no real alternative was ever on the table, it is context, not a decision.
  - A claim can spawn a paired node (a requirement to DO X often pairs with an invariant to PRESERVE P). Capture both; relate with edges.
```

## Disambiguate nearby kinds

```
goal vs thesis
  -> goal commits to a target outcome
  -> thesis stakes a refutable position about who/why; carries the problem theory

context vs assumption vs unknown   (epistemic triad)
  -> context  : known / stipulated true for this spec
  -> assumption: believed enough to proceed, but later validation could overturn it
  -> unknown  : explicitly not known; the spec/plan must accommodate the ignorance
  x> do not launder a known-unknown into an assumption to look complete

constraint vs invariant
  -> constraint narrows acceptable solutions (a non-goal, scope, policy, platform bound)
  -> invariant protects a property across states/transitions/versions

criterion vs oracle-plane node
  -> criterion : the oracle CLAIM in intent space (how we judge a property)
  -> check / vv_method / evidence / vv_obligation : the concrete verification machinery
  -> link the concrete oracle to the claim with a `witness` edge

story vs example
  -> story groups related behavior inside the spec (a Gherkin Feature lives here)
  -> example is a concrete witness (a Scenario/row is criterion or example)

sketch vs committed design node
  -> sketch : advisory/early design, not yet graph truth
  -> module/interface/entity : settled design claim
```

## Abstain rule

Weak classification support is a signal to **stop**, not to pick the nearest kind. Route low-confidence material to an `elicitation_gap` with a question + rationale; route a contradiction with existing truth to a `reconciliation_need`. Speculative captures degrade graph signal.
