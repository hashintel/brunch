# `.fixtures/seeds/fable/`

A spec graph hand-derived from the **fable** project
(`/Users/lunelson/Code/lunelson/fable`), a Vite-native component workbench
(React-first) positioned as a thin successor to Ladle on Vite 8.

Faithful vs. projected:

- **intent** plane — substantially **faithful** to `memory/SPEC.md`: the
  delegate-to-Vite and contact-surface theses, the lexicon terms (Ladle
  watermark, normalized story graph, false-thinness, no-React invariant), the
  config-composition / architecture-split / URL-backed-shell requirements, the
  Vite-8-only and no-merge constraints, the Shape D / window-event / config
  composition decisions, and the acceptance criteria are all drawn from real
  prose.
- **oracle** plane — **faithful**: nodes map to the actual probe harness in
  `tools/verify.ts` (no-React and boundary seed-checks, manifest-no-story-import
  guard, Playwright probes, the mount-id marker oracle, the six probe tiers) and
  the recorded spike / slice-5c evidence.
- **design** plane — **faithful**: the five spec modules (Workbench Core, Vite
  Host Binding, React Adapter, controls + source-view capabilities) and the two
  interfaces (Framework Adapter Contract, window-event protocol).
- **plan** plane — **faithful** to `memory/ROADMAP.md`: milestones, frontiers,
  and slices map to the real done/pending roadmap slices (config spike, walking
  skeleton, manifest parity, preview mode, source view, watermark audit).

The source carries a committed SPEC plus
an ordered ROADMAP of done and pending slices.

Coverage (a by-product of being faithful, not the goal):

- every node kind across all four planes (intent / oracle / design / plan)
- every edge category (dependency, proof, support, realization, boundary,
  composition, association, supersession), including both proof/support stances
- one supersession lineage: manifest-backed controls defaults (slice 4a)
  supersede the earlier client-side `mod.args` reading (slice 3b)

Contents:

- `spec-graph.json` — 67 nodes / 37 edges (66 / 36 in active context after the
  superseded predecessor is hidden).

Validate with:

```
npx tsx src/graph/validate-fixture.ts fable/spec-graph
```
