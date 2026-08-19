# FE-1348 read-only repository gate

## Frozen setup (before execution)

- UTC date: 2026-08-10 (sweep record date).
- Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`.
- Commit: `839c45d20d38a1e51c842a8d17967edfcb4e7cbf`.
- Host: macOS Darwin 25.6.0, arm64 (`Darwin Kernel Version 25.6.0`, `RELEASE_ARM64_T6041`); `TERM=xterm-256color`; `SHELL=/bin/zsh`; `CI` unset.
- Tools: Node `v24.19.0`; npm `12.0.2`; Git `2.50.1 (Apple Git-155)`; oxlint `1.72.0`; oxfmt `0.53.0`; konsistent `1.0.0-beta.1`; remark-validate-links `13.1.0`.
- Selected fixture intentions: none. This row executes only the repository-owned read-only `npm run check` entry point; it does not seed, reset, inspect, or promote a workbench or run fixture.
- Protected concurrent work: `.pi/settings.json` remains untouched. Pre-run content SHA-256: `9a88610ff5725c86759f4163e824cd50ca473101ea43b49fe16ec671347ad028`; pre-run diff SHA-256: `08a0d881461dde5840c1671f89705b6f51437e6544c110ac65c5061257e08045`.

## Row contract

Capability: **Read-only repository gate**. The real `npm run check` aggregate must pass. Its declared chain in `package.json` is lint, format check, konsistent structural assertions, Markdown links, skill consistency, and promoted-run path checks. Warnings are classified rather than repaired inline.

## Execution

Command: `npm run check`

Outcome: exit 0. Every declared stage ran through the aggregate entry point:

- oxlint: passed with six warnings;
- oxfmt: 941 files checked, all correctly formatted;
- konsistent: 47 files checked, three advisory warnings;
- Markdown links: passed;
- ln/reporting skill contracts: 21 and 3 contracts consistent;
- promoted-run paths: 123 retained files portable.

### Warning classification

All nine warnings are **known frozen-baseline warnings**, not newly produced observations or gate contradictions:

- Six oxlint `typescript(unbound-method)` warnings are in pre-existing test mock assertions: four at `src/rpc/__tests__/standalone-web-session-host.contract.test.ts:234-237` and two at `src/session/__tests__/live-session-host.test.ts:86-87`. They reference Vitest mock methods for call assertions, occur in test code last changed by the frozen parent history, and did not prevent the type-aware lint stage from passing. This evidence-only row does not rewrite those tests.
- Three konsistent `src-area-topology-doc` warnings name `src/__tests__`, `src/client`, and `src/utils`. `konsistent.json` explicitly declares this convention with `"severity": "warning"`; therefore these are the configured advisory baseline, not missing structural evidence hidden by the command. The structural contract itself is evidenced by that configuration and the successful real konsistent query over 47 files.

No warning revealed a product-path contradiction, a broken repository-gate contract, or a genuine omitted capability. Nothing was added to `TESTING_FINDINGS.md`, and no production, tooling, configuration, fixture, or incidental file was changed.

## Integrity checks

- The protected `.pi/settings.json` content and diff hashes after execution remain `9a88610ff5725c86759f4163e824cd50ca473101ea43b49fe16ec671347ad028` and `08a0d881461dde5840c1671f89705b6f51437e6544c110ac65c5061257e08045`.
- Fixture intention remained none; no workbench or promoted evidence fixture was touched.
