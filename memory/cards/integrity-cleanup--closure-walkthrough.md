# Integrity cleanup closure walkthrough

Frontier: integrity-cleanup
Status:   active
Mode:     sweep
Created:  2026-08-04

## Orientation

- Containing seam: FE-1311 repository-integrity closure — make the package, module, and documentation paths agree with the current implementation.
- Frontier: `integrity-cleanup` on `ln/fe-1311-integrity-cleanup`; the original sweep is dispositioned, including A2's verified keep.
- Posture: **earned** (inherited from `integrity-cleanup`); every row below has a settled owner and closure oracle.
- Main risk: turning a bounded closure walkthrough back into generative dead-code cleanup. The five required rows are the closed inventory; adjacent findings stay in PLAN Horizon.

## Cold-start reads

- `memory/PLAN.md` — frontier `integrity-cleanup`; boundary, aggregate DoD, and trigger-gated residue
- `memory/SPEC.md` — D140-L and §Acknowledged Blind Spots
- `AGENTS.md` — §code organization, §topology files, §development phase posture, and verification commands
- `src/dev/TOPOLOGY.md` — end-to-end comparison root/private-subtree ownership
- `src/executor/TOPOLOGY.md` — `path-exists.ts` ownership and the deliberately unresolved `source-policy.ts` semantic fork
- `package.json` and `scripts/check-release-pack.mjs` — published file set and release-artifact oracle

## Sweep preflight

1. **Boundary:** exactly five closure findings belong: published web artifact exclusivity, probe topology ownership, comparison public-root conformance, the final exact `pathExists` clone, and honest DB test naming. Out: `source-policy.ts` behavior, `src/utils/strings.ts`, `.npmcheckrc`, TOON/D83-L, production-dependency-closure automation, and any newly discovered cleanup candidate.
2. **Source-of-truth inputs:** `package.json#files` + `src/rpc/web-host.ts` + built tar entries; the actual `src/probes/**` entry points/consumers; AGENTS.md's fractal public-root rule + `src/dev/TOPOLOGY.md`; `src/executor/path-exists.ts` + the registry test's byte-identical local helper; and the DB test's imports/assertions.
3. **Owners / closure:** each row below names one owner and a runnable oracle.
4. **Classification:** buildable-now. No row depends on future product state or provider evidence.
5. **Closed inventory:** five required rows. One newly discovered row may be recorded as `new`; more than one means this ledger was not closed and must return to `ln-plan`.

## Ledger

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| `dist-web/**` is the sole published web artifact; local `dist/web/**` and `dist/probes/**` remain buildable but cannot enter the tarball | `built` | ● | earned | `package.json`; `scripts/check-release-pack.mjs`; `.changeset/trim-published-install-surface.md` | Source truth: `src/rpc/web-host.ts` serves `dist-web`; no published entry reaches `dist/web`, whose emitted JS depends on non-emitted CSS/image imports. Close with an exported prefix-exclusion assertion covered in `scripts/check-release-pack.test.mjs`, `dist-web/index.html` inclusion, and `npm pack --dry-run --ignore-scripts --json` showing zero `dist/web` / `dist/probes` entries. Do not change `tsconfig.build.json`: local compiled consumers remain valid. |
| `src/probes/TOPOLOGY.md` declares probe ownership, invocation/build/package boundaries, and dependency direction | `built` | ● | earned | `src/probes/TOPOLOGY.md` | Source truth: the 17 CLI-guarded/buildable probe modules, two shell entry points, probe tests, `src/dev` consumers, and the `dist/probes` local-build contract. Close with `npm run konsistent` no longer reporting the `src/probes` topology warning, plus `npm run check:markdown-links`. Keep the file short and within the allowed third-segment topology home. |
| External consumers of `end-to-end-comparison/` import its public root | `built` | ● | earned | `src/dev/end-to-end-comparison.ts`; `src/dev/execution-comparison/historical-replay-target.ts`; `src/dev/TOPOLOGY.md` | Source truth: AGENTS.md's fractal public-root rule and the five current deep imports from `historical-replay-target.ts`. Export `materializeExactExecutionPacket` from the root and route that consumer through one root import. Keep `validation.ts` private: no external reader needs it. Close with `src/dev/execution-comparison/__tests__/historical-replay-target.test.ts`, `npm run check`, and a structural grep showing no import from `../end-to-end-comparison/` outside the root file and private subtree. |
| All byte-identical existence checks use executor-owned `pathExists` | `built` | ● | earned | `src/.pi/extensions/__tests__/registry.test.ts` → `src/executor/path-exists.ts` | Source truth: the local `fileExists` body is identical to the shared helper and the test already crosses the executor boundary. Import the owner, delete the local helper, and preserve unrelated direct `access(...)` assertions. Close with the registry suite, the path-exists suite, and a structural check that this file defines no `fileExists`. Do not touch the non-equivalent `source-policy.ts` readability check. |
| DB column round-trip coverage has a name matching what it imports and proves | `built` | ● | earned | `src/db/row-schemas.test.ts` → `src/db/schema-columns.test.ts` | Source truth: the suite imports `connection.ts` and `schema.ts`, never `row-schemas.ts`; it proves posture and acknowledged-LSN column round trips. Rename only; do not rewrite or split the tests. Close with `npx vitest run src/db/schema-columns.test.ts` and absence of the old path. |

## Aggregate DoD

- Every `●` row is `have` or `built`.
- `npm pack --dry-run --ignore-scripts --json` contains `dist-web/index.html` and no path under `dist/web/` or `dist/probes/`.
- `npm run check` passes; the pre-existing topology warnings outside this slice (`src/__tests__`, `src/client`, `src/utils`) remain out of scope.
- Focused release-helper, historical-replay, registry/path-exists, and DB schema-column suites pass.
- No product behavior, source-build inclusion, dependency classification, or unrelated cleanup changes ride the slice.

## Cross-cutting obligations

- D140-L remains the deletion discipline: direct contract assertions are welcome; automated inference from reference count is not.
- `dist/probes/**` and `dist/web/**` may still exist after `npm run build`; this slice governs the published tarball, not local build output.
- The end-to-end comparison root is a public boundary, not a mirror of every private module; export only what an external consumer reads.
- Existing archive/history is not rewritten to pretend old package or module shapes never existed.

## Expected touched paths (tentative)

```text
package.json                                                     ~
.changeset/trim-published-install-surface.md                      ~
scripts/
├── check-release-pack.mjs                                       ~
└── check-release-pack.test.mjs                                  ~
src/
├── probes/TOPOLOGY.md                                           +
├── dev/
│   ├── TOPOLOGY.md                                              ~
│   ├── end-to-end-comparison.ts                                 ~
│   └── execution-comparison/historical-replay-target.ts         ~
├── .pi/extensions/__tests__/registry.test.ts                    ~
└── db/
    ├── row-schemas.test.ts                                      -
    └── schema-columns.test.ts                                   +
memory/
├── PLAN.md                                                      ~
└── cards/integrity-cleanup--closure-walkthrough.md              ~
```

## Promotion / disposal

A row that stops being row-sized remains open and routes through `ln-plan`; it does not silently widen. Once all five rows are built and canonical docs agree, `ln-sync` deletes this ledger, archives FE-1311's closure, and returns PLAN to a three-item rolling completion window.
