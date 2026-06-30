# About / Specifiation Lifecycle and Data-model

## Lifecycle

A specification moves through phases. These can broadly be grouped in to first extractive, and then generative categories. The extractive phases require active **elicitation** of the user's intent in detail; the generative phases rely more on **projection** of the user's stated intent, preferences, ideas etc. in to proposed graph truth which the user accepts/approves or rejects. Moving from the extractive to the generative phases requires a certain *readiness*.

The final phase of the specification process is commitment and planning but the phases are not strictly forward-only gates. The user can return to questions of an earlier phase, which is to say also of a more fundamental type, in order to revisit them and maybe reconsider certain ideas, choices, and so on. In such a case reconciliation may be required.

- extractive phases (grounding, elicitation)
  - intent capture (basic, structural, reasoning)

- generative phases (projection, commitment)
  - technical design
  - verification design
  - req and ac projection
  - plan projection


## Data Model

Specifications and plans in the contexts described above are often structured documents; in Brunch they are represented as a graph of nodes and edges. The full set of nodes and edges, conceived for the SWE specification process, is detailed below.

### Nodes and Planes

- **intent plane**: what we want and why
- **design plane**: how to shape it
- **oracle plane**: how to verify it
- **plan plane**: how implementation is sequenced and qualified

| Kind            | Code | Plane  | Latest Phase | Latest Band |
| --------------- | ---- | ------ | ------------ | ----------- |
| `example`       | EX   | intent | extractive   | -           |
| `story`         | ST   | intent | extractive   | -           |
| `term`          | T    | intent | extractive   | -           |
| `sketch`        | SKT  | intent | extractive   | -           |
| `thesis`        | TH   | intent | extractive   | grounding   |
| `goal`          | G    | intent | extractive   | grounding   |
| `assumption`    | A    | intent | extractive   | elicitation |
| `constraint`    | CON  | intent | extractive   | elicitation |
| `context`       | CTX  | intent | extractive   | elicitation |
| `decision`      | D    | intent | extractive   | elicitation |
| `invariant`     | INV  | intent | extractive   | elicitation |
| `unknown`       | UNK  | intent | extractive   | elicitation |
| `requirement`   | REQ  | intent | generative   | commitment  |
| `interface`     | API  | design | generative   | projection  |
| `module`        | MOD  | design | generative   | projection  |
| `entity`        | ENT  | design | generative   | projection  |
| `check`         | CH   | oracle | generative   | projection  |
| `evidence`      | E    | oracle | generative   | projection  |
| `vv_method`     | VV   | oracle | generative   | projection  |
| `vv_obligation` | O    | oracle | generative   | projection  |
| `criterion`     | AC   | plan   | generative   | commitment  |
| `milestone`     | M    | plan   | generative   | commitment  |
| `frontier`      | F    | plan   | generative   | commitment  |
| `slice`         | S    | plan   | generative   | commitment  |

### Edge Categories, Impact Directions and Policies

| Category        | Endpoint Roles         | Impact Direction          | Impact strength | Stance   | Criteria help? | Projection effect                    |
| --------------- | ---------------------- | ------------------------- | --------------- | -------- | -------------- | ------------------------------------ |
| dependency      | dependency, dependent  | dependency --> dependent  | cascade         | —        | no             | none                                 |
| witness         | oracle, claim          | oracle <-- claim          | advisory        | required | yes            | none                                 |
| rationale       | support, claim         | support <-- claim         | advisory        | required | no             | none                                 |
| realization     | abstract, concrete     | abstract --> concrete     | advisory        | —        | no             | none                                 |
| refinement      | general, specific      | general --> specific      | advisory        | —        | no             | none                                 |
| exclusion       | boundary, subject      | boundary --> subject      | advisory        | —        | no             | none                                 |
| composition     | whole, part            | whole <-- part            | advisory        | —        | no             | none                                 |
| cross_reference | peer, peer             | peer <--> peer            | none            | —        | no             | none                                 |
| supersession    | successor, predecessor | successor <-- predecessor | advisory        | —        | no             | hide_predecessor_from_active_context |







