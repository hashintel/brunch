# Intent Graph Semantics — Ontology, Edges, and Progressive Checkability

> Status: **working design proposal**.
> Date: 2026-05-07.
> Scope: the **product-layer** intent-graph ontology and its edge semantics — the typed kinds, subtypes, relations, edge metadata, relation-policy registry, observer-prompt classification rules, and topology-driven question-ranking heuristics that the Brunch product should converge on.
>
> This document is the canonical reference for the FE-700 frontier item ("Intent graph semantics + progressive checkability foundation") in `memory/PLAN.md`. It expands the `Recommended shape:` of that item with the full ontology and policy detail that is too long to live inside the plan.
>
> Source synthesis: [`INTENT_SPEC_EVOLUTION.md`](../archive/design/INTENT_SPEC_EVOLUTION.md) §3, §4, §6, §11. Where this document overlaps, it supersedes the synthesis as the structured reference; the synthesis remains the broader narrative.
>
> Layer note: this is the **product layer**. It describes what Brunch users build. The dev-layer ontology is a parallel-but-not-yet-converged register described in [`ln-skills/EVOLUTION.md`](./ln-skills/EVOLUTION.md).

## Why this note exists

The product ontology has been growing piecemeal. Today's exploration ontology (`goal`, `term`, `context`, `constraint`, `decision`, `assumption`) plus accepted-review materializations (`requirement`, `criterion`) is functional but imprecise:

- A "decision" can absorb any user answer and become bloated.
- A "constraint" mixes scope boundaries, technical limitations, policy, and non-goals into one bucket.
- "Context" is doing the work of background, premises, descriptive truth, and pre-commitment notes simultaneously.
- An invariant (a property that must hold) has no home except as informal text inside a requirement or constraint.
- An example (a concrete case that disambiguates intent) is captured only as a turn artifact and lost as durable evidence.
- Edges (`depends_on`, `derived_from`, `constrains`, `verifies`, `refines`) carry no epistemic metadata — every edge is treated as equally authoritative for cascade, export, staleness, and reconciliation.

The cumulative effect: the graph carries the right *vocabulary* but does not carry enough *typing* to drive cascade preview, witness generation, ambiguity discovery, or progressive-checkability projection without the LLM re-deriving structure on every call.

This document specifies the typed shape FE-700 should land.

## Top-level kinds

Nine top-level kinds. The current six exploration kinds plus the two review-materialized kinds become eight, plus `example` is promoted to a top-level kind. Decision is narrowed; constraint is subtyped.

| Kind | Modality of claim | Source |
| --- | --- | --- |
| `goal` | Value or outcome claim | "What outcome are we after?" |
| `context` | Descriptive claim | "What is true about the world this lives in?" |
| `constraint` | Boundary claim | "What does this rule out?" |
| `assumption` | Uncertainty claim | "What might be false?" |
| `decision` | Choice claim | "What did we pick among real alternatives?" |
| `requirement` | Obligation claim | "What must the system do?" |
| `invariant` | Preservation claim | "What must never be broken?" |
| `criterion` | Oracle claim | "How will we judge that it holds?" |
| `example` | Witness or disambiguator claim | "What concrete case would settle this?" |

The framing: **a spec is a graph of typed claims.** Each kind is a *modality* of claim, not just a section bucket. `term` remains a vocabulary / lexicon capture used during grounding; it is not part of this typed-claim kind set until a future lexicon model promotes terms into graph-addressable claim records.

### Notes on each kind

**`goal`** — value or outcome claim. Why a feature exists. Does not commit the system to any particular behavior; commits the team to a target.

**`context`** — descriptive claim about the world that would remain true even if the specification paused tomorrow. Background, premises, actors, repo facts, vocabulary. Carries promotion rules (below).

**`constraint`** — boundary on acceptable solutions. Subtyped (below). Includes non-goals as a subtype. Distinct from invariant: a constraint restricts the *solution space*; an invariant states what must remain true as the system *operates or evolves*.

**`assumption`** — material belief whose truth could be falsified later. Carries confidence and a validation approach.

**`decision`** — chosen direction among plausible alternatives. **Narrow definition.** A decision is not every user answer; it is a choice with durable consequences. (See "Decision-capture criteria" below.)

**`requirement`** — normative obligation: the system shall satisfy these properties. Materialized only through accepted requirements review today; once shared-property modeling lands, may also be created as a commitment to one or more `Property` records.

