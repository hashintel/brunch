# Integrity cleanup sweep — ledger

Frontier: integrity-cleanup
Status:   active
Mode:     sweep
Created:  2026-08-03

## Orientation

- Containing seam: repo-wide integrity/deadness — deletion of verified-dead artifacts, consolidation of contract-bearing predicates, roster type-coupling. Frontier: `integrity-cleanup` ([FE-1311](https://linear.app/hash/issue/FE-1311/integrity-cleanup-sweep-verified-deletion-batch-and-predicate)), branch `ln/fe-1311-integrity-cleanup`.
- Inventory source: two 2026-08-03 `ln-induct` reports (reduction review + architecture review), every load-bearing claim independently verified; corrections are binding constraints (see PLAN definition §Constraints).
- Posture: **earned** (inherited from `integrity-cleanup`); per-row Fill downgrades to `proving` where a packaging unknown remains. A row that reveals a real unknown mid-build stops per sweep discipline.
- Main open risk: a deletion target with an out-of-graph consumer the induction missed → every deletion row's oracle includes the out-of-graph checks (`git log -S` provenance; `src/**/TOPOLOGY.md` + `src/treedocs.yaml` + `memory/PLAN.md` cross-reference) before `rm`.

## Cold-start reads

```
- memory/PLAN.md    — frontier: integrity-cleanup (boundary, constraints, aggregate DoD)
- memory/SPEC.md    — §Acknowledged Blind Spots "No deadness oracle in the gate"
- .agents/skills/ln-review/references/contract-lenses.md — the two 2026-08-03 entries
  (out-of-graph consumers; copy-not-import predicates) — the audit discipline deletion rows must apply
- AGENTS.md         — §intentional topology stubs (carve-out), §development phase posture (deletion rigor)
```

## Cross-cutting obligations

- Every deletion row runs the out-of-graph-consumer checks before deleting, and reconciles `TOPOLOGY.md` / `treedocs.yaml` references **in the same row**.
- **Pass `rg --hidden` for every consumer grep.** `src/.pi/**` is a hidden path, so plain `rg` silently reports zero consumers for anything under it (found row A1, 2026-08-03: five fixtures read as unreferenced until `--hidden` revealed five importing suites). Rows touching `src/.pi/` — inert tools, unused barrels/wrappers — are exposed to this false negative.
- **A canonical doc that declares a module live overrides an induction deadness verdict.** Before deleting, read the owning `TOPOLOGY.md`/`README.md` *prose* (not just its layout sketch) and grep active `memory/cards/*.md` for successor frontiers that plan to reuse the target. Found row A2, 2026-08-03: the induction read "retired campaign frontier" as "dead code", but `src/dev/TOPOLOGY.md` + `README.md` declare the same files functional dev/eval primitives and the live `capture-ledger-tracer` card reuses them. Retiring a *plan identity* does not retire the *code* it left behind.
- Intentional topology stubs (`export {}` + design comment) are not deletion candidates on unusedness alone.
- Consolidation rows are behavior-preserving: existing suites stay green, no semantics change rides along.
- Tie-off: `npm run verify:full` (executor seams are touched) and a changeset (`npm run changeset` — the published dependency set changes).

## A. Deletions & packaging

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| Pre-FE-1163 schema snapshots removed; baseline test asserts current provider constraints directly | `built` | ● | earned | `src/.pi/extensions/__tests__/` (fixtures + `tool-schema-baseline.ts`) | Oracle: rewritten test green without snapshot fixtures; −2,339 LOC. Built: 5 fixtures + helper deleted (−2,339); the five family suites now assert adapter provenance + provider legality via `shared/tool-schema.ts` predicates. Reconciled SPEC `I60-L` coverage cell (it cited the baselines). No `TOPOLOGY.md`/`treedocs.yaml` reference existed (`treedocs.yaml` excludes `__tests__`). Surfaced the `rg --hidden` hazard now recorded above. |
| Parked consequential-fact campaign deleted (resurrect from git if it re-enters PLAN) | `spec` (BLOCKED) | ● | earned | `src/dev/consequential-fact-*` — **route back to `ln-plan`, do not delete** | **Premise falsified 2026-08-03 (out-of-graph checks, no code changed).** The row conflated the retired *campaign frontier identity* with the `src/dev/consequential-fact-*` *code*, which is live: (1) `src/dev/dev-cli.ts:26,40,216` imports `writeConsequentialFactEvaluation` and ships the `evaluate-consequential-fact` subcommand, exercised by `src/dev/__tests__/dev-cli.test.ts:363,530,570` against `consequential-fact-evaluator/review-diff-scenario.json` — a live import, not a dangling one; (2) `src/dev/TOPOLOGY.md:52` and `src/dev/README.md:63` both state verbatim that the evaluator, report, runner, and directive-ablation seam "remain functional dev/eval primitives" and that only the earlier campaign line "is retired rather than parked" (echoed at `docs/archive/PLAN_HISTORY.md:47`); (3) the live `capture-ledger-tracer` frontier (PLAN.md:180–188) reuses them — its card `capture-ledger-tracer--conduct-falsifier.md` names `src/dev/TOPOLOGY.md` for "existing consequential-fact campaign/evaluator … ownership" and marks all three files `~` (reused) in its touched-path sketch; (4) `src/.pi/extensions/__tests__/continue-lexicon.test.ts:10` pins `src/dev/consequential-fact-campaign-runner.ts` in `CURRENT_PRODUCT_FILES` and reads it — a hidden-path consumer. No `treedocs.yaml` reference; provenance is `1885130a7` (FE-1208). No part of the family is safely deletable under the current canonical record; PLAN's "Deletes / retires" list needs the same correction. |
| Committed Oxc schema copies deleted | `built` | ● | earned | `@types/oxfmt_configuration_schema.json`, `@types/oxlint_configuration_schema.json` | Verified: `.oxlintrc.json`/`.oxfmtrc.json` `$schema` point at `node_modules`; oracle: `npm run check` green. Built: both files deleted (−1,202 LOC), emptying `@types/`; the now-orphan `"@types/**"` `ignorePatterns` entry removed from **both** `.oxlintrc.json` and `.oxfmtrc.json` (added later, in `b0abf2679`, only because these files existed). Out-of-graph evidence: `git log -S '<filename>' --all` returns only the ledger commit `71a0ec455` — no config, script, doc, or source has ever named either file; provenance is `e3cae3270` (FE-744 squash, no rationale commit); `@types/` has only ever held these two files across all refs; no `typeRoots`/`include` covers it (tsconfig includes are `src/**/*`, `.pi/extensions/**/*.ts`) and root `@types/` is not on TS's default resolution path; absent from `package.json` `files`; no `TOPOLOGY.md`/`README`/`treedocs.yaml`/`memory/cards` reference. Copies were also *stale* snapshots (18.2K vs 701K upstream oxlint; 40.8K vs 52.2K oxfmt), so keeping them would teach wrong schemas. |
| Test-only production modules deleted with same-row TOPOLOGY reconciliation | `spec` | ● | earned | `run-auto-replan-policy.ts` (`src/executor/TOPOLOGY.md`), `drawer-card.tsx` (`src/web/TOPOLOGY.md`), packet redaction, a11y contract, plan output | Each target: confirm TOPOLOGY entry doesn't declare a live seam → delete module + tests + doc/treedocs mention, or keep and record why. Oracle: verify green + no `TOPOLOGY.md`/`treedocs.yaml` orphan reference |
| Inert tools deleted: `present_alternatives`, `execute_plan_outline_artifact`, `execute_plan_draft_artifact` + components/tests + all registry entries | `spec` | ● | earned | `src/.pi/components/alternatives.ts`, `src/.pi/extensions/executor/execute-*-artifact`, `tool-names.ts`, `run-execution-authority.ts`, `transcript-context.ts:26`, component-preview registry | Includes the orphan `'present_alternatives'` literal (already absent from `tool-names.ts` — drift realized). Pairs with row B3; −644 LOC |
| Unused barrels/wrappers/CLI helpers deleted | `spec` | ● | earned | `src/dev/index.ts`, `src/dev/end-to-end-comparison.ts`, `src/dev/faux-launcher.ts`, `src/.pi/extensions/shared/query-projection.ts`, `src/graph/validate-fixture.ts` (`src/graph/TOPOLOGY.md`), `src/web/queries/session.ts` | Out-of-graph check per file; −457 LOC |
| `row-schemas.ts` + `drizzle-typebox` + `@sinclair/typebox` deleted | `spec` | ● | earned | `src/db/row-schemas.ts`; `src/db/TOPOLOGY.md` + `src/graph/TOPOLOGY.md` reconciliation | −2 deps; changeset required |
| TOON wrappers + `@toon-format/toon` deleted | `spec` | ● | earned | `src/agents/shared/toon.ts` | No production renderer calls (verified); −1 dep |
| `stringify-tree` + `lodash.flatten` replaced by native recursive formatter | `spec` | ● | earned | `src/agents/shared/tree.ts` | Native replacement, not deletion — `renderTree` output identical (existing tests as oracle); −1 dep |
| Deterministic-exchange minting chain deleted (sequencing helper kept) | `spec` | ● | earned | `src/probes/deterministic-exchange-script.ts` | −100 LOC |
| `src/probes/**` excluded from production build | `spec` | ● | proving | `tsconfig.build.json` | Verified: non-test importers all in already-excluded `src/dev`. Oracle: `npm run build` green + probes absent from `dist/` + `check:release-pack` green |
| Six Vite-bundled web packages moved to `devDependencies` | `spec` | ● | proving | `package.json` | Unknown: published surface. Oracle: `npm pack` inspection — `dist-web` prebuilt, no runtime import of the six from published `dist/**`; `check:release-pack` green; changeset |
| CI ripgrep install line carries a name-the-contract comment | `spec` | ● | earned | `.github/workflows/test.yml:49` | NOT deletable — FE-1241 provisioned it for spawned-agent bounded grep reads. Comment names consumer + issue id |
| Unreferenced/duplicate walkthrough PNGs deleted | `spec` | ○ | earned | `testing/walkthroughs/` | Deferred: −1.15 MB, zero silent risk; fold in only if a same-directory row is already open |
| Nine recursive dir walkers → Node `readdir({recursive})` | `spec` | ○ | earned | `scripts/`, `src/**/__tests__/` | Deferred: loud class, no drift risk; opportunistic |

## B. Predicate consolidation & roster integrity

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| One executor state-predicates owner; writer, reader authority, and replay import it | `spec` | ● | earned | new module under `src/executor/` (fractal sub-tree rules apply), imported by `orchestrate.ts`, `observer-read.ts`, `petri-events.ts`, `petri-replay.ts` | Consolidates `stringArraysEqual` ×4 + terminal-summary/marking predicates (`sanitizeTerminalSummary`, `mergeTerminalSummary`, `terminalMatchesPayload`, `petriMarkingsEqual`, …). Behavior-preserving; oracle: existing executor suites green, duplicate definitions gone (`rg 'function stringArraysEqual' src` → 1) |
| One shared `canonicalPath` helper across git ports + executor authority | `spec` | ● | earned | shared fs helper; consumers: `src/app/git-{run-promotion,slice-integration,host-land}-port.ts`, `src/executor/worktree.ts`, `src/executor/run-execution-authority.ts` | Copies byte-identical today (verified) — pure lift. Oracle: suites green, `rg 'function canonicalPath' src` → 1 |
| Authority map keyed by the `tool-names.ts` union, not `Record<string, …>` | `spec` | ● | earned | `src/executor/run-execution-authority.ts:128,131` | Both drift directions become compile errors. Oracle: type-check (oxlint tsgolint) fails on a key not in the union — witnessed by the inert-tool deletion row forcing entry removal |
| One `pathExists` helper (22 copies: 16 executor tests, 5 executor production, 1 app) | `spec` | ● | earned | shared helper; `src/executor/`, `src/app/` | Oracle: `rg 'function pathExists' src scripts` → 1; suites green |
| `defaultRunId` consolidation | `spec` | ○ | earned | `src/probes/` ×6, `src/dev/` ×1 | Deferred: dev-lane only (build-excluded), low stakes |

## C. Guardrail decision

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| knip wired into `npm run check` (with topology-stub/ambient allowlist) **or** stub deleted | `spec` | ● | proving | `knip.jsonc`, `package.json` — decide during build (user, 2026-08-03) | Builder attempts wiring first; if the allowlist proves noisy or slow, fall back to deleting the stub and record why. The unwired `konsistent` script rides the same outcome. Either way, update the SPEC blind-spot Mitigation cell ("No deadness oracle in the gate") in the same row |

## Aggregate DoD

No `●` row remains `spec` / `new` / `partial`; `npm run verify:full` green; changeset committed; no `TOPOLOGY.md`, `treedocs.yaml`, or doc teaches a retired module; SPEC blind-spot mitigation cell reflects the row-C outcome.