# Capture / SKILL

## Goals: Comprehensive, expressive, coherent

## Capture / Turn Cycle

Two disciplines: **promote** descriptive material to its sharpest kind before filing, and **route** each span to the substrate that matches its confidence and conflict state. Capture first, then ask from the updated world.

```
chain capture-then-ask:
  unswept transcript tail
    -> classify each span by modality (see slice-kind-selection)
    -> promote context to its sharpest kind
    -> route by confidence/conflict (table below)
    -> mutate_graph / update_elicitation_gaps / raise reconciliation_need
    -> compose next question over the updated graph + gaps
```

## Capture / Observation

### How to parse and observe

### Observation routing ladder

Stop at the first rung that holds:

1. **directly stated, or exact-review approved**? Capture as graph truth with `basis: explicit`           
2. **confidently materialized from accepted content**? Capture as graph truth with `basis: implicit`           
3. **low-confidence noticing / suspicion / possible implication / missing piece**? Capture as elicitation_gap (question + rationale) 
4. **contradicts existing graph truth**? Capture as reconciliation_need                    
5. **a batch awaiting human judgment**? Capture as review-set draft (not accepted truth)  

NOTES:
- `basis` is approval DIRECTNESS, not the mutation path. The path lives in `change_log`.

### Elicitation Gaps

Weak support is a stop signal. Prefer an `elicitation_gap` over a speculative node, and a `reconciliation_need` over a competing edge. Speculative captures degrade graph signal.


## Capture / Edges

```
-> the same concept does not change kind to cross planes; you add an edge
-> readiness bands guide questioning/projection; they do NOT gate truth
-> if the user states a later-plane item early, capture it honestly with the right kind + basis
```

## Capture / Nodes

### File `context` last

`context` is the broadest attractor and the most common misclassification. Promote before writing.

```
policy: first-match
context: a span that reads as "descriptive"

| if the material…                                     | -> route to              |
| ---------------------------------------------------- | ------------------------ |
| states the desired outcome / why the work matters    | goal or thesis           |
| defines a term or naming commitment                  | term                     |
| must be true for success or safety                   | requirement or invariant |
| limits acceptable solutions or scope                 | constraint               |
| is believed but might be materially false            | assumption               |
| is an acknowledged unknown, not answerable now       | unknown                  |
| chooses among alternatives with durable consequences | decision                 |
| explains how success will be judged                  | criterion or oracle node |
| gives a concrete case / trace / counterexample       | example                  |
| only aids interpretation, no stronger role yet       | keep context             |
```

## Signal → kind (first-match)

`context` is the broadest attractor, so it sits last: try every sharper kind before filing as `context`.

```
policy: first-match
context: classifying one span of settled material

| rule | signal in the material                                         | -> kind     |
| ---- | -------------------------------------------------------------- | ----------- |
| R1   | "we chose A over B because…" (real alternatives ruled out)     | decision    |
| R2   | "the system must / shall…"                                     | requirement |
| R3   | "always / never / must remain true while it runs"              | invariant   |
| R4   | "must not / cannot / out of scope / we don't care about"       | constraint  |
| R5   | "we'll know it works when / tested by / reviewed for"          | criterion   |
| R6   | "for instance / like when / the case where / counterexample"   | example     |
| R7   | "probably / we think / assuming / if X holds" (could be false) | assumption  |
| R8   | "we don't know yet / open question / TBD" (must accommodate)   | unknown     |
| R9   | "by X we mean / call it X" (naming commitment)                 | term        |
| R10  | "this is for <user> because…" (target + problem theory)        | thesis      |
| R11  | "we want / so that…" (outcome, no implementation)              | goal        |
| R12  | "this group of behavior is about…" (mid-level cluster)         | story       |
| R13  | otherwise descriptive, aids interpretation only                | context     |

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

# Generate

Each plane answers a different concern. Stay on the plane the active work is on; cross-plane links are edges, not kind changes. Promote across planes only when the material genuinely hardens.

## Generate / Intent

> what and why  #intent

Build the spec's truth-bearing claims. Coherence here means: every goal/thesis has a path toward something that satisfies it, and every commitment is judged.

```
tree intent obligations:
  goal / thesis            value + bet — the why
    requirement            obligations that serve the why
      invariant            what must stay true while requirements operate
      criterion            how each requirement/invariant is judged
      example              concrete witnesses + counterexamples
  context / term           the stipulated frame + lexicon
  assumption / unknown     what might be false / what is not yet known
  constraint               what the solution space rules out
