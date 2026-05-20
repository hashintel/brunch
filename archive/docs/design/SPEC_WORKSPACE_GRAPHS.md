# Spec Workspace Graphs — Intent, Oracle, Design, and Plan

> Status: **working design proposal**.
> Date: 2026-05-18.
> Scope: product-layer graph architecture for Brunch follow-on work after spec elicitation: verification/oracle strategy, technical design decomposition, planning decomposition, and future agentic orchestration.
>
> Authority: this is a design capture, not canonical planning state. Promote accepted conclusions into `memory/SPEC.md` and `memory/PLAN.md` through `ln-spec` / `ln-plan` before treating them as roadmap commitments.
>
> Companions: [`INTENT_GRAPH_SEMANTICS.md`](./INTENT_GRAPH_SEMANTICS.md), [`BEHAVIORAL_KERNELS.md`](./BEHAVIORAL_KERNELS.md), [`CONVERSATIONAL_WORKSPACE_RUNTIME.md`](./CONVERSATIONAL_WORKSPACE_RUNTIME.md), and [`ln-skills/EVOLUTION.md`](./ln-skills/EVOLUTION.md) for the parallel dev-layer workflow analogy.

## 1. Product motivation

Brunch currently centers on an **intent graph**: typed nodes and semantic edges that capture the items constituting a specification. Several major product horizons extend beyond initial spec elicitation:

1. **Validation and verification strategy** — analogous to the current `ln-oracles` workflow: analyze requirements, invariants, assumptions, decisions, and criteria, then propose the verification strategy that should support them.
2. **Technical design / decomposition** — analogous to `ln-design`: identify modules, interfaces, seams, and adapters that keep implementation deep, local, and testable.
3. **Spec-to-plan decomposition** — analogous to `dev-plan` / `ln-plan`: decompose intent, design, and oracle strategy into tracer-bullet / walking-skeleton slices that establish invariants end-to-end.
4. **Future agentic orchestration** — carry plan structure forward into implementation, dynamically updating graph state as work proceeds.

The core architectural conclusion is that these should not all be collapsed into the existing intent graph. Instead, Brunch should grow from one graph into a **spec workspace** with four trace-connected graph planes.

```text
intent-graph
oracle-graph
design-graph
plan-graph
```

The intent graph remains the canonical graph of specification meaning. The other graphs are durable downstream work-product graphs accountable to the intent graph and to one another.

## 2. Conceptual model

### 2.1 Four graph planes

```text
intent_node
  Canonical typed claims about the specification.

oracle_node
  Verification strategies and checks that operationalize criteria and protect intent.

design_node
  Modules, interfaces, seams, and adapters that realize intent through deep architecture.

plan_node
  Milestone/frontier/slice progress claims for delivery and future orchestration.
```

Each plane has domain-specific node kinds and statuses. Edges, however, should converge through a shared semantic edge system and relation-policy registry.

### 2.2 Source-of-truth rule

Only the **intent graph** says what the specification means.

Oracle, design, and plan graphs are first-class durable work products, but they are accountable projections from intent and from each other. They can feed discoveries back into the intent graph when they expose missing claims, contradictions, durable decisions, or new constraints.

### 2.3 Criteria remain intent nodes

A `criterion` remains an `intent_node`. It is the spec-level statement of acceptable evidence or judgment.

An `oracle_node` does not replace a criterion. It operationalizes criteria.

```text
criterion intent_node:
  "Stale proposals are rejected when semantic state advances."

oracle check node:
  "Stale proposal integration check."

semantic_edge:
  oracle check --verifies--> criterion
```

This prevents verification strategy from becoming a divergent source of truth. The criterion says **what would count as evidence**; oracle nodes say **how evidence is produced**.

## 3. Node kinds

Use moderate node kinds and precise relation kinds. Node kind answers: **what kind of thing is this?** Relation kind answers: **what claim connects these things?**

### 3.1 Intent node kinds

The current FE-700 direction remains the baseline:

```ts
type IntentNodeKind =
  | "goal"
  | "context"
  | "constraint"
  | "assumption"
  | "decision"
  | "requirement"
  | "invariant"
  | "criterion"
  | "example"
  | "term" // lexical/transitional if retained
```

Intent nodes are normally claim-like: their titles should state compact propositions.

### 3.2 Oracle node kinds

