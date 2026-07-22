# Prove the real Petrinaut provider preflight

Frontier: brownfield-comparison-cases
Status:   blocked
Mode:     single
Created:  2026-07-22

Posture: proving (inherited from `brownfield-comparison-cases`).

## Orientation

- **Containing seam:** D136-L's real HASH preparation and standalone `/optimization` mechanical hard gate, behind D137-L's admitted lane-ready target.
- **Frontier:** FE-1241 `brownfield-comparison-cases`; this remains on `ka/fe-1241-brownfield-comparison-cases`.
- **Volatile state:** synthetic Petrinaut preparation/oracle proofs are green; no retained controller receipt proves the frozen identities, real immutable install, and real merged-reference route together.
- **Main risk:** interpreting a provider candidate failure when the real HASH setup or oracle calibration is itself invalid.

## Target Behavior

The controller emits a setup-valid Petrinaut preflight receipt only after the frozen real HASH parent and a disjoint controller-only merged reference pass their distinct preparation and calibration gates.

## Cold-start reads

- `memory/SPEC.md` — A49-L retirement clarification; D136-L; D137-L
- `memory/PLAN.md` — frontier `brownfield-comparison-cases`
- `src/dev/TOPOLOGY.md` — Historical Replay Isolation and Brownfield Comparison Oracles
- `memory/cards/brownfield-comparison-cases--admission-contract-hardening.md` — remaining provider-preflight debt
- `src/dev/execution-comparison/historical-replay-target.ts` — real parent preparation/admission
- `src/dev/execution-comparison-operator.ts` and `operator-cli.ts` — controller command surface
- `src/dev/execution-comparison/petrinaut-optimization-oracle.ts` and private subtree — focused builds/browser calibration
- `testing/end-to-end-comparisons/cases/petrinaut-optimization/study-contract.json` — frozen parent identity
- `testing/execution-comparisons/cases/petrinaut-optimization/controller/oracle-manifest.json` — hard-gate identity

## Boundary Crossings

```text
→ explicit safe real HASH source checkout
→ frozen parent commit/tree resolution
→ D137 lane-ready parent preparation with the real immutable install
→ disjoint controller-only merged-reference materialization
→ the same code-owned immutable install
→ closed Petrinaut focused-build/browser oracle
→ redacted write-once receipt + bounded hashed logs
→ cleanup of both owned workspaces
```

The parent workspace is the only future provider target. The merged-reference workspace calibrates controller setup and oracle sensitivity; it is always a forbidden root and is never returned as lane-ready input.

## Risks and Assumptions

- **RISK:** reference calibration leaks historical solution material into the provider target.
  - **MITIGATION:** use disjoint roots, include the reference root in admission denial, retain no absolute path in the receipt, and scan the target/receipt for reference commit and path leakage.
- **RISK:** the heavy real install mutates tracked source or depends on ambient tooling.
  - **MITIGATION:** reuse the one code-owned immutable recipe, retain bounded stdout/stderr digests, and fail before calibration/provider work on nonzero exit or tracked mutation.
- **RISK:** the current synthetic oracle does not match the real merged UI.
  - **MITIGATION:** run the unchanged compile-time oracle against the controller-only merged reference; any setup or claim failure invalidates the preflight instead of weakening the oracle.
- **ASSUMPTION:** the real merged PR #9051 tree can satisfy D136-L's focused builds and standalone `/optimization` route under the immutable install.
  - **IMPACT IF FALSE:** historical provider runs remain blocked and the Petrinaut oracle/profile must be respecified or corrected.
  - **VALIDATE:** this slice's real no-provider-turn preflight is the falsifier.

## Posture check

This tracer scores on all proving axes:

- **Proof of life:** the production parent preparation and real merged-reference browser oracle run through one controller command.
- **Invariant:** the historical reference remains controller-only while the parent target receives strict admission.
- **Uncertainty:** setup-validity is settled before provider budget or candidate interpretation.

No separate spike is cheaper: the real preflight command is itself the minimum experiment and leaves a structured receipt.

## Acceptance Criteria

```text
Petrinaut real-source preflight
├── controller composition
│   ├── ✓ petrinaut-historical-preflight.test.ts — the closed case resolves the frozen parent and code-owned merged-reference commit
│   ├── ✓ operator-cli.test.ts — preflight requires absolute disjoint source/work/output roots and dispatches no arbitrary command
│   └── ✓ petrinaut-historical-preflight.test.ts — command trace contains no Claude or Brunch provider-lane launch
├── parent gate
│   ├── ✓ petrinaut-historical-preflight.test.ts — D137 returns a lane-ready parent with exact commit/tree, packet child, admission, and real-recipe result
│   └── ✓ petrinaut-historical-preflight.test.ts — parent setup failure yields setup_failed and no calibration
├── controller-only calibration
│   ├── ✓ petrinaut-historical-preflight.test.ts — reference materialization is disjoint and never returned as lane-ready
│   ├── ✓ petrinaut-historical-preflight.test.ts — install/build/oracle failure yields setup_failed rather than candidate assertion evidence
│   └── ✓ real preflight command — unchanged petrinaut-optimization-oracles-v1 passes against merged PR #9051
├── retained evidence
│   ├── ✓ petrinaut-historical-preflight.test.ts — receipt is write-once, schema-validated, path-redacted, and hashes bounded install/oracle logs
│   └── ✓ petrinaut-historical-preflight.test.ts — receipt binds case, parent commit/tree, reference commit/tree, dependency recipe, oracle id/pack hash, and final setup status
└── isolation and cleanup
    ├── ✓ petrinaut-historical-preflight.test.ts — target and receipt contain no reference commit/path or controller-private packet
    └── ✓ petrinaut-historical-preflight.test.ts — pass and failure remove only owned parent/reference workspaces while retaining the receipt/evidence
```

