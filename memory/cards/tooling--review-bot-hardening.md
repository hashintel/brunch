# Review-bot artifact and drift hardening

Frontier: n/a
Status:   active
Mode:     chain
Created:  2026-06-09

## Orientation

- **Containing seam:** probe/dev verification artifacts and drift guards. The sampled review comments are not product behavior requests; they expose false-proof risks in artifact writers, committed probe reports, coverage-ledger tests, and the dev introspection loop.
- **Relevant frontier item:** no single active `memory/PLAN.md` frontier owns all fixes. The comments came from PR #178 (`elicitation-backlog`, runtime affordances, capture-quality) and PR #180 (`dx-feedback-loops`), while the current branch is PR #186 over PR #180. Treat this as repo/tooling hardening on the current stack, not a new Linear/Graphite frontier.
- **Volatile handoff state:** `HANDOFF.md` describes unrelated graph PULL design work; do not chase that thread here. Existing `memory/cards/runtime-affordances--coverage-ledger.md` is stale/consumed per `memory/PLAN.md` (`runtime-affordances-and-legality` is done); this file owns only the review-bot drift-guard repair.
- **Main open risk:** widening into a generic artifact framework. Keep the slice to the sampled contracts: portable artifact IDs, portable committed reports, exact drift-guard keys, accurate capture verdict prose, and turn-correlated introspection artifacts.

Posture: proving (inherited from `.pi/POSTURE.md`; no containing PLAN frontier).

Cross-cutting obligations for the chain:

- Stakes are high: validate boundary input used as a filesystem path segment; fail loud on path traversal or separator-bearing IDs.
- Preserve pre-release/free-rewrite posture: regenerate stale committed artifacts rather than adding compatibility shims or accepting both old/new artifact contracts.
- Preserve D39-L/D69-L: introspection remains dev-gated/read-only and observes product prompts; it must not shape product behavior.
- Preserve D60-L coverage discipline: drift guards must certify exact contracts, not lossy projections that can hide drift.
- Keep fixes scoped to existing probe/dev/test seams; do not add a generic artifact platform or new planning ledger.

## Card 1 — Safe artifact run IDs

Status: done
Weight: full

### Target Behavior

Every probe/dev artifact writer rejects `runId` values that are not portable single path segments before constructing an on-disk artifact path.

### Boundary Crossings

```pseudo
→ CLI/options runId input
→ shared run-id validation / normalization seam
→ probe/dev artifact path construction
→ .fixtures/runs/** writes
```

### Risks and Assumptions

```pseudo
- RISK: each probe grows a local regex and the contract drifts.
    → MITIGATION: add one shared helper near existing report portability code and reuse it at every artifact path boundary.
- RISK: default generated run ids are accidentally rejected.
    → MITIGATION: assert current default run-id shapes remain valid.
- ASSUMPTION: run ids only need to be portable path segments, not human-title slugs.
    → IMPACT IF FALSE: artifact naming UX may need a richer slugification policy, but safety still holds.
    → VALIDATE: reject `..`, `/`, `\\`, empty ids, and basename-changing values; accept existing checked-in run-id shapes.
```

### Posture check

Proving slice. It scores on **invariants** by making the artifact-id-as-path-segment contract explicit and on **proof of life** by exercising the real artifact writers that currently interpolate `runId`. The slice retires a silent path-escape failure mode without introducing a new artifact framework.

### Acceptance Criteria