**`invariant`** — property that must remain true across relevant states, transitions, executions, versions, or semantic revisions. Subtyped (below).

**`criterion`** — observation that would witness a property holding. Subtyped (below). Distinct from a requirement: a requirement is what must be true; a criterion is how we recognize that it is.

**`example`** — concrete scenario, trace, input/output, edge case, approved example, rejected example, not-relevant label, or counterexample. Subtyped (below). Durable evidence, not just conversational aid.

## Subtypes

Subtypes live inside a kind. They keep the top-level kind set small while preserving the discriminations the LLM needs to classify, observe, and check.

### `constraint` subtypes

| Subtype | Meaning |
| --- | --- |
| `non_goal` | An explicit exclusion from the current scope. |
| `scope` | A bound on what the spec covers vs. what it does not. |
| `technical` | A technical limitation imposed by stack, runtime, or platform. |
| `policy` | A policy or compliance restriction. |
| `resource` | A resource bound (cost, time, headcount, capacity). |
| `compatibility` | A compatibility constraint with existing systems, data, or interfaces. |
| `environmental` | An environmental constraint (deployment target, network shape, single-tenant). |

### `criterion` subtypes

| Subtype | Meaning |
| --- | --- |
| `acceptance` | A user-facing accept/reject condition. |
| `test` | An automated test. |
| `manual_review` | A reviewer-evaluated check. |
| `runtime_check` | A runtime assertion or contract. |
| `proof` | A proof obligation in a formal system. |
| `observability` | A trace, log, or audit signal that must be visible. |

Required fields on a criterion: `target` (which requirement / invariant / property it observes), `method`, `scope` (`example` / `bounded` / `all_states`), `expected_observation`.

### `invariant` subtypes

| Subtype | Meaning |
| --- | --- |
| `state` | A property that holds in every reachable state. |
| `transition` | A property of every state transition. |
| `authority` | A property about who or what may take an action. |
| `provenance` | A property about where data or decisions originated. |
| `consistency` | A consistency property between two views, projections, or copies. |
| `security` | A security or access-control property. |
| `data_integrity` | An integrity property over stored or transmitted data. |

### `example` subtypes

| Subtype | Meaning |
| --- | --- |
| `positive` | A concrete case that the spec must accept. |
| `negative` | A counterexample: a concrete case that the spec must reject. |
| `edge_case` | A boundary or degenerate case included for clarification. |
| `trace` | A sequence of states or actions that illustrates a behavior. |
| `not_relevant` | A case the user labelled out of scope, useful as durable disambiguation. |

The `negative` subtype is especially important because **intent is often clarified by ruling out plausible interpretations** — see Negative edges below.

## Promotion rules

The interviewer and observer should treat the kinds as a partial lattice with explicit promotion rules. The most common drift case is `context` absorbing material that should be a stronger kind.

### `context` promotion

| If the context… | Promote it to… |
| --- | --- |
| must be true for success | `requirement` or `invariant` |
| limits acceptable solutions | `constraint` |
| may be false and matters | `assumption` |
| chooses among alternatives | `decision` |
| just helps interpretation | keep as `context` |

### `requirement` ↔ `invariant`

A requirement says "the system must do X." An invariant says "X must never be broken." They often pair: a requirement to *do* something, plus an invariant to *preserve* something across the doing of it.

### `decision` ↔ `invariant`

A decision captures the choice; an invariant captures the rule that must keep holding after the choice. "We chose option A over option B" is a decision. "After this choice, property P must continue to hold" is the invariant the decision introduces.

### `assumption` retirement

When an assumption is validated, it does not become a requirement. It becomes either a **decision** (if the validation forced a choice) or it gets retired as confirmed truth (and the dependent decisions / requirements no longer carry the assumption tag).

## Decision-capture criteria

A common drift case is treating every user answer as a decision. A claim should become a `decision` only if it satisfies all of the following:

1. **Plausible alternatives existed.** "We chose React over Svelte" is a decision; "we use TypeScript" is context if no alternative was on the table.
2. **The choice is durable.** It will affect future design, implementation, or interpretation. One-off question answers that don't constrain future work are not decisions.
3. **The choice is explicit.** It can be stated as "we chose A over B/C/D" rather than as a description of current behavior.
4. **Rejected alternatives can be named.** A decision without rejected alternatives is just a description.
5. **There is a rationale.** "Because X" or "because Y was a non-starter for Z reason." A decision without rationale is just a fact.

