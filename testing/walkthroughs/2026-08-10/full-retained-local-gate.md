# FE-1348 full retained local gate

## Frozen setup

- UTC sweep record date: 2026-08-10.
- Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`.
- Commit tested: `3f148a65f6e464c4f9032c56d290838f8619d7bf`.
- Host: macOS Darwin 25.6.0, arm64 (`Darwin Kernel Version 25.6.0`, `RELEASE_ARM64_T6041`); `CI` unset.
- Tools: Node `v24.19.0`; npm `12.0.2`; Git `2.50.1 (Apple Git-155)`; Vitest `4.1.10`.
- Selected fixture intentions: none. This row executes only the repository-owned retained local aggregate gate.

## Row contract

Capability: **Full retained local gate**. The real `npm run verify:full` entry point must pass and prove the default, core-slow, comparison, and build paths through the declared aggregate command. Counts and skips must agree with the verification policy in `AGENTS.md`, `memory/SPEC.md`, and `package.json`.

## Execution

Command: `npm run verify:full`

Outcome: exit 0. The package-owned entry point ran `fix`, `test:full`, and `build`; `test:full` ran the default suite followed by `test:slow`, whose two lanes were core-slow followed by comparison.

| Lane | Files | Tests | Skips | Outcome |
| --- | ---: | ---: | ---: | --- |
| Default | 337 passed, 1 skipped (338 total) | 2,760 passed, 2 skipped (2,762 total) | 1 file / 2 tests | passed |
| Core-slow | 9 passed | 87 passed | 0 | passed |
| Comparison | 5 passed | 32 passed | 0 | passed |
| Aggregate tests | 351 passed, 1 skipped (352 lane-file executions) | 2,879 passed, 2 skipped (2,881 total) | 1 file / 2 tests | passed |
| Build | TypeScript, build info, Pi assets, and Vite web build completed | n/a | n/a | passed |

Policy comparison:

- The default command excluded `*.slow.test.ts`, as declared.
- Core-slow ran serially and excluded both comparison directories, as declared.
- Comparison ran the five explicitly retained expensive oracle files serially, as declared.
- `test:full` therefore included every retained default and slow lane, and `verify:full` completed the build after all tests, matching the declared full-local/merge-queue policy.
- The skipped-test count did not increase from the parent commit: the same source-level conditional/skipped declarations remain, and this run reported two skipped default tests with zero skips in both slow lanes. Delta: **0 tests**.

The lint-fix phase emitted six existing `typescript(unbound-method)` warnings across `src/rpc/__tests__/standalone-web-session-host.contract.test.ts` and `src/session/__tests__/live-session-host.test.ts`. They did not fail the gate or contradict this row's aggregate-command contract, so no finding was opened.

## Cleanup and integrity checks

- The worktree was clean before execution and remained clean immediately after the format-writing aggregate command; no unrelated formatter output was retained.
- No fixture, workbench, promoted evidence, or comparison `dist` path was created by this row.
- No retained Vitest or comparison-lane process remained after execution.
- No production or canonical planning seam changed. Reconciliation is limited to this evidence record and this row's ledger status.