Because all oracle nodes are verification-oriented, do not prefix kinds with `verification_`.

```ts
type OracleNodeKind =
  | "strategy"
  | "check"
```

- `strategy` — a verification approach or evidence-production pattern, e.g. property-based testing, manual UX walkthrough, LLM-as-user probe, golden transcript fixture strategy.
- `check` — a specific planned or implemented evidence-producing activity.

Do not introduce a `result` node initially. Raw run results, logs, screenshots, transcripts, and failure reports belong to implementation/result storage, not the oracle graph. A result may later be promoted into a reusable fixture, but fixture promotion is a separate decision.

A future `fixture` oracle node may be justified only when a fixture has independent lifecycle, reuse, review status, or staleness impact. Fixture creation itself is normally a plan-graph concern.

### 3.3 Design node kinds

The design graph uses architecture vocabulary from deep-module/interface/seam thinking. It is not a file graph.

```ts
type DesignNodeKind =
  | "module"
  | "interface"
  | "seam"
  | "adapter"
```

Definitions:

- `module` — anything with an interface and implementation; scale-agnostic.
- `interface` — everything a caller must know to use the module correctly: types, invariants, ordering, error modes, configuration, performance characteristics.
- `seam` — where an interface lives; a place behavior can be altered without editing in place.
- `adapter` — a concrete thing satisfying an interface at a seam.

Files/classes/functions may attach as implementation references, but they should not define the graph. A code artifact earns design-node identity only when it carries architectural intent: leverage, locality, dependency control, or a seam.

A useful rule from the architecture skill applies:

> One adapter = hypothetical seam. Two adapters = real seam.

Adapters become first-class design nodes when variation across the seam matters, e.g. JSONL adapter, fake-process adapter, and future MCP adapter.

### 3.4 Plan node kinds

```ts
type PlanNodeKind =
  | "milestone"
  | "frontier"
  | "slice"
```

Plan nodes are **fractal slices**. The difference between milestone, frontier, and slice is scale, not kind.

- `milestone` — a roadmap-scale slice of progress.
- `frontier` — a scoped work item that establishes a stable capability or invariant bundle.
- `slice` — a thin cross-plane execution unit, ideally tracer-bullet / walking-skeleton shaped.

Each plan node stakes a progress claim and has an evidence path. Smaller plans may use only frontier + slice.

## 4. Shared node content shape

Start with a shared minimal node shape plus optional kind-specific payload.

```ts
type BaseNode = {
  id: string
  nodeType: "intent_node" | "oracle_node" | "design_node" | "plan_node"
  nodeKind: string
  title: string
  summary?: string
  provenance?: NodeProvenance
  payload?: unknown
}
```

`title` is always required. Many compact context packs may use only titles plus relation labels. `summary` is optional globally but may be required by particular workflows or node kinds.

### 4.1 Title discipline

A node title must be context-pack usable: compact, specific, and reasonably meaningful in a neighborhood summary.

Good:

```text
Only accepted changesets mutate semantic truth
JSONL adapter satisfies agent transport seam
Secondary chats persist across reload
```

Weak:

```text
Mutation rule
Adapter
Reload
```

### 4.2 Claim-like vs noun-like titles

- Intent nodes are claim-like.
- Plan nodes are intent-like progress claims.
- Oracle and design nodes may be noun-like artifacts.

Plan nodes should carry a `claim` field at least for milestone/frontier.

```ts
type PlanNodePayload = {
  claim?: string // required for milestone/frontier, optional for slice
  definitionOfDone?: string // augmentative prose, not the primary structure
}
```

For a slice, `claim` may be extra ceremony if title + trace edges + acceptance criteria already make the claim obvious. For milestones and frontiers, the claim is essential.

Oracle/design nodes can use noun-like titles with structured fields:

```ts
type OracleCheckPayload = {
  expectedObservation?: string
  targetScope?: string
}

type DesignModulePayload = {
  responsibility?: string
  interfaceSummary?: string
  hiddenImplementation?: string
}
```

## 5. Provenance and proposal handling

### 5.1 Near-term: persist accepted nodes only

Current Brunch flows do not persist proposed graph nodes separately from accepted nodes. Candidate items live in memory or turn artifacts and are persisted only if accepted.

Near-term rule:

> If a node is persisted in a graph table, it is canonical/accepted by default.

