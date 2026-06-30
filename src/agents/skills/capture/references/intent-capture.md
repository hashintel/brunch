# Intent capture slice

Draft injectable reference for the elicitor, capture sweep, and any foreground agent turning user/world material into coherent specification graph content. Use schema-owned graph files for exact kind legality and [`../../../contexts/about/readiness-bands.md`](../../../contexts/about/readiness-bands.md) for readiness/settlement terminology.

## Job

Capture stable intent-plane material as settled graph truth; capture reviewed but not-yet-harmonized source signal as advisory graph material; route everything else to the correct non-truth substrate.

```pseudo
incoming material
  -> normalize to declarative claim or named graph item
  -> classify by modality
  -> promote away from context when a sharper kind is earned
  -> decide route: settled graph item | advisory graph item | elicitation_gap | reconciliation_need | review draft
  -> add edges only after endpoint confidence is settled
```

## Intent-kind routing matrix

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

## Promotion decision table

policy: first-match

| rule | If material...                           | → route                          |
| ---- | ---------------------------------------- | -------------------------------- |
| R1   | contradicts existing settled graph truth | `reconciliation_need`            |
| R2   | is low-confidence, suspected, or missing | `elicitation_gap`                |
| R3   | is a candidate batch awaiting approval   | review-set draft                 |
| R4   | selects A over named B/C with rationale  | `decision`                       |
| R5   | rules out solution space or scope        | `constraint`                     |
| R6   | must remain true across operation/change | `invariant`                      |
| R7   | describes how success will be judged     | `criterion` or oracle-plane node |
| R8   | gives a concrete witness/counterexample  | `example`                        |
| R9   | only helps interpretation                | `context`                        |

notes:
  - #R1 is retrospective repair; do not file contradictions as gaps.
  - #R2 is prospective elicitation agenda; the gap stores question/rationale, not hidden domain truth.
  - #R4 must satisfy the decision criteria in `graph-heuristics.md`.

## Coherent intent content checklist

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
