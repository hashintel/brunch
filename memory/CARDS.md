<!-- CARDS.md — prepared scope-card queue for ONE frontier item (ln-scope sanctioned derivative).
     Frontier: cook mode-from-spec (refinement on cook-codebase-mode + spec-to-cook-plan/FE-800).
     Delete or overwrite when the queue is exhausted or superseded. -->

# Cards — cook mode-from-spec

## Orientation

- **Seam:** the `brunch cook` resolver + sandbox-init seam (`src/orchestrator/src/cook-cli.ts` `resolveCookMode` / `parseCookArgs` / `runCook`; `worktree.ts` `createSandbox`) and the `brunch plan <specId>` → `plan.yaml` emission contract (`src/server/plan-runner.ts`, `db/completed-spec-snapshot.ts`, `src/orchestrator/src/plan-projection.ts`, `plan-emitter.ts`, `plan-loader.ts`, `types.ts` `Plan`).
- **Frontier:** refinement spanning `cook-codebase-mode` (done) and `spec-to-cook-plan` / FE-800 (branch-complete). Not FE-819 (the current branch is Petrinaut work) — this likely warrants its own Linear issue + branch per CLAUDE.md workflow; confirm at build/start.
- **The model change:** today greenfield/brownfield is inferred from plan *location* (SPEC §D50: `<dir>/plan.yaml` = greenfield/empty worktree; `.brunch/cook/specs/<id>/plan.yaml` = brownfield, **always** `git worktree add` of cwd). The DB already records `specification.mode` (`'greenfield' | 'brownfield'`, default greenfield) but it never reaches the plan. We are **decoupling** mode from location: the emitted `plan.yaml` carries the spec's `mode`, and cook keys the worktree strategy off `plan.mode` — so a spec-emitted *greenfield* plan runs in an empty worktree (no clone), and only *brownfield* clones the cwd. Authored fixture `plan.yaml` (no mode field) defaults to greenfield → unchanged behavior.
- **Open risk:** `resolveCookMode` currently decides the sandbox mode *before* the plan is loaded; the mode marker lives *in* the plan, so the worktree decision (and the clean-tree git gate) must move to after `loadPlan`. This reshapes the `ResolvedCookMode` contract.

---

## Card 1 — Cook keys the worktree strategy off the spec-derived plan mode (FULL)

**Status:** done — `PlanMode` + `Plan.mode`, `CompletedSpecSnapshot.mode`, projection/reconcile/loader threading, `buildCompletedSpecSnapshot` reads `specification.mode`, `resolveCookMode` split into `resolveCookPlan` (path-only) + `resolveSandboxPlan` (mode-driven, brownfield-only git gate). Greenfield-from-spec "never clones" oracle added to brownfield-smoke. Verify gate green (1706 tests). §D50/R50/I123-K reconciliation deferred to ln-sync.

### Target Behavior

`brunch cook` runs a spec-emitted greenfield plan in an empty worktree and a spec-emitted brownfield plan in a cwd clone, choosing the strategy from the plan's own `mode` field (default greenfield) rather than from the plan's on-disk location.

### Boundary Crossings

```
→ brunch plan <specId>  (src/server/plan-runner.ts)
→ buildCompletedSpecSnapshot reads specification.mode  (src/server/db/completed-spec-snapshot.ts)
→ CompletedSpecSnapshot.mode  (src/orchestrator/src/plan-projection.ts)
→ projectPlanFromSpec → Plan.mode  (plan-projection.ts) → reconcilePlan preserves mode (plan-reconciliation.ts)
→ Plan.mode serialized into plan.yaml  (plan-emitter.ts → stringifyYaml)
→ ── on the cook side ──
→ brunch cook <dir>  (cook-cli.ts parseCookArgs)
→ resolveCookMode resolves the plan PATH only  (cook-cli.ts)
→ loadPlan(planPath) → plan.mode (default greenfield if absent)  (plan-loader.ts, types.ts Plan)
→ runCook chooses createSandbox strategy from plan.mode; brownfield-only clean-git-tree gate  (cook-cli.ts)
→ createSandbox(... mode: greenfield→empty | brownfield→git worktree add)  (worktree.ts)
```

### Risks and Assumptions

