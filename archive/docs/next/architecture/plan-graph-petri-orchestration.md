# Plan-Graph Petri Orchestration

> Status: speculative design note.
> Date: 2026-05-18.
> Inputs: `docs/design/SPEC_WORKSPACE_GRAPHS.md` and the Petri-net basic orchestration demo.
> Purpose: explore how a Brunch `plan-graph` can hand off executable work to a Petri-net-based orchestrator without collapsing semantic completion into mechanical completion.

## 1. Thesis

A Brunch `plan-graph` should remain the semantic source of planning truth. A Petri net should be an executable/read-model projection of one active plan subtree: usually a frontier, slice, or small slice cluster.

```text
intent/oracle/design/plan graphs + relation policy
  -> compile active plan subtree
  -> typed Petri execution net
  -> execution events, evidence refs, status suggestions
  -> Brunch graph reconciliation / explicit status declaration
```

The Petri net is valuable because it makes execution state, concurrency, resource constraints, retries, blocking, and terminal markings explicit. The Brunch graphs are valuable because they preserve why the work matters and what evidence counts as completion.

The critical design pressure is this:

> A token reaching `Done` is not the same thing as the plan claim being semantically established.

Therefore speculative nets should model both mechanical execution and semantic completion.

## 2. Layer split

### 2.1 Mechanical layer

Mechanical execution answers: what has been dispatched, produced, run, verified, blocked, or retried?

Example mechanical places:

```text
PlanSliceSelected
ContextPackReady
ImplementationInProgress
CodeArtifactReady
TestArtifactReady
TestReportReady
VerifyPassed
BranchReady
TaskBlocked
TaskAbandoned
```

Example mechanical transitions:

```text
BuildContextPack
DispatchImplementation
ImplementationDone
RunInnerLoop
RunGateVerify
OpenPullRequest
RetryFix
AbandonAfterMaxRetries
```

### 2.2 Semantic layer

Semantic completion answers: has this evidence established the intended plan claim against current intent/design/oracle state?

Example semantic places:

```text
GraphRevisionCurrent
IntentTargetsCurrent
OracleSatisfied
DesignIntroduced
DesignExercised
RiskRetired
RiskAccepted
CompletionClaimReviewed
CompletionClaimAccepted
PlanDoneAccepted
```

Example semantic transitions:

```text
AssessOracleSatisfaction
AssessDesignExercised
AssessIntentEstablished
ReviewResidualRisk
ReviewCompletionClaim
DeclarePlanDone
MarkSemanticReviewNeeded
```

Mechanical transitions produce candidate evidence. Semantic transitions judge whether that evidence satisfies the graph-derived requirements.

```text
RunTests -> TestReportReady
AssessOracleSatisfaction -> OracleSatisfied
```

A test report is not itself oracle satisfaction. It becomes oracle satisfaction only if it maps to the required oracle node, was run against the right artifact and graph revision, and satisfies the relation-policy-derived gate.

## 3. Token taxonomy

### 3.1 Resource tokens

Resource tokens model scarce or permissioned executors.

```text
CodingAgentAvailable(agentId)
ReviewAgentAvailable(agentId)
HumanReviewerAvailable(userId)
BrowserHarnessAvailable(harnessId)
GraphWriteCapabilityAvailable(scope)
CIRunnerAvailable(runnerId)
```

These prevent the net from pretending that every transition can always run.

### 3.2 Context and revision tokens

```text
ContextPackReady(planNodeId, contextPackRef, graphRevision)
GraphRevisionCurrent(graphRevision)
GraphRevisionStale(graphRevision)
SemanticReviewNeeded(planNodeId, staleRevision, currentRevision)
```

Every meaningful evidence-producing token should carry the graph revision it was derived from. Semantic transitions require current revision, or else route to reconciliation.

### 3.3 Artifact and evidence tokens

```text
CodeArtifactReady(planNodeId, artifactRef, graphRevision)
TestReportReady(planNodeId, reportRef, status, graphRevision)
OracleEvidenceReady(oracleNodeId, evidenceRef, graphRevision)
DesignEvidenceReady(designNodeId, evidenceRef, graphRevision)
PlanEvidenceBundleReady(planNodeId, evidenceRefs, graphRevision)
```

Raw logs, screenshots, transcripts, and test reports should live in an artifact/evidence store. Tokens carry stable refs.

### 3.4 Semantic satisfaction tokens

```text
OracleSatisfied(planNodeId, oracleNodeId, evidenceRef)
DesignIntroduced(planNodeId, designNodeId, evidenceRef)
DesignExercised(planNodeId, designNodeId, evidenceRef)
IntentEstablished(planNodeId, intentNodeId, evidenceRefs)
RiskRetired(planNodeId, riskRef, evidenceRef)
RiskAccepted(planNodeId, riskRef, acceptedBy, rationaleRef)
CompletionClaimAccepted(planNodeId, acceptedBy, rationaleRef)
PlanDoneAccepted(planNodeId)
```

