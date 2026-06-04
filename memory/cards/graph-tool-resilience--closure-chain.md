# Graph tool resilience closure chain

Frontier: graph-tool-resilience
Status:   active
Mode:     chain
Created:  2026-06-04

## Orientation

- Containing seam: `graph-tool-resilience` (FE-808), after the graph write contract materialization commits.
- Posture: proving (inherited from `graph-tool-resilience`). The chain should stabilize D62-L/D63-L/D53-L at the product boundary, then fire the direct-runtime probes that decide whether A14-L is materially broader than the old happy path.
- Volatile state: probe/transcript rendering work is being handled separately; this chain should not reshape `src/session/session-transcript*` unless the probe reporter cannot use the committed transcript API.
- Main open risk: the code now stores the right graph invariants, but the agent-facing tool surface still leaks raw ids and dry-run validation can diverge from commit validation.
- Frontier obligations: preserve `CommandExecutor` as the mutation authority, keep projected node codes out of DB storage, avoid harness-as-false-proof by exercising the default Brunch runtime factory, and record probe fitness rather than only pass/fail.

Build order: Cards 1–2 are cleanup required before the product-path probes. Cards 3–5 are the remaining FE-808 probe evidence slices; they should remain valid after Cards 1–2 because they target frontier acceptance, not an implementation detail.

## Card 1 — Canonicalize graph tool handles

Status: done

### Target Behavior

The Pi graph-tool boundary exposes projected node codes as the only agent-facing existing-node handle.

### Boundary Crossings

```pseudo
read_graph / commit_graph Pi tools
→ src/.pi/extensions/graph tool schemas + prompt guidance
→ selected-spec graph code resolver
→ CommandExecutor / snapshot readers using internal NodeIds
→ tool result text + details
```

### Risks and Assumptions

- RISK: raw integer ids remain useful for diagnostics and tests.
  → MITIGATION: keep raw ids in internal `details`/domain objects only; remove them from agent instructions, primary rendered handles, and tool-call parameters.
- RISK: resolving projected codes inside `.pi/extensions/graph` could pull DB access into the adapter.
  → MITIGATION: inject or import a graph-layer resolver/reader; `.pi/extensions/graph` must still avoid direct `db/` imports.
- ASSUMPTION: `node_code` / `existingCode` is sufficient for the current product path.
    → IMPACT IF FALSE: FE-808 probes would still rely on raw ids and fail to prove D62-L at the agent boundary.
    → VALIDATE: graph-tool adapter tests and product probe transcripts should contain code handles such as `G1` / `R2`, not instructions to use raw ids.

### Posture check

This is an invariant tracer: it makes D62-L observable at the product boundary rather than only in storage and snapshots. It also removes the compatibility bridge that lets agents keep using raw DB ids.

### Acceptance Criteria

```pseudo
✓ graph tool schema tests — commit_graph edge refs accept intra-batch refs and projected existing-node codes, not `{ existing: <id> }`
✓ graph tool schema/tests — read_graph neighborhood mode accepts a projected node code instead of `node_id`
✓ adapter tests — selected-spec code resolution succeeds for an existing code and fails loudly for malformed, missing, or wrong-spec codes
✓ CommandExecutor input types/tests — commitGraph no longer accepts presentation-code refs directly; adapters resolve to internal NodeIds before mutation
✓ graph tool formatting tests — overview, neighborhood, and commit success render projected codes as primary handles
✓ prompt guidance tests — graph tool descriptions/guidelines no longer tell the agent to use raw existing node ids
```

### Verification Approach

- Inner: adapter/schema/unit tests — prove code-only agent parameters and selected-spec resolution.
- Middle: transcript grep in later probe cards — prove the default runtime exposes/uses projected handles.

### Cross-cutting obligations

- Do not store rendered code strings in graph tables.
- Do not let `.pi/extensions/graph` import from `db/`.
- Keep raw ids available only as internal diagnostics/details where they are needed for tests or domain plumbing.

### Expected touched paths (tentative)

```pseudo
src/.pi/extensions/graph/
├── tool-schemas.ts        ~
├── command-adapter.ts     ~
└── index.ts               ~
src/.pi/__tests__/
└── graph-tools.test.ts    ~
src/graph/
├── command-executor.ts       ~
├── command-executor.test.ts  ~
├── snapshot.ts               ~
├── snapshot.test.ts          ~
├── workspace-store.ts        ~
└── schema/
    └── nodes.ts              ~
src/agents/contexts/
├── graph.ts               ~
├── graph.test.ts          ~
├── node.ts                ~
└── node.test.ts           ~
```

