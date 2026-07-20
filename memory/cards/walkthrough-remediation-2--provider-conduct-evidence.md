# R8–R10 controlled provider-conduct evidence

Frontier: walkthrough-remediation-2
Status:   paused — user-directed hold after remediation-4 tie-off
Mode:     slices
Created:  2026-07-17

Posture: proving (inherited from `walkthrough-remediation-2`)

Two-card sequence. Card 1 built the deterministic evidence instrument. Card 2 began on 2026-07-17 but was stopped before approval when human review invalidated D27-L's settled-only premise; it produced no report and counts 0/3. The mixed-settlement review + populated-group-only Impact Ledger are now materialized. At user direction, the extractor/oracle hardening pass and Card 2 are paused after the `remediation-4` tie-off. Re-enter only by explicit decision; then reconcile the extractor before any fresh run. Card 2 remains human/provider-gated and must not be delegated to a user-less builder.

## Card 1 · Deterministic provider-conduct report extractor — `done`

Completed 2026-07-17; production-cover acceptance restored through two independent-review corrections. `src/probes/provider-conduct-report.ts` now joins canonical assistant `toolCall` blocks to following `toolResult` messages by exact id, validates agent-authored mutation arguments with the owning TypeBox `MutateGraphParams` schema, validates successful details with canonical `zMutateGraphSuccess`, tolerates production-shaped `{ field, message }` structural rejection followed by correction, pairs each review with its own continuation response, enforces digest-result → feedback-result → questionnaire-result → first successful mapping order, and bounds exact acceptance receipt readback to `(beforeLsn, afterLsn]`. The restored harness covers every named rival, malformed/mechanical inputs, sibling active-branch exclusion, deterministic questionnaire count/order, the human-only semantic boundary, a default source CLI leg, and a fresh-compile slow source/built differential over a canonical Pi JSONL tree plus a temporary production-created Brunch DB/change log with session/source/store stability proofs. Coordinator acceptance after `e6c8ab7e5` covers cumulative commits `77084b50`, `3cc3fb4d9`, `9729ac743`, and `e6c8ab7e5`: focused suites 22/22 and fresh-build slow differential 1/1 passed with protected hashes exact. Card 2 remains provider/human-gated. Its first attempted run was invalidated before settlement and is preserved only as non-counting diagnostic evidence at `.fixtures/scratch/provider-conduct/run-1-20260717T170400Z/`. The accepted extractor still embodies the pre-amendment R10 marker meaning; the report contract below is now the target for the required `ln-oracles` reconciliation, not a claim that the current implementation already classifies per-item settlement preservation.

### Target Behavior

A read-only report extractor classifies R8–R10 conduct from one real session without semantic inference.

### Cold-start reads

- `memory/SPEC.md` — D27-L, D38-L, D99-L, D106-L, D110-L, D116-L; I15-L, I57-L; §Verification Design “FE-1187 controlled provider conduct gate”
- `memory/PLAN.md` — frontier: `walkthrough-remediation-2`; R8–R10 verification
- `TESTING_FINDINGS.md` — R8, R9, R10 and their forbidden rivals
- `docs/architecture/probes-and-transcripts.md` — scratch/promotion and report contract
- `src/session/TOPOLOGY.md` — active-branch JSONL semantics
- `src/exchanges/TOPOLOGY.md` — current offer/ask detail vocabulary

### Boundary Crossings

```text
Pi session JSONL + selected-spec graph readback + run metadata
→ active-branch structured-exchange/tool-call projection
→ deterministic event ordering and settlement markers
→ schema-validated report.json + concise text summary + process exit status
```

### Report contract

The extractor is a narrow verification instrument, not a new product RPC or canonical store.

```text
identity
├── schemaVersion + runId + generatedAt
├── branch/commit + Pi version
├── provider/model/thinking
├── seed ref + source SHA-256
└── session path + active leaf + spec id + before/after LSN

markers
├── digest presented + terminal feedback order
├── material question count + bounded questionnaire presence
├── combinatorial/permutation option rival
├── first mapping mutation relative to clarification completion
├── direct advisory mutation, when used (valid alternate path)
├── review-set per-node/per-edge proposed settlement + visible presentation
├── review response + exact accepted settlement readback + receipt
├── post-approval model-authored completion/rewrite rival
└── exact cited JSONL entry/toolCall ids for every marker

verdict
├── sample: valid | mechanically_invalid
├── R8/R9/R10: pass | fail | not_observed
├── forbiddenRivals[]
└── humanJudgmentsRequired[]
```

The extractor may classify only transcript/tool/graph facts with deterministic ownership. It must leave question materiality, digest fidelity, proposition cohesion, and fatigue in `humanJudgmentsRequired`; no keyword heuristic or LLM judge may counterfeit those judgments.

