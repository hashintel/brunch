# End-to-end Petri-editor factorial matrix

Frontier: end-to-end-comparison-tracer
Status:   done
Mode:     slices
Created:  2026-07-21

## Orientation

- Containing seam: controller-owned dev/evaluation composition over the rigorous FE-1210 elicitation recipe, FE-1230 execution artifacts/oracles, and FE-1232 reporting grammar; no product runtime command is added.
- Frontier: `end-to-end-comparison-tracer` (FE-1239), stacked on FE-1230 and parented under FE-1211.
- Volatile state: FE-1230's independent browser journeys are built on the parent branch; its old retained pair remains separate sibling evidence. This frontier must run fresh elicitation-derived outputs.
- Main risk: the existing execution public contract exposes product behavior. Shared interoperability requirements must therefore be disclosed before elicitation and marked as controlled baseline, while exact lane-authored specification bytes cross the handoff unchanged.

Posture: proving (inherited from `end-to-end-comparison-tracer`).

Cross-cutting obligations:

- preserve mission/reveal/controller isolation and FE-1210 failure retention;
- preserve FE-1230 `ExecutionAttempt`, controller-oracle, and no-landing contracts;
- let comparison-reporting consume retained evidence without changing run conduct;
- never credit shared public-baseline requirements as elicitation gains.

## Card 1 — Freeze the study and exact handoff

Status: done

### Target Behavior

A frozen study accepts only byte-identical approved elicitation artifacts and describes one closed two-specification-by-two-executor matrix with complete requirement provenance.

### Cold-start reads

- `memory/SPEC.md` — D70-L, D134-L, I67-L, D40-L, D120-L, I62-L
- `memory/PLAN.md` — frontier: `end-to-end-comparison-tracer`
- `docs/praxis/comparison-runs.md` and `comparison-runs/mission-packet.md` — rigorous actor, validity, retention, and controller isolation
- `.agents/skills/comparison-reporting/references/end-to-end-comparisons.md` — validity chain and traceability row shape
- `src/dev/TOPOLOGY.md` — dev/evaluation ownership
- `src/dev/execution-comparison/artifact-contract.ts` and `oracle-pack.ts` — immutable attempt/oracle identities to reference, not widen

### Boundary Crossings

```text
frozen case references
  → runtime-boundary study parser
  → approved elicitation artifact + byte hash
  → immutable handoff record
  → closed matrix + requirement registry
```

### Risks and Assumptions

- RISK: a path points to controller material or escapes the retained run → MITIGATION: canonical containment checks plus disjoint controller/target roots at parse and materialization boundaries.
- RISK: a handoff helper "helps" by reformatting free-form Markdown → MITIGATION: hash the source bytes and write/copy only those bytes with exclusive creation.
- ASSUMPTION: FE-1230's `ExecutionAttempt` is sufficient as the execution-cell leaf.
  → IMPACT IF FALSE: widening that schema would couple sibling evidence to E2E provenance.
  → VALIDATE: matrix tests reference attempts by path/hash and prove the complete join without altering `ExecutionAttempt`.

### Posture check

- Proof of life: establishes the previously missing elicitation → execution identity seam.
- Invariant: makes "unchanged approved specification" executable rather than report prose.
- Uncertainty: locates whether a separate E2E artifact can compose FE-1230 without schema widening.

### Acceptance Criteria

- ✓ `study-contract.test.ts` — rejects mutable/unknown versions, incomplete lane sets, duplicate matrix cells, non-SHA identities, and controller roots reachable from target roots.
- ✓ `handoff-contract.test.ts` — materializes exact approved bytes once, rejects source/hash drift and destination overwrite, and records elicitation provenance without normalization.
- ✓ `matrix-contract.test.ts` — accepts exactly `{brunch_spec, claude_spec} × {brunch, claude_code}` and validates referenced `ExecutionAttempt` bytes/hashes.
- ✓ `traceability-contract.test.ts` — requires every predeclared row to name origin, both elicitation dispositions, both handoffs, all four implementation/verification dispositions, evidence, and assessment.
- ✓ `redaction.test.ts` — audience-safe rows retain opaque ids/public concern categories and remove controller-only wording, fixtures, expected states, and reveal policy.

### Invariants preserved

- FE-1230 `ExecutionAttempt` schema remains unchanged — guarded by: existing `artifact-contract.test.ts` plus matrix composition tests.
- Controller-only material never enters a target path — guarded by: study/handoff containment negatives.
- Invalid/failed evidence remains referenceable — guarded by: matrix fixtures containing valid and invalid attempts.

### Verification Approach

- Inner: runtime-boundary unit tests for every untrusted JSON/path/artifact entry.
- Middle: synthetic retained-run fixture closes all four cells and every ledger row.
- Outer: none for this card; Card 3 owns provider evidence and reviewed promotion.

