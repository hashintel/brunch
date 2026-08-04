# Brunch execution-oracle smoke

Frontier: execution-comparison-tracer
Status:   active
Mode:     single
Created:  2026-07-20

## Orientation

- Containing seam: controller-owned execution evaluation over Brunch's existing `empty_dir` plan/run/Petri/promotion pipeline; the comparison harness is dev/evaluation tooling, not product runtime.
- Frontier: `execution-comparison-tracer` (FE-1230), child of FE-1211 and independent of the private elicitation-mission namespace.
- Volatile state: the Opus 4.8 Brunch Specify run produced a human-approved build-ready Petri-editor specification, now frozen at `testing/execution-comparisons/cases/minimal-petri-net-editor/spec.md`; the initial `/compare-specs` controller stalled before harness launch, so that input-generation attempt is diagnostic and not comparison evidence.
- Main open risk: an implementation-neutral hidden browser suite cannot drive independently generated UIs without leaking exact tests; the approved resolution is a minimal public runtime/accessibility contract plus hidden scenarios and reference-model expectations.

Posture: proving (inherited from `execution-comparison-tracer`).

## Target Behavior

The approved Petri-editor case drives one isolated Brunch Execute run to `promotion_prepared` and evaluates its output with the frozen controller-only oracle pack without host landing.

## Cold-start reads

- `memory/SPEC.md` — D40-L, D120-L, I62-L; Verification Design sections for FE-1230 diagnostic, loop-tier strategy, design boundary, and blind spots
- `memory/PLAN.md` — frontier: `execution-comparison-tracer`
- `testing/execution-comparisons/cases/minimal-petri-net-editor/spec.md` — approved lane-neutral product specification
- `testing/comparisons/missions/minimal-petri-net-editor.md` — private elicitation origin only; never copy into an execution lane
- `docs/praxis/comparison-runs.md`, `comparison-runs/mission-packet.md`, and `comparison-runs/judgment-prompt-pack.md` — validity, retention, masking, split-judgment, and promotion discipline
- `src/dev/TOPOLOGY.md` — dev/evaluation harness ownership
- `src/executor/TOPOLOGY.md` — `empty_dir`, frozen plan, Petri journal, promotion, and no-landing boundaries
- `src/app/TOPOLOGY.md` — real planner/agent/test/promotion port composition
- `docs/praxis/manual-testing.md` — browser/TUI control and cleanup rules

## Public case contract

Only the following material enters the lane:

```text
case:
  id: minimal-petri-net-editor-v1
  specification: spec.md
  model: anthropic/claude-opus-4-8
  repository: fresh empty git repository at a frozen empty base commit
  elapsed_budget_minutes: 90
  mechanical_intervention_budget: 2
  substantive_human_interventions: 0

delivery:
  npm_test: required
  npm_build: required
  static_output: dist/
  runtime_network: forbidden

accessible_names:
  application: Petri net editor
  canvas: Petri net canvas
  controls:
    - Add place
    - Add transition
    - New net
    - Reset marking
    - Export JSON
    - Import JSON
  dynamic:
    - "Place: <label>"
    - "Transition: <label> (enabled|disabled)"
  inspector_fields:
    - Label
    - Initial tokens
    - Arc weight
  feedback:
    invalid input or import is exposed through role=status or role=alert
```

The accessibility contract names semantics needed by one common black-box controller; it does not prescribe framework, source layout, rendering library, state model, test library, visual treatment, or implementation decomposition. Exact journeys, coordinates, fixtures, malformed files, expected markings, reference-model states, and label mapping stay controller-only.

The case manifest records exact Brunch, Pi, provider/model, Node/npm, OS/architecture, package-lock, public-packet, oracle-pack, and actor-recipe versions/hashes. Dependency installation may use the same predeclared package-registry policy for every lane; the built application itself must require no network.

## Boundary Crossings

```text
→ human-approved execution specification
→ content-addressed public case/runtime/accessibility packet
→ fresh empty target repository
→ Brunch Specify import/backfill only as required by the real product
→ Brunch Execute plan synthesis and admission
→ empty_dir run → slice execution → verification → Petri export
→ promotion_prepared (hard stop; no /brunch:land)
→ harvested runBaseSha..reviewSha implementation
→ controller-owned build/test/static-serve/browser/reference-model oracles
→ common mechanical report + Brunch-only diagnostic appendix
→ retained scratch attempt with validity and cleanup status
```