Mechanical invalidity is limited to missing/corrupt session input, unresolved active branch, unavailable required graph readback, or a run that never reaches the relevant carrier due to provider/harness failure. A structurally valid run with wrong choreography is `fail`, not mechanically invalid.

### Risks and Assumptions

- RISK: parsing rendered Markdown instead of durable details makes the report presentation-coupled → MITIGATION: classify from active-branch JSONL entries, tool names/arguments, validated details, and canonical graph/readback facts.
- RISK: a checker encodes the desired sequence so loosely that every run passes → MITIGATION: contrastive fixtures include each original rival: heavyweight digest review, post-digest clarification, combinatorial choices, advisory laundering, and post-approval mutation.
- RISK: a checker encodes human quality as keywords → MITIGATION: emit explicit pending human judgments and never include them in deterministic pass fields.
- ASSUMPTION: current JSONL/tool-result details expose enough ordering and settlement identity to classify every mechanical marker.
  → IMPACT IF FALSE: Card 2 cannot produce trustworthy reports.
  → VALIDATE: fixture tests use a faithful passing trace plus one rival trace per marker; if a required marker is unobservable, stop and route to `ln-oracles` rather than infer it.

### Posture check

- **Lights up:** one text-native classifier over the actual provider-run carrier.
- **Stabilizes:** the boundary between deterministic conduct facts and human semantic judgments.
- **Information gain:** landing proves whether the existing transcript/graph surfaces are sufficient to judge R8–R10 without another runtime event spine.

### Acceptance Criteria

```text
✓ provider-conduct-report.test.ts passing fixture — exact R8/R9/R10 passes and cited entry/toolCall ids
✓ provider-conduct-report.test.ts rival table — each forbidden choreography flips only its owned marker/verdict
✓ provider-conduct-report.test.ts malformed/mechanical table — corrupt or carrier-less inputs classify mechanically_invalid, never pass
✓ provider-conduct-report.test.ts semantic boundary — report lists human judgments and contains no generated semantic verdict
✓ source CLI fixture — writes schema-validated report.json + concise summary and exits 0 only when all deterministic R8/R9/R10 markers pass
✓ built CLI fixture — dist entry produces normalized-equivalent report apart from declared generatedAt/path fields
```

### Invariants preserved

- JSONL active-branch semantics, not append-order history, own session classification — guarded by: sibling-branch rival fixture.
- Reports are evidence projections, never transcript/graph/session truth — guarded by: read-only boundary test and zero workspace mutation assertion.
- Existing structured-exchange schemas remain the sole detail vocabulary — guarded by: imports from canonical schema/projection homes rather than restated DTOs.

### Verification Approach

- Inner: schema/fixture/contrastive unit tests over faithful minimal active-branch traces.
- Middle: source-vs-built CLI differential over a temporary real session/workspace fixture with zero mutation before/after.
- Outer: none; Card 2 owns authenticated and human evidence.

### Cross-cutting obligations

- Reuse the normal scratch→promotion artifact contract; do not add a sidecar evidence store.
- Do not modify product prompts, exchange schemas, or conduct while building the observer.
- Mark any simplification ceiling explicitly, including the bounded three-run/report vocabulary.

### Expected touched paths (tentative)

```text
src/probes/
├── provider-conduct-report.ts                                  +
└── __tests__/provider-conduct-report.test.ts                   +
package.json                                                     ?  (only if a named script materially improves the runbook)
memory/PLAN.md                                                   ~
memory/cards/walkthrough-remediation-2--provider-conduct-evidence.md ~
```

## Card 2 · Three controlled authenticated runs — `invalidated; paused before extractor/oracle reconciliation`

### Target Behavior

Under the landed amended D27-L contract, three fresh controlled authenticated runs determine whether the ingest carrier produces the required digest, questionnaire, honest per-item settlement, and atomic review conduct. Count starts at 0/3; the stopped run is not replaced or counted.

### Cold-start reads

- `memory/SPEC.md` — D27-L, D38-L, D99-L, D106-L, D110-L, D116-L; I15-L, I57-L; §Verification Design “FE-1187 controlled provider conduct gate”
- `memory/PLAN.md` — frontier: `walkthrough-remediation-2`; R8–R10 verification and current sequencing
- `TESTING_FINDINGS.md` — R8, R9, R10
- `docs/praxis/manual-testing.md` — authenticated workbench, artifact, and findings-ledger discipline
- `.fixtures/seeds/workspace-alpha-grounding/base.json` — fixed starting graph
- `.fixtures/workbenches/workspace-alpha-grounding/FOREIGN-SPEC-NOTES.md` — fixed foreign source; required SHA-256 `1679e23ab02b27f0f5e7a1be8aade97a77ebc1b981f9bc4b5d3798640a80d19c`
- `testing/walkthroughs/2026-07-14/remediations-3a.md` §3 — original failure evidence