## Card 2 — Normalize graph tool outcomes and unify commitGraph planning

Status: done

### Target Behavior

Every graph-tool structural failure travels through the same structured diagnostic path used by commitGraph dry-run and commit execution.

### Boundary Crossings

```pseudo
commit_graph / read_graph Pi tool params
→ adapter normalization over projected codes
→ CommandExecutor.dryRunCommitGraph / CommandExecutor.commitGraph
→ private commit-graph batch planner
→ graph structural validators + selected-spec reference checks
→ transaction writer / structured tool result
```

### Build order inside this card

```pseudo
1. adapter normalization: no thrown Error for malformed/missing codes; return structured diagnostics
2. result identity: replace `nodes` + optional `nodeCodes` with one created-node result shape
3. tool params: make `ReadGraphParams` a discriminated union so neighborhood requires `nodeCode`
4. resolver contract: require the selected-spec code resolver at the graph tool boundary
5. planner extraction: make dry-run and commit share the full commitGraph planner, including supersession acyclicity
```

### Risks and Assumptions

- RISK: adapter code currently throws before the agent receives a `structural_illegal`-style tool result.
  → MITIGATION: normalize projected-code failures into the same diagnostic envelope that `formatCommitGraphResult` renders for agent self-correction.
- RISK: `CommitGraphSuccess` currently represents identity twice (`nodes: ref → id` plus optional `nodeCodes`).
  → MITIGATION: make one created-node result shape such as `createdNodes: { [ref]: { id, code } }`; keep raw ids internal/diagnostic, never as the primary rendered handle.
- RISK: `ReadGraphParams` currently permits `{ mode: "neighborhood" }` and rejects it imperatively.
  → MITIGATION: use a discriminated union so overview and neighborhood params make invalid states unrepresentable at the schema/type boundary.
- RISK: supersession acyclicity currently depends on resolved endpoints after insertion setup.
  → MITIGATION: plan against temporary batch endpoint keys plus existing NodeIds before writing; commit maps the already-planned batch refs to inserted rows.
- RISK: this cleanup could become a broad executor rewrite.
  → MITIGATION: split only graph-tool normalization and commitGraph batch planning/validation; leave unrelated spec/recon-need commands alone.
- ASSUMPTION: dry-run, commit, and graph-tool normalization should be structurally identical except for persistence.
    → IMPACT IF FALSE: review-set proposals can pass dry-run and fail on approval, or agent probes can crash instead of producing retryable diagnostics, breaking D27-L/D53-L/A14-L.
    → VALIDATE: paired adapter/dry-run/commit differential tests for current structural-illegal families.

### Posture check

This is an invariant tracer: it closes the adapter-exception and dry-run/commit gaps before FE-808 probes and FE-809 review-cycle work depend on these diagnostics as product evidence.

### Acceptance Criteria

