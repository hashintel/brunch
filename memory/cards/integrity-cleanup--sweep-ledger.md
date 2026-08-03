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
- Intentional topology stubs (`export {}` + design comment) are not deletion candidates on unusedness alone.
- Consolidation rows are behavior-preserving: existing suites stay green, no semantics change rides along.
- Tie-off: `npm run verify:full` (executor seams are touched) and a changeset (`npm run changeset` — the published dependency set changes).

## A. Deletions & packaging

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| Pre-FE-1163 schema snapshots removed; baseline test asserts current provider constraints directly | `spec` | ● | earned | `src/.pi/extensions/__tests__/` (fixtures + `tool-schema-baseline.ts`) | Oracle: rewritten test green without snapshot fixtures; −2,339 LOC |
| Parked consequential-fact campaign deleted (resurrect from git if it re-enters PLAN) | `spec` | ● | earned | `src/dev/consequential-fact-*` | Not in PLAN (verified); dev-lane; oracle: `npm run test` green, no dangling imports |
| Committed Oxc schema copies deleted | `spec` | ● | earned | `@types/oxfmt_configuration_schema.json`, `@types/oxlint_configuration_schema.json` | Verified: `.oxlintrc.json`/`.oxfmtrc.json` `$schema` point at `node_modules`; oracle: `npm run check` green |
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
| knip wired into `npm run check` (with topology-stub/ambient allowlist) **or** stub deleted | `new` | ● | proving | decision needed: `knip.jsonc`, `package.json` | Micro-decision first (wire vs delete; the unwired `konsistent` script rides the same decision). Either outcome discharges or re-affirms SPEC blind spot "No deadness oracle in the gate" — update the blind-spot Mitigation cell in the same row |

## Aggregate DoD

No `●` row remains `spec` / `new` / `partial`; `npm run verify:full` green; changeset committed; no `TOPOLOGY.md`, `treedocs.yaml`, or doc teaches a retired module; SPEC blind-spot mitigation cell reflects the row-C outcome.
