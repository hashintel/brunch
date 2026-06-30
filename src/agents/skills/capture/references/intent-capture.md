# Intent Capture Method

Capture stable intent-plane material as settled graph truth; capture reviewed but not-yet-harmonized source signal as advisory graph material; route everything else to the correct non-truth substrate.

```pseudo
incoming material
  -> normalize to declarative claim or named graph item
  -> classify by modality
  -> promote away from context when a sharper kind is earned
  -> decide route: settled graph item | advisory graph item | elicitation_gap | reconciliation_need | review draft
  -> add edges only after endpoint confidence is settled
```

## Work by band, inner -> outer


## Classify

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


### Map by modality and disambiguate

| Material role                        | Kind          | Good node title shape                                                | Common false route                                 |
| ------------------------------------ | ------------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| desired outcome, value, win          | `goal`        | “Reduce fake closure in review flows”                                | `requirement` too early                            |
| audience/problem/bet/positioning     | `thesis`      | “The spec workspace is for teams evolving uncertain software intent” | vague `context`                                    |
| canonical vocabulary                 | `term`        | “Frontier means plan/tracker/branch unit”                            | duplicating prose in every node                    |
| ambient fact about world/repo/domain | `context`     | “Runtime state is transcript-backed”                                 | absorbing constraints or decisions                 |
| intra-spec behavior grouping         | `story`       | “Review-set approval story”                                          | `milestone` or `example`                           |
| acknowledged unknown                 | `unknown`     | “Provider payload drift is not fully known”                          | pretending it is an `assumption`                   |
| required behavior/property           | `requirement` | “Review acceptance commits the batch atomically”                     | `criterion`                                        |
| believed-but-falsifiable premise     | `assumption`  | “LLMs can produce legal edge drafts after prompt guidance”           | `context`                                          |
| boundary/non-goal/resource/policy    | `constraint`  | “Graph writes must not bypass CommandExecutor”                       | `invariant` when it is only design-space narrowing |
| always/never/must-remain property    | `invariant`   | “Rejected drafts never enter accepted graph truth”                   | `constraint` when it protects runtime/evolution    |
| durable choice among alternatives    | `decision`    | “Use role-named edges over generic source/target drafts”             | any ordinary answer                                |
| acceptance/oracle condition          | `criterion`   | “Mutation batch is accepted only if dry-run validates”               | `check` too concrete                               |
| concrete case/counterexample/trace   | `example`     | “Counterexample: rejected item appears in export”                    | hidden note in body text                           |

### Promote to sharpest kind

policy: first-match

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
| selects A over named B/C with rationale                      | `decision`                          |
| rules out solution space or scope                            | `constraint`                        |
| must remain true across operation/change                     | `invariant`                         |
| describes how success will be judged                         | `criterion` or oracle-plane node    |
| gives a concrete witness/counterexample                      | `example`                           |
| only helps interpretation                                    | `context`                           |


## The epistemic triad: context / assumption / unknown

The old doc's `context` promotion rules implied a two-way fork between "known" and "might be false." The current model makes this a **three-way informal certainty triad** — a routing heuristic, not a stored `epistemic_status` field (ONTOLOGY_REVIEW_PROTOCOL §6.6):

- `context` — known / stipulated true for this spec.
- `assumption` — believed enough to proceed, but **deferred-falsifiable** ("what might be false").
- `unknown` — a known-unknown; explicitly not known, and the system or plan must accommodate that ignorance.

Do not launder a known-unknown into an assumption to make the graph look complete. Routing for formal work: an **axiom / given → `context` + `detail.form:"given"`** (known *and* load-bearing); load-bearing-ness comes from outgoing `dependency` edges, not from the kind. A **theorem / property → `invariant`** (a preservation claim carrying `witness` edges).


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

### Route by confidence

Each swept span takes the strongest honest route. Confidence and conflict decide the route; settlement decides whether a graph item is current spec truth. Stop at the first row that holds

| If the swept span is…                                                         | Route                 | Notes                                                      |
| ----------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------- |
| directly stated, or exact-review approved, and harmonized?                    | settled graph item    | `basis: explicit`                                          |
| confidently materialized from accepted, harmonized content?                   | settled graph item    | `basis: implicit`                                          |
| reviewed source-derived material that is graph-shaped but not yet harmonized? | advisory graph item   | early outer-band signal carried forward, not a commitment  |
| coherent but judgment-heavy candidate material?                               | review-set draft      | no graph basis until accepted                              |
| low-confidence noticing, suspicion, possible implication, or missing piece?   | `elicitation_gap`     | question + rationale naming the kind it would establish    |
| contradiction with existing settled graph truth?                              | `reconciliation_need` | retrospective repair, never overwrite the conflicting node |