```pseudo
✓ graph-tool adapter tests — malformed, missing, and wrong-spec projected codes produce structured diagnostic tool results, not thrown exceptions
✓ graph-tool schema tests — `ReadGraphParams` is an overview/neighborhood discriminated union; neighborhood requires `nodeCode`, and raw `node_id` stays rejected
✓ graph-tool adapter tests — selected-spec code resolver is required at the boundary; no default `() => undefined` resolver remains
✓ result-shape tests — commit success exposes one created-node identity shape with both internal id and projected code; formatting renders codes as primary handles with no optional `#id` fallback for created nodes
✓ dry-run/commit parity tests — invalid basis, missing existing ref/code, invalid category/stance, self-loop, and detail-shape errors produce matching diagnostics
✓ dry-run/commit parity tests — existing, intra-batch, and mixed supersession cycles are rejected by dry-run before any write path runs
✓ transaction tests — failed commitGraph batches do not persist nodes, edges, change-log rows, or counter rows
✓ topology/file-size check — commitGraph batch planning lives in a private `src/graph/command-executor/*` module imported only by the public command-executor entrypoint
✓ file-size check — `src/graph/command-executor.test.ts` no longer carries the full commitGraph matrix past the 1000-line threshold
```

### Verification Approach

- Inner: adapter/schema tests — prove graph-tool normalization returns structured diagnostics and code-only params make invalid states unrepresentable.
- Inner: unit/differential tests over the batch planner and public `CommandExecutor` methods.
- Middle: review-set dry-run tests keep using the public `dryRunCommitGraph` path.

### Cross-cutting obligations

- Preserve `CommandExecutor` as the public mutation boundary; the new planner is private implementation.
- Do not add a standalone authority service or second write path.
- Keep projected codes out of DB storage; raw ids may remain in typed internals/details but not as primary agent-facing handles.
- Keep the split semantic, not file-shape theatre: extract graph-tool normalization and commitGraph batch planning only.

### Expected touched paths (tentative)

```pseudo
src/.pi/extensions/graph/
├── command-adapter.ts           ~
├── index.ts                     ~
├── tool-schemas.ts              ~
└── review-set-proposal.ts       ?
src/.pi/__tests__/
├── graph-tools.test.ts          ~
└── review-set-proposal.test.ts  ~
src/graph/
├── command-executor.ts              ~
├── command-executor.test.ts         ~
├── snapshot.ts                      ?
├── workspace-store.ts               ?
└── command-executor/
    ├── commit-graph-batch.ts        +
    └── commit-graph-batch.test.ts   +
