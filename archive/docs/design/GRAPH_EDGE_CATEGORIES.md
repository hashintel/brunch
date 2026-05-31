# Graph Edge Categories — archived brainstorm

> **Retired 2026-05-31.** Superseded by
> [`docs/design/GRAPH_MODEL.md`](../../../docs/design/GRAPH_MODEL.md),
> which is the canonical reference for the edge model. This document
> is preserved as the rationale lineage / stress-test record that
> produced GRAPH_MODEL.md.

Long-form design note for the graph data layer. This document records the replacement direction for the earlier "large semantic edge-type catalogue + relation-policy interpretation" model discussed for M4/M5 graph work.

`memory/SPEC.md` remains the authoritative register until this design is promoted through `ln-spec` / `ln-sync`. This document is the rationale, stress-test record, and prompt/tooling material for the agent-facing graph edge tools.

## Starting point

The current graph plan already requires:

- durable graph nodes and edges in SQLite-backed graph persistence
- all mutations through `CommandExecutor`
- structural legality at write time
- graph snapshots / neighborhoods for agent context
- review-set proposals carrying entity and edge drafts that can dry-run through `CommandExecutor`
- edge semantics rich enough to support intent, oracle, design, and plan planes over time

The original direction implied a catalogue of named semantic relation kinds, with tuple-specific legality and projection policy. Examples in current architecture notes include relation names like `depends_on`, `validates`, `produces`, `discharges`, `counterexample_for`, and `witnesses`.

That shape creates two coupled burdens:

1. **Modeling burden at edge creation.** The agent must choose the exact relation kind from a growing catalogue, and must not hallucinate relation kinds that do not exist.
2. **Interpretation burden at snapshot time.** Context builders must consult relation policy to determine whether a given typed relation makes the anchor's neighbor a dependency, dependent, support item, realization, boundary, related concern, and so on.

This is manageable for a human-curated ontology. It is brittle when the primary edge author is an agent extracting or projecting graph mutations from assistant-user exchanges, review sets, and later reviewer outputs.

## Design move

Store a small set of **structural edge categories with endpoint roles**. Derive domain-specific labels later from tuple context.

```text
agent-facing command
  -> category + endpoint roles
  -> CommandExecutor structural validation
  -> stored graph edge
  -> tuple-label lookup for snapshot rendering
```

The agent does **not** author labels like `depends_on`, `asserted_by`, `witnesses`, or `implements`. Those are presentation phrases derived from:

```text
(category, source node kind, target node kind, endpoint perspective, stance?)
```

The category and endpoint roles drive policy. Tuple-specific label lookup must not upgrade, downgrade, or reinterpret the stored category.

## Final category scheme

```text
legend:
  dependency:   dependency -> dependent       # hard upstream
  support:      support -> claim              # soft warrant / evidence
  realization:  abstract -> concrete          # expression / implementation / establishment
  boundary:     boundary -> subject           # scope / constraint / exclusion
  composition:  whole -> part                 # containment / decomposition
  association:  peer <-> peer                 # weak relatedness only
  supersession: successor -> predecessor      # replacement / retirement lineage
```

### Category table

| Category | Endpoint roles | Policy | Agent test |
| --- | --- | --- | --- |
| `dependency` | `dependency -> dependent` | Hard upstream. If the dependency changes or is invalidated, the dependent must be revisited, blocked, or marked stale. | “If this upstream item stops being true, must the downstream item be reconsidered?” |
| `support` | `support -> claim` | Soft warrant, motivation, evidence, example, or counterexample. Does not automatically block the claim. Carries `stance: for | against`. | “Does this item strengthen, motivate, witness, or challenge the claim without being load-bearing?” |
| `realization` | `abstract -> concrete` | A concrete item expresses, implements, operationalizes, establishes, or asserts an abstract item. | “Is the target a concrete form of the source?” |
| `boundary` | `boundary -> subject` | A constraint, non-goal, scope rule, or exclusion limits the subject. Boundary changes can require subject review, but boundary is not merely evidence. | “Does this item limit, scope, exclude, or constrain the subject?” |
| `composition` | `whole -> part` | Topology / decomposition. A whole contains a part. This is not a sequencing dependency. | “Is this a parent/child, whole/part, milestone/slice, or decomposition relation?” |
| `association` | `peer <-> peer` | Weak related concern. No dependency, support, cascade, or completion semantics. Last resort. | “Are these usefully related, but no stronger category is safe?” |
| `supersession` | `successor -> predecessor` | A successor replaces a predecessor for overlapping scope. Projections can hide superseded predecessors from active context while preserving history. Must be acyclic. | “Does this newer item intentionally replace the older item?” |