### Boundary Crossings

```text
fixed five-node/three-edge seed + fixed foreign source + fixed actor policy
→ authenticated recommended provider/model TUI session
→ present_digest feedback + bounded clarification carrier
→ direct advisory capture and/or one cohesive mixed-settlement review
→ Pi JSONL + proposed-status projection + graph/LSN/readback + provider/model-stamped run report
→ R8–R10 findings disposition
```

### Controlled run protocol

#### Constants

- Exactly three fresh independent counted runs after the contract/extractor revision; do not count the stopped partial run or replace a failed counted run with a cleaner rerun.
- Reset `workspace-alpha-grounding/base` before each run so no graph/session state crosses runs.
- Verify the foreign-source checksum before each run; copy the exact source into the run’s scratch artifact before any later reset.
- Use the fixed tuple `anthropic / claude-sonnet-4-6 / low` for all three. The sealed/default thinking level may appear as `medium`; explicitly change it to `low` before choosing the process move. If the tuple cannot remain fixed, stop rather than compare unlike runs.
- Use one normal-width TUI and the same terminal theme for conduct classification. Both-theme presentation judgment remains in the consolidated outer checkpoint.
- Record UTC start/end, branch/commit, Pi version, provider/model/thinking, seed ref, source hash, session JSONL path, and graph LSN before/after.

#### Fixed actor policy

1. Set thinking to `low`, then enter Specify mode using **Work via intent**.
2. If selecting Work via intent immediately opens the startup ask observed in the partial run, cancel it before sending the counted instruction; handle this setup beat identically in all runs.
3. Give the same instruction in each fresh run: `Read FOREIGN-SPEC-NOTES.md as foreign source material for this specification. Help me confirm your understanding, clarify what materially remains unclear, then map the confirmed material with its stated maturity preserved.`
4. For digest feedback, accept only when the abstract faithfully distinguishes accepted claims, exploratory sketches, unresolved conflict, constraints, and open questions; otherwise give one concise factual correction grounded only in the source.
5. When several material questions remain, answer the bounded questionnaire from the source only. Use `Unknown / not decided in the source` rather than inventing facts. Preserve the same answers across semantically equivalent questions.
6. If one material question remains, answer the standalone confirmation/ask directly.
7. Approve a cohesive review when every proposed node and edge has a visible, source-honest settlement; advisory and settled items may appear together. Reject/request changes if any item is laundered or its status is not inspectable. Do not manually request a different choreography merely to make the run pass.

#### Artifact capture

For each run, create `.fixtures/scratch/provider-conduct/<run-id>/` containing:

```text
source.md          exact foreign source copy
session.jsonl      source Pi transcript copied before reset
report.json        extractor-owned provider/model stamps + deterministic conduct markers + graph/LSN effects
report.md          extractor-owned concise evidence summary
notes.md           bounded human judgments/corrections only
```

After the run settles and before reset, invoke the Card 1 source CLI against the live workspace/session with explicit `run-id`, seed ref, source path/hash, spec id, and captured pre-run LSN; write directly into that run's scratch directory. Then copy the source JSONL there and run the built CLI against the same inputs as the source-vs-built differential. `report.json`/`report.md` are extractor-owned; do not hand-author transcript, marker, or graph rows. Promote reviewed evidence to `.fixtures/runs/fe-1187-provider-conduct/<run-id>/` only after all three reports and source JSONLs are inspected. A failed run remains evidence and is promoted with its honest classification when it bears on the verdict.

### Conduct decision tree

```text
run completion
├── mechanical/runtime invalidity
│   ├── provider unavailable, harness crash, corrupt artifact, or product tool cannot execute
│   └── stop and route through ln-diagnose; do not count or replace the run
└── valid conduct sample
    ├── R8 digest choreography
    │   ├── present_digest precedes mapping
    │   ├── ordinary free-text correction/confirmation is available
    │   ├── material clarification completes before mapping
    │   └── no heavyweight approve/request-changes/reject digest review rival
    ├── R9 questionnaire conduct
    │   ├── several material questions use one bounded questionnaire
    │   ├── independently keyed questions remain independently answerable
    │   └── no combinatorial/permutation option rival
    └── R10 settlement/review conduct
        ├── direct advisory mutation remains a valid path when no review is used
        ├── any review set is one cohesive proposition with every node/edge settlement visible
        ├── advisory and settled drafts may coexist when source-honest
        ├── approval preserves every reviewed settlement through one atomic seam
        └── no model-authored post-approval mutate_graph completes or rewrites the proposal
```