```pseudo
✓ shared run-id tests — invalid ids such as `../escape`, `nested/run`, `nested\\run`, `.`, `..`, and empty strings fail loudly.
✓ shared run-id tests — existing default/sample ids such as `2026-06-08-capture-quality-sample`, `fixture-curation-2026-06-05T104440Z`, and `introspection-2026-06-09T000000000Z` remain valid or are adjusted to a documented valid default shape.
✓ artifact-writer tests — each writer that interpolates `runId` into `.fixtures/runs/**` uses the shared validation before writing.
```

### Verification Approach

- Inner: unit tests for the shared run-id validator and one representative writer per artifact family.
- Middle: targeted existing probe/dev artifact tests for capture-quality, public RPC parity/propose/review/fixture curation, submit/capture proofs, and introspection launcher where they already cover artifact paths.

### Cross-cutting obligations

- Do not preserve unsafe run-id compatibility; reject unsafe input.
- Keep the helper narrow: validate artifact path segments only.

### Expected touched paths (tentative)

```pseudo
src/probes/
├── portable-report.ts                         ~
├── portable-report.test.ts                    +
├── capture-quality-loop.ts                    ~
├── capture-quality-loop.test.ts               ~
├── project-graph-review-cycle-proof.ts        ~
├── project-graph-review-cycle-proof.test.ts   ~
├── propose-graph-commit-proof.ts              ~
├── propose-graph-commit-proof.test.ts         ~
├── public-rpc-parity-proof.ts                 ~
├── public-rpc-parity-proof.test.ts            ~
├── fixture-curation-loop.ts                   ~
├── fixture-curation-loop.test.ts              ~
├── capture-response-to-graph-proof.ts         ~
├── capture-response-to-graph-proof.test.ts    ~
├── submit-message-capture-proof.ts            ~
└── submit-message-capture-proof.test.ts       ~
src/dev/
├── introspection-launcher.ts                  ~
└── introspection-launcher.test.ts             ~
```

## Card 2 — Portable capture-quality sample report

Status: done
Weight: light

### Objective

The checked-in capture-quality sample report reflects the probe writer’s portable-cwd contract.

### Acceptance Criteria

```pseudo
✓ `.fixtures/runs/capture-quality/2026-06-08-capture-quality-sample/report.json` no longer contains a developer-machine absolute cwd.
✓ A focused fixture-residue check or existing artifact test would fail if that sample report regressed to `/Users/...` cwd.
```

### Verification Approach

- Inner: focused grep/test over the capture-quality sample report plus existing capture-quality artifact test.

### Cross-cutting obligations

- Regenerate or rewrite the committed artifact to the current writer contract; do not field-patch a token while leaving stale generated structure.

### Assumption dependency

None — this is artifact residue cleanup under an already-established portability contract.

### Expected touched paths (tentative)

```pseudo
.fixtures/runs/capture-quality/2026-06-08-capture-quality-sample/
└── report.json                                 ~
src/probes/
└── capture-quality-loop.test.ts                ?
```

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Card 3 — Accurate capture-quality negative verdict

Status: done
Weight: light

### Objective

The capture-quality verdict text names high-confidence false commits as the failure condition measured by `falseCommitCount`.

### Acceptance Criteria

```pseudo
✓ `verdictFor` negative output no longer says `low-confidence` when `falseCommitCount > 0`.
✓ The existing false-commit test asserts the corrected wording or a precise substring that would catch the old mismatch.
```

### Verification Approach

- Inner: `src/probes/capture-quality-loop.test.ts` false-commit verdict case.

### Cross-cutting obligations

- Keep A22-L’s false-commit guard semantics intact: low-confidence implications remain out of graph truth; high-confidence false commits block graduation.

### Assumption dependency

None — this is diagnostic wording aligned to existing test semantics.

### Expected touched paths (tentative)

```pseudo
src/probes/
├── capture-quality-loop.ts        ~
└── capture-quality-loop.test.ts   ~
```

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Card 4 — Exact runtime-affordance drift guard

Status: done
Weight: light

### Objective

The runtime-affordance coverage test certifies the exact `AffordanceAxis` field contract instead of mapping unknown fields into expected ledger rows.

### Acceptance Criteria

```pseudo
✓ `runtime-affordances-coverage.test.ts` asserts each axis affordance has exactly `legalOptions` and `defaultOnSwitch` before deriving ledger rows.
✓ A field rename/add/drop would fail the drift guard rather than being mapped to `*.default_on_switch`.
```

### Verification Approach

- Inner: focused vitest for `src/session/runtime-affordances-coverage.test.ts` and `src/projections/session/affordances.test.ts` if needed.

### Cross-cutting obligations

- Preserve D60-L coverage discipline: this is a no-loss/shape guard, not a golden snapshot.
- Do not ship new RPC/web affordance surfaces in this card.

### Assumption dependency

None — the underlying runtime affordance seam is already built and documented as done.

### Expected touched paths (tentative)

```pseudo
src/session/
└── runtime-affordances-coverage.test.ts   ~
```

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Card 5 — Correlated introspection run artifacts

Status: next
Weight: full

### Target Behavior

`runBrunchIntrospectionTurn` only writes a paired run artifact when the passive provider capture and optional base report belong to the prompted turn.

### Boundary Crossings

```pseudo
→ dev introspection launcher prompt()
→ introspection store capture/report records
→ turn/run correlation check
→ .fixtures/runs/introspection/** artifacts
```

### Risks and Assumptions

```pseudo
- RISK: the launcher keeps using ambient latest records and can pair stale mechanical data with a fresh subjective answer.
    → MITIGATION: snapshot a store cursor before prompting, require a new passive capture after the prompt, and attach a base report only when it references the same turn id.
- RISK: correlation requirements leak into product behavior.
    → MITIGATION: keep changes under the dev-gated introspection extension/store/launcher seam only.
- ASSUMPTION: a passive provider capture is the required mechanical half for a paired subjective introspection run.
    → IMPACT IF FALSE: the run artifact shape would need a new state such as `subjective_only`, weakening D69-L’s paired-run proof.
    → VALIDATE: tests cover stale prior capture, missing new capture, matching base report, and mismatched base report exclusion/failure.
    → memory/SPEC.md A26-L, D69-L
```

### Posture check

Proving slice. It scores on **proof of life** by making the introspection artifact walk on its own production/dev bones instead of a stale store value, and on **invariants** by naming the paired-run correlation contract. The slice does not broaden introspection into live TUI or conversational self-report; those remain `dx-introspection-live` follow-ons.

### Acceptance Criteria

```pseudo
✓ introspection launcher test — a stale passive capture present before `prompt()` is not accepted as the prompted turn’s mechanical payload.
✓ introspection launcher test — a new passive capture after `prompt()` is required for success.
✓ introspection launcher test — a base report is included only when it references the same turn id as the selected passive capture.
✓ introspection launcher test — the written `manifest.json`, `mechanical.json`, and `subjective.json` stay paired to the same turn id.
```

### Verification Approach

- Inner: `src/dev/introspection-launcher.test.ts` plus focused tests for any store cursor/correlation helper added under `src/.pi/extensions/introspection/`.
- Middle: no live TUI/browser proof; this is the dev faux launcher contract only.

### Cross-cutting obligations

- Preserve D69-L read-only observation: introspection observes provider payloads and base prompt inputs but never mutates product runtime posture.
- Do not implement `dx-introspection-live` follow-ons in this card.

### Expected touched paths (tentative)

```pseudo
src/.pi/extensions/introspection/
└── index.ts                         ~
src/.pi/__tests__/
└── introspection.test.ts            ?
src/dev/
├── introspection-launcher.ts        ~
└── introspection-launcher.test.ts   ~
```