## Edge shape

Approximate persisted shape:

```ts
type GraphEdgeCategory =
  | "dependency"
  | "support"
  | "realization"
  | "boundary"
  | "composition"
  | "association"
  | "supersession";

type GraphEdge = {
  id: string;
  category: GraphEdgeCategory;
  sourceId: string;
  targetId: string;

  // Only valid for support.
  stance?: "for" | "against";

  // Grounding for why this accepted edge exists.
  basis: "explicit" | "inferred" | "accepted_review_set";
  rationale?: string;
  provenance?: {
    sessionId?: string;
    entryId?: string;
    proposalEntryId?: string;
  };

  createdAtLsn: number;
  updatedAtLsn: number;
};
```

Graph truth should not carry low-confidence edge candidates as accepted edges. Low-confidence or uncertain material belongs in structured-exchange preface, `capture_*` analysis, review-set drafts, or `reconciliation_need` until clarified or accepted.

## Agent-facing tool surface

Prefer category-specific commands over one generic `createEdge({ relationKind })` command:

```ts
linkDependency({ dependency, dependent, basis, rationale })
linkSupport({ support, claim, stance, basis, rationale })
linkRealization({ abstract, concrete, basis, rationale })
linkBoundary({ boundary, subject, basis, rationale })
linkComposition({ whole, part, basis, rationale })
linkAssociation({ a, b, basis, rationale })
linkSupersession({ successor, predecessor, basis, rationale })
```

The command layer owns tuple validation. If a tuple is structurally illegal for a category, the tool returns `structural_illegal`; the agent should not try to invent a narrower label to force it through.

## Label lookup

Tuple-label lookup is a presentation concern only. It produces plain/pseudo language for graph snapshots, UI, and prompt context.

Examples:

| Stored edge | View from source | View from target |
| --- | --- | --- |
| `dependency(assumption -> decision)` | “premise for decision” | “depends on assumption” |
| `dependency(assumption -> requirement)` | “required by requirement” | “depends on assumption” |
| `support(context -> requirement, for)` | “motivates requirement” | “motivated by context” |
| `support(example -> invariant, for)` | “witnesses invariant” | “witnessed by example” |
| `support(example -> invariant, against)` | “counterexample for invariant” | “challenged by counterexample” |
| `realization(invariant -> requirement)` | “expressed by requirement” | “expresses invariant” |
| `realization(requirement -> design module)` | “realized by module” | “realizes requirement” |
| `realization(interface -> adapter)` | “implemented by adapter” | “implements interface” |
| `realization(requirement -> plan slice)` | “established by slice” | “establishes requirement” |
| `boundary(non-goal -> requirement)` | “rules out / limits requirement” | “bounded by non-goal” |
| `composition(milestone -> slice)` | “contains slice” | “belongs to milestone” |
| `supersession(new requirement -> old requirement)` | “supersedes old requirement” | “superseded by new requirement” |
| `association(A <-> B)` | “related to B” | “related to A” |

Snapshot buckets come from category and endpoint role, not from the derived label.

```text
anchor: R_offline: intent.requirement

hard dependencies:
  A_no_network: depends on assumption

support:
  P_field_users: motivated by context
  E_airplane: witnessed by example

realized by:
  M_sqlite_store: realized by design module
  SL_persist: established by plan slice

boundaries:
  C_no_cloud: bounded by constraint

supersedes:
  R_offline_v0: supersedes prior requirement
```

## Prompting snippets for graph-writing agents

### System prompt fragment