```
- RISK: resolveCookMode decides sandbox mode before the plan is read → MITIGATION: split resolution (path-only) from sandbox-strategy (post-loadPlan); move the clean-git-tree gate into the brownfield branch in runCook. Re-shape ResolvedCookMode to drop the mode/sourceDir conflation.
- RISK: authored fixture plan.yaml has no `mode` field → MITIGATION: plan-loader defaults missing `mode` to 'greenfield'; existing greenfield fixture tests stay green untouched.
- ASSUMPTION: plan.yaml is the right home for the marker (vs cook re-reading specification.mode from the DB at run time) → VALIDATE: confirmed by the user's framing ("if the spec in the generated plan file defines that as greenfield"); plan.yaml stays the self-contained cook contract so cook needs no DB access. [→ memory/SPEC.md §Assumptions]
- ASSUMPTION: brownfield is the only mode that clones cwd; greenfield always uses an empty worktree regardless of plan location → VALIDATE: Card-1 acceptance tests below.
- DECISION (reverses D50): mode is spec-derived plan truth, not a function of plan location. → reconcile SPEC §D50 / Requirement 50 + I123-K wording via ln-sync.
```

### Acceptance Criteria

```
✓ plan-projection — projectPlanFromSpec carries snapshot.mode onto Plan.mode
✓ snapshot-builder — buildCompletedSpecSnapshot reads specification.mode into CompletedSpecSnapshot.mode
✓ plan-emitter/round-trip — emitted plan.yaml contains `mode:`; plan-loader round-trips it; missing mode loads as 'greenfield'
✓ resolveCookMode — resolves a plan PATH without deciding greenfield/brownfield (mode no longer inferred from location)
✓ cook greenfield-from-spec — a spec-emitted greenfield plan creates an EMPTY worktree (no `git worktree add`, no clean-tree gate)
✓ cook brownfield-from-spec — a spec-emitted brownfield plan creates a cwd clone via `git worktree add` and enforces the clean-git-tree gate
✓ cook authored-fixture — `<dir>/plan.yaml` with no mode still runs greenfield/empty (regression)
✓ engine contract suite green on both engines
```

### Verification Approach

```
- Inner: vitest/bun unit — plan-projection.test, completed-spec-snapshot.test, plan-emitter round-trip, cook-cli resolveCookMode + sandbox-selection tests
- Middle: brownfield-smoke.integration.test — assert greenfield-from-spec does NOT clone (source HEAD/worktree count unchanged) and brownfield-from-spec does clone
- Outer: optional manual `brunch plan <id>` then `brunch cook` against a greenfield vs brownfield spec
```

### Promotion note

Promoted to full: reverses §D50 decision (mode ≠ location), changes the `plan.yaml` transport contract, and refines invariant I123-K. Reconcile §D50 / R50 / I123-K via ln-sync after build.

---

## Card 2 — Cook directory argument is optional, defaulting to cwd (LIGHT)

**Status:** done — `parseCookArgs` defaults a missing positional dir to `BRUNCH_LAUNCH_CWD || process.cwd()` (no throw); cli.ts help reads `cook [dir]`. Verify gate green. Stayed light; R46 `[dir]` phrasing touch deferred to ln-sync.

### Objective

`brunch cook` without a positional directory runs against the current directory (searching for `.brunch` there), instead of erroring on a missing argument.

### Acceptance Criteria

```
✓ parseCookArgs with no positional dir returns dir = resolved cwd (BRUNCH_LAUNCH_CWD || process.cwd()), no throw
✓ parseCookArgs with an explicit dir still resolves that dir (regression)
✓ usage/help text updated: `brunch cook [dir] [flags]`
✓ flag-only invocation (e.g. `brunch cook --spec=3`) resolves dir to cwd
```

### Verification Approach

```
- Inner: cook-cli parseCookArgs unit tests (omitted dir → cwd; explicit dir preserved; flag-only)
```

### Promotion checklist

- [ ] requirement change? no
- [ ] assumption created/retired? no
- [ ] non-trivial decision? no (defaulting a CLI positional)
- [ ] new seam invariant? no
- [ ] crosses >2 seams? no (cook-cli only)
- [ ] first touch in unfamiliar seam? no
- [ ] can't name seam/rationale? no

Stays light. SPEC Requirement 46 phrasing (`brunch cook <dir>`) gets a minor `[dir]` touch at ln-sync; not a model change.
