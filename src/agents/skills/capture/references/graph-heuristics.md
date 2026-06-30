# Graph authoring heuristics

Runtime-eligible shared reference for graph-writing judgment (D97-L/D98-L). Use `graph-ontology.md` for generated vocabulary tables: exact kind list, codes, readiness bands, edge-category policy, required detail payloads, and `detail.form` legality. This file carries the authored judgment the elicitor needs to classify, promote, relate, and verify graph material without copying schema tables into skill bodies.

## Mental model

Brunch's graph is a typed graph of stable specification material. Most nodes should read as declarative claims or named artifacts, not interview prompts, scratch notes, or hidden chain-of-thought.

```pseudo
spec graph:
  intent plane     what / why / obligation / uncertainty / examples
  oracle plane     how claims are checked or evidenced
  design plane     how the system is shaped
  plan plane       how the work is sequenced

accepted graph truth:
  nodes: stable graph items with kind, basis, source, optional detail
  edges: structural categories with role-named endpoints
  gaps: prospective elicitation obligations, not graph truth
  reconciliation_needs: retrospective repair obligations, not graph edges
```

The old nine-kind claim ontology is superseded. The current model has four planes and 24 node kinds. The current exact set is generated in `graph-ontology.md`; use this guide for the semantic routing behind those kinds.

## Classify by modality, then by plane

Start from the role the material plays, not the words the user happened to use.

### Intent plane

- `goal` — value or outcome claim: what result is sought, without committing to implementation.
- `thesis` — position or bet claim: who/what/why framing, target user, problem theory, or product bet.
- `term` — vocabulary commitment: canonical definition, alias, or ubiquitous-language clarification. `term` is graph-addressable now, but band-less.
- `context` — descriptive claim: a relevant fact about the world, repo, domain, environment, or starting situation.
- `story` — intra-spec grouping: a mid-level narrative or Gherkin-Feature-like cluster inside one spec.
- `unknown` — known-unknown: a domain uncertainty that is not presently answerable but must be structurally accommodated.
- `requirement` — obligation claim: what the system shall do or satisfy.
- `assumption` — deferred-falsifiable belief: something believed enough to proceed, but possibly false.
- `constraint` — boundary claim: what rules out solution space, scope, policy, resource envelope, platform, or non-goal interpretations.
- `invariant` — preservation claim: what must remain true across states, transitions, versions, or semantic revisions.
- `decision` — choice claim: a durable selected option among real alternatives; requires chosen option, rejected alternatives, and rationale.
- `criterion` — oracle claim: how a requirement, invariant, or other claim will be judged.
- `example` — concrete witness or disambiguator: positive case, counterexample, edge case, trace, or labelled out-of-scope case. Polarity comes from wording and edges, not a subtype field.

### Oracle, design, and plan planes

Use these when the material is no longer only intent capture.

- Oracle plane (`check`, `vv_method`, `evidence`, `vv_obligation`) — concrete verification checks, verification methods, observed evidence, or proof/verification obligations.
- Design plane (`module`, `interface`, `entity`, `sketch`) — implementation shape, seams, data/domain entities, or intentionally lightweight design sketches.
- Plan plane (`milestone`, `frontier`, `slice`) — sequencing units. A `frontier` is the plan/tracker/branch unit; a `slice` is the buildable implementation unit inside it.

Readiness bands guide questioning and projection; they do not gate graph truth. If the user clearly states a later-band item early, capture it honestly with the right kind and basis.

## Promote before filing as context

`context` is the broadest attractor and therefore the most common misclassification. Promote to a sharper kind before writing graph truth.

| If the descriptive material... | Route to... |
| --- | --- |
| states the desired outcome or why the work matters | `goal` or `thesis` |
| defines a term or naming commitment | `term` |
| must be true for the system to succeed or stay safe | `requirement` or `invariant` |
| limits acceptable solutions or scope | `constraint` |
| is believed but might be false in a material way | `assumption` |
| is an acknowledged unknown that cannot simply be answered now | `unknown` |
| chooses among alternatives with durable consequences | `decision` |
| explains how success will be judged | `criterion` or an oracle-plane node |
| gives a concrete case, trace, or counterexample | `example` |
| only helps interpretation and has no stronger graph role yet | keep `context` |

A formal axiom or given is `context` with `detail.form:"given"` when it is stipulated as true and load-bearing. Load-bearing-ness comes from edges such as `dependency`, not from inventing a `given` kind.

