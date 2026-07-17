# Warrant-before-commit ablation campaign

Frontier: capture-ledger-tracer (superseded lineage: consequential-fact-discovery-tracer / FE-1208)
Status:   superseded (2026-07-17 — FE-1210 proved the general actor; `capture-ledger-tracer` now owns the rich mixed-source mission, matched comparison, and architectural verdict while reusing the landed FE-1208 evaluator/report primitives. This card remains historical evidence; do not resume its fixed scenario or six-run directive-ablation campaign.)
Mode:     single
Created:  2026-07-15

## Orientation

- Containing seam: FE-1208's dev/eval-only real-TUI trajectory → consequential-fact evaluator path. Commits `11607e10`, `1e944616`, and `1f36ee18` established canonical active-branch/graph readback plus the calibrated review-diff scorer.
- Frontier: historical FE-1208 proving campaign, superseded by `capture-ledger-tracer`; no active Linear issue or branch is attached to this card.
- Volatile state: no separate handoff survives; this card is the sole historical actor-v2 record. Its corrected scratch trajectory is still diagnostic only; neither that run nor the scorer's hand-authored contrastive fixture counts as provider evidence.
- Main risk: campaign machinery can create a false causal claim by changing more than one prompt feature, relaxing the actor between arms, or promoting only favorable runs. Arm assignment, actor policy, run budget, model configuration, validity rules, and discrimination threshold must be fixed before the first provider run.

Posture: proving (historical FE-1208 posture; this card is no longer executable).

## Target Behavior

A controlled six-run real-TUI campaign produces a promoted, predeclared verdict on whether the warrant-before-commit directive discriminates the calibrated review-diff scenario from its ablated rival.

## Cold-start reads

- `memory/SPEC.md` — req 24; A5-L; §Verification Design, especially consequential-fact discovery, combined trajectory/evaluation assessment, controlled warranted-commitment ablation, flywheel design notes, and acknowledged blind spots
- `memory/PLAN.md` — superseding frontier: `capture-ledger-tracer`
- `docs/praxis/manual-testing.md` — TUI priority order, sandbox fallback, evidence capture, cleanup, and findings-ledger discipline
- `src/dev/TOPOLOGY.md` — trajectory/evaluator/tui-driver ownership and scratch boundary
- `src/.pi/extensions/dev-mode/introspection/TOPOLOGY.md` — provider-visible trajectory contract and content-retention ceilings
- `src/agents/runtime/elicitor/TOPOLOGY.md` — real Specify prompt body/composition seam
- `src/.pi/TOPOLOGY.md` and `src/.pi/extensions/TOPOLOGY.md` — sealed profile and product extension composition root
- `src/session/TOPOLOGY.md` — active-branch and review-set settlement authority
- `src/graph/TOPOLOGY.md` — graph/readback and change-log authority

## Intervention and campaign contract

### Single intervention

- **Control arm:** the current provider-visible elicitor body includes the exact warrant-before-commit paragraph beginning “When a commitment is ready…”.
- **Ablated arm:** one dev/eval-only override removes exactly that paragraph at the real live elicitor composition seam.
- Assign stable directive id `warrant-before-commit` and a content hash to the delimited paragraph. Source delimiters must not become provider-visible text in either arm.
- Product launches, Execute mode, tools, skills, references, graph/session context, and all other elicitor text remain unchanged. The ablation is unavailable unless dev/eval instrumentation is explicitly active.
- The joined trajectory/report must prove the expected directive id/hash is provider-visible in control runs and absent in ablated runs; code-level prompt differential tests prove no other body bytes change.

### Fixed scenario and actor

Use the already calibrated review-diff scenario as the sole scenario:

- public brief: review policy-copy changes and accept a reviewed set atomically
- hidden fact: every accepted policy rewrite retains its source regulator clause identifier verbatim
- forbidden rival: semantic-equivalent text may drop the identifier
- reveal policy: disclose the exact hidden fact only after a compliance/audit/missing-constraint question; otherwise answer from the public brief without leaking it
- approval policy: approve only an exact review set that carries the revealed constraint; request correction when the set omits or contradicts it

The actor is one versioned deterministic policy over the real TUI surface. A small declared keyword/shape matcher may classify the qualifying question; mark its semantic ceiling and retain every classification in the report for human audit. The policy, response strings, turn budget, timeout behavior, startup/menu gestures, and invalid-run rules are identical across arms.

### Fixed run configuration

Before run 1, write one campaign manifest fixing:

- campaign/scenario/actor/rubric versions
- three run ids per arm and arm order
- workspace seed/setup recipe and fresh-workspace reset per run
- provider, model, thinking level, and any provider-supported seed; record `unsupported` rather than inventing a seed when the provider exposes none
- turn budget, timeout budget, TUI dimensions, actor policy, and artifact paths
- the exact control/ablation directive id/hash pair
- validity rules and discrimination threshold