Three rules govern the table:

- **Low confidence never commits.** Its durable form is an `elicitation_gap`, not a speculative node. Abstain rather than guess; speculative captures degrade graph signal.
- **Contradiction is reconciliation, not a gap.** A gap is missing prospective coverage; a contradiction is a retrospective impasse over existing truth. Keep the two agendas distinct.
- **Relate only confident endpoints.** Commit missing high-confidence endpoints first, then add role-named edges; skip the edge and spawn a gap when either endpoint is weak. See [`references/edge-heuristics.md`](references/edge-heuristics.md).
- `basis` is approval DIRECTNESS, not the mutation path. The path lives in `change_log`.
- Weak support is a stop signal. Prefer an `elicitation_gap` over a speculative node, and a `reconciliation_need` over a competing edge. Speculative captures degrade graph signal.

### Anti-goals

- Do not treat every sentence as a graph node.
- Do not make raw tool output the capture source for bulk material; digest first.
- Do not launder ambiguous material into graph truth to avoid a follow-up question.
- Do not launder reviewed arbitrary-source material into settled commitments just because it is specific or already structured.
- Do not bypass the capture sweep with direct graph claims in prose.
- Do not run a product-side extraction pass or revive observer/auditor queues; this is transcript conduct plus the standard sweep.

### Promotion


## References

- [Readiness Bands](../../contexts/about/readiness-bands.md) — bands, latest expected band, settlement, advisory capture, early outer-band signal.
- [`slice-band-walk.md`](slice-band-walk.md) — the band-walk procedure for the sweep.
- [`references/graph-heuristics.md`](references/graph-heuristics.md) — classify, promote, relate, and verify graph material; role-named mutation grammar.
- [`references/intent-capture.md`](references/intent-capture.md) — intent-kind routing matrix and promotion table.




### Observation routing ladder

Stop at the first rung that holds:

1. **directly stated, or exact-review approved and harmonized**? Capture as settled graph material with `basis: explicit`
2. **confidently materialized from accepted and harmonized content**? Capture as settled graph material with `basis: implicit`
3. **low-confidence noticing / suspicion / possible implication / missing piece**? Capture as elicitation_gap (question + rationale) 
4. **reviewed source-derived signal that is not yet harmonized**? Capture as advisory graph material
5. **contradicts existing settled graph truth**? Capture as reconciliation_need
6. **a batch awaiting human judgment**? Capture as review-set draft (not accepted graph material)

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

### Coherent intent content checklist

- Each node can be read aloud as a stable claim or named item.
- `context` nodes are not carrying obligations, choices, boundaries, or uncertainty in disguise.
- Requirements say what must hold; criteria say how we judge; examples make interpretation concrete.
- Invariants protect preservation; constraints narrow solution space.
- Decisions name rejected alternatives and rationale, not just “the user answered yes.”
- Negative knowledge is preserved as `example` + `witness:against` or as `constraint`/`exclusion`, not as vague prose.

## Edge hints

| From                     | To                                     | Edge                                      |
| ------------------------ | -------------------------------------- | ----------------------------------------- |
| `goal` / `thesis`        | `requirement` / `decision`             | `rationale` with `stance: for`            |
| `constraint`             | any bounded subject                    | `exclusion`                               |
| `assumption` / `context` | claim depending on it                  | `dependency`                              |
| `criterion` / `example`  | claim it checks or illustrates         | `witness` with `stance: for` or `against` |
| broader claim            | narrower claim                         | `refinement`                              |
| story                    | grouped requirements/criteria/examples | `composition`                             |

Do not create relation-bearing batches until both endpoints are confident graph truth.


## Graph material has basis and settlement, not proposal/status sprawl

Do not add old edge metadata such as `support`, `status`, `provenanceTurnId`, `createdBy`, or per-claim `checkability`/`strength` fields.

Current ownership:

- `basis: explicit | implicit` records approval directness for accepted nodes and edges.
- `settlement: advisory | settled` records whether graph material is source-derived signal awaiting harmonization or current spec truth.
- `source` on nodes is lightweight epistemic attribution text, not policy.
- `rationale` on edges explains the relation.
- `change_log` owns audit/provenance by LSN.
- Review-set drafts own proposed graph material before acceptance.
- Rejected proposals are absent from active graph material plus audit history.
- Staleness is represented by `reconciliation_need`, not by mutating edge status.

## Treat `detail.form` as inert payload

`kind` drives graph behavior. `detail.form` is method payload plus a renderer hook.

- `plain`, `gherkin`, and `formal` are legal on `requirement`, `criterion`, and `invariant`.
- `given` is legal on `context`.
- `decision` and `term` have their own required detail payloads.

