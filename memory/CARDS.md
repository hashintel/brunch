# Scope cards — epic-verify-recovery (FE-884)

Execution queue for `epic-verify-recovery` (FE-884, branch
`ka/fe-884-epic-verify-recovery`, stacked on FE-883's `ka/fe-883-worktree-gc`).

**Core problem:** the orchestrator's two verification tiers are asymmetric. The
slice tier is recoverable (`failing-tests → code-agent → run-tests`, in-net
retry budget). The epic tier is terminal: `epic-verify:<epic>:fail` routes
straight to `epicHaltedPlace` via `attach-halt-reason` (`net-compiler.ts`
~458–535). So the one place cross-slice defects surface — epic integration — is
the one place the harness cannot act on what it found. A failed epic halts the
whole run and promotes nothing, discarding the diagnosis, the folded worktree,
and every passing epic.

**Worked example:** run `59100820-...` (spec 49, 3 epics / 11 slices, 60m26s).
11/11 slices + 2/3 epics passed; `route-integration` failed on a real bug (view
toggle wrote `?view=graph` but the sibling `useViewParam()` never resynced —
`pushState` doesn't emit `popstate`). The verify agent named the exact fix; the
run halted anyway. The fix (`brunch:viewparamchange` event, ~10 lines) was
applied by hand afterward — on a worktree the harness already had, from a
diagnosis it already produced.

**Builds on FE-883:** the epic verify already composes the folded
`__epic__/<epicId>/` tree (`materializeEpicVerifyTree`), and promotion folds
slice commits (`harvestCookRun`, idempotent `commitSliceWorktree`). FE-884 makes
a failed epic *recoverable* rather than *terminal* — substrate-free, distinct
from Arc-2 `interactive-recovery`/`adaptive-replan` (which need the parked
semantic substrate).

**Owed reconciliation:** FE-884 is not yet a frontier in `memory/PLAN.md`, and
the oracle strategy below is not yet folded into SPEC §Verification Design.
Reconcile via ln-plan + ln-sync when FE-884 registers / lands.

---

## Slice A — recoverable epic verification (the missing green step)

Status: **done** (2026-06-18). All 7 acceptance criteria proven (run-59100820
by analog; real-agent dogfood is outer-loop, not run). Gate green: check 0
errors, build pass, orchestrator + epic-recovery e2e 104 tests pass (full suite
2101 pass / 2 skip; the single `build-boundary` failure is the pre-existing
dev-worktree `node_modules` symlink artifact documented on FE-883's PR).

**Design finding (round-trip assumption — VALIDATED with caveat):** the naive
assumption was false — `harvestCookRun` folds only *slice* worktrees; the
`__epic__/<id>/` tree is detached and discarded. A remediation fix made in the
folded tree must be **diff-transferred and committed to the representative slice
branch** (`transferFoldedFixToSlice` in `run-artifact.ts`) to be folded into the
promoted artifact. → record as a SPEC decision + invariant on canonical
reconciliation (owed).

Full scope card — structural (changes the epic-verify topology; establishes the
invariant *a failed epic is recoverable, not terminal*).

### Target Behavior

A failed epic verification dispatches a remediation code agent against the folded
epic tree and re-verifies, reaching the halt sink only after the epic's
remediation budget is exhausted.

### Boundary Crossings

```
→ epic-verify:<epic>:fail        (report.passed falsy — today's dead-end sibling)
→ epic-remediate:<epic>:dispatch → epic-remediate:running   (new; mirrors the slice dispatch/running split)
→ code agent in __epic__/<epic>/ folded worktree (FE-883), fed the verify diagnosis
→ detect-and-reject guard: post-attempt git diff touches the epic integration test path → discard, count against budget
→ commit fix into the owning slice branch via idempotent commitSliceWorktree (FE-883)
→ epic-remediate:<epic>:complete → back to verifyPlace   (re-run verify-epic + slice suites on the folded tree)
→ epic-retry-budget place: decrement; on exhaustion → epicHaltedPlace (attach-halt-reason, honest cause)
```

### Risks and Assumptions

```
- RISK: a remediation agent greens the epic by editing the integration test, not product code
    → MITIGATION: detect-and-reject (git diff touches the epic test path → discard + budget); dual re-verify (slice suites must also pass)
- RISK: a fix in the detached folded tree never reaches promotion
    → MITIGATION: round-trip through commitSliceWorktree onto the owning slice branch so harvestCookRun folds it
- ASSUMPTION: an epic-level fix can be attributed to one slice's branch (vs a synthetic "integration slice" commit)
    → VALIDATE: trace harvestCookRun's fold over an added commit on a representative slice → [→ memory/SPEC.md §Assumptions]
- ASSUMPTION: the slice-loop retry-budget machinery generalizes to the epic lane unchanged
    → VALIDATE: epic-retry-budget place + dispatch/complete siblings reuse the existing in-net retry pattern
```

### Acceptance Criteria

```
✓ epic-remediation-fires — a falsy verify report routes to epic-remediate, not directly to halt
✓ re-verify-loop — remediate:complete returns to verifyPlace and re-runs verify-epic
✓ dual-re-verify — remediation is accepted only if the epic integration test AND the slice suites pass on the folded tree
✓ budget-exhaustion-halts — after N failed attempts the epic reaches epicHaltedPlace with an honest reason
✓ oracle-integrity — an attempt that modifies the epic integration test file is rejected and counts against budget
✓ fix-promotes — a remediation commit is folded by harvestCookRun (the fix survives into the promoted artifact)
✓ run-59100820-closes — replaying the example run, the route-integration epic self-heals within budget (outer)
```

### Verification Approach (oracle strategy)

```
- Inner:
  · topology golden/adapter — :fail routes → epic-remediate → verifyPlace; budget decrement; exhaustion → halt
  · negative-space test-path guard — post-attempt git diff touching the epic test path → reject + budget
  · engine contract suite stays green (runtime equivalence on the unchanged paths)
- Middle:
  · scripted-agent integration (model-based) over the SYNTHETIC broken-then-fixable epic fixture:
      (fail → edit product code → pass) reaches `done`; (fail → edit test) is rejected
  · dual re-verify (invariant) — epic integration test + slice suites both green on the folded tree
  · promotion round-trip (differential) — the remediation commit appears in the harvested tree
- Outer:
  · real-agent dogfood replay of run 59100820 — epic self-heals unattended (one-shot confidence, human-observed)
```

### Acknowledged blind spots

```
- LLM remediation COMPETENCE is not oracle-able — only loop mechanics are. Mitigation: budget + honest halt.
    Revisit: dogfood shows low fix-rate.
- detect-and-reject guards only the EPIC test path; an agent could weaken a SLICE test instead.
    Mitigation: dual re-verify (slice suites must pass). Revisit: a remediation greens by editing a slice test → freeze all *.test.* under the epic.
- a flaky epic test (the original ETIMEDOUT) misread as a logic fail → deferred to Slice B.
- wall-clock cost of extra agent round-trips — no time budget gate. Accept for now.
```

---

## Slice B — infra/timeout classification at the epic verdict — `done` (2026-06-18)

All 4 acceptance criteria met; gate green (check 0 errors, build ✓, full suite
2110 pass / 2 skip; the lone `build-boundary` failure is the pre-existing
dev-worktree symlink artifact). **Correctness finding:** the prior verify
subprocess timeout was `60_000`, and `spawnSync` timeout surfaces as
`error.code === 'ETIMEDOUT'` — but only `ENOENT` was classified infra, so a
**timeout was misclassified as `test`** and (with Slice A) would have wrongly
fed the remediation code agent a non-bug. Fixed: `ETIMEDOUT → infra`
(`isInfraSpawnError`) + raise `VERIFY_TIMEOUT_MS` to `180_000` (npx + code-split
warmup, ~25s observed). Distinct from FE-864's pi *session* deadline. Infra
re-verify is counted by a separate `Token.infraRetryCount` /
`RunPolicy.maxInfraRetries` (defaults to `maxRetries`), so blips don't consume
remediation attempts.

Light-ish card (adds a small topology arm inside A's now-settled verify-epic seam).

**Objective:** at the epic verdict, route on `failureKind` (already computed by
`runVerification`, FE-872) so an infra/timeout failure is retried as a toolchain
blip, not fed to the remediation code agent or silently halted.

**Design decisions:**
- Split the verify-epic fail-sibling by `failureKind`: `infra` → a bounded
  **infra-retry** chain (re-dispatch verify; **no** code agent — nothing for an
  agent to fix) → `verifyPlace`; exhaustion → `epicHaltedPlace` with an honest
  *infra* reason. `test`/logic → the Slice-A remediation loop (unchanged).
- A **separate `epic-infra-budget`** distinct from A's `epic-retry-budget`, so a
  toolchain blip doesn't consume remediation attempts (and vice versa).
- **Timeout sizing:** size the verify subprocess (`spawnSync`) timeout to the
  target's real cost so `npx` resolution + code-split warmup doesn't spuriously
  `ETIMEDOUT` (the `graph-route-wiring` test alone ran 25s). Coordinate with
  FE-864's pi-timeout work; do not regress it.

**Acceptance:**
```
✓ infra-retries — an infra/timeout verdict re-runs verify (bounded), not the code agent
✓ infra-exhaustion-halts-honestly — exhausted infra retries halt with an infra reason (not "tests failed"/"remediation attempts")
✓ logic-still-remediates — a test/logic failure still routes to the Slice-A remediation loop
✓ timeout-sized — the verify subprocess timeout accommodates code-split warmup (ETIMEDOUT-class regression)
```

**Verification:** topology goldens (fail-sibling splits on failureKind; infra-retry
chain + budget; exhaustion→halt reason); engine-contract green; e2e scenario where
verify returns `failureKind:'infra'` once then passes (retries, not remediated).

Independent of A's logic path; lands on the same branch.

## Slice C — partial promotion / salvage — deferred (not pre-carded)

Extend `harvestCookRun` to promote passing epics and hand back the folded
worktree + the failing epic's diagnosis instead of `nothing promoted`. Shape
depends on A's commit-round-trip topology and FE-883's GC ref-set, so do **not**
pre-card it until A lands.