Required fields on a decision: `chosen_option`, `rejected_alternatives` (≥ 1), `rationale`, `scope` (where this decision applies), `consequences` (what it now constrains downstream).

## Observer-prompt classification guide

When the observer extracts knowledge items from an answered turn, it should use a one-line rule per kind to decide how to classify a span of conversational content:

| Kind | One-line classification rule |
| --- | --- |
| `goal` | "X so that Y" or "we want Y" — outcome statement, no specific implementation |
| `context` | Descriptive present-tense fact about the world that does not commit the system |
| `constraint` | "must not", "cannot", "only if" — bounds the solution space |
| `assumption` | "we think", "probably", "if X is true" — material belief that could be wrong |
| `decision` | "we chose A over B because" — see Decision-capture criteria above |
| `requirement` | "the system shall" / "must do" — obligation, materialized via accepted review only |
| `invariant` | "always true", "never", "must remain" — preservation across states/transitions |
| `criterion` | "we'll know it works when", "tested by", "we'll review for" — oracle for a property |
| `example` | "for instance", "like when", "what about the case where" — concrete witness |

The observer should **abstain** rather than guess when classification support is weak. Speculative captures degrade graph signal.

## Phase-by-phase capture mapping

The phase a turn belongs to is itself a strong classification prior. The observer's allowed captures per phase:

| Phase | Allowed captures | Materialized at review acceptance |
| --- | --- | --- |
| Grounding | typed claims: `goal`, `context`, `constraint`, `assumption`, `example`; vocabulary capture: `term` | — |
| Design | `decision`, `constraint`, `invariant`, requirement-candidate (held as a draft tag), `example` | — |
| Requirements review | review proposes durable `requirement` items + paired `invariant` items | `requirement`, `invariant` materialize on accept |
| Criteria review | review proposes `criterion` items + `example` items + verification mappings | `criterion`, `example` materialize on accept |

The conceptual shift from earlier exploration ontology is that **hardening is requirements + invariants + criteria + examples**, not just requirements + criteria. The intent-spec direction needs preservation claims and witness claims as durable, not as conversational.

## Relations — the five-family taxonomy

Relations are typed and grouped into five semantic families. Edge kinds say *how* claims justify, constrain, depend on, refine, and verify one another.

| Family | Example relations | Purpose |
| --- | --- | --- |
| **Justification** | `derived_from`, `motivated_by`, `supports` | Explain why a claim exists |
| **Dependency** | `depends_on`, `assumes`, `requires` | Explain what must remain valid |
| **Boundary** | `constrains`, `excludes`, `rules_out`, `bounds_scope_of` | Explain how one claim limits another |
| **Refinement** | `refines`, `specializes`, `decomposes` | Explain how claims become more specific |
| **Verification** | `verifies`, `illustrates`, `disambiguates`, `counterexample_for`, `tested_by` | Connect intent to evidence |

The current relation vocabulary in the schema (`depends_on`, `derived_from`, `constrains`, `verifies`, `refines`) maps cleanly onto four of the five families. The two new candidates worth highlighting:

- **`illustrates`** and **`disambiguates`** (Verification family) — connect an `example` to the requirement, invariant, or decision it makes concrete.
- **`rules_out`** and **`counterexample_for`** (Boundary / Verification) — negative relations that connect a counterexample or constraint to the interpretations it eliminates.

### Negative edges

Intent is often clarified by ruling out plausible interpretations. Negative edges deserve first-class treatment:

```
Counterexample CE1:
  "Rejected review item appears in export."

CE1 violates Invariant I-review-authority.
Constraint C-no-fake-closure rules_out Requirement candidate "auto-export draft reviews".
```

Without negative edges, the graph captures only what we want; with them, the graph captures what we have *decided not to want*, which is often the harder-won knowledge.

## Edge schema and epistemic metadata

Every edge carries epistemic metadata so that inferred relations do not silently become false dependencies.

```ts
type KnowledgeEdge = {
  sourceId: KnowledgeItemId
  targetId: KnowledgeItemId
  relation: RelationKind
  family: RelationFamily
  support: 'explicit' | 'strong_inference' | 'weak_candidate'
  status: 'proposed' | 'accepted' | 'rejected' | 'stale'
  provenanceTurnId?: TurnId
  rationale?: string
  createdAt: timestamp
  updatedAt: timestamp
}
```

