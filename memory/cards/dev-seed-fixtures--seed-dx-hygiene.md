# Seed DX hygiene: wipe-and-reset, doc truth, continuous seed currency

Frontier: dev-seed-fixtures
Status:   active
Mode:     chain
Created:  2026-06-11

Three independent hardening cards inside the settled seed-CLI seam. No card
depends on implementation findings from another. The frontier's two remaining
◐ acceptance rows (explicit all-seeds flag, seed disposition catalog) are
**not** in this file — they stay frontier-level work, named but not
auto-implemented here.

---

## Card 1 — `--reset` wipe-and-reset flag on the seed CLI

Status: done (2026-06-11)

### Objective

`npm run seed -- --workspace <dir> --seed <set>/<slug> --reset` deletes the
target workspace's `.brunch/data.db` (plus `-wal`/`-shm` sidecars) before
seeding, making "fresh workbench from one named seed" a single command instead
of a manual `rm` ritual.

### Light-card cold-start reads

```
- memory/SPEC.md  — D70-L (four-role .fixtures tree), D20-L/D52-L (graph owns DB access)
- memory/PLAN.md  — frontier: dev-seed-fixtures (acceptance + cross-cutting obligations)
- src/graph/seed-fixtures.ts — current CLI parse/flow
```

### Acceptance Criteria

```
✓ --reset removes only <workspace>/.brunch/data.db, data.db-wal, data.db-shm — never the .brunch/ directory or anything else in the workspace
✓ --reset with a missing DB is a no-op (fresh workbench seeds cleanly)
✓ reset-then-seed yields a DB containing only the selected fixture's spec (no residue from prior seeds)
✓ --reset without --workspace/--seed still fails with usage before touching anything
✓ usage string documents --reset
```

### Verification Approach

```
- Inner: seed-fixtures.test.ts CLI tests on temp workspace dirs (seed → reseed with --reset → assert single spec; missing-DB no-op; flag parse rejection)
```

### Cross-cutting obligations

- Deletion is file-scoped to the three DB files; never `rm -rf` the workspace
  or `.brunch/` (critical file-safety rule — workbench `.brunch/` may hold
  other local state like `debug/`).
- Seeding still routes exclusively through `seedFixture`/`CommandExecutor`.
- No auto-seeding or auto-reset added to app startup.

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/graph/
├── seed-fixtures.ts        ~
└── seed-fixtures.test.ts   ~
.fixtures/README.md         ~   (one-line flow update: --reset replaces manual rm)
```

---

## Card 2 — retire stale manual-testing doc contract

Status: done (2026-06-11) — divergence note: staleness was deeper than scoped
(retired `issue-tracker-*` scenario catalog, `src/server/fixtures/corpus.ts`
capture flow, phase language); rewrote the whole doc to the workbench/sidecar
contract rather than patching the wipe section only. Spotted but NOT touched:
`docs/praxis/dev-server-logs.md` also looks stale (vite/api/agent-tail world).

### Objective

`docs/praxis/manual-testing.md` describes the current seeding reality —
`--workspace`/`--seed` flags, workbench `.brunch/data.db`, `--reset` for
wipe — and no longer references `brunch.db`, `BRUNCH_DB`, positional seed
scenarios (`issue-tracker-design-active`), or implicit all-seeds listing.

### Light-card cold-start reads

```
- memory/SPEC.md  — D70-L, D71-L (workbench launch convention)
- memory/PLAN.md  — frontier: dev-seed-fixtures (its ✅ doc acceptance row set the canonical flow)
- .fixtures/README.md — the canonical seed-then-dev flow to align with
```

### Acceptance Criteria

```
✓ no occurrence of brunch.db, BRUNCH_DB, or positional seed invocation remains in docs/praxis/manual-testing.md
✓ documented wipe+seed+launch flow is copy-pasteable and matches the actual CLI (verified by running it once against a temp workbench)
✓ scenario guidance points at real seed sets under .fixtures/seeds/ (names only; the disposition catalog stays frontier-level)
```

### Verification Approach

```
- Inner: grep for retired terms; manual execution of the documented commands
- (no test code; doc-only card)
```

### Assumption dependency

None.

### Expected touched paths (tentative)

```
docs/praxis/manual-testing.md   ~
```

Note: sequenced after Card 1 only because the doc should name `--reset`; the
flag's design is fixed by Card 1's card text, not by its implementation
findings, so the chain gate holds.

---

## Card 3 — continuous all-seeds schema-currency test

Status: next

### Objective

A vitest test globs every `.fixtures/seeds/<set>/<slug>.json` and seeds each
through `seedFixture` into an in-memory DB, so any schema/command-layer change
that invalidates a tracked seed fails `npm run test` instead of waiting for an
on-demand `validate-fixture.ts` run.

### Light-card cold-start reads

```
- memory/SPEC.md  — D70-L (seeds are tracked INPUT truth), §Verification Design loop tiers
- memory/PLAN.md  — frontier: dev-seed-fixtures
- src/graph/validate-fixture.ts — the existing on-demand legality check this test makes continuous
```

### Acceptance Criteria

```
✓ one test discovers all seed JSON files by glob/readdir (no hand-maintained list to drift)
✓ each fixture seeds successfully via seedFixture + CommandExecutor into :memory:
✓ failure output names the offending <set>/<slug> and surfaces command-layer diagnostics
✓ _*.ts prep scripts and README.md files under seeds/ are ignored by discovery
```

### Verification Approach

```
- Inner: the new test itself (npm run test); prove the failure path once by pointing it at a deliberately illegal in-test fixture object, not by corrupting a tracked seed
```

### Cross-cutting obligations

- Per-fixture named test cases (or equivalent) so a single bad seed doesn't
  mask the legality status of the rest.
- `validate-fixture.ts` stays as the fast single-fixture authoring loop; this
  card adds the continuous gate, it does not replace the CLI.

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/graph/
└── seed-fixtures.test.ts   ~   (or + seeds-currency.test.ts if the file reads better split)
```
