# Review-set drafting slice

Draft injectable reference for agents proposing graph changes for human review. Use when material is plausible and structured but should not be directly committed yet.

## Job

Draft a coherent reviewable graph batch: settled enough to inspect, not yet accepted graph truth. Keep low-confidence noticings out of review sets unless the proposal explicitly asks the user to accept them as graph truth.

```pseudo
candidate material
  -> choose topical slice: intent | design | oracle | plan
  -> draft nodes with stable titles and bodies
  -> draft only edges whose endpoints are present or resolvable
  -> validate role-named edge shape mentally before presenting
  -> ask for approve | request changes | reject
```

## Review-set batch shape

```yaml
review_set_candidate:
  heading: string
  purpose: string
  grounding:
    summary: string
    support: string[]     # why this batch is worth reviewing
  nodes:
    - draft_id: string
      plane: intent | oracle | design | plan
      kind: string
      title: string
      body: string?
      detail: object?
  edges:
    - category: string
      roles: object       # use role-named endpoints, not generic source/target
      stance: for | against | null
      rationale: string?
  user_choice:
    options: approve | request_changes | reject
```

This shape is explanatory, not a replacement schema. The actual review-set and graph mutation schemas are owned by graph code.

## Draft quality matrix

| Draft element | Required quality | Reject or ask changes when... |
| --- | --- | --- |
| heading | names the reviewable unit | it is generic (“Proposed updates”) |
| grounding.summary | says why this batch exists | it hides uncertainty or overclaims source support |
| node title | stable claim/item title | it is phrased as a question or TODO |
| node body | enough context to review | it contains multiple unrelated claims |
| node kind | current legal kind | it revives old subtype/relation vocabulary |
| detail | only legal kind/detail payload | it invents fields or stores prompt conduct |
| edge | role-named endpoints | either endpoint is missing or low-confidence |
| stance | present only on `witness`/`rationale` | stance is omitted there or added elsewhere |
| rationale | explains non-obvious relation | it merely repeats the category name |

## Plane-specific drafting hints

| Plane | Good proposal content | Common overreach |
| --- | --- | --- |
| intent | goals, requirements, constraints, assumptions, decisions, criteria, examples | treating every answer as a decision or requirement |
| design | modules, interfaces, entities, sketches anchored in intent | speculative architecture without anchors |
| oracle | criteria, checks, methods, evidence, obligations, examples | implementation tasks with no observation |
| plan | milestones, frontiers, slices tied to claims/design/oracles | backlog tasks detached from graph pressure |

## Edge drafting patterns

```pseudo
claim motivated by goal:
  category: rationale
  support: G1
  claim: REQ2
  stance: for

counterexample challenges invariant:
  category: witness
  oracle: EX3
  claim: INV4
  stance: against

requirement depends on assumption:
  category: dependency
  dependency: A5
  dependent: REQ2

constraint bounds design:
  category: exclusion
  boundary: CON6
  subject: MOD7

frontier contains slice:
  category: composition
  whole: F2
  part: S4
```

## Direct commit vs review set vs gap

policy: exclusive

| rule | Material state | → route |
| --- | --- | --- |
| R1 | exact user-approved graph item or safe explicit direct commit | `mutate_graph` |
| R2 | coherent candidate batch that needs human judgment | `present_review_set` |
| R3 | useful but low-confidence noticing | `elicitation_gap` |
| R4 | conflicts with accepted graph truth | `reconciliation_need` |
| R5 | only conversational response needed | no graph artifact |

notes:
  - #R2 becomes `basis: explicit` only after the user approves the exact reviewed items.
  - #R3 stores a question/rationale, not the low-confidence claim as hidden truth.

## Coherence checks before presenting

- Can the user approve the whole batch atomically without guessing your intent?
- Does each edge have both endpoints in the batch or selected spec?
- Are negative cases represented with `witness:against` or `exclusion` where appropriate?
- Are design/oracle/plan nodes anchored to accepted or proposed intent?
- Are all invented schema fields removed?
- Are uncertainty and blind spots visible in proposal prose, not hidden in graph truth?