Do not add a persisted `acceptance_state` until product flows need reloadable open proposals, rejected alternatives, proposal comparison, or agent reconciliation over non-canonical nodes.

### 5.2 Proposal artifacts and overrides

Generated alternatives, rejected proposals, and candidate bundles can remain as turn artifacts or proposal payloads. However, accepted nodes should preserve enough compact provenance to retrace important proposal/override logic.

This is analogous to decision capture: a true decision should record chosen option, rejected alternatives, and rationale. An override/assertion is different: it records that the system proposed one thing and the user asserted another.

```ts
type NodeProvenance = {
  origin: "user" | "agent" | "imported" | "derived"
  sourceTurnId?: string
  rationale?: NodeRationale
}

type NodeRationale =
  | DecisionRationale
  | OverrideRationale
  | NoteRationale

type DecisionRationale = {
  kind: "decision"
  chosenOption: string
  rejectedAlternatives: Array<{
    label: string
    summary?: string
    rejectionReason?: string
  }>
  rationale?: string
  consequences?: string
}

type OverrideRationale = {
  kind: "override"
  proposedSummary: string
  acceptedAssertion: string
  overrideReason?: string
  preserveIntent?: string
}

type NoteRationale = {
  kind: "note"
  text: string
}
```

Example oracle override:

```text
Proposed:
  Property-based transition testing.

Accepted assertion:
  Three hand-authored scenario fixtures are sufficient for now.

Override reason:
  Property-based test setup is too expensive until the state model stabilizes.

Preserve intent:
  Prefer bounded fixture coverage over generative coverage unless risk increases.
```

The full proposal remains in the transcript/turn artifact; the accepted node stores compact rationale for future reconciliation.

## 6. Status and implementation state

Canonicality and implementation/execution state are separate concerns. Because near-term persisted nodes are canonical by default, do not store `acceptance_state` yet. Store or infer domain status instead.

### 6.1 Intent status

Intent nodes may carry validation status as the product ontology matures.

```ts
type IntentValidationStatus =
  | "open"
  | "validated"
  | "invalidated"
```

### 6.2 Oracle status

Oracle graph tracks lightweight implementation availability/status, but not raw result history.

```ts
type OracleImplementationStatus =
  | "not_implemented"
  | "planned"
  | "implemented"
  | "passing"
  | "failing"
  | "flaky"
  | "retired"
```

The oracle graph should let an agent know whether a check is merely recommended, actually available, passing/failing/flaky, or retired. Raw runs/results live elsewhere.

### 6.3 Design status

Design graph tracks lightweight implementation status without becoming a file inventory.

```ts
type DesignImplementationStatus =
  | "not_implemented"
  | "planned"
  | "partially_implemented"
  | "implemented"
  | "retired"
```

### 6.4 Inferred vs declared status for oracle/design

Plan nodes are the execution carriers. Completing plan nodes should inform oracle/design implementation state.

Design/oracle nodes should support:

```ts
type ImplementationStatusProjection<TStatus> = {
  inferredStatus: TStatus
  declaredStatus?: TStatus
  effectiveStatus: TStatus // declaredStatus ?? inferredStatus
  statusBasis?: Array<StatusEvidenceRef>
}
```

- `inferredStatus` derives from graph traces, completed plan nodes, implementation evidence, and later test telemetry.
- `declaredStatus` is a user/agent assertion for imported reality or manual correction.
- `effectiveStatus` is what UI/context uses.

If no completed plan/evidence points to a design/oracle node, its inferred status is `not_implemented`.

Example:

```text
design_node D1:
  Agent transport seam

P1 --introduces_design--> D1
P1 --exercises_design--> D1

If P1 is not done:
  inferredStatus = not_implemented

If P1 is done:
  inferredStatus = partially_implemented or implemented_minimal

If user asserts prior implementation:
  declaredStatus = implemented
```

### 6.5 Plan status

Plan node execution status is primarily declared for now. Tooling may suggest updates, but completion should remain explicit because a plan node stakes a claim.

```ts
type PlanExecutionStatus =
  | "not_started"
  | "active"
  | "done"
  | "blocked"
  | "deferred"
  | "retired"
```

A future orchestration harness may infer suggested statuses from git/CI/artifacts, but near-term `plan_node.executionStatus` should be declared by user/agent/harness.

## 7. Semantic edges and relation policy

### 7.1 Shared semantic edge system

