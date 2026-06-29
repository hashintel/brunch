# lenses/ — Topical-focus prompt resources

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

## Heuristic provenance

Topology-driven next-question heuristics (look for goals with no derived
requirements, requirements with no examples/witnesses, decisions with empty
rejected alternatives, conflicting boundaries — ask about the most graph-shaping
absence first) are authored and locked into each `<lens>/SKILL.md` body in distilled
form (D97-L: cite/distill, do not copy vocabulary tables). Graph vocabulary itself is owned by
`src/graph/schema/kinds.ts`. This topology file owns the current lens membership
only — not a parallel copy of the per-lens ranking heuristics.