src/graph/README.md                 ~
```

## Card 3 — Existing-code product-path probe

Status: done

### Target Behavior

The default Brunch runtime commits graph truth by referencing a selected-spec existing node through its projected code.

### Boundary Crossings

```pseudo
probe runner
→ fresh workspace/spec/session setup with seeded graph node
→ default Brunch agent session runtime factory
→ real read_graph / commit_graph Pi tools
→ CommandExecutor
→ graph overview + transcript/report artifacts
```

### Risks and Assumptions

- RISK: the probe could seed the graph through a helper and then inspect private state, proving less than the product path.
  → MITIGATION: seeding may use `CommandExecutor`, but the agent action under test must use the default runtime factory and real Pi tools; final assertions read public graph snapshots/report artifacts.
- RISK: the model may still copy a raw diagnostic id if any prompt surface leaks one.
  → MITIGATION: report transcript handle usage and treat raw-id reliance as friction or failure.
- ASSUMPTION: the existing `propose-graph-commit` proof runner can be extended with named scenarios rather than replaced.
    → IMPACT IF FALSE: create a small sibling runner under `src/probes/`, but keep artifact shape identical.
    → VALIDATE: test the scenario summary/report without a live model run first.

### Posture check

This is proof of life plus invariant evidence: it proves D62-L in the real tool loop and selected-spec ownership at the boundary A14-L depends on.

### Acceptance Criteria

```pseudo
✓ probe summary tests — a named `existing-code-ref` scenario reports attempts, retry count, diagnostics, final graph counts/LSN, committed code/title summary, and friction
✓ product-path probe artifact — `.fixtures/runs/propose-graph-commit/<run-id>/report.json` records success for the existing-code scenario or names the specific gap
✓ transcript/report assertions — the agent saw and used projected codes as primary handles
✓ graph assertion — final graph includes the expected edge to the pre-existing selected-spec node and no writes to another spec
```

### Verification Approach

- Inner: probe report parser/summary tests — prove scenario-specific report fields.
- Middle/Outer: real model probe run through `createBrunchAgentSessionRuntimeFactory`; fixture artifacts are committed under `.fixtures/runs/`.

### Cross-cutting obligations

- No probe-only tool registration or runtime wiring.
- Preserve the existing artifact envelope (`session.jsonl`, `transcript.md`, `report.json`).
- Treat model friction as evidence, not hidden test setup.

### Expected touched paths (tentative)

```pseudo
src/probes/
├── propose-graph-commit-proof.ts        ~
└── propose-graph-commit-proof.test.ts   ~
.fixtures/runs/propose-graph-commit/
└── <existing-code-run-id>/              +
```

## Card 4 — Retry-diagnostics product-path probe

Status: next

### Target Behavior

The default Brunch runtime records a structural-illegal first commit attempt followed by a corrected retry outcome.

### Boundary Crossings

```pseudo
probe scenario prompt
→ default Brunch agent session runtime factory
→ real commit_graph structural_illegal result
→ retry prompt/tool guidance
→ corrected commit_graph attempt or named failure report
```

### Risks and Assumptions

- RISK: forcing the first attempt to be illegal may overfit the prompt rather than test diagnostics quality.
  → MITIGATION: use a representative illegal category/stance/detail mistake from the tool contract and report whether correction came from diagnostics.
- RISK: a model may refuse to make an illegal first attempt.
  → MITIGATION: success can be either corrected retry evidence or an explicit report that the scenario did not induce a retry; do not fake the retry by direct tool injection.
- ASSUMPTION: bounded retry remains the right proof shape for A14-L diagnostics.
    → IMPACT IF FALSE: FE-808 cannot claim diagnostic/retry resilience and should report the gap before FE-809 depends on it.
    → VALIDATE: attempt report includes first/final status and diagnostic text.

### Posture check

This is uncertainty-retirement evidence for A14-L: it tests whether `structural_illegal` diagnostics are actionable through the real agent loop.

### Acceptance Criteria

```pseudo
✓ probe summary tests — `retry-diagnostics` classifies firstAttemptStatus, finalStatus, retryCount, and diagnostics seen
✓ product-path probe artifact — report records at least one `structural_illegal` attempt and either a later success or an explicit diagnostic gap
✓ transcript assertion — retry prompt/tool guidance is visible in the Pi JSONL-derived transcript
✓ graph assertion — no partial graph state from the failed attempt is present
```

### Verification Approach

- Inner: probe attempt-classification tests.
- Middle/Outer: real model probe run through the default runtime factory with committed artifacts.

### Cross-cutting obligations

- Do not lower structural validation just to make retry easier.
- Do not bypass the tool result path when collecting diagnostics.

### Expected touched paths (tentative)

```pseudo
src/probes/
├── propose-graph-commit-proof.ts        ~
└── propose-graph-commit-proof.test.ts   ~
.fixtures/runs/propose-graph-commit/
└── <retry-diagnostics-run-id>/          +
```

## Card 5 — Ambiguity no-overcommit product-path probe

Status: next

### Target Behavior

The default Brunch runtime records an ambiguous graph prompt without committing unsupported graph truth.

### Boundary Crossings

```pseudo
ambiguous probe prompt
→ default Brunch agent session runtime factory
→ agent strategy/tool guidance
→ transcript outcome
→ graph overview/report artifact
```

### Risks and Assumptions

- RISK: no-overcommit is harder to assert than a successful commit.
  → MITIGATION: define the oracle narrowly: zero commit_graph success when the prompt withholds enough facts, or a transcript-visible clarification/no-op diagnostic that explains why no graph truth was written.
- RISK: the model may commit plausible but unsupported nodes.
  → MITIGATION: report overcommit as failure/friction; do not tune the prompt until the behavior disappears without naming the attempt.
- ASSUMPTION: the current `propose-graph` strategy guidance is specific enough to avoid overcommitment when evidence is missing.
    → IMPACT IF FALSE: FE-808 should close with a named strategy-guidance gap rather than claiming broad graph-tool resilience.
    → VALIDATE: final graph counts/LSN plus transcript classification.

### Posture check

This is an uncertainty tracer for A14-L's “ambiguity/no-overcommit” subclaim; it prevents the frontier from proving only happy-path persistence.

### Acceptance Criteria

```pseudo
✓ probe summary tests — `ambiguity-no-overcommit` classifies no-op/clarification, overcommit, and unexpected tool-use outcomes
✓ product-path probe artifact — report records final graph counts/LSN and friction for the ambiguity scenario
✓ transcript assertion — the agent either asks for clarification or explains why it cannot commit graph truth yet
✓ graph assertion — no successful commit_graph writes unsupported graph items for the ambiguous prompt
```

### Verification Approach

- Inner: transcript/report classifier tests.
- Middle/Outer: real model probe run through the default runtime factory with committed artifacts.

### Cross-cutting obligations

- Preserve offer-first/elicitation-first posture; no ambient free-chat workaround.
- Record fitness honestly if the model overcommits.
- Do not broaden into generative/adversarial probe infrastructure.

### Expected touched paths (tentative)

```pseudo
src/probes/
├── propose-graph-commit-proof.ts        ~
└── propose-graph-commit-proof.test.ts   ~
.fixtures/runs/propose-graph-commit/
└── <ambiguity-no-overcommit-run-id>/    +
```