These tokens are judgment-bearing. Some can be produced by deterministic checks; others may require review agents or humans.

## 4. Canonical slice-net template

A speculative Brunch slice subnet can be organized into four coupled lanes.

```text
Mechanical lane:
  SliceSelected
    -> ContextPackReady
    -> ImplementationInProgress
    -> CodeArtifactReady
    -> TestReportReady
    -> VerifyPassed

Oracle lane:
  RequiredOracleKnown
    -> OracleEvidenceReady
    -> OracleSatisfied

Design lane:
  RequiredDesignKnown
    -> DesignEvidenceReady
    -> DesignIntroduced / DesignExercised

Semantic lane:
  IntentTargetsCurrent
    -> IntentEstablished
    -> CompletionClaimAccepted
    -> PlanDoneAccepted
```

The terminal transition joins the lanes.

```text
DeclarePlanDone consumes:
  VerifyPassed(planNodeId)
  IntentEstablished(planNodeId, ...)
  OracleSatisfied(planNodeId, requiredOracleIds...)
  DesignIntroduced/DesignExercised(planNodeId, requiredDesignIds...)
  RiskRetired or RiskAccepted for required risks
  GraphRevisionCurrent(graphRevision)
  CompletionClaimAccepted(planNodeId)

DeclarePlanDone produces:
  PlanDoneAccepted(planNodeId)
  StatusProjectionSuggested(planNodeId, targetRefs)
```

Near-term, `PlanDoneAccepted` should suggest or support a declared plan status change. It should not silently become canonical truth unless the workflow explicitly grants that authority.

## 5. Relation-policy compilation

The workspace graph relation policy can compile semantic edges into Petri-net requirements.

| Relation kind | Possible Petri-net requirement |
|---|---|
| `plan.depends_on` | prerequisite token or guard before `SliceSelected` / `BuildContextPack` |
| `plan.establishes_intent` | require `IntentEstablished(planNodeId, intentNodeId)` before done |
| `plan.introduces_design` | require `DesignIntroduced(planNodeId, designNodeId)` before done |
| `plan.exercises_design` | require `DesignExercised(planNodeId, designNodeId)` before done |
| `plan.implements_oracle` | require oracle implementation/evidence-producing branch |
| `plan.verified_by_oracle` | require `OracleSatisfied(planNodeId, oracleNodeId)` before done |
| `plan.retires_risk` | require `RiskRetired` or explicit accepted deferral |

This makes Petri simulation a planning oracle: if relation policy says an edge is gating, then `PlanDoneAccepted` should be unreachable unless the corresponding semantic token can be produced.

## 6. Transition contracts

The Petri structure alone is not enough. Each transition needs a typed execution contract.

```ts
type TransitionContract = {
  transitionId: string
  kind: "mechanical" | "semantic" | "review" | "status_projection"
  actor?: "coding_agent" | "review_agent" | "human" | "tool" | "orchestrator"
  consumes: Array<TokenSchemaRef>
  produces: Array<TokenSchemaRef>
  guard?: GuardSpec
  action?: CapabilityBinding
  idempotencyKey?: string
  timeout?: string
  retryPolicy?: RetryPolicy
  cancellationPolicy?: CancellationPolicy
  emits: Array<EventSchemaRef>
}
```

Important contract fields:

- **guard** — checks graph revision, required relation-policy gates, artifact status, resource availability.
- **action** — binds transition to a Brunch capability, shell command, agent task, browser/manual harness, or no-op semantic assessment.
- **idempotency key** — prevents duplicate graph writes, duplicate PR creation, duplicate test dispatch, etc.
- **events** — durable replayable records for Brunch reconciliation.

## 7. Event model

The orchestrator should emit structured events rather than only final markings.

```text
transition_enabled
transition_fired
task_dispatched
task_completed
artifact_produced
oracle_passed
oracle_failed
design_exercised
graph_revision_stale
semantic_review_requested
completion_claim_accepted
status_projection_suggested
status_declared
transition_blocked
net_deadlocked
```

These events support audit, resumption, visualization, and graph reconciliation.

## 8. Failure-mode nets

### 8.1 Stale graph during execution

Scenario:

```text
ContextPackReady(P1, G42)
ImplementationInProgress(P1, G42)
Graph advances to G43
CodeArtifactReady(P1, G42)
```

Transition:

```text
DetectStaleGraph consumes:
  CodeArtifactReady(P1, G42)
  GraphRevisionCurrent(G43)

guard:
  G42 != G43

produces:
  GraphRevisionStale(G42)
  SemanticReviewNeeded(P1, G42, G43)
```

Completion remains blocked until either:

```text
ReconcileArtifactsToCurrentGraph -> EvidenceReady(P1, G43)
```

or:

```text
RebuildContextPack -> rerun mechanical branch against G43
```

### 8.2 Missing oracle

