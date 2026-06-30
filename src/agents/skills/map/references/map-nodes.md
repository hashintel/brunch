# Mapping Nodes

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

### Other planes

Use these when the material is no longer only intent-plane mapping. These triggers help choose the plane before loading the focused references; they are not proposal triggers. Proposal density, fan-out, and user-recognition flow belong to `propose`, but proposed material becomes map material once it is being expressed as graph nodes.

#### Oracle plane — how we know

Activating concepts: verification, tests, proof, audit trail, observed run, counterexample, blind spot.

| Material role                                       | Kind            | Example question forms                                  |
| --------------------------------------------------- | --------------- | ------------------------------------------------------- |
| acceptance/oracle claim                             | `criterion`     | "How will we judge that this holds?"                    |
| concrete executable or manual check                 | `check`         | "What test, review step, or gate verifies this?"        |
| verification method family                          | `vv_method`     | "What method establishes the criterion?"                |
| observed artifact                                   | `evidence`      | "What run, transcript, log, or measurement shows this?" |
| outstanding proof or verification obligation        | `vv_obligation` | "What must still be proven before relying on this?"     |
| concrete positive/negative witness or disambiguator | `example`       | "What case would demonstrate or falsify this?"          |

Continue in [`map-oracles.md`](map-oracles.md) when choosing the weakest sufficient oracle artifact or attaching witness edges.

#### Design plane — how it is shaped

Activating concepts: deep modules, information hiding, seams, API surface, data identity, lifecycle, deliberately soft architecture.

| Material role                             | Kind        | Example question forms                                         |
| ----------------------------------------- | ----------- | -------------------------------------------------------------- |
| implementation part with responsibility   | `module`    | "What part hides this complexity?"                             |
| contract across a seam                    | `interface` | "Where is the boundary, and what is exchanged across it?"      |
| domain/data object with identity          | `entity`    | "What object has lifecycle, storage shape, or relationships?"  |
| tentative option, diagram, or design hint | `sketch`    | "What shape helps thinking without constraining the work yet?" |

Continue in [`map-design.md`](map-design.md) when deciding whether design material is settled shape or advisory sketch.

#### Plan plane — how it is sequenced

Activating concepts: phase boundary, invariant bundle, tracker unit, branch unit, walking skeleton, tracer-bullet slice, risk retirement.

| Material role                                 | Kind        | Example question forms                                |
| --------------------------------------------- | ----------- | ----------------------------------------------------- |
| phase threshold or invariant bundle           | `milestone` | "What bundle must be true before this phase is done?" |
| canonical named work/tracker/branch unit      | `frontier`  | "What is the next named unit of work?"                |
| buildable implementation unit inside frontier | `slice`     | "What is the thinnest verifiable slice?"              |

Continue in [`map-plans.md`](map-plans.md) when distinguishing phase, frontier, and slice or linking work back to graph pressure.

Readiness bands guide questioning and mapping; they do not gate graph truth. If the user or a reviewed source clearly supplies a later-band item early, map it honestly with the right kind and basis, then mark settlement according to whether it has been harmonized.


## Promote before filing as context

`context` is the broadest attractor and therefore the most common misclassification. Promote to a sharper kind before writing graph truth.

| If the descriptive material...                                | Route to...                         |
| ------------------------------------------------------------- | ----------------------------------- |
| states the desired outcome or why the work matters            | `goal` or `thesis`                  |
| defines a term or naming commitment                           | `term`                              |
| must be true for the system to succeed or stay safe           | `requirement` or `invariant`        |
| limits acceptable solutions or scope                          | `constraint`                        |
| is believed but might be false in a material way              | `assumption`                        |
| is an acknowledged unknown that cannot simply be answered now | `unknown`                           |
| chooses among alternatives with durable consequences          | `decision`                          |
| explains how success will be judged                           | `criterion` or an oracle-plane node |
| gives a concrete case, trace, or counterexample               | `example`                           |
| only helps interpretation and has no stronger graph role yet  | keep `context`                      |

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

Use `sketch` for lightweight design material that should not yet harden into module/interface/entity shape. When a source implies `module`, `interface`, or `entity` before mapping has harmonized it, keep the sharper design kind as advisory rather than hiding it as a sketch.

## Decision mapping criteria

Do not turn every user answer into a `decision`. A `decision` needs all of these:

1. Real alternatives existed.
2. The choice is durable enough to constrain future interpretation or implementation.
3. The choice can be stated as “we chose A over B/C.”
4. At least one rejected alternative can be named.
5. There is a rationale.

Current required detail fields are `chosen_option`, `rejected`, and `rationale` (see `src/graph/schema/nodes.ts`). Put scope and consequences in the title/body or express them with edges; do not invent decision-detail fields.

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

## Coherent intent content checklist

- Each node can be read aloud as a stable claim or named item.
- `context` nodes are not carrying obligations, choices, boundaries, or uncertainty in disguise.
- Requirements say what must hold; criteria say how we judge; examples make interpretation concrete.
- Invariants protect preservation; constraints narrow solution space.
- Decisions name rejected alternatives and rationale, not just "the user answered yes."
- Negative knowledge is preserved as `example` plus `witness:against` or as `constraint`/`exclusion`, not as vague prose.