### Expected touched paths (tentative)

```text
src/dev/
├── end-to-end-comparison.ts                                  +
└── end-to-end-comparison/
    ├── study-contract.ts                                     +
    ├── handoff-contract.ts                                   +
    ├── matrix-contract.ts                                    +
    ├── traceability-contract.ts                              +
    ├── redaction.ts                                          +
    └── __tests__/                                            +
testing/end-to-end-comparisons/
└── cases/minimal-petri-net-editor/
    ├── study-contract.json                                   +
    └── requirement-registry.json                             +
```

### Completion evidence

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| Frozen study contract | met | `study-contract.test.ts`; tracked case hash load |
| Exact immutable handoff | met | `handoff-contract.test.ts`; byte equality, drift/escape/overwrite negatives |
| Closed four-cell matrix | met | `matrix-contract.test.ts`; four parsed immutable `ExecutionAttempt` leaves |
| Complete traceability rows | met | `traceability-contract.test.ts`; tracked AC14–AC26 registry |
| Audience-safe redaction | met | `traceability-contract.test.ts`; controller fields/private evidence removed |

Skipped-test-count delta vs parent: 0.

## Card 2 — Compose exact-spec execution cells

Status: done

### Target Behavior

Each frozen handoff launches through either executor from an isolated target workspace and produces an immutable FE-1230 execution attempt without exposing controller material or landing Brunch output.

### Cold-start reads

- `memory/PLAN.md` — frontier: `end-to-end-comparison-tracer`
- Card 1 public exports — frozen study/handoff/matrix contracts
- `src/dev/execution-comparison/brunch-lane.ts` — coded-spec adapter to preserve beside the new opaque-spec path
- `src/dev/execution-comparison-brunch.ts` — pinned Brunch execution entry
- `src/dev/execution-comparison/browser-oracle.ts` — unchanged common output oracle
- `src/executor/TOPOLOGY.md` — `empty_dir`, promotion, and no-landing boundaries

### Boundary Crossings

```text
immutable handoff
  → isolated target packet
  → Brunch or Claude execution adapter
  → output repository + process ledger
  → unchanged browser oracle
  → immutable ExecutionAttempt
```

### Risks and Assumptions

- RISK: opaque Markdown loses intent when seeded into Brunch graph state → MITIGATION: preserve it as one settled approved-spec artifact plus separately predeclared shared delivery/interface nodes; do not infer missing requirements.
- RISK: Claude execution becomes an ad hoc shell recipe that cannot prove cleanup → MITIGATION: one adapter contract owns launch, fixed prompt, process/status capture, git evidence, and deterministic teardown.
- ASSUMPTION: the existing browser oracle can assess all four outputs from the shared baseline.
  → IMPACT IF FALSE: a target may be behaviorally correct but unaddressable, invalidating common comparison evidence.
  → VALIDATE: run the known-good implementation through both adapter packet shapes before provider execution.

### Posture check

- Proof of life: lights the exact handoff through both executor boundaries.
- Invariant: stabilizes target/controller isolation and no-landing behavior across a crossed matrix.
- Uncertainty: tests whether Brunch can execute an opaque third-party specification without format repair.

### Acceptance Criteria

- ✓ `brunch-adapter.test.ts` — exact arbitrary Markdown survives workspace preparation byte-for-byte, the legacy coded-spec FE-1230 path stays green, and only shared baseline material is added separately.
- ✓ `claude-adapter.test.ts` — prepares a fresh git target containing only exact spec/shared baseline, validates fixed launch inputs, records output/cleanup, and rejects controller paths.
- ✓ `execution-cell.test.ts` — both adapters emit parseable immutable `ExecutionAttempt` artifacts linked by matrix cell without changing `ExecutionAttempt`.
- ✓ existing `browser-oracle.slow.test.ts` — unchanged `petri-editor-browser-v2` still passes against the known-good application.
- ✓ existing execution suites — `promotion_prepared` remains the Brunch terminal and `landed` remains invalid.

### Invariants preserved

- FE-1230 coded-spec execution remains available unchanged — guarded by: `brunch-lane.test.ts`.
- Browser journeys and controller pack remain byte-identical on this branch — guarded by: case/oracle contract tests and git diff review.
- Brunch host landing remains impossible inside the adapter — guarded by: terminal parser and launch-command negative assertions.

### Verification Approach

- Inner: adapter contract tests with injected process runners and temporary git repositories.
- Middle: known-good app through both packet/collection paths plus unchanged slow browser suite.
- Outer: Card 3 owns real provider runs, cleanup review, and promotion.

### Expected touched paths (tentative)

