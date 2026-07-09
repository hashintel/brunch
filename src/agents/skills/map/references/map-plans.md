# Mapping Plans

## Job

Turn accepted intent/design/oracle pressure into sequenced work without losing the distinction between phase, tracker unit, and committed execution handoff. The durable progression is `intent -> design -> verification -> scope -> build`: `frontier` remains the tracker/branch unit, `scope` is the durable handoff package to execution, and buildable slicing stays an execution-side concern rather than a plan-plane node.

```pseudo
accepted graph pressure
  -> identify invariant bundle or product threshold
  -> group into milestone if it marks phase readiness
  -> define frontier if it is the canonical named work item
  -> define scope if accepted requirements, design, and verification truth need a committed execution handoff
  -> link plan nodes back to the claims/design/oracles they realize or protect
  -> stop at scope; downstream execution thins it into buildable work
```

## Plan-kind routing

| Planning material                      | Kind        | Use when                                              | False route                               |
| -------------------------------------- | ----------- | ----------------------------------------------------- | ----------------------------------------- |
| phase boundary / invariant bundle      | `milestone` | advancing means a bundle of properties now holds      | vague roadmap heading                     |
| named frontier / tracker / branch unit | `frontier`  | a coherent work item owns a seam or coverage frontier | build task too small                      |
| committed execution handoff package    | `scope`     | execution needs a durable package of requirements, design, and verification | ephemeral runtime slice |

Do not model a buildable execution slice as a plan node. A scope is the committed package that execution receives; thinning it into buildable slices is downstream executor work rather than additional plan-plane truth.

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
  scope: plan

edges:
  goal, requirement, invariant -[rationale:for]-> milestone
  milestone                    -[composition]->  frontier
  frontier                     -[composition]->  scope
  requirement, invariant       -[realization]->  scope
  module, interface            -[composition]->  scope
  check, criterion             -[dependency]->   scope        # if work depends on oracle being present
  frontier                     -[dependency]->   frontier     # sequencing dependency

notes:
  - Plan nodes should explain what accepted graph pressure they discharge.
  - `composition` groups plan units; `dependency` orders them; `realization` ties work to claims/design.
  - The plan plane stops at scope; buildable slicing is downstream execution, not a plan node.
```

## Coherent plan content checklist

A plan node is coherent when it names:

- the claim/design/oracle pressure it exists to satisfy;
- the unit boundary: phase, frontier, or scope;
- the acceptance signal for that unit;
- the dependency or composition edges that matter;
- what is explicitly out of scope for this unit.

## Frontier vs scope decision table

policy: exclusive

| rule | Work shape                                                              | → kind                                               |
| ---- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| R1   | establishes a phase threshold across multiple work items                | `milestone`                                          |
| R2   | is the canonical named work item with its own planning/tracker identity | `frontier`                                           |
| R3   | is one committed execution handoff package inside a frontier            | `scope`                                              |
| R4   | is just a note, risk, or unresolved question                            | not plan graph truth; use body text, a scratchpad obligation, or unknown |

notes:
  - #R2 can contain several scopes through `composition`.
  - #R3 should package a plausible verification route for execution.
  - For one execution-facing handoff package, default to drafting one owning frontier plus one scope; widen to several scopes only when the accepted package truly contains several build handoffs, and add a milestone or extra frontier only when the accepted graph truth already names a broader phase threshold or a second true tracker unit.
  - The owning frontier is the `composition.whole` and the scope is the `composition.part`; keep design and verification anchors on the scope itself unless several scopes genuinely share the same frontier.

## Plan mapping matrix

| Upstream pressure                 | Plan response                           | Edge hint                                              |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------ |
| goal has no satisfying work       | create or attach frontier               | `rationale:for` from goal to frontier                  |
| requirement needs implementation  | frontier or scope                       | `realization`                                          |
| invariant needs protection        | scope plus oracle                       | `realization` and `dependency`                         |
| criterion/check missing           | verification scope or attach to existing work | `dependency` when required before proceeding      |
| design seam needs materialization | scope                                   | `composition` from module/interface into scope         |
| high-fanout assumption is risky   | verification scope or milestone gate    | `dependency` from assumption to work that relies on it |
| known unknown blocks sequencing   | investigation scope or scoped non-goal  | `dependency` only if the work truly relies on it       |

## Anti-patterns

- Do not turn every task into a `frontier`; frontiers are named work items, scopes are committed handoffs.
- Do not draft a standalone scope handoff unless an accepted frontier already exists to own it.
- Do not decompose one handoff package into a milestone plus extra frontier nodes just to restate implementation steps; keep the scope under its owning frontier unless a real second planning boundary exists.
- Do not create plan nodes detached from accepted claims/design/oracles.
- Do not sequence by aesthetic completeness; sequence by pressure, dependency, risk, and verification economics.
- Do not use plan nodes as a hidden backlog for uncertain facts; use a session scratchpad obligation, `unknown`, or review notes.
- Do not infer that a passing runtime slice proves a whole scope or frontier; state the acceptance breadth honestly.

## Minimum plan proposal shape

```yaml
plan_candidate:
  node:
    kind: milestone | frontier | scope
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
