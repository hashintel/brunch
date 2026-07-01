# Refactor: cook run-metadata lifecycle + orchestration topology file

> Temporary derivative execution aid (ln-refactor). Delete when complete or superseded.
> Source: ln-review findings 1, 2, 4 on `src/orchestration/` (FE-1089). Finding 3
> (discriminated-union `CookRunMetadata`) is deliberately out of scope — routed to
> `ln-design` under the `cook-sandbox` frontier.

## Problem Statement

The cook lifecycle tools in `src/orchestration/` re-derive the same run-metadata plumbing:

- The identical `readRunMetadata(path)` helper (try / `JSON.parse` / `catch → undefined`) is privately copy-pasted into **13** cook-\* files.
- Every transition tool repeats the same shape by hand: read `run.json`, guard on the prior `status`, build `{ ...metadata, status: <next>, ...newFields }`, `writeFile` the metadata JSON, and hand-assemble the `{ kind: 'write_file', path: metadataPath, ifExists: 'overwrite' }` side-effect record.
- `cook-run.ts` already owns `CookRunMetadata`, the path helpers (`cookRunDir`, `cookRunMetadataPath`), and the *write* half of run creation — but the *read* half and the metadata-persist + side-effect encoding live nowhere, so they scatter.
- `src/orchestration/README.md` is the only `README.md` left under `src/**`; every other subtree now uses `TOPOLOGY.md` (AGENTS.md: "Directory `TOPOLOGY.md` files under `src/**` own current topology state").

This is pure structural debt: it works and is fully test-covered, but the metadata lifecycle is not owned by one module, so the coming `cook-sandbox` ports would multiply the duplication.

## Solution

`cook-run.ts` becomes the single owner of run-metadata I/O and side-effect encoding:

- a shared `readCookRun(cwd, runId)` (or `readRunMetadata(path)`) reader, imported by every cook tool instead of a private copy;
- a shared metadata-persist helper that writes updated metadata and returns the canonical `write_file` side-effect record.

Each transition tool keeps its own status guard and result shape (these legitimately vary), but stops re-implementing metadata read/write and the side-effect literal. `README.md` is renamed to `TOPOLOGY.md` and the two canonical-doc references are updated.

Behavior is unchanged throughout — this is a pure refactor, verified by the existing per-tool cook test suite plus `npm run verify`.

## Commits

1. Rename `src/orchestration/README.md` to `TOPOLOGY.md` and update the two references to it (the D99-L materialized-state list in `memory/SPEC.md` and the cook frontier traceability lines in `memory/PLAN.md`). No code change; markdown-link check + verify stay green.

2. Add a single run-metadata reader to `cook-run.ts`, exported from that module. Replace all 13 private `readRunMetadata` copies with imports of the shared reader; delete the local copies. Behavior identical; existing cook tests cover every caller.

3. Add a run-metadata persist helper to `cook-run.ts` that writes the updated metadata file and returns the canonical `write_file` side-effect record. Adopt it in each transition tool, replacing the inline `writeFile(metadataPath, ...)` + hand-built metadata side-effect literal. Tools that also write an artifact file keep composing that artifact's own side effect alongside the returned metadata effect. Behavior identical.

## Decisions

- **Module owner**: `cook-run.ts` owns run-metadata read, persist, path helpers, and the `CookRunMetadata` type. No new file is introduced — this deepens the existing public entry module rather than adding a shallow helper module.
- **Seam boundary**: tools own their prior-status guard and their result/DTO shape; the shared module owns metadata I/O and side-effect encoding only. The `write_file` side-effect record is a real seam (13+ identical occurrences), not a hypothetical one.
- **No behavioral change**: statuses, guards, artifact paths, and returned side-effect arrays are byte-for-byte equivalent. I52-L bounded-side-effect discipline is preserved (the helper only re-expresses the same single metadata write).
- Finalize in `memory/SPEC.md` §Decisions only if the seam proves durable through `cook-sandbox`; otherwise this refactor needs no new decision record.

## Testing Decisions

- **Behavior, not implementation**: the existing `src/orchestration/__tests__/cook-*.test.ts` suite asserts each tool's status transitions and `sideEffects` payloads — exactly the observable contract this refactor must preserve. Every cook source file has a matching test; no coverage gap.
- **No new tests required** for a behavior-preserving extraction; rely on the existing suite + `npm run verify` as the regression oracle after each commit.
- Prior art: `cook-run.ts` already exposes `cookRunDir` / `cookRunMetadataPath` as shared helpers imported across tools — the reader/persist helpers follow the same pattern.

## Out of Scope

- **Finding 3** — modelling `CookRunMetadata` as a status-discriminated union to make invalid field combinations unrepresentable. This is a design change, not a mechanical extraction; route to `ln-design` and fold into `cook-sandbox`.
- The `cook-execution-ports.ts` seam and any real-execution behavior (belongs to `cook-sandbox` / `cook-agent-runner` / `cook-land`).
- The Pi tool adapters under `src/.pi/extensions/agent-runtime/execute-cook-*/` — already appropriately thin; no change.
- Any change to statuses, guards, artifact layout, or side-effect contracts.