| Field | Purpose |
| --- | --- |
| `support` | How well the edge is grounded. `explicit` = stated by the user; `strong_inference` = LLM-derived from a clear textual signal; `weak_candidate` = speculative pattern match. |
| `status` | Lifecycle. `proposed` = pending review; `accepted` = active; `rejected` = considered and dismissed; `stale` = upstream changed and needs reconfirmation. |
| `provenanceTurnId` | The turn this edge was extracted from, when known. |
| `rationale` | Short user-legible explanation, especially for inferred edges. |

## Relation-policy registry

Not every visible graph edge should drive cascade, staleness, export explanation, criteria generation, or the same compact-context wording. The relation-policy registry assigns capabilities per relation, gated by edge `support` and `status`, and owns both operational directionality and endpoint-relative display labels. Code must not infer downstream/upstream impact or dependency/dependent wording from raw source/target coordinates alone.

| Axis | Meaning |
| --- | --- |
| `visible` | Render in graph view |
| `cascade` | Participate in cascade preview when source changes |
| `export_trace` | Appear in export rationale ("requirement R is here because of goal G") |
| `staleness` | Mark target as stale when source changes |
| `reconciliation` | Generate a `reconciliation_need` when source changes |
| `criteria_help` | Used by interviewer to suggest criteria for the target |
| `weak_suggestion` | LLM-only signal; never user-visible by default |
| `source_label` | Phrase used when rendering the edge from the source item's perspective. |
| `target_label` | Phrase used when rendering the same edge from the target item's perspective. |
| `source_change` / `target_change` | Which endpoint may require reconciliation when either endpoint changes. |

A row in the registry might say:

| Relation | Family | visible | cascade | export_trace | staleness | reconciliation | criteria_help | weak_suggestion |
| --- | --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `derived_from` | Justification | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `depends_on` | Dependency | ✓ | ✓ | — | ✓ | ✓ | — | — |
| `verifies` | Verification | ✓ | — | ✓ | ✓ | — | ✓ | — |
| `illustrates` | Verification | ✓ | — | ✓ | — | — | ✓ | — |
| `disambiguates` | Verification | ✓ | — | ✓ | — | — | ✓ | — |
| `rules_out` | Boundary | ✓ | ✓ | ✓ | — | ✓ | — | — |
| `related_to` *(catch-all)* | — | ✓ | — | — | — | — | — | ✓ |

The actual registry should evolve through corpus probes. The point is that **policy is per-relation, per-axis**, not a binary "this edge counts."

### Endpoint-relative labels for compact snapshots

Compact context snapshots need both readable directions for an edge. A single canonical triple is not enough when the snapshot is centered on either endpoint.

For an item-centered snapshot, relation policy should be able to render edges into buckets such as `dependencies` and `dependents` with phrases that make sense from the anchored item's perspective:

```text
X123: Lorem ipsum...
  dependents:
    constrains X200: Lorem ipsum...
    motivates X198: Lorem ipsum...
  dependencies:
    presumes X2: Lorem ipsum...
    is conditioned by X78: Lorem ipsum...
    proves X45: Lorem ipsum...
```

The bucket and phrase are relation-policy outputs, not string reversals. Some relations have natural canonical source-to-target wording (`constraint constrains requirement`), while others naturally point from a dependent claim to a premise (`decision assumes assumption`) or from an oracle to a claim (`criterion verifies requirement`). The registry must therefore store endpoint-relative labels and operational source-change/target-change behavior separately.

Neighborhood snapshots can be selected by task rather than by one universal radius:

- **Immediate adjacency** — all relation-policy-visible incident edges around the anchor; good default for side chat orientation.
- **Dependencies** — premises, constraints, assumptions, motivating goals, and evidence the anchor relies on; useful for “why does this item stand?” questions.
- **Dependents / impact** — claims likely to be affected if the anchor changes; useful for edit preview, cascade, and reconciliation.
- **Evidence** — examples, criteria, witnesses, counterexamples, and checkability context; useful for QA and verification discussion.
- **Reconciliation** — open needs, affected targets, source changes, and relation-policy rationale; useful for reconciliation chats.
- **Historical** — once changesets exist, the neighborhood around the changeset that originally captured an item or last updated it; useful for reviving the context in which a claim was made, not just its current graph surroundings.

Historical neighborhoods should be changeset-derived, not approximated from current graph order. Before the changeset ledger, snapshot builders should avoid pretending they can answer “what was around this item when it was captured?” with precision.

