<!-- CARDS.md — prepared scope-card queue for one live frontier item.
     Created by ln-scope · consumed by ln-build · retired when queue exhausted.
     Frontier: petrinaut-colour-fold (FE-784). -->

# Scope cards — FE-784 petrinaut-colour-fold follow-ups

Three independent, order-free light cards inside the settled NetFolding seam
(the fold + NetFolding extraction already landed: commits `51ca9851`,
`51d7e7b3`). All stay on the `ka/fe-784-petrinaut-colour-fold` branch — no new
Linear issue. Build in any order; #3 recommended first.

(Supersedes the exhausted FE-761 four-slice queue previously held here.)

---

## Card #3: assert only dependency gates stay divergent

**Status:** done — added the divergence-bound oracle to petrinaut-fold.test.ts.

### Objective

Pin the fold's divergence set so a future compiler change that accidentally makes a uniform lifecycle transition diverge fails loudly instead of silently re-expanding the folded graph.

### Acceptance Criteria

```
✓ createNetFolding over a 2-slice plan (depPlan via compileTopology): the set of foldedTransitions() whose id still carries a slice-id segment equals exactly the known dependency gates — slice-ready:<sid> and <sid>:return-done — and nothing else
✓ the assertion is expressed so an unexpected divergent role (e.g. evaluate:dispatch splitting per slice) would fail it
```

### Verification Approach

```
- Inner: petrinaut-fold.test.ts (or petrinaut-export.test.ts) unit assertion over createNetFolding(compileTopology(depPlan)) — pure, no production change
```

### Promotion checklist

All no — pure oracle addition inside the settled fold seam. Stays light.

---

## Card #4: SDCPN folded-naming round-trip on a real 2-slice net

**Status:** done — added folded-naming + collapse + schema round-trip oracles to petrinaut-sdcpn.test.ts.

### Objective

Confirm the fold delivered its original motivation — clean SDCPN place names — by asserting `toSdcpnFile(realNet(depPlan))` yields PascalCase names with no collision-counter suffixes and fewer places than the unfolded net would have.

### Acceptance Criteria

```
✓ toSdcpnFile over a real folded 2-slice net produces no disambiguation-suffixed place names (no `…2` collision counters from the name allocator) for the folded slice lifecycle
✓ folded SDCPN place count is materially lower than 2× the single-slice lifecycle (collapse is observable end-to-end), and the file still satisfies the existing sdcpnFileSchema round-trip
```

### Verification Approach

```
- Inner: petrinaut-sdcpn.test.ts assertion over toSdcpnFile(serializeBlueprint(compileTopology(depPlan))) — extends the existing schema round-trip oracle to a folded multi-slice net
```

### Promotion checklist

All no — oracle-coverage addition over settled export. Stays light.

---

## Card #6: align brunch-owned colour/color spelling + lexicon

**Status:** next

### Objective

Use one spelling for brunch-owned fold identifiers instead of mixing British (`SLICE_COLOUR_TYPE`, `'slice-colour'`, `SliceColour`) with the American Petrinaut wire field (`colorId`); recommend matching the wire contract (`color`) and record the durable fold concepts in the SPEC lexicon.

### Acceptance Criteria

```
✓ brunch-owned fold identifiers use a single spelling (recommended: `color` — SLICE_COLOR_TYPE / SLICE_COLOR_TYPE_ID / 'slice-color' / SliceColor); grep finds no mixed colour/color in brunch-owned petrinaut symbols (Petrinaut's own `colorId` wire field is unchanged)
✓ SPEC §Lexicon gains entries for the durable fold concepts (e.g. "color fold", "token color", "folded net") aligned to the chosen spelling
✓ npm run verify green (rename touches petrinaut-fold.ts + its consumers/tests)
```

### Verification Approach

```
- Inner: npm run check (type-check catches missed references) + the four fold test files; grep audit for residual mixed spelling
```

### Promotion checklist

All no — naming reconciliation + lexicon doc edit inside the settled seam. Stays light. (Spelling choice is a minor naming decision, not a seam/architecture decision; confirm `color` vs `colour` with the user at build time if unsure.)