Use domain-specific node tables/concepts, but a shared semantic edge system.

```text
intent_node
oracle_node
design_node
plan_node
        \        |        /
         \       |       /
          shared semantic_edge
                  |
           relation_policy
                  |
          derived impact_index
```

Conceptual edge shape:

```ts
type SemanticEdge = {
  id: string
  source: NodeRef
  target: NodeRef
  relationKind: RelationKind
  provenance?: NodeProvenance
}

type NodeRef =
  | { nodeType: "intent_node"; nodeKind?: IntentNodeKind; nodeId: string }
  | { nodeType: "oracle_node"; nodeKind?: OracleNodeKind; nodeId: string }
  | { nodeType: "design_node"; nodeKind?: DesignNodeKind; nodeId: string }
  | { nodeType: "plan_node"; nodeKind?: PlanNodeKind; nodeId: string }
```

In code, `SemanticEdge` should be represented as a discriminated union by `relationKind`, not merely by `source.nodeType`, because the same source type can support multiple distinct edge types.

Example:

```ts
type OracleVerifiesCriterionEdge = {
  relationKind: "oracle.verifies_criterion"
  source: { nodeType: "oracle_node"; nodeKind: "check"; nodeId: string }
  target: { nodeType: "intent_node"; nodeKind: "criterion"; nodeId: string }
}

type DesignSatisfiesInterfaceEdge = {
  relationKind: "design.satisfies_interface"
  source: { nodeType: "design_node"; nodeKind: "adapter"; nodeId: string }
  target: { nodeType: "design_node"; nodeKind: "interface"; nodeId: string }
}

type PlanEstablishesIntentEdge = {
  relationKind: "plan.establishes_intent"
  source: { nodeType: "plan_node"; nodeKind: "milestone" | "frontier" | "slice"; nodeId: string }
  target: { nodeType: "intent_node"; nodeId: string }
}
```

### 7.2 Relation policy

Relation policy owns endpoint typing, labels, impact derivation, context/export visibility, and completion gating.

```ts
type RelationPolicy = {
  relationKind: RelationKind
  family: "intent" | "oracle" | "design" | "plan" | "trace"
  allowedSource: NodeTypeConstraint
  allowedTarget: NodeTypeConstraint
  sourceToTargetLabel: string
  targetToSourceLabel: string
  impactOnSourceChange?: ImpactRule
  impactOnTargetChange?: ImpactRule
  completionRole?: "gating" | "context"
  exportVisibility?: "include" | "omit" | "summary_only"
  contextPackVisibility?: "include" | "omit" | "summary_only"
}
```

Prefer relation-kind defaults for completion gating rather than per-edge overrides. If exceptions become necessary later, edge-level roles can be added then.

### 7.3 Relation vocabulary: families + specific kinds

Use relation families plus precise relation kinds. A tiny generic relation set is too lossy; fully ad hoc graph-specific relations will sprawl.

Candidate families and kinds:

```text
intent.*
  intent.depends_on
  intent.derived_from
  intent.refines
  intent.constrains
  intent.verifies

oracle.*
  oracle.instantiates_strategy
  oracle.verifies_criterion
  oracle.guards_intent
  oracle.tests_assumption
  oracle.uses_example
  oracle.complements
  oracle.supersedes

design.*
  design.exposes_interface
  design.interface_lives_at_seam
  design.satisfies_interface
  design.realizes_intent
  design.preserves_intent
  design.depends_on
  design.hides_implementation_detail
  design.supersedes

plan.*
  plan.contains
  plan.depends_on
  plan.establishes_intent
  plan.introduces_design
  plan.exercises_design
  plan.extends_design
  plan.retires_design
  plan.implements_oracle
  plan.verified_by_oracle
  plan.retires_risk
  plan.motivated_by_intent
  plan.references_design
```

Names can be refined, but the principle is stable: relation names should be precise enough that relation policy can determine labels, impact, and gating without requiring edge-level exceptions.

## 8. Derived operational impact index

Semantic edges should remain the source of truth. Do not make all graph edges impact-oriented.

However, impact traversal is product-central for staleness, reconciliation, context refresh, cascade preview, and future agent loading. Therefore a derived operational index is likely useful.

```text
semantic graph edges
  -> relation policy
  -> derived impact index
  -> cascade preview / reconciliation / context refresh / agent loading
```

Conceptual shape:

