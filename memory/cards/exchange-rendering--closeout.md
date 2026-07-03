# Close out the exchange-rendering frontier

Frontier: exchange-rendering
Status:   done
Mode:     slices
Created:  2026-07-03

Posture: earned (inherited from exchange-rendering). Three closure slices: lock in the request-formatter residuals, lock in the family-completeness test as the executable DoD, then flip the frontier. Sequential — each later slice's scope is already legible and does not depend on findings from earlier slices, only on their artifacts landing.

Build order is fixed: 1 → 2 → 3. Shared write paths (`src/dev/component-preview/`, request-formatter tests, sweep ledger) mean no parallel builds.

---

## Slice 1 — Request-formatter residuals + fixture remediations [done]

### Objective

Give the four request-response discriminants (answer / choice / choices / review) the same per-formatter honesty coverage and preview presence the present formatters already have, and clean up the two review nits from the row builds.

### Light-card cold-start reads

```
- memory/SPEC.md   — D104-L (pass-through + render-honesty contract), D106-L (answered-payload option echo)
- memory/PLAN.md    — frontier: exchange-rendering
- memory/cards/exchange-rendering--sweep.md — §Verification + residual notes on the request rows
- src/agents/contexts/exchanges/render-honesty.ts — missingRenderedDetailsLeaves + elisions/representations API
- src/agents/contexts/exchanges/__tests__/present-candidates.test.ts — the honesty-test pattern to replicate
```

### Work notes

- Formatters live under `src/agents/contexts/exchanges/request-response/` (answer/choice/choices/review), public entry `request-response.ts`. Follow the present-formatter pattern: export a `REQUEST_*_CONTENT_ELISIONS` list (or one shared list on the public entry if the discriminants share structural elisions) and assert `missingRenderedDetailsLeaves(...) === []` per discriminant. Use `representations` for leaves shown as checkboxes/strikethrough rather than verbatim text (D106-L option echo).
- Preview entries: add request-response transcript renders to `src/dev/component-preview/registry.ts` + `exchange-fixtures.ts`. One entry per discriminant family is acceptable if the gallery stays legible (answered choice with write-in + comment, answered choices, answered answer, review, and one terminal state); reuse the existing present fixtures' paired shapes where possible.
- **Remediation (from row-build review):** `structuralIllegalFixture` in `exchange-fixtures.ts` invents a details schema string (`brunch.structured_exchange.diagnostic`). Either derive the fixture's `details` from a real schema in `src/exchanges/schemas/` or drop the fake `details` and mark the fixture content-only — do not leave an unregistered schema tag lying around for grep archaeology.

### Acceptance Criteria

```
✓ request honesty tests — for each discriminant (answer, choice, choices, review), every populated details leaf is rendered, represented, or in a named elision list
✓ preview entries — dev:components gallery renders the request-response discriminants (and one terminal state) from fixtures through the Markdown pass-through
✓ structural-illegal fixture normalized — no invented schema tag remains in exchange-fixtures.ts
✓ existing goldens untouched — content formatters unchanged; snapshot suite green without snapshot updates
```

### Verification Approach

```
- Inner: vitest — new honesty tests + existing tuple goldens stay green
- Outer: preview-gallery spot-check of the new request entries (human)
```

### Cross-cutting obligations