```

```
coherence checks (intent)
  goal/thesis      -> has a rationale edge into >=1 requirement?            else: gap
  requirement      -> has a witness path (criterion/example/oracle)?        else: gap
  requirement      -> pairs with an invariant it must not break?            consider
  decision         -> names >=1 rejected alternative + rationale?           else: not a decision
  assumption       -> high fanout + thin evidence?                          surface risk
  constraint/non-goal -> attached to its subject via exclusion?             else: vague
```

Typical edges: `rationale` (goal→requirement), `dependency` (claim→claim), `exclusion` (constraint→subject), `refinement` (general→specific), `witness` (example→claim, with stance).

## Generate / Design

> how it's shaped  

Name the implementation shape that realizes the intent. Keep advisory material as `sketch` until it is settled enough to be graph truth.

```
kinds: module (MOD) | interface (API) | entity (ENT) | sketch (SKT)

  module     a seam / unit of implementation
  interface  a contract surface
  entity     a data/domain entity
  sketch     intentionally lightweight, not yet hardened
```

```
coherence checks (design)
  module/interface -> realizes >=1 requirement (realization edge)?  else: unanchored design
  entity           -> referenced by a requirement/criterion it serves?
  sketch           -> promote to module/interface/entity once settled; don't leave advisory truth
  interface        -> precondition as constraint, postcondition as criterion/invariant, hung on the API
```

Typical edges: `realization` (requirement→module, renders "implemented by"), `refinement` (model→specialization), `composition` (whole→part), `dependency` (module→module).

## Generate / Oracle

> how we know  

Make claims checkable. Distinguish the intent-plane `criterion` (the oracle *claim*) from oracle-plane nodes (the concrete *machinery*). Choose the **weakest sufficient** artifact; redundancy across independent oracle families is a feature when it reduces bad degrees of freedom at acceptable cost.

```
kinds: check (CH) | vv_method (VV) | evidence (E) | vv_obligation (O)

ladder (weakest sufficient first — this is conduct, not a stored field):
  human review -> example/counterexample -> regression/golden
    -> runtime contract -> property/model-based -> probe/transcript -> proof obligation
```

```
coherence checks (oracle)
  criterion        -> witness edge into the requirement/invariant it judges?  else: orphan oracle
  check/vv_method  -> names the observation that discriminates pass from fail? else: it's a task, not an oracle
  ensemble         -> blind spots named in prose? (false-positive shape, trigger to revisit)
  counterexample   -> example + witness:against the claim it falsifies
```

Typical edges: `witness` (oracle→claim, `stance: for|against`), `realization` (criterion→check). Express evidence breadth (reviewed / example-backed / regression-covered / enforced / proved) as prose, never as graph metadata.

## Generate / Plan

how it's sequenced  #plan

Sequence the work. A `frontier` is the plan/tracker/branch unit; a `slice` is the buildable unit inside it; a `milestone` is a bounded phase.

```
kinds: milestone (M) | frontier (F) | slice (S)

tree plan containment:
  milestone
    frontier        the tracker/branch unit
      slice         the buildable unit; establishes requirements
```

```
coherence checks (plan)
  frontier -> contains >=1 slice (composition)?
  slice    -> establishes >=1 requirement (realization, renders "established by")?
  frontier -> dependencies mirror intent dependencies, not intra-frontier slice order
  milestone-> frontiers map to an invariant bundle to establish
```

Typical edges: `composition` (milestone→frontier→slice), `realization` (requirement→slice, renders "established by"), `dependency` (frontier→frontier).

#