## Invariants preserved

- Historical reference material never becomes provider-target-visible — guarded by: receipt/target negative scans and D137 forbidden-root admission.
- Public packets continue to name only the parent source identity; merged-reference identity remains controller-owned — guarded by: existing case-profile redaction tests.
- Dependency and oracle selection remain compile-time closed — guarded by: TypeScript build and existing registry tests.
- Preflight evidence is not a serializable admission/security token and cannot authorize a lane — guarded by: receipt type and operator dispatch tests.
- Brunch stops at `promotion_prepared`; no source repository receives candidate output — guarded by: existing no-landing suites.
- Minimal Petri remains the sole greenfield case — guarded by: existing case-profile tests.

## Verification Approach

- **Inner:** self-contained temporary Git parent/reference fixtures with injected install/oracle runners prove ordering, receipt shape, redaction, no-provider trace, and cleanup.
- **Middle:** existing D137 admission and Petrinaut oracle suites remain unchanged; the preflight invokes those public operations rather than duplicating their assertions.
- **Outer:** one explicit real preflight command against the local `hashintel/hash` checkout. It must retain a setup-valid receipt before historical provider work can be scoped.
- **Checkpoint:** focused tests, `npm run verify:full`, `npm run check`, `git diff --check`, and skipped-test delta versus `origin/next`.

## Cross-cutting obligations

- The source checkout, controller root, parent target, reference calibration root, and receipt output root are explicit and pairwise safe.
- No env-gated skipped test may stand in for the real preflight witness.
- Install output is bounded and retained by digest; secrets, absolute paths, and full dependency logs do not enter the receipt.
- Setup invalidity remains separate from candidate assertion failure.
- The full `/processes/draft` host/iframe journey remains separately owned non-gating evidence.

## Explicitly Out

- Any Claude or Brunch provider turn, elicitation lane, 2×2 matrix, candidate interpretation, or promoted comparison report.
- The fully provisioned HASH `/processes/draft` host/iframe smoke.
- Arbitrary reference commits, dependency commands, oracle plugins, or manifest-selected shell behavior.
- Making the preflight receipt an admission capability or extending `ExecutionAttempt`.

## Completion evidence

The controller operation and CLI are built, but the scope is **not done**. The direct declared
`@hashintel/refractive` build closes the focused setup defect without generic graph preparation: the
diagnostic real no-provider run now passes both immutable installs, tracked-source checks, and all six
focused builds. Navigation readiness is no longer coupled to network idleness, and the unchanged
5-second semantic checks now expose a fixture/public-UI contract mismatch: the exact heading is absent
and the pinned historical action is `Create`, not `Create optimization`. No provider run may proceed
until the browser contract is respecified from the real public UI.

| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| Closed parent/reference identities | met | `petrinaut-historical-preflight.test.ts` proves fixed case selection and code-owned merged reference `276e17d7b0f80c8a80d5abe01849bbb67c6169d0`; the real receipt binds parent commit/tree |
| Absolute disjoint CLI roots; no arbitrary command/reference/plugin | met | `operator-cli.test.ts` — `Petrinaut preflight operator command` |
| No Claude/Brunch provider turn | met | `petrinaut-historical-preflight.test.ts` command trace contains controller preparation/calibration only |
| D137 lane-ready parent, exact identities, packet child, admission, recipe | met | focused preflight + existing `historical-replay-target.test.ts`; real parent install passed |
| Parent setup failure stops calibration | met | `retains setup_failed evidence and never calibrates after parent preparation fails` |
| Reference is disjoint/controller-only and never returned lane-ready | met | core preflight test checks forbidden-root admission, parent/reference separation, redacted receipt, and cleanup |
| Reference install/build/oracle setup failure remains setup_failed | met | install-stage, tracked-cleanliness, and oracle-preparation rivals retain distinct bounded evidence |
| Oracle assertion failure remains distinct from setup failure | met | `preserves the calibration assertion distinction from the unchanged oracle` |
| Unchanged real `petrinaut-optimization-oracles-v1` passes merged PR #9051 | **blocked** | all six focused steps pass; semantic navigation has no timeout or failed request, but the exact heading is absent and all downstream checks fail on the fixture-only `Create optimization` label |
| Write-once schema-validated redacted receipt with digests | met | receipt/evidence collision rivals plus failed-result digest round-trip; fixed relative filenames bind bounded parent/reference dependency and oracle-summary files |
| Receipt binds parent/reference identities, recipe, oracle pack/report, status | met | real invalid receipt binds both resolved identities, both passed recipes, oracle pack/report digests, setup status, evidence metadata, and cleanup |
| Parent/receipt leakage and controller-private packet exclusion | met-with-divergence | parent negative scans and receipt path-redaction pass; the receipt intentionally contains the reference commit/tree because the controlling requirement explicitly requires that binding, while containing no reference absolute path |
| Pass/failure clean only owned workspaces and retain receipt | met | parent is removed after reference-leak validation and before the reference install to bound scratch usage; real receipt records both workspaces removed |