## Risks and Assumptions

- RISK: the hidden suite accidentally enters the target cwd or prompt → MITIGATION: path-separation tests enumerate target files before launch and scan public packets/manifests for controller-only paths, fixture ids, expected states, and oracle hashes.
- RISK: the accessibility contract over-steers implementation → MITIGATION: constrain only externally observable names and the static build boundary; keep architecture, source shape, interaction layout, and exact tests hidden.
- RISK: executor-authored tests substitute for independent acceptance → MITIGATION: run one byte-identical controller-owned suite after harvesting; lane tests are retained evidence but never satisfy hidden checks by themselves.
- RISK: visual polish launders a broken domain model → MITIGATION: mechanical build/browser/reference-model gates run first and cannot be overridden by judgment.
- RISK: a mechanically correct but unusable UI passes → MITIGATION: catastrophic absence/unreachability/impossible interaction is a gate; ordinary hierarchy, clarity, and feel receive separate masked qualitative review.
- RISK: Brunch-only telemetry contaminates the cross-product result → MITIGATION: common report fields are a closed schema; Petri/JSONL/debug enrichment lives only in an unblinded Brunch appendix.
- RISK: a failed or invalid first attempt is silently replaced → MITIGATION: every attempt is immutable and retained with the predeclared validity reason; replacement is allowed only for provider/adapter/mechanical invalidity, never poor output.
- RISK: promotion mutates the host → MITIGATION: stop at `promotion_prepared`, inspect the durable review ref, and make any `landed` status or `/brunch:land` invocation a hard invalidity.
- ASSUMPTION: the public roles/names are sufficient for one implementation-neutral browser journey.
  → IMPACT IF FALSE: the controller must either widen the public contract or use per-lane adaptive tests, invalidating the intended unchanged-oracle comparison.
  → VALIDATE: a selector-contract fixture with two deliberately different DOM implementations must pass the same locator layer before the real lane runs.
- ASSUMPTION: Brunch can consume the approved Markdown specification, synthesize a valid plan, and reach `promotion_prepared` from `empty_dir` without host landing.
  → IMPACT IF FALSE: FE-1230 becomes an executor-adapter/product-gap diagnosis before Claude comparison is meaningful.
  → VALIDATE: this Brunch-only vertical smoke.

## Posture check

- **Lights up:** frozen case → real Brunch plan/run/Petri/promotion path → independent hidden browser/Petri verdict.
- **Stabilizes:** the execution-case artifact boundary, public-vs-controller separation, common lane report, and `promotion_prepared` stop.
- **Uncertainty retired by landing:** whether FE-1210's evidence discipline can become a valid execution-side tracer without a generic runner or automatic landing.
- A failed Brunch smoke is still informative completion for this slice when the exact product/adapter boundary is captured and FE-1230 is replanned rather than papered over.

## Acceptance Criteria