A relation policy row should support at least:

```ts
type RelationPolicy = {
  relation: RelationKind
  canonicalLabel: string
  sourceLabel: string
  targetLabel: string
  sourceRole: string
  targetRole: string
  sourceBucketForTargetSnapshot: 'dependencies' | 'dependents' | 'evidence' | 'contextual'
  targetBucketForSourceSnapshot: 'dependencies' | 'dependents' | 'evidence' | 'contextual'
  onSourceChange: 'affects_source' | 'affects_target' | 'affects_both' | 'none' | 'contextual'
  onTargetChange: 'affects_source' | 'affects_target' | 'affects_both' | 'none' | 'contextual'
}
```

The exact bucket enum can be narrower in implementation, but the invariant is that context packs and reconciliation never recover directionality from verb names alone.

## Edge-local neighborhoods

For LLM collaboration the most important practical change is to provide **edge-local neighborhoods**, not only grouped item lists. A neighborhood pack for one claim:

```
R17: Each phase exposes an explicit kickoff/frontier/recovery/handoff affordance.

Incoming:
  motivated_by  G2: avoid fake closure and stranded users
  constrained_by  C8: no generic task-planning surface
  derived_from  D94: phase progression is frontier-anchored

Outgoing:
  verified_by  K13: open phases bottom-load one visible artifact
  protected_by  I24: stream projection/hydration stability
  refined_by  R18: open interview phases default to kickoff/frontier/generation/recovery
```

This is a stronger context object than "all goals, all constraints, all requirements." It lets the interviewer and observer reason about consequences, gaps, and drift.

The `edge-local neighborhood` Lexicon entry in `memory/SPEC.md` already names this pattern; this section gives it concrete shape.

## Topology-driven question ranking

Once the graph carries kinds, subtypes, and typed edges, the interviewer can rank next questions by graph topology rather than by template.

Heuristics worth implementing first:

| Signal | Suggested question shape |
| --- | --- |
| `assumption` with high fanout (many depends_on edges out) and low confidence | "We're depending on the assumption that X. Do you want to validate it?" |
| `requirement` with no `verifies` incoming | "How will we know this requirement holds?" |
| `criterion` with no `verifies` outgoing target | "What does this criterion check? Which requirement or invariant?" |
| `decision` with no `rejected_alternatives` | "What did we consider and rule out before choosing this?" |
| Conflicting `constrains` edges into the same target | "These two constraints disagree about X. Which wins?" |
| `goal` with no derived requirements | "We've stated this goal but nothing in the spec ties to it. What would satisfy it?" |
| `requirement` with no `examples` and high external uncertainty | "What's a concrete case where this requirement would matter?" |

These heuristics complement the behavioral-kernel signal-phrase routing in [`BEHAVIORAL_KERNELS.md`](./BEHAVIORAL_KERNELS.md): kernels suggest *what kind* of question to ask; topology heuristics suggest *which item* to ask about next.

## Translation table

A useful contract for the observer and the interviewer: which user phrases map to which kind. This is the bridge between user vocabulary and ontology.

| User phrase pattern | Most likely kind |
| --- | --- |
| "always true that…" | `invariant` (state subtype) |
| "should never…" | `invariant` (state or transition) |
| "valid transition from X to Y" | `invariant` (transition) |
| "invalid input" | `criterion` (runtime_check) or `invariant` (data_integrity) |
| "for example, when…" | `example` (positive) |
| "but what about the case where…" | `example` (edge_case) |
| "we wouldn't want…" | `example` (negative / counterexample) or `constraint` |
| "another plausible interpretation is…" | `example` (disambiguates) |
| "if this happened it would be a serious bug" | `criterion` (high-priority verification target) |
| "we don't care about X" | `constraint` (non_goal) |
| "we picked Y over Z because…" | `decision` |

The observer should treat these as **strong priors**, not rigid rules. The classification rule above still governs final assignment.

## Progressive checkability binding

Every claim carries a `checkability` field describing the strongest oracle that currently witnesses it. The ladder, from weakest to strongest:

```
1. human_review        — a person reads it and judges
2. example             — a concrete witness (positive)
3. counterexample      — a concrete case ruled out (negative)
4. regression_test     — an automated test
5. runtime_contract    — a runtime assertion / pre/post condition
6. state_machine_rule  — a state or transition constraint enforced by the model
7. invariant           — a property model-checked over reachable states
8. proof_obligation    — a static proof in a verifier
```

