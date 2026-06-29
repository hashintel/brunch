# Slice: promotion & capture routing

> Draft injectable context slice (scratch; not wired). Inject during the capture sweep — turning an answered turn into graph truth, gaps, or reconciliation needs. Source of truth is [`graph-authoring-heuristics.md`](../references/graph-authoring-heuristics.md).

Two disciplines: **promote** descriptive material to its sharpest kind before filing, and **route** each span to the substrate that matches its confidence and conflict state. Capture first, then ask from the updated world.

## Capture-then-ask

```
chain capture-then-ask:
  unswept transcript tail
    -> classify each span by modality (see slice-kind-selection)
    -> promote context to its sharpest kind
    -> route by confidence/conflict (table below)
    -> mutate_graph / update_elicitation_gaps / raise reconciliation_need
    -> compose next question over the updated graph + gaps
```

## Promote before filing as context

`context` is the broadest attractor and the most common misclassification. Promote before writing.

```
policy: first-match
context: a span that reads as "descriptive"

if the material…                                        | -> route to
--------------------------------------------------------|------------------------
states the desired outcome / why the work matters       | goal or thesis
defines a term or naming commitment                     | term
must be true for success or safety                      | requirement or invariant
limits acceptable solutions or scope                    | constraint
is believed but might be materially false               | assumption
is an acknowledged unknown, not answerable now          | unknown
chooses among alternatives with durable consequences    | decision
explains how success will be judged                     | criterion or oracle node
gives a concrete case / trace / counterexample          | example
only aids interpretation, no stronger role yet          | keep context
```

## Route by confidence and conflict

```
policy: first-match
context: where does this span go?

state of the material                                   | -> route
--------------------------------------------------------|---------------------------------
directly stated, or exact-review approved               | graph truth, basis: explicit
confidently materialized from accepted content          | graph truth, basis: implicit
low-confidence noticing / suspicion / possible implication / missing piece | elicitation_gap (question + rationale)
contradicts existing graph truth                        | reconciliation_need
a batch awaiting human judgment                         | review-set draft (not accepted truth)

notes:
  - basis is approval DIRECTNESS, not the mutation path. The path lives in change_log.
  - rejected proposals are absent from active truth (audit only). There is no `status` field.
```

## Substrates at a glance

```
graph truth          accepted nodes + edges; present-or-absent; no status
elicitation_gaps     prospective coverage obligations; flat table; NOT graph nodes
                       predicate: presence (structural) | field, coverage (unsupported) | manual
                       disposition: open | answered | not_applicable | irrelevant | reopened
reconciliation_needs retrospective repair obligations; NOT edges
                       kind: edge_revalidation | possible_relation | possible_duplicate | semantic_conflict
review-set drafts     candidate material before acceptance
```

## Abstain

Weak support is a stop signal. Prefer an `elicitation_gap` over a speculative node, and a `reconciliation_need` over a competing edge. Speculative captures degrade graph signal.
