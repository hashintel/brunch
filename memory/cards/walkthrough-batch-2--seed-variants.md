# Seed variants for skill-routing and generative probes

Frontier: walkthrough-batch-2
Status:   active
Mode:     slices
Created:  2026-07-02

## Orientation

- **Containing seam:** the tracked-seed contract (`src/graph/seed-fixtures.ts` → `CommandExecutor`) and its export inverse (`src/graph/export-fixtures.ts`); fixture files under `.fixtures/seeds/workspace-alpha-grounding/`.
- **Frontier:** `walkthrough-batch-2` (FE-1124) — fixture/seed preparation is in its declared remit. Consumers: TESTING_PLAN.md scenario 2 routing probes (propose/project/review rows currently ✗/◔ "no seed"), goal 6 generative discoverability, and `session-entry-orientation`'s generative menu-option verification (PLAN §Dependencies edge).
- **Posture:** earned (inherited from walkthrough-batch-2 fixture-prep remit) — settled seams throughout; each card closes a named seed gap from the scenario-2 matrix. Card 1 additionally **materializes** D99-L's settlement dimension into the fixture contract.
- **Main open risk:** authored variants may not be *discriminating enough* — a seed can satisfy its structural description yet still leave the target skill's trigger ambiguous in live conduct. Mitigation is in each variant's acceptance (state assertions phrased as the matrix's discriminating conditions), with live probe beats as the outer check.
- **Deliberately not scoped:** the mid-size alpha (~30 nodes) seed for the `analyze` probe. It stays an open `?` in the scenario-2 matrix; the drive-live-then-export flow (`npm run dev -- export`) is the prep path if/when that probe becomes pressing. Hand-authoring 30 coherent nodes is not cheaper than driving a session there.

Mechanics established at scope time (2026-07-02): mutation ops already carry optional `settlement` (`src/graph/command-executor/graph-mutation-types.ts:51-68`; command layer defaults `'settled'`) — the gap is only that `SeedFixtureNode`/`SeedFixtureEdge` and the export mapping don't carry the field. `npx tsx src/graph/validate-fixture.ts <name>/<variant>` is the fast authoring loop. Seed refs are auto-discovered from `.fixtures/seeds/<name>/<variant>.json` — new variants need no registration.

---

## Card 1 — Settlement round-trips through the seed-fixture contract · `done`

### Objective

Fixture JSON can declare `settlement` (`advisory` | `settled`) per node and per edge, `seedFixture` passes it through to the command layer, and `exportSeedFixture` emits it — so settlement-bearing graph states survive the seed → workbench → export round trip.

### Light-card cold-start reads

```
- memory/SPEC.md   — D99-L (settlement dimension, orthogonal to basis), I52-L (advisory never read as settled)
- memory/PLAN.md    — frontier: walkthrough-batch-2
- .fixtures/seeds/README.md — seed-ref conventions
- src/graph/command-executor/graph-mutation-types.ts — existing per-op settlement fields
```

### Acceptance Criteria

```
✓ seed-fixtures.test.ts — a fixture node/edge with settlement: 'advisory' seeds as advisory; omitted settlement still defaults to 'settled' (existing seeds unaffected)
✓ export-fixtures.test.ts — export emits settlement for advisory rows; seed → export → seed round-trip preserves settlement (deep-equal on the settlement projection)
✓ validate-fixture CLI accepts a settlement-bearing fixture without changes beyond the type
```

### Verification Approach

```
- Inner: vitest — extend seed-fixtures.test.ts + export-fixtures.test.ts round-trip cases
- Middle: npx tsx src/graph/validate-fixture.ts on a settlement-bearing scratch fixture
```

### Cross-cutting obligations

- I52-L: nothing in this card may cause advisory rows to be *read* as settled — passthrough only, no reader changes.
- Pre-release posture: no compatibility shim; existing fixtures stay valid because the field is optional with the command-layer default.

### Assumption dependency

None — D99-L/I52-L are landed and command-enforced (FE-1116).

### Expected touched paths (tentative)

```
src/graph/
├── seed-fixtures.ts                    ~  (SeedFixtureNode/Edge fields + op passthrough)
├── export-fixtures.ts                  ~  (emit settlement)
└── __tests__/
    ├── seed-fixtures.test.ts           ~
    └── export-fixtures.test.ts         ~
```

---

## Card 2 — Settlement-independent variants: `intent-settled` + `requirements-accepted` · `done` (independent of Card 1)

### Objective

Two hand-authored variants of `workspace-alpha-grounding` give the `propose` and `project` skills a discriminating starting state, closing the two ✗ rows in the scenario-2 matrix.

### Light-card cold-start reads

```
- memory/SPEC.md   — D56-L (intent kind set), D100-L (project = derivation from accepted anchors), I51-L (candidates never commit graph truth)
- memory/PLAN.md    — frontier: walkthrough-batch-2
- TESTING_PLAN.md   — scenario 2 per-skill discriminating-state matrix (the contract these variants satisfy)
- src/agents/references/data-model.md — kind → plane vocabulary
- .fixtures/seeds/workspace-alpha-grounding/base.json — authoring base
```

### Acceptance Criteria

```
✓ intent-settled.json — validates via validate-fixture; intent plane carries a settled, coherent goal/thesis/context/constraint/term set (alpha's domain, elaborated); requirement kinds present but plane effectively thin/empty per the propose trigger ("settled intent + EMPTY target plane"); zero design/oracle-plane nodes
✓ requirements-accepted.json — validates; requirements settled/accepted with intent anchors and edges; zero criterion/check/vv_* nodes (the project trigger: "ACCEPTED upstream + empty downstream")
✓ npm run dev -- --seed workspace-alpha-grounding/intent-settled --reset boots to a ready session (smoke, and same for requirements-accepted)
✓ TESTING_PLAN.md scenario-2 matrix rows propose/project flip from ✗ to ✓ with the variant named
```

### Verification Approach

```
- Inner: validate-fixture per variant (structural legality via the real command layer)
- Middle: rpc graph.overview counts assert the discriminating shape (empty planes actually empty)
- Outer: the propose/project routing probes themselves (walkthrough beats — consumed by the doctor thread, not this card)
```

### Cross-cutting obligations

- Discriminating-state fidelity: each variant's node/edge content must make the target skill the *distinctively correct* move, not merely a legal one — content coherence matters, not just kind counts.

### Assumption dependency

None.

### Expected touched paths (tentative)

```
.fixtures/seeds/workspace-alpha-grounding/
├── intent-settled.json          +
└── requirements-accepted.json   +
TESTING_PLAN.md                  ~  (matrix fit-today cells)
```

---

## Card 3 — Settlement-bearing variants: `advisory-pending` + `contradictory` · `next`

### Objective

Two further variants exercise the review path: a settled+advisory settlement mix (`advisory-pending`) and plantable semantic conflicts (`contradictory`), unlocking the review routing probe and giving `semantic_conflict` reconciliation testing a repeatable state.

### Light-card cold-start reads

```
- memory/SPEC.md   — D99-L/I52-L (settlement), D81-L (capture commitment gradient — what makes content plausibly advisory)
- memory/PLAN.md    — frontier: walkthrough-batch-2; reconciliation-derivation §Convergence (contradictory feeds semantic_conflict testing; advisory/staleness state feeds the future derived edge_revalidation view)
- TESTING_PLAN.md   — scenario 2 matrix (review row) + scenario 4 (settlement visibility)
```

### Acceptance Criteria

```
✓ advisory-pending.json — validates; carries a mixed settled/advisory node set (advisory rows provenance-plausible, e.g. source-derived); requires Card 1's settlement passthrough
✓ contradictory.json — validates; contains at least two committed, settled statements that genuinely contradict (content-level, plantable for review to find); no reconciliation_need rows are seeded — needs are agent-authored, the seed only plants the conditions
✓ launch smoke per variant (as Card 2)
✓ TESTING_PLAN.md scenario-2 review row flips ◔ → ✓
```

### Verification Approach

```
- Inner: validate-fixture per variant
- Middle: rpc graph.overview / settlement projection asserts the advisory mix is visible as advisory (I52-L reader honesty)
- Outer: review routing probe + scenario 4 settlement-visibility beat (doctor thread)
```

### Cross-cutting obligations

- I52-L: advisory rows must surface as advisory through projection/context in the live session — if they don't, that is a product finding for the ledger, not a fixture bug to paper over.
- Convergence note for `reconciliation-derivation`: keep the contradiction *edge-free* between the conflicting nodes (semantic_conflict targets node pairs without a connecting edge).

### Assumption dependency

Depends on: Card 1 landing (mechanism, not findings — scope here does not shift based on Card 1's implementation).

### Expected touched paths (tentative)

```
.fixtures/seeds/workspace-alpha-grounding/
├── advisory-pending.json   +
└── contradictory.json      +
TESTING_PLAN.md             ~  (matrix cell)
```
