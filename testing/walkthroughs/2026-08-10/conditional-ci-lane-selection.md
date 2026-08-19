# FE-1348 conditional CI lane selection

## Frozen setup (before execution)

- UTC date: 2026-08-10 (sweep record date).
- Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`.
- Commit: `36f3fca2161ce7f1f83d9691ce6d54ed822c5333`.
- Host: macOS Darwin 25.6.0, arm64; `CI` unset.
- Tools: Node `v24.19.0`; npm `12.0.2`; Git `2.50.1 (Apple Git-155)`; Vitest `4.1.10`.
- Selected fixture intentions: none. This row runs only focused selector/workflow contract tests and inspects existing policy; it does not execute comparison or provider campaigns.
- Protected concurrent work: `.pi/settings.json` pre-run content SHA-256 `9a88610ff5725c86759f4163e824cd50ca473101ea43b49fe16ec671347ad028`, pre-run diff SHA-256 `08a0d881461dde5840c1671f89705b6f51437e6544c110ac65c5061257e08045`; `src/dev/__tests__/interactive-shell-config.test.ts` content SHA-256 `a6bf0354bf2443f74b1bba6bba729d9a8893e4e61e0f55e9e5a832e82d6a1bc9`.

## Row contract

Capability: **Conditional CI lane selection**. Focused selector tests must prove that only a complete pull-request diff wholly inside the closed non-runtime allowlist omits expensive comparison oracles. Runtime/non-allowlisted paths, unknown or incomplete/empty evidence, unknown events, and merge-group candidates must fail open to that lane. The workflow and SPEC policy must agree.

## Execution

Command:

```text
npm test -- scripts/ci-test-lanes.test.mjs scripts/test-workflow.contract.test.mjs
```

Outcome: exit 0. Vitest reported **2 passed test files of 2**, **21 passed tests of 21**, **0 failed**, and **0 skipped** (382 ms).

The focused selector suite directly covered:

- omission for a complete pull-request diff wholly inside the closed allowlist (`.agents/`, `.changeset/`, `docs/`, `memory/`, and `AGENTS.md` samples), returning `comparison: false` / `closed-non-runtime-diff`;
- fail-open selection for runtime source, comparison-controller and fixture paths, test source, manifests/lockfiles, workflow/build configuration, unknown roots, and both sides of allowlist-boundary renames, returning `comparison: true` / `runtime-or-unknown-path`;
- fail-open selection for incomplete and empty diffs and an unknown event;
- unconditional selection for `merge_group`, returning `comparison: true` / `merge-group-full-gate`.

The workflow contract tests additionally proved one stable `Full gate`, selector invocation, mandatory default and non-comparison-slow lanes, comparison-only conditionality, mandatory build, and `merge_group` registration.

## Policy agreement

- `memory/SPEC.md:323` (D1-K) says complete closed non-runtime pull-request diffs alone may omit expensive comparison oracles; missing, incomplete, unknown, non-allowlisted, and merge-group evidence runs them. It also requires static checks, build, default tests, non-comparison slow tests, and one stable `Full gate`.
- `scripts/ci-test-lanes.mjs:9-39` implements the closed directory/root-file allowlist, merge-group and unknown-event fail-open branches, incomplete/empty fail-open branch, closed-diff omission, and runtime/unknown-path fail-open fallback.
- `.github/workflows/test.yml:3-6,15-17,31-37,66-77` registers pull-request and merge-group events, exposes one `Full gate`, invokes the selector, always runs check/default/core-slow/build, and conditions only `npm run test:comparison` on the selector output.

The inspected policy, selector, and workflow agree. No policy divergence, genuine omitted capability, or finding was observed; `TESTING_FINDINGS.md` and all CI selector/workflow sources remain untouched.

## Integrity checks

- Skipped-test marker count was unchanged from parent to working tree: **1 → 1**; the focused run itself reported zero skipped tests.
- Post-run protected hashes remained unchanged: `.pi/settings.json` content `9a88610ff5725c86759f4163e824cd50ca473101ea43b49fe16ec671347ad028`, Git diff `08a0d881461dde5840c1671f89705b6f51437e6544c110ac65c5061257e08045`; `src/dev/__tests__/interactive-shell-config.test.ts` content `a6bf0354bf2443f74b1bba6bba729d9a8893e4e61e0f55e9e5a832e82d6a1bc9`.
- Repository status after the focused command contained only the protected pre-existing `.pi/settings.json` modification before this owned evidence/card update.
- Fixture intention remained none; no source, workflow, script, config, package/tooling, fixture, or production path was changed.