Diagnostic red: `npm test -- src/dev/execution-comparison/__tests__/petrinaut-historical-preflight.test.ts -t "reference installation fails"`
failed because the receipt had no structured dependency stage or retained file. The oracle diagnostic
rival then failed because preparation command output was discarded. Green: parent/reference failures
cross D137 as structured observations; bounded path/secret-redacted files are retained after cleanup
with `wx`, and the oracle exposes only a narrow capture callback for its fixed preparation results.
Direct-fix red: `petrinaut-optimization-oracle.test.ts -t "Refractive workspace build"` failed because
the compile-time sequence omitted the declared workspace dependency. Green: the exact public sequence
contains `refractive-build` directly before UI, while the known-good slow fixture passes that sequence
and rejects omission and reordering.
Navigation red: the background-readiness slow rival failed all seven checks because `page.goto`
waited for `networkidle` under the 5-second action timeout. Green: the same DOM-ready candidate passes
all claims while a background request remains active for six seconds; `failedRequests` stays empty.

Real evidence:

- command: `npx tsx src/dev/execution-comparison-operator.ts petrinaut-preflight` with the real
  `/Users/kostandin/Projects/hashdev/hash` checkout and explicit disjoint scratch roots
- receipt:
  `/private/tmp/brunch-petrinaut-preflight-20260722T1558/evidence/petrinaut-historical-preflight-receipt.json`
- receipt SHA-256: `0ddbd4bffd4e57ce7426bc254bd8780e6d399c1eaf98f27499c261ac174a8046`
- final status: `assertion_failed`; setup status: `invalid`; exact stage:
  `oracle_calibration` → historical semantic contract
- parent dependency evidence: `parent-dependency.json`, SHA-256
  `a9252a4448a87b9589efb4e4f1a7474d2540fdc87f80c28645ea3848804b1773`, 14,724
  bytes, not truncated
- reference dependency evidence: `reference-dependency.json`, SHA-256
  `813ac025c81b6b29c35bd296d41f2e98b4fb2dec13824998360713acd2d976b7`, 14,724
  bytes, not truncated
- oracle evidence: `oracle-summary.json`, SHA-256
  `39106c60d47d88699df2a92920ed46348ecb1e3efdbb61b05a7a80efe51468ae`, 22,011
  bytes, not truncated
- parent/reference: exact commit/tree matched; `corepack yarn install --immutable --mode=skip-build`
  and tracked-source cleanliness passed for both
- oracle preparation: all six fixed steps passed; `refractive-build` exited 0 before
  `petrinaut-ui-build` exited 0
- browser calibration: `route-and-accessibility` reports `view: expected 1, received 0`; all six
  downstream checks time out under the unchanged 5-second semantic budget waiting for the exact
  `Create optimization` button
- real navigation contributes no timeout or `net::ERR_ABORTED`; `failedRequests` and `consoleErrors`
  are empty
- pinned-source check: `OptimizationsView` renders `title="Optimizations"` but its button child is
  `Create`; `/optimization` mounts `LocalStorageDemoApp` without a route-specific direct-view override
- no setup failure, provider turn, or browser claim pass
- cleanup: parent `removed`; reference `removed`

Re-entry requires respecifying the browser oracle from pinned historical public semantics, including
the route's initial mode/view transition and actual accessible labels. Do not silently rename the
historical control, weaken semantic assertions, or replace this invalid receipt.

Final verification after the semantic-contract witness: focused preflight/invariant run — 7 files /
54 tests passed; focused known-good/sensitivity/background-readiness run — 1 slow file / 4 tests
passed; `npm run verify:full` — 329 default files / 2,587 tests passed and 1 file / 2 tests skipped,
plus 9 slow files / 71 tests passed, then build passed; `npm run check`, `git diff --check`, and
touched-file lints passed. Skipped-test declarations are unchanged versus `origin/next` (1 → 1;
delta 0).

## Expected touched paths (tentative)

```text
memory/
├── PLAN.md                                                               ~
└── cards/brownfield-comparison-cases--petrinaut-provider-preflight.md
docs/praxis/comparison-runs.md                                            ~
src/dev/
├── TOPOLOGY.md                                                           ~
├── execution-comparison-operator.ts                                      ~
└── execution-comparison/
    ├── historical-replay-target.ts                                       ?
    ├── petrinaut-historical-preflight.ts                                  +
    ├── petrinaut-historical-preflight/                                    ?
    ├── pinned-dependency-preparation.ts                                   ?
    └── __tests__/
        ├── operator-cli.test.ts                                           ~
        └── petrinaut-historical-preflight.test.ts                         +
```
