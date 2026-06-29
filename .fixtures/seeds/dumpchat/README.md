# `.fixtures/seeds/dumpchat/`

A spec graph hand-derived from the **dumpchat** project
(`/Users/lunelson/Code/lunelson/dumpchat`), a WXT browser extension that exports
ChatGPT / Claude / Perplexity conversations to Markdown via each platform's
native per-turn copy buttons.

Faithful vs. projected:

- **intent** plane — substantially **faithful** to `docs/SPEC.md` and `README.md`:
  the copy-button thesis, the four-step extraction flow, index alternation,
  depth filtering, selector-stability constraints, and the Verify Export
  diagnostics requirement are all drawn from real prose.
- **design** plane — **faithful**: nodes map to actual modules
  (`dumpchat.content.ts`, `lib/dumpchat/extraction.ts`, `config.ts`, `sites/*`)
  and the `SiteConfig` type contract.
- **oracle** plane — **mixed**: the `extraction.test.ts` check and the in-page
  Verify Export run / diagnostics JSON are real; the per-platform re-verification
  vv_obligation is **projected**.
- **plan** plane — **substantially projected**: the source has no plan doc, so
  milestone / frontier / slice nodes are plausible projections from the intent,
  marked `source: "projected"`.

The source spec commits firmly to
decisions, invariants, and selector policy, but carries no explicit plan.

Coverage (a by-product of being faithful, not the goal):

- all four planes (intent / oracle / design / plan) and every node kind used in
  the intent plane
- every edge category (dependency, realization, boundary, composition,
  association, supersession, proof, support), including both proof/support
  stances
- one supersession lineage: depth-based separation and the modal-depth filter
  decision supersede the retired `button.closest("pre, code")` check

Contents:

- `base.json` — the canonical faithful Dumpchat graph; 41 nodes / 33 edges
  (40 / 31 in active context after the superseded predecessor is hidden).

Validate with:

```
npx tsx src/graph/validate-fixture.ts dumpchat/base
```