A valid sample fails if any required marker is absent or any forbidden rival occurs. Do not reinterpret a failure as “close enough” because later output looks correct.

### Risks and Assumptions

- RISK: the actor over-coaches the model into the expected choreography → MITIGATION: fix only the task and answer policy; never name `present_digest`, questionnaire, advisory capture, or review tools in user turns.
- RISK: semantically equivalent model questions make actor answers drift → MITIGATION: answer from the fixed source and retain the exact answer text in `notes.md`.
- RISK: a provider/tool outage is mistaken for conduct failure → MITIGATION: classify mechanical invalidity separately and route to `ln-diagnose`; do not silently replace the run.
- RISK: reset destroys the only session artifact → MITIGATION: copy source JSONL and source material into the scratch run before the next reset.
- ASSUMPTION: the fixed source remains rich enough to elicit material clarification and both advisory and settled material.
  → IMPACT IF FALSE: R9/R10 cannot be judged; the scenario—not conduct—failed.
  → VALIDATE: run 1 must expose at least two material questions and mixed maturity; otherwise stop and rescope the input rather than continuing two vacuous runs.

### Posture check

- **Lights up:** the first repeated authenticated witness over the built digest → questionnaire → direct advisory and/or mixed-settlement review path.
- **Stabilizes:** the behavioral boundary between the landed mixed-settlement carriers and provider conduct that actually chooses them.
- **Information gain:** 3/3 passes close R8–R10 provider conduct; any honest failure identifies whether prompt guidance, scenario framing, or runtime mechanics owns the next seam.

### Acceptance Criteria

```text
✓ source checksum command — all three runs use SHA-256 1679e23…a80d19c
✓ three report.json files — exact provider/model/thinking tuple and deterministic marker fields are present
✓ three source session.jsonl files — each report cites exact entry ranges for digest, clarification, mapping, review, and any post-review mutation
✓ report checker/manual report audit — every valid run passes all R8/R9/R10 required markers and no forbidden rival; closure requires 3/3
✓ graph/LSN readback — each accepted proposition has one honest atomic receipt and every accepted node/edge settlement exactly matches the reviewed value
✓ TESTING_FINDINGS.md — R8/R9/R10 each names the three-run verdict and evidence paths; failures are fixed/promoted/retired with an owner, never merely deferred
✓ memory/PLAN.md — provider gate is marked complete only on 3/3; otherwise the observed correction route becomes the next action
```

### Invariants preserved

- Workbench `.brunch/` state remains ephemeral and is never committed as fixture truth — guarded by: `docs/praxis/manual-testing.md`.
- Pi JSONL remains canonical session evidence; `notes.md` and debug mirrors cannot override it — guarded by: report entry-range citations.
- Exact review settlement stays one CommandExecutor call, one LSN, and one change-log entry while preserving every reviewed node/edge status — guarded by: graph/LSN report fields and revised D27-L tests.
- No scenario failure authorizes implementation during this evidence card — guarded by: stop condition and findings-ledger promotion.

### Verification Approach

- Inner: existing questionnaire, digest successor, settlement, and Impact Ledger suites remain the mechanical baseline; no code gate rerun is required unless tracked implementation changes.
- Middle: three authenticated, provider/model-controlled JSONL + graph differential reports over one reset seed/source pair; 3/3 with no forbidden rival is the conduct gate.
- Outer: the same three TUI sessions supply bounded human judgment of question materiality and proposition cohesion; full fatigue, both-theme, and Impact Ledger presentation judgment remains owned by `memory/cards/walkthrough-remediation-2--consolidated-outer-checkpoint.md` after A48-L.

### Cross-cutting obligations

- Do not absorb A48-L, R6/R13 presentation judgment, web graph audit, or KA-owned O7–O9 into these runs.
- Provider/model stamps and raw failed samples remain visible; no cherry-picked replacement runs.
- Findings dispositions must name an owner and re-entry trigger under the manual-testing protocol.
- After three fresh runs, A48-L remains the next planned scope/build unit unless an R8–R10 failure creates a higher-priority bounded correction.

### Expected touched paths (tentative)

```text
.fixtures/
├── scratch/provider-conduct/<run-id>/                            +  (gitignored, three runs)
└── runs/fe-1187-provider-conduct/<run-id>/                       +? (only reviewed promotion)
TESTING_FINDINGS.md                                               ~
memory/PLAN.md                                                    ~
memory/cards/walkthrough-remediation-2--provider-conduct-evidence.md - (delete after terminal disposition)
```
