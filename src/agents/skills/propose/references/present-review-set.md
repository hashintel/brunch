# Review-set Drafting

Use after candidate recognition when the agent has a coherent graph-draft batch for human review. This reference is a drafting and coherence aid only. `map` and graph schema/policy own graph vocabulary, role-named edge grammar, detail payload legality, routing, and persistence.

## Job

Draft a batch the user can approve, request changes to, or reject as one unit. Keep low-confidence noticings out of review sets unless the proposal explicitly asks the user to accept them as graph truth.

```pseudo
chain review-set-drafting
  start from recognized candidate material
  choose topical batch: intent | design | oracle | plan
  draft nodes with stable titles and reviewable bodies
  draft only edges whose endpoints are present or resolvable
  check edge roles against current map/schema guidance
  present_review_set
  ask({ continues })
  approval commits the exact batch through the product acceptance path
  never follow approval with mutate_graph for that batch
```

A review set is not a hidden mutation. Items become accepted graph truth only after the user approves the exact reviewed batch through the review-set acceptance path.

## Explanatory batch shape

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
      roles: object       # use current role-named endpoints, not generic source/target
      stance: for | against | null
      rationale: string?
  user_choice:
    options: approve | request_changes | reject
```

This is an authoring sketch, not a replacement schema. If it diverges from current map or graph code, the code-owned contract wins.

## Draft quality matrix

| Draft element | Required quality | Reject or ask changes when... |
| --- | --- | --- |
| heading | names the reviewable unit | it is generic (“Proposed updates”) |
| purpose | states why this batch exists | it hides uncertainty or overclaims support |
| grounding | cites accepted/proposed anchors | it treats speculation as settled evidence |
| node title | stable claim/item title | it is phrased as a question or TODO |
| node body | enough context to review | it contains multiple unrelated claims |
| node kind/detail | legal under current graph guidance | it revives retired vocabulary or invents fields |
| edge | role-named endpoints | either endpoint is missing or low-confidence |
| stance | present only where legal | stance is omitted where required or added where invalid |
| rationale | explains non-obvious relation | it merely repeats the category name |

## Plane drafting hints

| Plane | Good proposal content | Common overreach |
| --- | --- | --- |
| intent | goals, requirements, constraints, assumptions, decisions, criteria, examples | treating every answer as a decision or requirement |
| design | modules, interfaces, entities, sketches anchored in intent | speculative architecture without anchors |
| oracle | criteria, methods, concrete checks, examples, or deliberately promoted observed evidence | implementation tasks with no observation; future evidence; legacy/reserved kinds |
| plan | milestones, frontiers, scopes tied to accepted claims, design, and verification anchors | backlog tasks detached from graph pressure |

## Routing policy

```pseudo
rules review-set-route
  exact user-approved item or safe explicit direct commit -> graph mutation path
  coherent candidate batch needing judgment -> present_review_set
  useful low-confidence noticing -> session scratchpad obligation
  conflict with accepted graph truth -> reconciliation_need
  only conversational response needed -> no graph artifact
```

Notes:
- Review-set approval can produce `basis: explicit` only for the exact reviewed items.
- A scratchpad obligation stores the obligation/rationale, not a hidden low-confidence claim.
- A reconciliation need records the conflict; it does not silently choose a winner.

## Coherence checks before presenting

- Can the user approve the whole batch atomically without guessing your intent?
- Does each edge have both endpoints in the batch or selected spec?
- Are negative cases represented with a current legal edge/category pattern?
- Are design/oracle/plan nodes anchored to accepted or proposed intent?
- For plan batches that hand off to execution, does every scope package accepted requirements, executable criteria, design anchors, and verification machinery rather than frontier-only task prose?
- For a single handoff package, is there one owning frontier around the scope rather than an unnecessary milestone or extra frontier decomposition?
- If the batch drafts a new scope handoff, does it either draft the owning frontier too or attach the scope to an already-accepted frontier?
- Are invented schema fields removed?
- Are uncertainty and blind spots visible in proposal prose, not hidden in graph truth?