```ts
type ImpactIndexEntry = {
  cause: NodeRef
  impacted: NodeRef
  impactKind:
    | "mark_stale"
    | "review_needed"
    | "coverage_changed"
    | "completion_affected"
    | "context_refresh_needed"
  sourceEdgeId: string
  confidence?: "high" | "medium" | "low"
}
```

Why not impact-first edges?

- Not all semantic relations have one clean impact direction.
- Impact is not the only traversal question; explanation, provenance, export, and context all need semantic meaning.
- Semantic relation determines the kind of impact.
- Optimizing source edges around one traversal algorithm risks losing product meaning.

Use semantic source edges plus relation policy; materialize impact as a read-model/index if needed.

## 9. Oracle graph semantics

### 9.1 Strategy vs check

Oracle graph contains at least two levels:

```text
strategy -> check -> criterion / invariant / assumption / example
```

A strategy is a family/pattern of evidence production:

```text
Property-based transition testing
Manual UX walkthrough
Golden transcript fixture strategy
LLM-as-user probe
Runtime assertion
Graph-review rubric
```

A check is a specific planned or implemented evidence-producing activity:

```text
Stale proposal integration check
Reload persistence manual walkthrough
LLM-as-user brownfield incremental feature probe
```

Example:

```text
intent_node C1:
  Stale proposal behavior is correctly enforced.

oracle_node S1:
  State-machine/property testing strategy.

oracle_node O1:
  Property test over proposal base changeset transitions.

semantic_edges:
  O1 --instantiates_strategy--> S1
  O1 --verifies_criterion--> C1
  O1 --guards_intent--> invariant I4
```

Specific checks own authoritative coverage. Strategies may carry default or suggested coverage, but accepted checks are what verify criteria and guard intent.

### 9.2 Oracle graph boundary

Oracle graph owns:

- strategy: what kind of evidence is needed
- check: what specific evidence-producing activity should exist or exists conceptually
- coverage: which criteria/invariants/assumptions/examples the check protects
- blind spots, confidence, cost, loop tier
- lightweight implementation availability/status

Plan graph owns:

- slices that create fixtures
- slices that implement tests/checks
- slices that run manual walkthroughs
- slices that promote selected artifacts into reusable fixtures

Implementation/result storage owns:

- raw test runs
- logs
- screenshots
- generated transcripts
- failure reports

## 10. Design graph semantics

The design graph should support decomposition to planning by representing durable architectural orientation, not code inventory.

### 10.1 Essential design triangle

```text
module exposes interface
interface lives_at seam
adapter satisfies interface
```

Modules hide implementation details and create depth. Interfaces are the test surface. Seams identify where behavior can vary. Adapters are concrete satisfiers at seams.

### 10.2 Example

Intent:

```text
Requirement: Agents can drive Brunch through a local JSONL capability CLI.
Invariant: Agents may not mutate durable state through ORM access.
Decision: Agent writes route through Brunch-owned mutation handlers.
```

Design graph:

```text
design_node M1: Agent capability runtime module
design_node I1: Capability contract interface
design_node S1: Agent transport seam
design_node A1: JSONL stdin/stdout adapter
design_node A2: fake-process adapter

design edges:
  M1 exposes I1
  I1 lives_at S1
  A1 satisfies I1
  A2 satisfies I1

cross-plane semantic edges:
  M1 realizes requirement R1
  I1 preserves invariant I1
```

A file such as `src/server/agent/capabilities.ts` may be an implementation reference, not necessarily a design node.

## 11. Plan graph semantics

### 11.1 Plan nodes as fractal slices

Plan nodes stake progress claims at different scales.

```text
Milestone claim:
  Scenario acceleration is safe enough for product-facing use.

Frontier claim:
  Candidate bundle acceptance preserves semantic truth through changesets.

Slice claim:
  Accepting one coherent candidate bundle writes one atomic changeset and updates latest semantic state.
```

The plan graph is a fourth durable graph plane because it must preserve user-authored sequencing judgment, status, dependency structure, and eventually support agentic orchestration.

### 11.2 Cross-plane slicing

A slice is not just one requirement, module, or test. It is a cross-plane bundle:

```text
slice establishes intent claim(s)
slice introduces/exercises design node(s)
slice implements or is verified by oracle check(s)
slice retires a risk or assumption
```

The first slice inside a frontier should usually prefer tracer-bullet / walking-skeleton shape:

> the smallest end-to-end path through intent + design + oracle that proves an architectural seam and establishes a real invariant.

### 11.3 Build-out progression

A frontier can progress through:

1. **Tracer bullet / walking skeleton** — thinnest end-to-end proof.
2. **Coverage expansion slices** — broaden intent coverage, examples, checks, adapters, and module responsibilities.
3. **Negative / hard-case slices** — retire known risks: stale state, invalid input, concurrency, permissions, failure modes.
4. **Integration / cutover slices** — replace old paths, retire duplicate surfaces, converge DTOs, delete stale fixtures.
5. **Hardening / observability slices** — diagnostics, logs, test builders, manual walkthroughs, performance/usability checks.

### 11.4 Definition of done

`plan_node.definitionOfDone` is an optional prose augmentation. The primary completion structure comes from trace edges.

A plan node is done when:

1. Required child plan nodes are done or explicitly descoped.
2. Required intent targets are established or preserved.
3. Required design targets are implemented/stable enough.
4. Required oracle targets are implemented/passing or manually satisfied.
5. Optional prose definition of done is satisfied.
6. Residual risks are accepted, retired, or deferred.

Relation kind determines whether an edge participates in completion gating. Do not add per-edge gating overrides until relation vocabulary proves insufficient.

## 12. Directionality and plan-driven implementation status

Plan nodes are the things implemented and marked done. Design/oracle implementation statuses are derived or reconciled from plan completion and evidence.

Plan-to-design relations describe what completion of the plan node means for the design node:

```text
plan.introduces_design
  If this plan node is completed, the design node now exists at least minimally.

plan.exercises_design
  If this plan node is completed, the design node has been proven through an end-to-end path.

plan.extends_design
  If this plan node is completed, the design node gains broader capability or coverage.

plan.retires_design
  If this plan node is completed, the design node should be retired or superseded.
```

A tracer-bullet slice may both introduce and exercise a seam:

```text
P1 --introduces_design--> D1
P1 --exercises_design--> D1
```

Plan completion is the primary implementation event; design/oracle statuses are projections or reconciled summaries.

## 13. Open questions and deferred concerns

This design intentionally stops before over-specifying uncertain areas.

Deferred:

- Persisted proposal lifecycle for non-canonical nodes.
- Rejected proposal nodes as first-class graph entities.
- Fixture nodes in the oracle graph.
- Raw result storage and telemetry integration.
- Full archival/deactivation/soft-delete semantics across all graph planes.
- Agentic orchestration harness schema and update policy.
- Whether physical storage uses one edge table or multiple tables behind a shared relation policy.
- Exact relation vocabulary and endpoint constraints.

Known future pressure:

- Graph items will need a retirement/archival path as implementation embeds or satisfies them.
- Plan graph items need completion status now and richer implementation evidence later.
- Context packing for coding agents will need active-context policies so fully satisfied or archived items do not overload agent prompts.
- Future orchestration may suggest plan status changes from git/CI/artifacts, but plan completion should remain explicit until trust is established.

## 14. Summary of accepted design conclusions

1. Brunch should grow from one intent graph into four trace-connected graph planes: intent, oracle, design, and plan.
2. Criteria remain intent nodes; oracle nodes operationalize criteria rather than replacing them.
3. Oracle graph starts with `strategy` and `check`; no `result` node initially.
4. Design graph represents modules, interfaces, seams, and adapters, not files/classes as such.
5. Plan graph contains fractal progress-claim nodes: milestone, frontier, slice.
6. Persisted graph nodes are canonical/accepted near-term; proposals remain turn artifacts until accepted.
7. Accepted nodes can carry lightweight provenance/rationale, including decision-style rationale or override/assertion rationale.
8. Nodes use a shared minimal content shape: title, optional summary, provenance, optional typed payload.
9. Intent and plan nodes are claim-like; oracle/design nodes may be noun-like.
10. Domain-specific node concepts should share one semantic edge system and relation-policy registry.
11. `SemanticEdge` should be a discriminated union by `relationKind`.
12. Relation vocabulary should use families plus precise relation kinds.
13. Semantic edges are source of truth; derived impact index is an operational read model.
14. Design/oracle statuses have inferred and declared layers; plan execution status is primarily declared.
15. Plan completion drives inferred/reconciled implementation status for design/oracle nodes.