Do not infer edge legality, readiness, commitment strength, or runtime method state from `detail.form`. A Gherkin or formal payload changes how the node renders or round-trips; it does not change what kind of graph thing the node is.

## Capture routes

| Material confidence / conflict / settlement state                              | Route                                            |
| ------------------------------------------------------------------------------ | ------------------------------------------------ |
| directly stated or exact-review approved and harmonized graph material         | settled graph item with `basis: explicit`        |
| confidently materialized from accepted and harmonized content                  | settled graph item with `basis: implicit`        |
| reviewed arbitrary-source material that is graph-shaped but not yet harmonized | advisory graph item with the appropriate `basis` |
| low-confidence noticing, suspicion, possible implication, or missing piece     | `elicitation_gap` with a question and rationale  |
| contradiction with existing settled graph truth                                | `reconciliation_need`                            |
| candidate batch awaiting human judgment                                        | review-set draft, not accepted graph material    |

Abstain rather than guess. Speculative captures degrade graph signal.

## Edge-local neighborhoods are the useful context unit

For LLM collaboration, an item-centered neighborhood is usually stronger than “all goals” or “all requirements.” Read/render neighborhoods with the policy-derived labels and impact direction.

```pseudo
REQ17: Each phase exposes an explicit kickoff/frontier/recovery/handoff affordance.
  upstream / dependencies:
    motivated by G2: avoid fake closure and stranded users
    bounded by CON8: no generic task-planning surface
  downstream / impact:
    realized by S13: phase affordance renderer slice
    refined by REQ18: interview phases expose kickoff/frontier/generation/recovery
  evidence:
    witnessed by AC13: open phases bottom-load one visible artifact
```

Do not reconstruct directionality from raw `sourceId` / `targetId` or from the English verb. Use the category policy and label projections.

## Topology-driven question ranking

Use graph topology to pick the next useful question:

| Signal                                                           | Suggested question shape                                                    |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| High-fanout `assumption` with thin evidence                      | “Many claims depend on X. Should we validate it or mark the risk?”          |
| `requirement` or `invariant` with no witness/evidence path       | “How will we know this holds?”                                              |
| `criterion` not linked to the claim it judges                    | “Which requirement or invariant does this criterion check?”                 |
| Candidate `decision` lacks rejected alternatives or rationale    | “What did we consider and rule out before choosing this?”                   |
| Constraints/exclusions appear to disagree about one subject      | “These boundaries conflict. Which one wins?”                                |
| `goal` / `thesis` has no path into requirements, design, or plan | “What would satisfy this goal in the actual system?”                        |
| Requirement has no example/counterexample and high ambiguity     | “What concrete case would settle this interpretation?”                      |
| `unknown` blocks a design or plan edge                           | “Do we accommodate the unknown, investigate it, or narrow scope around it?” |

These are ranking heuristics, not automatic graph writes.

## Progressive checkability is conduct, not schema

Choose the weakest sufficient oracle artifact for the claim at hand: human review, example/counterexample, regression/golden, runtime contract, property/model-based rule, probe/transcript, or proof obligation. Express the artifact as existing graph vocabulary (`criterion`, `check`, `vv_method`, `evidence`, `vv_obligation`, `example`, `witness` edges) and name blind spots in prose.

Do not add claim-level `checkability`, `strength`, `validTraces`, or `invalidTraces` fields. Evidence breadth is prompt/oracle conduct unless a future scoped reader proves it needs schema.

## Phrase-to-kind priors

Treat these as priors, not rigid rules.

| User phrase pattern                                | Likely route                     |
| -------------------------------------------------- | -------------------------------- |
| “we want Y” / “so that Y”                          | `goal`                           |
| “this is for X because...”                         | `thesis`                         |
| “by X we mean...”                                  | `term`                           |
| “true about the environment/repo/domain...”        | `context` unless promotable      |
| “a known unknown is...”                            | `unknown`                        |
| “must not”, “cannot”, “out of scope”               | `constraint`                     |
| “probably”, “we think”, “if X is true”             | `assumption`                     |
| “the system must...”                               | `requirement`                    |
| “always”, “never”, “must remain”                   | `invariant`                      |
| “we chose A over B because...”                     | `decision`                       |
| “we'll know it works when...”                      | `criterion` or oracle-plane node |
| “for example”, “case where”, “counterexample”      | `example`                        |
| “module”, “API”, “entity”, “sketch”                | design-plane kind                |
| “test”, “proof”, “evidence”, “verification method” | oracle-plane kind                |
| “milestone”, “frontier”, “slice”                   | plan-plane kind                  |