Plus an explicit step beneath the ladder: `unresolved_ambiguity` — claims that are intentionally open.

The discipline is: **emit the weakest sufficient artifact for the claim at hand.** Some claims need only examples. Some deserve runtime assertions or property tests. Some should remain qualitative, but they should be marked honestly rather than laundered into fake precision.

A claim's record carries:

```ts
type Checkability =
  | 'human_review'
  | 'example'
  | 'counterexample'
  | 'regression_test'
  | 'runtime_contract'
  | 'state_machine_rule'
  | 'invariant'
  | 'proof_obligation'
  | 'unresolved_ambiguity'

type ClaimMetadata = {
  checkability: Checkability
  oracle?: string             // path to the test, contract, or proof
  strength: 'asserted' | 'example_backed' | 'tested' | 'enforced' | 'proved'
  validTraces?: string[]
  invalidTraces?: string[]
}
```

The `strength` field forces honesty: "checked on three examples" is not the same claim as "proved for all reachable states." A claim's `checkability` says *what kind* of witness exists; `strength` says *how broad* that witness is.

## Consumers of the typed graph

This ontology is the substrate for several near-term capabilities:

| Capability | Uses |
| --- | --- |
| Observer relation-first capture (existing, FE-639) | Kinds, edge schema, support/status, relation-policy registry |
| Cascade preview (existing, A48) | `cascade` axis on relation-policy registry |
| Reconciliation needs (active, Multi-chat substrate) | `reconciliation` axis; status transitions |
| Behavioral kernels (planned, FE-702 probes) | Kernel signals consume kinds and edges; emit invariants, examples, criteria |
| Candidate-spec assist (horizon) | Generates batches of typed claims with declared support and rationale |
| Architect / generator loop (horizon) | Same, plus proposes edges; HITL review through reconciliation |
| Spec drift detection (proposed) | Compares claim's `checkability` and `strength` to evidence in implementation |
| Export grounding (existing) | Uses `export_trace` axis to explain why each requirement is in the export |
| Topology-driven question ranking (proposed) | Reads kind + edge density + epistemic metadata to suggest next questions |

## Open questions

- **`Property` as a shared primitive.** The synthesis proposes a `Property` record that requirements *commit to* and criteria *observe*, factoring out a many-to-many relationship instead of pairing them by paraphrase. Worth prototyping but not committed; the current document treats requirements and criteria as directly linked through `verifies`. (See `memory/SPEC.md` Lexicon entry for `property *(candidate ontology)*`.)
- **Subtypes vs. top-level kinds.** Have we picked the right split? `non_goal` could be its own top-level kind rather than a constraint subtype. The argument against is that nine top-level kinds is already at the edge of what users can hold in their heads.
- **Edge support thresholds.** When does `weak_candidate` become `strong_inference`? Should this be a number of corroborating signals, an LLM-emitted confidence, or a human review?
- **Relation-policy registry granularity.** One relation, all kinds vs. one relation per source-kind / target-kind pair? The latter is more precise but explodes combinatorially.
- **Migration of existing edges.** The current schema's edges have no `support`, `status`, `family`, or `rationale` field. Backfill to `support: explicit, status: accepted` for existing edges, or treat them all as `strong_inference` until reviewed?
- **Where the `Checkability` field actually lives.** On the claim itself (denormalized), on a `verification` join table, or both?
- **Observer abstention thresholds.** What classification confidence is needed to emit a kind? Today's observer is conservative; the typed ontology may let it be more confident in some cases (clear "should never" → invariant) and less confident in others (decision-capture criteria are strict).

## References

- [`INTENT_SPEC_EVOLUTION.md`](../archive/design/INTENT_SPEC_EVOLUTION.md) §3 (shared claims), §4 (knowledge edges), §6 (ambiguity-targeted disambiguation), §11 (persistence model).
- [`BEHAVIORAL_KERNELS.md`](./BEHAVIORAL_KERNELS.md) — kernels generate the questions; this document defines what their answers become.
- `memory/SPEC.md` Requirement 38 (invariant + example as kinds), Requirement 30 (relation-first observer), I109 (compact existing-knowledge anchors), Lexicon entries for `intent graph`, `progressive checkability`, `behavioral kernel`, `edge-local neighborhood`, `property *(candidate)*`, `invariant *(planned)*`, `example *(planned)*`.
- `memory/PLAN.md` item 3 (FE-700) — the active frontier item this document expands.
