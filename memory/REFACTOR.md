# Refactor: reconcile PR 177 rename residue + edge-direction label

> Source: `ln-induct` run on PR 177 (FE-811) review comments. Temporary execution
> aid — delete when complete or superseded (per `AGENTS.md` §ln-refactor).
> Builder works on branch `ln/fe-811-poc-live-ship-blockers`.

## Problem Statement

PR 177 renamed several identifiers across code and docs, but the migration
stopped at the code/doc plane and never reached the **data plane**. Two
committed reference runs were generated before the renames and never
regenerated, so they straddle old and new contracts silently:

- `.fixtures/runs/fixture-curation/fixture-curation-2026-06-05T104440Z/`
- `.fixtures/runs/project-graph-review-cycle/2026-06-06-project-graph-review-cycle/`

Concretely, against the current writer contract (`src/probes/*` now emit
`graphOverviewJson` → `graph-overview.json`; `src/rpc/product-updates.ts` only
emits topic `workspace.state`):

- both runs' `report.json` carry `artifacts.graphSnapshotJson` → `graph-snapshot.json`
- both runs ship a stale `graph-snapshot.json` file (writers now produce `graph-overview.json`)
- the `project-graph-review-cycle` run's `report.json:88` carries a stale
  `"topic": "workspace.snapshot"`

The Cursor bot sampled only the first of these in only the artifact field; the
others are the unsampled tail of the same syndrome. Field-patching the one the
bot named would leave the run still wrong on the others — the false confidence
this whole lens predicts.

Separately, a presentation-layer bug: `formatRelatedNodesResult` in
`src/.pi/extensions/graph/command-adapter.ts:255` labels each result edge
`outgoing`/`incoming` from a one-sided check (`source ∈ anchors`). The query
layer (`src/graph/queries.ts`) correctly traverses multi-hop and node↔node
edges, so at hop ≥ 2 an edge between two non-anchor nodes (source ∉ anchors) is
silently mislabeled `incoming`.

**Data-plane delta:**

```pseudo
tree current (per stale run)            tree desired
  report.json                             report.json
    artifacts.graphSnapshotJson    -->      artifacts.graphOverviewJson
    productUpdates[].topic                  productUpdates[].topic
      "workspace.snapshot"         -->        "workspace.state"
  graph-snapshot.json              -->      graph-overview.json   (file renamed/regenerated)
```

## Solution

Regenerate both reference runs from their committed session transcripts (the
runs are replay-deterministic — the probe reads `session.jsonl` + seed and
derives artifacts; no live model calls), so every committed identifier matches
the current writer contract. Then install a guard so a future rename cannot
silently leave reference-data residue. Finally, fix the edge-direction label to
classify by both endpoints.

### Non-goals (do not do these)

- **Do NOT add `snapshottedLsn` backward-compatibility.** Copilot suggested the
  reader at `src/projections/session/runtime-state.ts:121` accept both
  `seenLsn` and the legacy `snapshottedLsn`. This contradicts the repo's
  pre-release posture (`AGENTS.md`: no back-compat shims unless explicitly
  required). No committed transcript carries the legacy field. Leave the
  single-field read as-is.
- Do not widen scope to other probe runs — the audit confirmed the other five
  committed `report.json` files carry no graph-artifact or workspace-topic keys.
- Do not touch the `queries.ts` traversal — it is correct.

## Commits

Ordered; each leaves the suite green. Behavioral change last.

1. **Regenerate the `fixture-curation-2026-06-05T104440Z` reference run.**
   Replay its committed `session.jsonl` through the fixture-curation probe so
   `report.json` emits `graphOverviewJson` → `graph-overview.json`, and the
   stale `graph-snapshot.json` is replaced by `graph-overview.json`. Confirm the
   probe test still passes against the regenerated run.
   - Touches: `.fixtures/runs/fixture-curation/fixture-curation-2026-06-05T104440Z/*`
   - Driver: `src/probes/fixture-curation-loop.ts` (entrypoint writes to the run dir)

2. **Regenerate the `2026-06-06-project-graph-review-cycle` reference run.**
   Same regeneration; this additionally resolves the stale
   `"topic":"workspace.snapshot"` to `"workspace.state"`. Confirm
   `src/probes/project-graph-review-cycle-proof.test.ts` passes.
   - Touches: `.fixtures/runs/project-graph-review-cycle/2026-06-06-project-graph-review-cycle/*`
   - Driver: `src/probes/project-graph-review-cycle-proof.ts`

3. **Add a contract-residue guard test (enforce loudly).** A test that scans
   every committed `report.json` under `.fixtures/runs/**` and fails if any
   contains a retired contract token (`graphSnapshotJson`, `graph-snapshot`,
   `workspace.snapshot`). Green only after commits 1–2. This is the lens's
   "enforce it loudly" repair: a future rename that forgets the data plane now
   fails CI instead of shipping silent drift.
   - Touches: new test near `src/probes/` (e.g. `src/probes/fixture-contract-residue.test.ts`)
   - Note: `.fixtures` is gitignored but force-committed — enumerate files via
     `git ls-files '.fixtures/**/report.json'`, not a glob that respects ignore.

4. **Fix the edge-direction label (behavioral).** In
   `formatRelatedNodesResult` (`src/.pi/extensions/graph/command-adapter.ts:255`),
   classify by both endpoints: `source ∈ anchors → outgoing`,
   `target ∈ anchors → incoming`, else `lateral`. Add a regression test that
   builds a 2-hop related result containing a node↔node edge and asserts it is
   labeled `lateral`, not `incoming`.
   - Touches: `src/.pi/extensions/graph/command-adapter.ts` + its test

## Verification

- Per commit: `npm run fix` (inner loop).
- Gate before handing off: `npm run verify` (fix → test → build).
- Commit 3's guard must be RED if either regeneration is skipped, GREEN after.
- Commit 4's regression test must be RED against the current one-sided label.
```

The lens that produced this is `ln-review` §Contract integrity → "rename
blast-radius includes the data plane."
