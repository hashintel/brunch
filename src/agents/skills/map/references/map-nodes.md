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
- `example` — concrete case or disambiguator: positive case, counterexample, edge case, trace, or labelled out-of-scope case. Polarity comes from wording, not a subtype field; execution results are promoted separately as evidence.

Read [`map-intents.md`](map-intents.md) when distinguishing intent-plane kinds or promoting away from `context`.

### Oracle plane — how we know

Activating concepts: verification, tests, proof, audit trail, observed run, counterexample, blind spot.

| Material role                                       | Kind            | Example question forms                                  |
| --------------------------------------------------- | --------------- | ------------------------------------------------------- |
| acceptance/oracle claim                             | `criterion`     | "How will we judge that this holds?"                    |
| concrete executable or manual check                 | `check`         | "What test, review step, or gate verifies this?"        |
| verification method family                          | `vv_method`     | "What method establishes the criterion?"                |
| observed artifact                                   | `evidence`      | "What run, transcript, log, or measurement shows this?" |
| concrete positive/negative case or disambiguator    | `example`       | "What case would demonstrate or falsify this?"          |

This table is live authoring guidance, not the full physical taxonomy: `evidence` is capture-only for deliberately promoted observations, and the schema-readable legacy/reserved obligation kind is never newly authored. Read [`map-oracles.md`](map-oracles.md) when choosing the weakest sufficient check or attaching assurance edges.

### Design plane — how it is shaped

Activating concepts: deep modules, information hiding, seams, API surface, data identity, lifecycle, deliberately soft architecture.

| Material role                             | Kind        | Example question forms                                         |
| ----------------------------------------- | ----------- | -------------------------------------------------------------- |
| implementation part with responsibility   | `module`    | "What part hides this complexity?"                             |
| contract across a seam                    | `interface` | "Where is the boundary, and what is exchanged across it?"      |
| domain/data object with identity          | `entity`    | "What object has lifecycle, storage shape, or relationships?"  |
| tentative option, diagram, or design hint | `sketch`    | "What shape helps thinking without constraining the work yet?" |

Read [`map-design.md`](map-design.md) when deciding whether design material is settled shape or advisory sketch.

### Plan plane — how it is sequenced

Activating concepts: phase boundary, invariant bundle, tracker unit, branch unit, committed execution handoff, risk retirement.

| Material role                                 | Kind        | Example question forms                                |
| --------------------------------------------- | ----------- | ----------------------------------------------------- |
| phase threshold or invariant bundle           | `milestone` | "What bundle must be true before this phase is done?" |
| canonical named work/tracker/branch unit      | `frontier`  | "What is the next named unit of work?"                |
| committed execution handoff inside frontier   | `scope`     | "What package should execution receive as durable truth?" |

Read [`map-plans.md`](map-plans.md) when distinguishing phase, frontier, and scope or linking work back to graph pressure.

Readiness bands guide questioning and mapping; they do not gate graph truth. If the user or a reviewed source clearly supplies a later-band item early, map it honestly with the right kind and basis, then mark settlement according to whether it has been harmonized.
