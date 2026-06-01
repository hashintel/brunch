# lenses/ — Topical-focus prompt packs

SPEC decisions: D25-L, D56-L

Each lens describes a topical focus — what domain of the spec the
agent is currently exploring or proposing into.

## Lenses

| Lens      | Plane focus | Notes                                   |
|-----------|-------------|-----------------------------------------|
| `intent`  | intent      | Requirements, goals, constraints, etc.  |
| `design`  | design      | Modules, interfaces, architecture       |
| `oracle`  | oracle      | Checks, criteria, evidence, obligations |

Future execute-mode lenses (`plan`, `sync`, `scope`) are deferred.

## Topology-driven question ranking (M5 input)

When `agent-graph-integration` lands prompt packs, each lens
should include topology-driven heuristics for what to ask next.
These heuristics read graph shape, not templates:

| Signal                                       | Suggested question shape                          |
|----------------------------------------------|---------------------------------------------------|
| `assumption` with high fanout + low confidence | "We depend on X. Want to validate it?"           |
| `requirement` with no incoming `proof` edge  | "How will we know this holds?"                    |
| `criterion` with no outgoing `proof` target  | "What does this criterion check?"                 |
| `decision` with empty `rejected`             | "What did we consider and rule out?"              |
| Conflicting `boundary` edges into same target | "These constraints disagree. Which wins?"         |
| `goal` with no derived requirements          | "Nothing ties to this goal. What would satisfy it?" |
| `requirement` with no examples + high uncertainty | "What's a concrete case where this matters?"  |

These complement behavioral-kernel signal-phrase routing: kernels
suggest *what kind* of question; topology heuristics suggest *which
item* to ask about next.

## Source reference

Rich topology-driven ranking heuristics from the earlier design
are in the archived
`/brunch/docs/design/INTENT_GRAPH_SEMANTICS.md` §Topology-driven
question ranking. Treat as a prompt engineering input.
