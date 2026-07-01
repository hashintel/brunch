# Mapping Plans

## Job

Turn accepted intent/design/oracle pressure into sequenced work without losing the distinction between phase, tracker unit, and implementation slice.

```pseudo
accepted graph pressure
  -> identify invariant bundle or product threshold
  -> group into milestone if it marks phase readiness
  -> define frontier if it is the canonical named work item
  -> thin to slice when it is buildable execution scope
  -> link plan nodes back to the claims/design/oracles they realize or protect
```

## Plan-kind routing

| Planning material                      | Kind        | Use when                                              | False route                               |
| -------------------------------------- | ----------- | ----------------------------------------------------- | ----------------------------------------- |
| phase boundary / invariant bundle      | `milestone` | advancing means a bundle of properties now holds      | vague roadmap heading                     |
| named frontier / tracker / branch unit | `frontier`  | a coherent work item owns a seam or coverage frontier | build task too small                      |
| thin buildable unit                    | `slice`     | one execution context can implement and verify it     | dumping an entire frontier into one slice |

## Sequencing graph

```pseudo
nodes:
  goal: intent
  requirement: intent
  invariant: intent
  criterion: intent/oracle-anchor
  module: design
  check: oracle
  milestone: plan
  frontier: plan
  slice: plan

edges:
  goal, requirement, invariant -[rationale:for]-> milestone
  milestone                    -[composition]->  frontier
  frontier                     -[composition]->  slice
  requirement, invariant       -[realization]->  frontier, slice
  module, interface            -[realization]->  slice
  check, criterion             -[dependency]->   slice        # if work depends on oracle being present
  frontier                     -[dependency]->   frontier     # sequencing dependency

notes:
  - Plan nodes should explain what accepted graph pressure they discharge.
  - `composition` groups plan units; `dependency` orders them; `realization` ties work to claims/design.
```

## Coherent plan content checklist

A plan node is coherent when it names:

- the claim/design/oracle pressure it exists to satisfy;
- the unit boundary: phase, frontier, or slice;
- the acceptance signal for that unit;
- the dependency or composition edges that matter;
- what is explicitly out of scope for this unit.

## Frontier vs slice decision table

policy: exclusive

| rule | Work shape                                                              | → kind                                               |
| ---- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| R1   | establishes a phase threshold across multiple work items                | `milestone`                                          |
| R2   | is the canonical named work item with its own planning/tracker identity | `frontier`                                           |
| R3   | is one buildable execution scope inside a frontier                      | `slice`                                              |
| R4   | is just a note, risk, or unresolved question                            | not plan graph truth; use body text, a scratchpad obligation, or unknown |

notes:
  - #R2 can contain several slices through `composition`.
  - #R3 should have a plausible verification route.

## Plan mapping matrix

| Upstream pressure                 | Plan response                           | Edge hint                                              |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------ |
| goal has no satisfying work       | create or attach frontier               | `rationale:for` from goal to frontier                  |
| requirement needs implementation  | frontier or slice                       | `realization`                                          |
| invariant needs protection        | frontier/slice plus oracle              | `realization` and `dependency`                         |
| criterion/check missing           | oracle slice or attach to existing work | `dependency` when required before proceeding           |
| design seam needs materialization | slice                                   | `realization` from module/interface to slice           |
| high-fanout assumption is risky   | validation slice or milestone gate      | `dependency` from assumption to work that relies on it |
| known unknown blocks sequencing   | investigation slice or scoped non-goal  | `dependency` only if the work truly relies on it       |

## Anti-patterns

- Do not turn every task into a `frontier`; frontiers are named work items, slices are build units.
- Do not create plan nodes detached from accepted claims/design/oracles.
- Do not sequence by aesthetic completeness; sequence by pressure, dependency, risk, and verification economics.
- Do not use plan nodes as a hidden backlog for uncertain facts; use a session scratchpad obligation, `unknown`, or review notes.
- Do not infer that a passing slice proves a whole frontier; state the acceptance breadth honestly.

## Minimum plan proposal shape

```yaml
plan_candidate:
  node:
    kind: milestone | frontier | slice
    title: string
    body: string          # boundary, objective, and out-of-scope
  anchors:
    satisfies: string[]   # requirements/goals/invariants/design/oracles
    blocked_by: string[]  # dependencies or unknowns
    verifies_with: string[]
  acceptance:
    observation: string
    breadth: example | bounded | sweep | milestone
```

Keep `acceptance.breadth` in proposal prose unless a current schema field exists for it. Do not invent plan-node detail fields.