## Distinguish nearby kinds

### `requirement` vs `invariant`

A requirement says the system must do or provide something. An invariant says a property must keep holding while the system operates or evolves. They often pair:

```pseudo
requirement: users can export accepted review items
invariant: rejected or draft review items never appear in exports
```

### `criterion` vs oracle-plane nodes

A criterion is the acceptance/oracle claim in intent space: how we judge a property. Oracle-plane nodes name concrete verification machinery or evidence.

```pseudo
criterion: export excludes draft review items in the reviewer-visible artifact
check: vitest golden for exported review payload
vv_method: golden-file regression plus fixture replay
```

Link the concrete oracle to the claim with a `witness` edge (`stance: for` when it supports, `stance: against` when it refutes or falsifies).

### `assumption` vs `unknown` vs `context`

- `context`: treated as known or stipulated for the current spec.
- `assumption`: believed enough to proceed, but later validation could overturn it.
- `unknown`: explicitly not known; the system or plan must accommodate that ignorance.

Do not launder a known-unknown into an assumption just to make the graph look complete.

### `constraint` vs `invariant`

A constraint narrows the acceptable solution space. An invariant protects a property across operation or change.

```pseudo
constraint: must not require a network service during local CLI runs
invariant: local CLI runs never send workspace graph data to a remote service
```

### `story` vs `example`

A story groups related behavior inside a spec. An example is a concrete witness. A Gherkin `Feature` inside one spec usually maps to `story`; a Scenario / Examples row usually maps to `criterion` or `example` depending on whether it is the oracle statement or a concrete case.

### `sketch` vs committed design nodes

Use `sketch` for advisory or early design material that should not yet harden into module/interface/entity truth. Promote to `module`, `interface`, or `entity` only when the design claim is settled enough to be part of graph truth.

## Decision capture criteria

Do not turn every user answer into a `decision`. A `decision` needs all of these:

1. Real alternatives existed.
2. The choice is durable enough to constrain future interpretation or implementation.
3. The choice can be stated as “we chose A over B/C.”
4. At least one rejected alternative can be named.
5. There is a rationale.

Current required detail fields are `chosen_option`, `rejected`, and `rationale` (see `graph-ontology.md`). Put scope and consequences in the title/body or express them with edges; do not invent decision-detail fields.

## Examples and negative knowledge

There are no `example` subtype fields. Preserve example semantics through the node text and edge structure.

```pseudo
positive witness:
  EX1 concrete accepted export case
  create_edge witness:
    oracle: EX1
    claim: REQ3
    stance: for

counterexample / rejected interpretation:
  EX2 rejected review item appears in export
  create_edge witness:
    oracle: EX2
    claim: INV4
    stance: against

out-of-scope disambiguator:
  EX3 importing old local dev fixtures
  create_edge exclusion:
    boundary: CON2
    subject: EX3
```

Intent is often clarified by what has been ruled out. Prefer a concrete `example` plus `witness:against` or an `exclusion` edge over vague prose such as “not that.”

## Edge authoring

Accepted edges use the closed structural categories generated in `graph-ontology.md`. Do not use retired named-relation dialects such as `derived_from`, `motivated_by`, `rules_out`, `counterexample_for`, or `tested_by` as edge categories.

Use the role-named `mutate_graph` grammar. Endpoint storage order does not carry impact meaning; category metadata owns endpoint roles, affected endpoint, impact strength, criteria-help signal, and projection effect.

| If you mean... | Use current edge category |
| --- | --- |
| one claim relies on another remaining true | `dependency` (`dependency` -> `dependent`) |
| an oracle, example, check, evidence, or criterion supports/refutes a claim | `witness` with `stance: for` or `stance: against` |
| a goal, thesis, rationale, or argument motivates/opposes a claim | `rationale` with `stance: for` or `stance: against` |
| an abstract claim is implemented or expressed by a concrete artifact | `realization` |
| a general claim/model is specialized by a more specific one | `refinement` |
| a boundary, non-goal, or constraint limits a subject | `exclusion` |
| a whole contains a part | `composition` |
| two items are related but no stronger relation is justified | `cross_reference` |
| one item replaces an older item | `supersession` |

Stance is required only for `witness` and `rationale`; omit it everywhere else.

## Relation-bearing batches need confident endpoints

Create edges only after both endpoints are settled enough to stand as graph truth.

