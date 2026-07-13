# Workspace DB identity: brunch-v1.db rename + fail-safe open

Frontier: workspace-db-identity
Status:   active
Mode:     single
Created:  2026-07-13

Full scope card — cutover-shaped (rename + guard); establishes I63-L's protecting oracle.

Posture: earned (inherited from workspace-db-identity). Build queues SERIALLY after the
in-flight `spec-posture--establishment-tracer.md` build is committed — one writer per
worktree, and the conditional posture-evidence wiring below assumes that card's
establishment seam exists.

## Target Behavior

The workspace runtime opens exactly one deliberately-named database — `.brunch/brunch-v1.db`, self-identified via SQLite `application_id` — refusing foreign files, surfacing (never touching) a 0.x `brunch.db`, and adopting a legacy alpha `data.db` by rename on first open.

## Full-card cold-start reads

```
- memory/SPEC.md   — D124-L (all mechanics: lineage policy, constant, stamp, detection,
                     recovery), I63-L (the invariant this slice's tests will protect),
                     D118-L (posture-evidence consumer)
- memory/PLAN.md   — frontier: workspace-db-identity (Group 2, FE-1196)
- src/graph/TOPOLOGY.md — workspace-store row (the "opens .brunch/data.db" line this
                     slice rewrites)
- memory/cards/spec-posture--establishment-tracer.md — the establishment seam the
                     conditional evidence-wiring lands against (read its final state,
                     post-build, not the scoped intent)
```

## Boundary Crossings

```
→ src/graph/workspace-store.ts open path (constant, stamp/check, detection, recovery)
→ every path-literal consumer (seed-fixtures, export-fixtures, dev-cli, drizzle.config)
→ [conditional] populated-cwd/brownfield evidence into the spec-posture establishment seam
→ .brunch/ directory on disk (rename-only mutation; refusal paths touch nothing)
```

## Risks and Assumptions

```
- RISK: drizzle.config.ts may not cleanly import the TS constant from src (drizzle-kit
  loader) → MITIGATION: verify at build; if it cannot, the config keeps its own literal
  with a `ceiling:` comment naming the constant as source of truth and a test pinning
  the two equal.
- RISK: captured fixtures under .fixtures/ contain data.db files; seeding them into a
  workspace after the rename would strand the old name → MITIGATION: seed-fixtures adopts
  via the same recovery path, or regenerate fixtures (pre-release posture licenses
  regeneration; recovery is owed only to live .brunch/ workspaces per D124-L).
- RISK: rename-with-sidecars (-wal/-shm) on a db that was not cleanly closed →
  MITIGATION: recovery renames all three before any open; never rename while a
  connection exists; test the wal-present case.
- ASSUMPTION: spec-posture's establishment seam is committed before this card builds.
    → IMPACT IF FALSE: the evidence-wiring leaf has no seam to land on.
    → VALIDATE: check the spec-posture card Status and git log at build start; if not
      landed, build everything else and defer ONLY the wiring leaf (owner: frontier
      workspace-db-identity / FE-1196; trigger: spec-posture merge) — do not improvise
      a parallel evidence channel.
```

## Posture check (earned)

- **Closes:** the accidental-safety gap — filename divergence as the only guard between incompatible 0.x/1.x data models.
- **Materializes:** D124-L into the workspace-store home; I63-L's protecting oracle.
- **Canonicalizes:** `.brunch/brunch-v1.db` and the `brunch-v{major}.db` lineage.
- **Deletes/retires:** all seven scattered `data.db` literals.
- **Locks in:** I63-L as tested behavior.

All five closure questions answered — no circling.

## Acceptance Criteria

```
✓ single constant — workspace-store test asserts the exported filename constant is
  'brunch-v1.db'; named check: `rg -n "data\.db" src/ drizzle.config.ts` yields only the
  recovery/adoption code and its tests (no path-literal consumers remain)
✓ stamp + match — workspace-store test: fresh create stamps application_id with the
  Brunch magic; reopen of a stamped db succeeds
✓ fail-safe refusal — workspace-store test: a brunch-v1.db with foreign/zero-mismatched
  application_id → typed refusal error naming the path; file bytes untouched (no open,
  no migrate, no delete)
✓ 0.x detection — workspace-store test: sibling .brunch/brunch.db present → detection
  result exposed to callers; the 0.x file is never opened or written
✓ recovery — workspace-store tests: data.db (+ -wal/-shm variants) present and
  brunch-v1.db absent → renamed then opened normally (drizzle migrations included);
  both present → brunch-v1.db wins, data.db left untouched
✓ consumers follow — existing seed-fixtures / export-fixtures / dev-cli suites stay green
  under `npm run verify` with the new name; dev-cli reset message names brunch-v1.db
✓ [conditional] posture evidence — detection feeds populated-cwd/brownfield evidence into
  the spec-posture establishment flow (test in that seam's suite); if spec-posture has
  not landed, this leaf defers with owner FE-1196 / trigger spec-posture merge
```

## Invariants preserved

```
- No user data is ever deleted or overwritten: recovery is rename-only; every refusal
  path is read-only — STOP-THE-LINE (this IS I63-L; a red here is a respec signal)
- Drizzle migration authority unchanged (D124-L): migrations still run at open,
  including on an adopted data.db — guarded by: existing db/migration tests +
  the recovery acceptance test above
- Fixture capture/seed round-trip keeps working — guarded by: existing seed-fixtures /
  export-fixtures tests in `npm run verify`
- Workspace-level .brunch/workspace.json posture stub untouched (D118-L boundary) —
  guarded by: src/workspace/workspace-state-store tests staying green
```

## Verification Approach

```
- Inner: unit tests over every open-guard branch (create / match / refuse / detect /
  recover) + npm run fix — proves I63-L mechanically
- Middle: none beyond the branch tests — the open path IS the seam; no cross-module flow
  to exercise separately
- Outer: TESTING_PLAN.md run 1D ("Existing Brunch 0.x database — caution") witnesses the
  detection surfacing; rides FE-1196's owned outer beats alongside spec-posture's
  Concern 2 runs — same branch, before tie-off, not a later lane
```

## Cross-cutting obligations

```
- I63-L wording is the contract — do not weaken "never opened, migrated, or deleted"
  to "warn and continue"
- src/graph/TOPOLOGY.md workspace-store row must be rewritten in the same slice
  (it currently states the data.db name); D124-L's current-state pointer aims there
- Keep the lineage policy visible: the constant's doc comment names brunch-v{major}.db
  and the major-version-only format-change rule
- Reconciliation at close: I63-L oracle column moves from "planned" to the test names;
  D124-L status drops "materialization pending"
```

## Expected touched paths (tentative)

```
src/graph/
├── workspace-store.ts                 ~  (constant, stamp/check, detection, recovery)
├── workspace-store.test.ts            +? (new, or extend the existing store suite)
├── seed-fixtures.ts                   ~
├── export-fixtures.ts                 ~
└── TOPOLOGY.md                        ~  (workspace-store row)
src/dev/dev-cli.ts                     ~
drizzle.config.ts                      ~
src/.pi/components/workspace-dialog/…  ?  (conditional evidence wiring — only after
src/session/workspace-session-coordinator.ts ?  spec-posture is committed; else defer)
memory/SPEC.md                         ~  (reconciliation: I63-L oracle, D124-L status)
memory/PLAN.md                         ~  (frontier status)
```