```text
When creating graph edges, choose only from Brunch's structural edge categories:
dependency, support, realization, boundary, composition, association, supersession.

Do not invent relation names such as depends_on, validates, witnesses, implements,
expresses, motivated_by, or related_concern. Those are rendering labels derived later
from the stored category and endpoint node kinds.

Create an accepted graph edge only when the relation is clear enough to become graph truth.
If the relation is weak, speculative, ambiguous, or merely a possible duplicate/possible
relation, do not create an accepted edge. Keep it in preface/capture analysis or raise a
reconciliation_need.

Use one edge for the strongest operational role between two nodes. Do not create multiple
edges merely because several English paraphrases are possible.
```

### Category selection rubric

Ask these questions in order. Stop at the first strong match.

```text
0. Should this be graph truth now?
   - explicit user statement, accepted review set, or high-confidence extraction -> continue
   - weak inference, possible relation, possible duplicate, unresolved ambiguity -> no accepted edge

1. Is a newer item intentionally replacing an older item for overlapping scope?
   -> supersession(successor -> predecessor)

2. Is this a whole/part, parent/child, or decomposition relation?
   -> composition(whole -> part)

3. Does one item limit, exclude, scope, or constrain another?
   -> boundary(boundary -> subject)

4. If the upstream item is invalidated, must the downstream item be revisited, blocked, or marked stale?
   -> dependency(dependency -> dependent)

5. Is one item a concrete expression, implementation, assertion, establishment, or operationalization of another?
   -> realization(abstract -> concrete)

6. Does one item motivate, justify, evidence, witness, or challenge another without being load-bearing?
   -> support(support -> claim, stance: for | against)

7. Are the two items usefully related, but no stronger role is safe?
   -> association(a <-> b)

8. Otherwise, create no edge.
```

### Hard vs soft upstream guard

```text
Do not treat every “because” as dependency.

Use dependency only when downstream validity or readiness depends on the upstream item.
Use support when the upstream item explains, motivates, or evidences the downstream item
but the downstream item could still stand if the support changed.
```

Examples:

```text
“A local-only product means we do not need account auth.”
  local-only assumption -> no-auth decision
  category: dependency

“Terminal users will appreciate keyboard-first flow.”
  terminal-user context -> keyboard-first requirement
  category: support, stance: for
```

### Evidence guard

```text
Evidence is support unless and until it needs a distinct policy.

Positive example -> claim: support(..., stance: for)
Counterexample -> claim: support(..., stance: against)
Check result -> criterion/invariant: support(..., stance: for | against)
```

Do not create a separate `evidence` edge category unless support proves insufficient for policy.

### Boundary vs negative support guard

```text
Use boundary when the source is itself a scope rule, constraint, non-goal, exclusion, or limit.
Use support(..., stance: against) when the source is evidence or an example that argues against a claim.
```

Examples:

```text
“No cloud accounts” -> “sync via hosted account”
  category: boundary

“Cloud outage blocks access” -> “hosted account sync is acceptable”
  category: support, stance: against
```

### Composition vs dependency guard

```text
Containment is not dependency.

A milestone contains a slice: composition.
A slice cannot start until another slice lands: dependency.
A module contains a private helper: composition.
A module calls another module at runtime or requires its interface: dependency or realization, depending on the claim.
```

### Realization guard

```text
Use realization for abstract-to-concrete expression:
- invariant -> requirement
- requirement -> design module
- interface -> adapter
- requirement -> plan slice
- oracle strategy -> concrete check

If the relation only explains why the concrete item exists, use support.
If the abstract item must remain true for the concrete item to remain valid, use dependency.
```

### Association guard

```text
Association is not a junk drawer.
Use it only when preserving adjacency is useful for future context and no stronger category is justified.
Do not create association for ordinary co-mention in the same sentence or turn.
Prefer no edge over noisy association.
```

### Supersession guard

```text
Use supersession only for intentional replacement of overlapping scope.
It is not support, dependency, or composition.
It should be acyclic. Context projections should prefer active leaves of a supersession chain
while preserving the predecessor in history/audit views.
```

Caveat: Brunch already uses `supersedes` in transcript-native review-set proposal regeneration. Graph `supersession` is a graph-entity relation; proposal `supersedes` is transcript lineage. They share a concept but are separate substrates.

## Worked stress cases

### Case 1 — one category set across intent, design, oracle, and plan