```pseudo
chain relation-bearing-authoring:
  candidate relation
    -> confirm or create confident endpoint nodes
    -> skip edge if either endpoint remains low-confidence
    -> use role-named mutate_graph endpoints
```

If an endpoint is uncertain, spawn or reuse an elicitation gap for the missing claim. If a relation contradicts existing graph truth, create a reconciliation need instead of overwriting or adding a competing edge.

## Accepted graph truth has no proposal/status fields

Do not add old edge metadata such as `support`, `status`, `provenanceTurnId`, `createdBy`, or per-claim `checkability`/`strength` fields.

Current ownership:

- `basis: explicit | implicit` records approval directness for accepted nodes and edges.
- `source` on nodes is lightweight epistemic attribution text, not policy.
- `rationale` on edges explains the relation.
- `change_log` owns audit/provenance by LSN.
- Review-set drafts own proposed graph material before acceptance.
- Rejected proposals are absent from active graph truth plus audit history.
- Staleness is represented by `reconciliation_need`, not by mutating edge status.

## Treat `detail.form` as inert payload

`kind` drives graph behavior. `detail.form` is method payload plus a renderer hook.

- `plain`, `gherkin`, and `formal` are legal on `requirement`, `criterion`, and `invariant`.
- `given` is legal on `context`.
- `decision` and `term` have their own required detail payloads.

Do not infer edge legality, readiness, commitment strength, or runtime method state from `detail.form`. A Gherkin or formal payload changes how the node renders or round-trips; it does not change what kind of graph thing the node is.

## Capture routes

| Material confidence / conflict state | Route |
| --- | --- |
| directly stated or exact-review approved graph material | graph truth with `basis: explicit` |
| confidently materialized from accepted content | graph truth with `basis: implicit` |
| low-confidence noticing, suspicion, possible implication, or missing piece | `elicitation_gap` with a question and rationale |
| contradiction with existing graph truth | `reconciliation_need` |
| candidate batch awaiting human judgment | review-set draft, not accepted graph truth |

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

| Signal | Suggested question shape |
| --- | --- |
| High-fanout `assumption` with thin evidence | “Many claims depend on X. Should we validate it or mark the risk?” |
| `requirement` or `invariant` with no witness/evidence path | “How will we know this holds?” |
| `criterion` not linked to the claim it judges | “Which requirement or invariant does this criterion check?” |
| Candidate `decision` lacks rejected alternatives or rationale | “What did we consider and rule out before choosing this?” |
| Constraints/exclusions appear to disagree about one subject | “These boundaries conflict. Which one wins?” |
| `goal` / `thesis` has no path into requirements, design, or plan | “What would satisfy this goal in the actual system?” |
| Requirement has no example/counterexample and high ambiguity | “What concrete case would settle this interpretation?” |
| `unknown` blocks a design or plan edge | “Do we accommodate the unknown, investigate it, or narrow scope around it?” |

These are ranking heuristics, not automatic graph writes.

## Progressive checkability is conduct, not schema

Choose the weakest sufficient oracle artifact for the claim at hand: human review, example/counterexample, regression/golden, runtime contract, property/model-based rule, probe/transcript, or proof obligation. Express the artifact as existing graph vocabulary (`criterion`, `check`, `vv_method`, `evidence`, `vv_obligation`, `example`, `witness` edges) and name blind spots in prose.

Do not add claim-level `checkability`, `strength`, `validTraces`, or `invalidTraces` fields. Evidence breadth is prompt/oracle conduct unless a future scoped reader proves it needs schema.

## Phrase-to-kind priors

Treat these as priors, not rigid rules.

| User phrase pattern | Likely route |
| --- | --- |
| “we want Y” / “so that Y” | `goal` |
| “this is for X because...” | `thesis` |
| “by X we mean...” | `term` |
| “true about the environment/repo/domain...” | `context` unless promotable |
| “a known unknown is...” | `unknown` |
| “must not”, “cannot”, “out of scope” | `constraint` |
| “probably”, “we think”, “if X is true” | `assumption` |
| “the system must...” | `requirement` |
| “always”, “never”, “must remain” | `invariant` |
| “we chose A over B because...” | `decision` |
| “we'll know it works when...” | `criterion` or oracle-plane node |
| “for example”, “case where”, “counterexample” | `example` |
| “module”, “API”, “entity”, “sketch” | design-plane kind |
| “test”, “proof”, “evidence”, “verification method” | oracle-plane kind |
| “milestone”, “frontier”, “slice” | plan-plane kind |