- ✓ `src/dev/execution-comparison/__tests__/case-contract.test.ts` — the public packet parses, hashes all visible files, pins the approved spec/model/base/budgets/build output, and contains no controller-only path, fixture, expected marking, label mapping, or hidden-oracle content.
- ✓ `src/dev/execution-comparison/__tests__/accessibility-contract.test.ts` — two structurally different DOM fixtures satisfy one role/name locator contract; missing or duplicate required semantics fail before any campaign lane.
- ✓ `src/dev/execution-comparison/__tests__/petri-reference.test.ts` — a tiny independent weighted P/T model covers enablement, disabled firing, weighted consume/produce, conflicts resolved by selected transition, reset, and unbounded places.
- ✓ `src/dev/execution-comparison/__tests__/artifact-contract.test.ts` — success, failure, exhaustion, and invalidity retain immutable manifest, public-packet hash, final git range, common command/browser results, intervention ledger, terminal state, and cleanup; unavailable common metrics serialize as `not_assessable`.
- ✓ `src/dev/execution-comparison/__tests__/packet-redaction.test.ts` — masked outcome packets contain only label, final tree/diff, common mechanical results, and public contract; unblinded process packets contain normalized visible evidence and exclude hidden reasoning, controller fixtures, and Brunch-only diagnostics.
- ✓ `src/dev/execution-comparison/__tests__/browser-oracle.slow.test.ts` — the unchanged controller suite builds and serves `dist/`, observes no startup console/module errors, locates every public role/name, and exercises create/move/release/rename/delete, valid/invalid arcs, value validation, enable/fire/reset, reload, JSON round-trip, malformed import, cascade delete, and new/clear against a known-good fixture app.
- ✓ `src/dev/execution-comparison/__tests__/brunch-lane.test.ts` — the deterministic adapter projects the frozen public packet into complete greenfield and opaque brownfield execution seeds and rejects incomplete planning truth.
- ○ Outer witness — replay unchanged `petri-editor-browser-v2` against both retained outputs, prove the `promotion_prepared` / never-`landed` boundary and complete `runBaseSha..reviewSha` tree, then promote only bounded evidence. This remains PLAN-owned KA evidence, not a missing test file.
- ✓ `npm run check:promoted-run-paths` and `npm run verify:full` — no scratch/runtime paths enter tracked evidence and the full gate passes because the slice adds/touches slow browser and execution seams.

## Invariants preserved

- Host mutation remains user-confirmed and outside comparison — guarded by: terminal-state assertion, command/process ledger scan, and existing landing tests.
- Executor lifecycle/Petri journal order stays authoritative — guarded by: existing executor full suite plus retained run/Petri replay checks.
- Controller-only oracle material never becomes product prompt/workspace input — guarded by: packet/path separation and redaction negative tests.
- Failed/invalid attempts remain evidence rather than being erased — guarded by: immutable attempt-store contract tests.
- Scratch evidence is non-canonical until reviewed promotion — guarded by: tracked-path checks and existing `check:promoted-run-paths`.

## Verification Approach

- Inner: public/controller schema and hash checks, selector-contract rivals, independent Petri reference-model tests, artifact/validity schemas, packet redaction, and no-landing negative space.
- Middle: one unchanged slow black-box browser/metamorphic suite plus one real Brunch `empty_dir` execution-to-promotion smoke using the controller suite after harvest.
- Outer: inspect the retained Brunch attempt for catastrophic usability, evidence completeness, and process legibility; do not compare products or declare a winner in this slice.

## Cross-cutting obligations

- Keep execution cases under `testing/execution-comparisons/`; do not put approved execution input or hidden oracles under the private `testing/comparisons/missions/` namespace.
- Reuse FE-1210's split judgment, immutable failure retention, masking, and reviewed promotion discipline without copying elicitation question/reveal mechanics that do not apply to execution.
- The common evidence schema may include only signals available to both eventual lanes; Brunch Petri/JSONL/debug evidence is diagnostic appendix material.
- Record the direct fallback-driven elicitation attempt as input provenance, not as a valid execution comparison lane.
- Do not create `/compare-execution` or a generic campaign framework in this slice.

## Expected touched paths (tentative)

```text
testing/execution-comparisons/
├── README.md                                                    +
└── cases/minimal-petri-net-editor/
    ├── spec.md                                                  ~
    ├── public-contract.json                                     +
    └── controller/
        ├── oracle-manifest.json                                 +
        └── fixtures/                                            +
src/dev/
├── execution-comparison.ts                                     +
├── execution-comparison/
│   ├── case-contract.ts                                         +
│   ├── artifact-contract.ts                                     +
│   ├── accessibility-contract.ts                                +
│   ├── petri-reference.ts                                       +
│   ├── browser-oracle.ts                                        +
│   ├── brunch-lane.ts                                           +
│   └── __tests__/                                               +
├── dev-cli.ts                                                   ?
└── TOPOLOGY.md                                                  ~
package.json                                                     ?
memory/
├── SPEC.md                                                      ~
├── PLAN.md                                                      ~
└── cards/execution-comparison-tracer--brunch-oracle-smoke.md   +
```