Scenario:

```text
CodeArtifactReady
VerifyPassed
RequiredOracleKnown(O7)
O7 implementation status: not_implemented
```

Net behavior:

```text
AssessOracleSatisfaction is not enabled.
ImplementRequiredOracle branch becomes enabled.
```

The plan can reach mechanical verification but cannot reach semantic completion.

```text
VerifyPassed != OracleSatisfied
```

### 8.3 Design not exercised

Scenario:

```text
Tests pass, but implementation bypasses intended seam D2.
```

Net behavior:

```text
AssessDesignExercised consumes:
  CodeArtifactReady
  RequiredDesignKnown(D2)
  DesignEvidenceReady?

guard fails:
  evidence does not show path crossing D2

produces:
  DesignExerciseRejected(D2, reason)
  ReworkRequired(P1)
```

This catches fake completion: a slice may pass tests while failing to exercise the architecture it was meant to establish.

### 8.4 Residual risk accepted instead of retired

Scenario:

```text
KnownRisk(R3): concurrency race not fully tested in this slice.
```

Two possible branches:

```text
RetireRiskMechanically -> RiskRetired(R3)
AcceptResidualRisk -> RiskAccepted(R3, acceptedBy, rationaleRef)
```

`DeclarePlanDone` can accept either only if relation policy allows accepted residual risk for that risk kind. Some risks may require retirement, not acceptance.

## 9. Visualization model

The UI should not force one graph to masquerade as the other. It should offer synchronized views.

### 9.1 Semantic graph view

Shows Brunch-native traceability:

```text
P1 establishes R1
P1 introduces D1
P1 exercises D2
P1 verified_by O1
P1 depends_on P0
```

Answers:

- Why does this work matter?
- What completion evidence is required?
- What becomes stale if this node changes?
- Which semantic gates block completion?

### 9.2 Petri execution view

Shows runtime markings:

```text
ContextPackReady -> ImplementationInProgress -> TestReportReady -> OracleSatisfied -> PlanDoneAccepted
```

Answers:

- What can fire now?
- What is blocked?
- Which agents/tasks/artifacts are in flight?
- Which terminal states are reachable?
- Where did execution deadlock?

### 9.3 Cross-highlighting

- Click a plan slice: reveal its compiled Petri subnet.
- Click a Petri transition: show the relation-policy and graph edges that generated it.
- Click a blocked semantic place: show the missing oracle/design/intent/risk token.
- Click a `PlanDoneAccepted` token: show evidence lineage back to graph revision, artifacts, and semantic edges.

## 10. Prototype candidates

### Prototype A: happy-path tracer bullet

Goal: compile one plan slice into a Petri subnet where mechanical and semantic lanes both complete.

Acceptance criteria:

- `PlanDoneAccepted` is reachable only after `VerifyPassed`, `OracleSatisfied`, `DesignExercised`, and `IntentEstablished`.
- Event log can explain how each semantic token was produced.

### Prototype B: stale graph guard

Goal: prove graph revision tokens prevent stale completion.

Acceptance criteria:

- An artifact produced from `G42` cannot satisfy semantic completion after current graph revision becomes `G43`.
- The net routes to reconciliation or context rebuild.

### Prototype C: missing oracle branch

Goal: prove the net distinguishes implementation completion from verification coverage.

Acceptance criteria:

- `VerifyPassed` can be reached while `PlanDoneAccepted` remains unreachable.
- `ImplementRequiredOracle` becomes enabled.

### Prototype D: design bypass detection

Goal: model a test-passing implementation that fails the intended architecture claim.

Acceptance criteria:

- `TestReportReady(status=passing)` does not imply `DesignExercised`.
- Rework is required unless a reviewer explicitly changes/accepts the design trace.

## 11. Open questions

1. How much semantic assessment can be deterministic versus agent/human-reviewed?
2. Should Petri-net compilation produce one flat net, hierarchical subnets, or colored nets with rich token payloads?
3. What is the minimal transition contract needed to avoid hidden imperative behavior in TypeScript kernels?
4. How should visual Petrinaut-compatible numeric token dimensions relate to execution-only typed token payloads?
5. Which relation kinds are completion-gating by default, and which are context-only?
6. When, if ever, may a Petri terminal marking directly declare `plan_node.executionStatus = done`?
7. How should aborted or abandoned runs affect plan/oracle/design status projections?
8. Can Petri simulation catch plan-shape defects before execution, such as unjoinable branches or unreachable semantic completion?

## 12. Working conclusion

Petri nets look most promising as a compiled execution semantics and visualization layer for active plan subtrees. The highest-leverage prototype is not a generic task runner. It is a slice net that makes this distinction executable:

```text
mechanical completion produces evidence
semantic completion accepts evidence against graph-derived gates
```

If that distinction holds, Petri-net orchestration could become both an agent execution harness and a planning oracle for Brunch's workspace graphs.