Use one provider/model/thinking combination for all six runs. Do not replace or discard a valid run. A mechanically invalid run may be repeated only under its predeclared rule, with the failed attempt retained and named.

### Predeclared verdict

For each run, the scorer's six atomic judgments remain visible. Define the primary composite before execution as:

```text
warranted_commitment =
  consequential_fact_completeness == pass
  && item_groundedness == pass
  && settlement_correctness == pass
  && forbidden_rival_absence == pass
  && private_leakage_absence == pass
  && duplicate_effect_absence == pass
```

The campaign **discriminates** only when control has at least `2/3` valid composite passes and ablated has at most `1/3`. Report the exact counts and every atomic reason. If this threshold is not met, the slice still lands the valid promoted no-discrimination evidence, but FE-1208 remains open and `memory/PLAN.md` must record the invalidated discrimination expectation instead of tuning the scorer, changing the actor, or selecting different runs post hoc.

## Boundary Crossings

```text
→ fixed campaign manifest + calibrated private scenario
→ dev/eval-only prompt intervention at live elicitor composition
→ product Brunch TUI composition root
→ controlled actor over real PTY/TUI input and visible output
→ provider requests + Pi active-branch transcript + graph settlement
→ joined trajectory + consequential-fact evaluator
→ aggregate predeclared verdict
→ human audit
→ deliberate scratch-to-runs promotion
```

## Risks and Assumptions

- RISK: the override leaks into normal product behavior → MITIGATION: make the option programmatic/dev-eval-only, fail closed outside active instrumentation, and pin product/control prompt equivalence.
- RISK: the two arms differ in more than the directive → MITIGATION: exact body differential test plus first-provider-request directive id/hash evidence for every run.
- RISK: semantic question matching makes the deterministic actor selectively cooperative → MITIGATION: one frozen matcher/policy for both arms, code-adjacent `ceiling:` marker, retained classification evidence, and human audit of all six classifications.
- RISK: provider or TUI failures are laundered as behavioral failures → MITIGATION: predeclare mechanical validity separately from scorer verdicts; retain failed attempts and permit replacement only for named mechanical invalidity.
- RISK: promotion captures secrets or workstation paths → MITIGATION: retain bounded secret-filtered trajectory content, copy only the required JSONL/report/readback/viewport artifacts, normalize paths, and run `check:promoted-run-paths`.
- ASSUMPTION: removing the one warrant directive changes enough conduct for the predeclared 2/3-versus-1/3 rule to discriminate.
  → IMPACT IF FALSE: the evaluator remains calibrated but this intervention does not validate its usefulness on real provider behavior; FE-1208 needs plan revision rather than broader tracing.
  → VALIDATE: execute and retain all six fixed runs, then compute the aggregate verdict without post-hoc rubric/actor changes.
  → `memory/SPEC.md` §Acknowledged Blind Spots: warrant-directive ablation is an intentionally weak rival

## Posture check

- **Lights up:** the complete real TUI → controlled actor → joined trajectory → evaluator → aggregate verdict → promoted regression path.
- **Stabilizes:** a dev/eval-only single-directive intervention, fixed campaign manifest, and scratch→audit→promotion contract.
- **Uncertainty retired by landing:** whether the calibrated evaluator and landed legibility envelope discriminate the real provider's conduct under the selected single intervention.
- A positive result closes the synthetic A/B portion of FE-1208. A negative result is still information gain but triggers `ln-plan`; it must not be repaired by expanding the evaluator, adopting OTel, or changing campaign conditions in this slice.

## Acceptance Criteria

- ✓ `src/agents/runtime/elicitor/__tests__/compose-live-prompt.test.ts` — control output preserves the current provider-visible elicitor body, ablated output removes only stable directive `warrant-before-commit`, source delimiters are absent in both, and the directive hash is stable.
- ✓ `src/.pi/extensions/__tests__/agent-runtime-system-prompts.test.ts` plus the real app composition test — product launches cannot select ablation; explicit dev/eval launches wire the chosen arm through `before_agent_start` and `before_provider_request` without changing active tools, skills, references, runtime control, or Execute prompting.
- ✓ joined trajectory tests — every run report validates the directive id/hash and expected arm state at the provider boundary; mismatched arm evidence fails before scoring.
- ✓ campaign actor/state-machine tests — legal TUI traces obey one frozen reveal/approval policy and turn budget; hidden facts never appear before a qualifying question; omitted/contradictory review sets receive the predeclared correction response; unknown states/timeouts fail mechanically rather than improvising.
- ✓ campaign manifest/report tests — arm order, three run ids per arm, fixed provider/model/thinking/setup/actor/budget, validity rules, artifact inventory, atomic scorer reasons, and the 2/3-versus-1/3 rule are runtime-validated and byte-stably reprojected.
- ✓ campaign integration test — a deterministic fake-provider or replay fixture drives the same production TUI composition, actor, joined-report, evaluator, and aggregate entry points end to end; the harness does not inject prompt wiring or graph outcomes unavailable to the real command.
- ✓ six real-provider run bundles under `.fixtures/scratch/` — three valid control and three valid ablated runs use fresh workspaces and the fixed manifest; each retains run config, source `session.jsonl`, joined `trajectory.json`/report, bounded viewport, graph readback, evaluator verdict/reasons, and cleanup status.
- ✓ human calibration record — the user/coordinator audits all six reveal-policy classifications and at least one full atomic-reason chain per arm, recording agreement/disagreement without editing run outputs; any material disagreement blocks promotion and routes through `ln-oracles`.
- ✓ promoted campaign bundle under `.fixtures/runs/consequential-fact-ablation/<campaign-id>/` — contains the immutable campaign manifest, all six reviewed run bundles, aggregate JSON/Markdown verdict, calibration record, and portable artifact references; no scratch-only or credential material is copied.
- ✓ `npm run check:promoted-run-paths` and `npm run verify` — promotion is portable and the full project gate passes with no unexplained skipped-test increase.

