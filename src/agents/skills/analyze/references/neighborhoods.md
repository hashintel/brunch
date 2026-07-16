# Neighborhood consumption slice

Draft injectable reference for agents reading existing graph context before answering, proposing, or mutating. Use when a task is centered on one claim, design seam, oracle, or plan item.

## Job

Reason from an item-centered neighborhood, not from global kind buckets. Direction, labels, and impact come from edge policy projections, not raw `sourceId` / `targetId` order.

## Neighborhood data shape

```yaml
neighborhood:
  anchor:
    code: string
    kind: string
    title: string
    body: string?
  buckets:
    dependencies: item_edge[]   # premises, constraints, assumptions, upstream support
    dependents: item_edge[]     # likely affected claims/work if anchor changes
    evidence: item_edge[]       # criteria, checks, examples, evidence, counterexamples
    refinements: item_edge[]    # abstract/concrete, whole/part, successor/predecessor as useful
    lateral: item_edge[]        # cross_reference or low-impact neighbors
  open_needs:
    gaps: string[]
    reconciliation_needs: string[]

item_edge:
  label: string          # rendered from anchor perspective
  neighbor_code: string
  neighbor_kind: string
  neighbor_title: string
  stance: string?        # for | against, only when category carries stance
  impact: string         # upstream | downstream | lateral
  rationale: string?
```

## Reading chain

```pseudo
task about anchor
  -> read anchor text and edge-local neighborhood
  -> bucket neighbors by relation to anchor: dependencies | dependents | evidence | lateral
  -> inspect open scratchpad obligations/reconciliation needs before assuming completeness
  -> answer or propose with explicit references to affected neighbors
```

## Bucket interpretation matrix

| Bucket | Means | Ask |
| --- | --- | --- |
| dependencies | what the anchor relies on or is conditioned by | “If this changes, does the anchor still stand?” |
| dependents | what may be affected if the anchor changes | “What downstream claims/work need reconciliation?” |
| evidence | what witnesses, refutes, checks, or exemplifies the anchor | “Is the claim actually observed?” |
| refinements | more abstract/concrete versions or parts | “Is this the right level of specificity?” |
| lateral | related but non-driving context | “Is this merely adjacent or should it become a stronger edge?” |

## Edge-local context pattern

```pseudo
REQ17: Each phase exposes explicit kickoff/frontier/recovery/handoff affordances.
  dependencies:
    motivated by G2: avoid fake closure and stranded users
    bounded by CON8: no generic task-planning surface
    depends on A4: users will tolerate visible phase state
  dependents:
    implemented by MOD5: phase affordance renderer
    establishes SCP13: open-phase artifact scope
  evidence:
    witnessed by AC13: open phases bottom-load one visible artifact
    challenged by EX4: cancelled interview with no handoff artifact
  open:
    scratchpad obligation: Should recovery affordances appear before or after generation failure?
```

This shape is more useful than “all goals, all constraints, all requirements” because it carries why the anchor stands and what changes if it moves.

## Consumption rules

- Do not infer direction from raw storage coordinates. Use rendered labels and impact buckets.
- Do not treat lack of visible evidence as proof that no evidence exists; ask for a targeted read if needed.
- Do not flatten `witness:against` into generic “related evidence.” Negative evidence is semantically important.
- Do not update an anchor without checking dependents; changes can create reconciliation needs.
- Do not answer “why is this here?” without looking for `rationale`, `dependency`, and `realization` paths.

## Task-specific neighborhood choices

| Task | Prioritize |
| --- | --- |
| explain why a claim exists | dependencies + rationale edges |
| edit a claim | dependents + reconciliation needs |
| generate criteria | evidence gaps + existing criteria/checks/examples |
| project design | requirements/invariants/constraints + examples |
| plan work | requirements/design seams/oracle obligations + dependency edges |
| reconcile conflict | conflicting neighbors + edge rationale + change history if available |

## Output discipline

When responding from a neighborhood, name the graph relation rather than merely citing nodes:

- Good: “REQ17 depends on A4 and is bounded by CON8; changing A4 would affect REQ17.”
- Weak: “Relevant nodes: A4, CON8, REQ17.”

When proposing a mutation, include the edge intent in prose before committing or presenting review-set drafts.
