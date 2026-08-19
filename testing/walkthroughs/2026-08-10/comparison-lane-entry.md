# FE-1348 comparison lane entry

## Frozen setup (before execution)

- UTC date: 2026-08-10 (sweep record date).
- Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`.
- Commit: `51e2869c96cbf55583206830a17c2a766a3a03c8`.
- Host: macOS Darwin 25.6.0, arm64 (`Darwin Kernel Version 25.6.0`, `RELEASE_ARM64_T6041`); `TERM=xterm-256color`; `SHELL=/bin/zsh`; `CI` unset.
- Tools: Node `v24.19.0`; npm `12.0.2`; Git `2.50.1 (Apple Git-155)`; Vitest `4.1.10`.
- Selected fixture intentions: none. This row executes only the closed repository-owned comparison test lane. It does not launch a provider campaign, seed or reset a workbench, or promote comparison artifacts.
- Protected concurrent work: `.pi/settings.json` remains untouched. Pre-run content SHA-256: `9a88610ff5725c86759f4163e824cd50ca473101ea43b49fe16ec671347ad028`; pre-run diff SHA-256: `08a0d881461dde5840c1671f89705b6f51437e6544c110ac65c5061257e08045`. `src/dev/__tests__/interactive-shell-config.test.ts` also remains untouched; content SHA-256: `a6bf0354bf2443f74b1bba6bba729d9a8893e4e61e0f55e9e5a832e82d6a1bc9`.

## Row contract

Capability: **Comparison lane entry**. The real `npm run test:comparison` entry point must pass its closed current suite and leave bounded cleanup. This validates lane availability and retained comparison oracles only; it does not claim a fresh Brunch, Claude, provider, mission, or execution-comparison campaign.

## Execution

Command: `npm run test:comparison`

Outcome: exit 0. The package-owned entry point invoked Vitest with one worker over its five declared slow comparison files:

- `src/dev/execution-comparison/__tests__/browser-oracle.slow.test.ts`
- `src/dev/execution-comparison/__tests__/host-landing-oracle.slow.test.ts`
- `src/dev/execution-comparison/__tests__/petrinaut-optimization-oracle.slow.test.ts`
- `src/dev/execution-comparison/__tests__/prospect-research-workspace-oracle.slow.test.ts`
- `src/dev/end-to-end-comparison/__tests__/factorial-browser-oracle.slow.test.ts`

Vitest reported **5 passed test files of 5**, **32 passed tests of 32**, **0 failed**, and **0 skipped**. Duration was 302.13 seconds, including 299.73 seconds in tests.

No output contradicted the declared comparison-lane owner or contract, and no genuine omitted capability was discovered. Nothing was added to `TESTING_FINDINGS.md`; no provider-quality or saved-mission conclusion is inferred from this lane-only pass.

## Cleanup and integrity checks

- Repository status before and immediately after the lane contained only the protected pre-existing `.pi/settings.json` modification.
- The pre-existing `.fixtures/scratch` inventory was byte-path identical before and after execution; no workbench, run fixture, or promoted evidence path was created.
- No comparison fixture `dist` directory remained under `src/dev`.
- The lane's known `brunch-prospect-*`, `brunch-petrinaut-*`, `brunch-e2e-factorial-oracle-*`, and `brunch-factorial-oracle-*` temporary-root families had no newly retained root. Six `brunch-prospect-execution-*` roots were present after the command, but filesystem birth times show all six predated this run (latest `2026-08-10T12:41:23`, before Vitest's `12:43:18` start); they are protected pre-existing host residue and were not removed.
- No retained Vitest or comparison-lane process remained after the command.
- Protected hashes after execution remained unchanged: `.pi/settings.json` content `9a88610ff5725c86759f4163e824cd50ca473101ea43b49fe16ec671347ad028`, its Git diff `08a0d881461dde5840c1671f89705b6f51437e6544c110ac65c5061257e08045`, and `src/dev/__tests__/interactive-shell-config.test.ts` content `a6bf0354bf2443f74b1bba6bba729d9a8893e4e61e0f55e9e5a832e82d6a1bc9`.