```text
nodes:
  A_local_only:      intent.assumption
  D_no_auth:         intent.decision
  R_offline:         intent.requirement
  I_no_network:      intent.invariant
  C_no_cloud:        intent.constraint

  IF_session_store:  design.interface
  M_sqlite_store:    design.module

  CH_airplane:       oracle.check
  EV_trace:          oracle.evidence

  MS_graph:          plan.milestone
  SL_persist:        plan.slice

edges:
  A_local_only     -[dependency]->   D_no_auth
  A_local_only     -[dependency]->   R_offline
  C_no_cloud       -[boundary]->     D_no_auth

  I_no_network     -[realization]->  R_offline
  R_offline        -[realization]->  M_sqlite_store
  IF_session_store -[realization]->  M_sqlite_store

  CH_airplane      -[support:+]->    I_no_network
  EV_trace         -[support:+]->    CH_airplane

  MS_graph         -[composition]->  SL_persist
  R_offline        -[realization]->  SL_persist
```

Pressure: `realization` is deliberately broad. It covers expression, implementation, assertion, and establishment. The bet is that category policy remains stable while tuple labels make each relation readable.

### Case 2 — support vs realization for examples

```text
nodes:
  I_preserve_history: intent.invariant
  R_archive_tasks:    intent.requirement
  E_delete_project:   intent.example
  CR_history_visible: intent.criterion

edges:
  I_preserve_history -[realization]->  R_archive_tasks
  I_preserve_history -[realization]->  CR_history_visible
  E_delete_project   -[support:+]->    I_preserve_history
  E_delete_project   -[support:+]->    CR_history_visible
```

Rule: examples usually support claims; they do not usually realize them. Use `realization` for durable work-products that operationalize an abstract claim.

### Case 3 — process debt instead of accepted graph truth

```text
nodes:
  R_fast_setup:      intent.requirement
  R_quick_onboard:   intent.requirement
  N_possible_dup:    reconciliation_need

? possible edge:
  R_fast_setup -[association]-> R_quick_onboard

non_semantic_refs:
  N_possible_dup -[concerns]-> R_fast_setup
  N_possible_dup -[concerns]-> R_quick_onboard
```

Rule: suspected duplicate / possible relation is process debt, not graph truth. Raise `reconciliation_need` unless weak association is actually useful as accepted context.

### Case 4 — supersession is the first non-fitting relation, now admitted explicitly

```text
nodes:
  R_old:       intent.requirement [superseded]
  R_new:       intent.requirement [active]
  D_keychain:  intent.decision

edges:
  D_keychain -[realization]->   R_new
  R_new      -[supersession]->  R_old
```

Reasoning: replacement does not fit dependency, support, realization, boundary, composition, or association cleanly. It is temporal/evolutionary and affects active-context projection. Admit it as a first-class category with tight caveats rather than smuggling it into association.

## Structural invariants

- Edge categories are closed. Agents cannot submit arbitrary relation strings.
- Every edge has exactly one category.
- `support.stance` is required for `support` and invalid for other categories.
- `association` is symmetric at the product level, even if physically stored with source/target ids.
- `supersession` chains are acyclic.
- Accepted graph edges are graph truth. Candidate or low-confidence edges live outside graph truth until accepted.
- Tuple-label lookup cannot change category policy.
- Snapshot bucket assignment comes from category and endpoint role, not from label strings.
- `composition` does not imply sequencing or dependency.
- `support` does not imply blocking/staleness by default.

## Open assumptions

- The seven-category set is expressive enough for M4/M5 intent-first work and later oracle/design/plan stubs.
- `realization` can remain broad if tuple labels carry the domain-specific phrasing.
- `support` can absorb evidence, examples, checks, and counterexamples with only `stance` as extra structure.
- `association` will remain rare under prompting discipline.
- `supersession` belongs in graph edges rather than only lifecycle/change-log fields because active-context projection needs to traverse replacement lineage.

## Promotion notes

When this is promoted into canonical planning/spec state, update the graph-data-plane language from “edge-type catalogue” to “closed structural edge category set,” and update review-set proposal payload examples so `edge_drafts` use category-specific endpoint roles instead of arbitrary `relation` strings.