## Invariants preserved

- Normal Brunch and Execute prompts remain unchanged unless explicit dev/eval instrumentation selects the ablation — guarded by: prompt differential, app composition, and Execute prompt tests.
- One intervention changes per campaign; directive presence/precedence supports causality only inside this controlled comparison — guarded by: fixed manifest validation and bounded-claim report text.
- Pi active branch and Brunch spec-scoped graph readers remain evidence authority — guarded by: campaign integration and per-run evaluator reports.
- Review-set approval remains the only atomic settled-batch commit path — guarded by: existing I15-L settlement suites plus per-run single-effect scorer judgment.
- Hidden facts never enter provider input through the campaign harness before actor reveal — guarded by: actor policy tests, provider-boundary trajectory evidence, and human calibration.
- Scratch artifacts are non-evidence until reviewed and promoted deliberately — guarded by: promotion command/check plus manifest artifact-state validation.

## Verification Approach

- Inner: prompt differential, runtime boundary schemas, actor state-machine, aggregate verdict, artifact hygiene, and deterministic replay tests.
- Middle: deterministic production-entry campaign replay plus six real-provider TUI runs scored from canonical session/graph/trajectory artifacts.
- Outer: user/coordinator audit of all reveal classifications and sampled atomic reasons before promotion; the audit is owned by this card and is not deferred.

## Cross-cutting obligations

- Use the real TUI/product composition root; test-only prompt injection or direct graph seeding of expected outcomes cannot satisfy the campaign integration or real-run leaves.
- Keep traces and campaign artifacts dev/eval-only and non-authoritative; no product event spine or runtime scoring behavior.
- Deterministic checks own structure and negative space; human labels calibrate only residual semantic classification.
- Preserve product-neutral scenario/run/verdict fields while keeping Brunch directive/trajectory enrichment diagnostic.
- Retain and restate the bounded claim: this ablation validates evaluator discrimination only, not broad Brunch quality, practical usefulness, or competitor superiority.
- Do not add OTel, broad subagent spans, provider matrices, competitor execution, generic scorecards, interaction-quality scoring, or a second artifact system.
- After a positive campaign, FE-1208 still owes one mined real walkthrough failure before practical-quality claims; scope that separately rather than pulling it into this build.

## Expected touched paths (tentative)

```text
src/agents/prompts/elicitor.md                                  ~
src/agents/runtime/
├── foreground-policy.ts                                       ~
└── elicitor/
    ├── compose-live-prompt.ts                                  ~
    ├── __tests__/compose-live-prompt.test.ts                   ~
    └── __snapshots__/live-elicitor-prompt.md                   ?
src/.pi/extensions/
├── agent-runtime/system-prompts/index.ts                       ~
├── dev-mode/introspection/trajectory.ts                        ~
├── dev-mode/introspection/TOPOLOGY.md                          ~
├── __tests__/agent-runtime-system-prompts.test.ts              ~
└── __tests__/dev-mode-introspection.test.ts                    ~
src/app/
├── brunch.ts                                                   ~
├── brunch-tui.ts                                               ~
├── pi-extensions.ts                                            ~
├── TOPOLOGY.md                                                 ?
└── __tests__/brunch-tui.test.ts                                ~
src/dev/
├── consequential-fact-evaluator.ts                             ~
├── consequential-fact-campaign.ts                              +
├── consequential-fact-evaluator/
│   ├── actor.ts                                                +
│   ├── campaign.ts                                             +
│   └── review-diff-scenario.json                               +
├── dev-cli.ts                                                  ~
├── TOPOLOGY.md                                                 ~
└── __tests__/
    ├── consequential-fact-evaluator.test.ts                    ~
    ├── consequential-fact-campaign.test.ts                     +
    ├── dev-cli.test.ts                                         ~
    └── fixtures/consequential-fact-review-diff.json            -
.fixtures/runs/consequential-fact-ablation/<campaign-id>/       +
memory/PLAN.md                                                  ~
```