- Dual-audience discipline: this slice adds tests and previews only — persisted `content` must not change; any snapshot diff is a red flag, not a snapshot update.
- Boundary rule: never touch `shared/choice-source.ts` / `choices-editor.ts` collection paths.

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/agents/contexts/exchanges/
├── request-response.ts                          ~   (export elision lists)
├── request-response/                            ~   (elision lists if per-discriminant)
└── __tests__/                                   ~   (request honesty tests; extend existing files or add request-response.test.ts)
src/dev/component-preview/
├── registry.ts                                  ~
└── exchange-fixtures.ts                         ~
```

---

## Slice 2 — Family-completeness registry test (executable DoD) [done]

### Objective

Materialize the sweep's aggregate DoD as one test: every registered structured-exchange tool has a content formatter, a `dev:components` preview entry, and golden-snapshot coverage — so a future exchange kind fails the test instead of silently extending the ledger.

### Light-card cold-start reads

```
- memory/SPEC.md   — D104-L; §Design Notes "Exchange-presentation oracle design"
- memory/PLAN.md    — frontier: exchange-rendering (Aggregate DoD bullet)
- memory/cards/exchange-rendering--sweep.md — §Sweep preflight item 5 (closure rationale) + DoD line
- src/.pi/extensions/__tests__/exchanges-extension.test.ts — registerTools() walk pattern (renderCall uniformity test)
```

### Work notes

- The registration walk already exists (`registerTools()` in `exchanges-extension.test.ts` enumerates the four tools and locks the list). The family test extends that spine: for each registered tool, assert (a) a formatter mapping exists, (b) a preview-registry entry references it, (c) a snapshot file under `src/agents/contexts/exchanges/__snapshots__/` covers it. `request_response` is one registered tool serving four discriminants — the test should require coverage per discriminant, not just per tool, or the DoD is weaker than the ledger it replaces.
- Suggested home: `src/.pi/extensions/__tests__/exchange-family-completeness.test.ts` (it crosses registration → formatter → preview → snapshot, and the registration side is the anchor). A static mapping table inside the test (tool/discriminant → formatter fn, preview id, snapshot path) is acceptable and keeps failures legible; the point is that adding a tool without extending the table fails the registered-list assertion.
- **Remediation (from row-build review):** the narrow `src/dev/component-preview/__tests__/registry.test.ts` (asserts only the present-candidates entry) is subsumed by this test — retire it, or repurpose the file as the preview-side half of the family test. Do not leave both a one-entry check and a family check asserting overlapping facts.

### Acceptance Criteria

```
✓ family-completeness test green — every registered exchange tool (and each request_response discriminant) maps to formatter + preview entry + snapshot coverage
✓ negative power demonstrated — removing any mapping row (tool from the expected list, preview id, or snapshot path) fails the test (verify locally during red/green; no committed artifact required)
✓ registry.test.ts subsumed — one-entry preview assertion retired or absorbed; no duplicate overlapping checks remain
```

### Verification Approach

```
- Inner: vitest — the family test itself, plus the full exchange suite staying green
- Middle: this test IS the middle layer going forward (executable aggregate DoD per sweep §Verification)
```

### Cross-cutting obligations

- The test must read registration truth from `registerTools()` (code-owned), not from a hand-copied tool list that can drift.

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/.pi/extensions/__tests__/
└── exchange-family-completeness.test.ts         +
src/dev/component-preview/__tests__/registry.test.ts  -   (or ~ if absorbed rather than retired)
```

---

## Slice 3 — Frontier tie-off [done]

### Objective

Flip the exchange-rendering frontier to done: gate green, ledger and PLAN reconciled, consumed scope files retired, and the remaining human outer oracle named for the user.

### Light-card cold-start reads

```
- memory/PLAN.md    — frontier: exchange-rendering (Aggregate DoD + Topology reconciliation bullets)
- memory/cards/exchange-rendering--sweep.md — DoD line
- docs/praxis/manual-testing.md — before naming the walkthrough re-observation step
```

### Work notes

- Run `npm run verify` (full gate). Boundary guards (`src/exchanges/schemas/__tests__/source-boundary.test.ts`, `src/projections/__tests__/topology-boundaries.test.ts`) must be green — they should be already; this is confirmation, not new work.
- Topology reconciliation was done in the 2026-07-03 D108-L sync; re-check only the four TOPOLOGY files named in the DoD line for drift introduced by slices 1–2 (new test files, preview entries).
- Ledger: mark the sweep file `Status: done`; flip the PLAN frontier item out of Active per PLAN's own conventions (move to Recently completed; arc `exchange-presentation` stays open — `exchange-answering-chrome` is untouched). This scope file and the sweep ledger are then exhausted: deletion of consumed cards follows the established convention, but **confirm with the user before deleting**, per the file-safety rule.
- **Out of agent scope, must be named in the handoff:** walkthrough re-observation (TESTING_PLAN scenarios 3/5) and preview-gallery aesthetic review are human outer oracles. The frontier's code DoD can close without them, but the PLAN completion note must record whether they happened or remain owed.

### Acceptance Criteria

```
✓ npm run verify green — fix, full test suite, build all pass
✓ sweep DoD line satisfied — every ● row built, family test green, boundary guards green, TOPOLOGY files reconciled
✓ PLAN + ledger flipped — frontier moved out of Active with a completion note naming the outstanding human oracles (if any)
✓ consumed scope files dispositioned — sweep ledger + this file marked done; deletion only with user confirmation
```

### Verification Approach

```
- Inner: npm run verify (the gate)
- Outer: walkthrough re-observation + gallery review — human-owned, recorded in the PLAN completion note
```

### Cross-cutting obligations

- Commit discipline: this slice ends in a commit of all open state (the row-build output currently sitting uncommitted plus slices 1–3).

### Assumption dependency

None.

### Expected touched paths (tentative)

```
memory/PLAN.md                                   ~
memory/cards/exchange-rendering--sweep.md        ~   (Status: done)
memory/cards/exchange-rendering--closeout.md     ~   (Status: done)
src/**/TOPOLOGY.md                               ?   (only if slices 1–2 introduced drift)
```