```text
src/dev/
├── execution-comparison/brunch-lane.ts                        ~
├── execution-comparison/__tests__/brunch-lane.test.ts         ~
└── end-to-end-comparison/
    ├── brunch-adapter.ts                                      +
    ├── claude-adapter.ts                                      +
    ├── execution-cell.ts                                      +
    └── __tests__/                                             ~
```

## Card 3 — Run and promote the factorial witness

Status: done

### Target Behavior

One reviewed retained bundle proves the full validity chain from two fresh rigorous elicitation lanes through four execution cells to a closed requirement traceability report.

### Cold-start reads

- `memory/PLAN.md` — frontier: `end-to-end-comparison-tracer`
- Cards 1–2 public contracts and verification results
- `.agents/skills/agent-as-user-comparison/SKILL.md` — fresh actor recipe
- `.agents/skills/comparison-reporting/SKILL.md` and `references/end-to-end-comparisons.md` — evidence order and report grammar
- `docs/praxis/manual-testing.md` — outer-loop capture, cleanup, and findings disposition

### Boundary Crossings

```text
two fresh elicitation lanes
  → operator approval + immutable handoffs
  → four real execution cells
  → unchanged independent journeys
  → complete requirement ledger
  → controller + audience-safe reports
  → reviewed promoted bundle
```

### Risks and Assumptions

- RISK: provider/runtime invalidity exhausts the first launch → MITIGATION: retain every attempt and replace only under the frozen replacement rule.
- RISK: poor output is mislabeled invalid and rerun → MITIGATION: validity and quality stay orthogonal; poor valid output remains the result.
- RISK: a polished report overclaims the one-case matrix → MITIGATION: no aggregate winner; report only cell validity, requirement outcomes, within-executor/spec contrasts, and limitations.

### Posture check

- Proof of life: first valid end-to-end comparison path.
- Invariant: proves exact frozen handoff identity survives real actors and executors.
- Uncertainty: determines whether elicitation differences remain visible after crossing executor identity.

### Acceptance Criteria

- ✓ retained elicitation manifests — one valid Brunch and one valid Claude target-authored specification under matched frozen actor policy, with complete cleanup.
- ✓ handoff validator — both approved source hashes equal execution input hashes byte-for-byte.
- ✓ matrix validator — exactly four retained execution cells exist; invalid attempts are retained and replacements cite the frozen rule.
- ✓ browser reports — every cell retains a verdict for all five independent journeys even when another journey fails.
- ✓ traceability validator — every registry row closes with exact evidence or `not_assessable`; shared-baseline rows are never credited as elicitation gains.
- ✓ comparison-reporting review — controller report presents validity before outcomes and makes no winner/reliability/cross-case causal claim.
- ✓ `npm run check:promoted-run-paths` — promoted bundle contains no scratch, controller-root, session-private, or absolute host path.
- ✓ `npm run verify:full` — full repository gate passes.

### Invariants preserved

- Private reveal keys are never promoted — guarded by: promoted-path/content checks and manual bundle review.
- Failed and invalid attempts are not erased — guarded by: manifest inventory and immutable directories.
- Common comparison claims use only common evidence — guarded by: traceability schema and report review.

### Verification Approach

- Inner: validators over the assembled retained bundle.
- Middle: unchanged mechanical oracle over every execution cell.
- Outer: named operator/controller review of elicitation validity, cleanup, traceability dispositions, redaction, and bounded report before promotion.

### Expected touched paths (tentative)

```text
.fixtures/runs/end-to-end-comparison/<run-id>/                 +
docs/praxis/comparison-runs.md                                 ~
src/dev/TOPOLOGY.md                                            ~
memory/PLAN.md                                                  ~
memory/cards/end-to-end-comparison-tracer--factorial-matrix.md ~
.changeset/*.md                                                 +
```

### Completion evidence

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| Two exact elicitation handoffs | met | promoted `handoffs/`; both study/spec hashes validate |
| Closed real execution matrix | met | promoted `matrix-manifest.json`; four immutable valid failed attempts |
| Unchanged common oracle | met | five portable journey dispositions under every cell's `evidence/` directory |
| Requirement closure and redaction | met | controller ledger retained in scratch; promoted `requirement-ledger.public.json` |
| Bounded comparison report | met | promoted `report.md`; validity precedes outcomes and no winner/causal claim is made |
| Portable promotion | met | manual untracked-bundle scan plus `check:promoted-run-paths` recipe; no host/scratch/controller paths |

Promoted witness:
`.fixtures/runs/end-to-end-comparison/petri-editor-e2e-20260721T132600Z/`.

Observed result: all four final cells were valid failures. Both Brunch cells halted at
`plan_slice_invalid` before implementation; both Claude Code outputs passed their own gates and failed
the common browser oracle. Poor valid outputs were retained and not rerun.
