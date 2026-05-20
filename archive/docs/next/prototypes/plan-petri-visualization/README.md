# Plan-Graph Petri Visualization Prototype

A disposable-but-trackable Brunch next prototype for pressure-testing `plan-graph` to Petri-net orchestration ideas.

It uses plain HTML, TypeScript, Vite, and the local Cytoscape.js clone at:

```text
~/Clones/cytoscape/cytoscape.js/dist/cytoscape.esm.mjs
```

## Run

```bash
cd docs/next/prototypes/plan-petri-visualization
npm run dev
```

Then open the printed local URL.

## What this tests

The prototype renders one canonical slice-net template with scenario toggles:

1. Happy path
2. Missing oracle
3. Design bypass
4. Stale graph
5. Risk pending

The purpose is to see whether a Petri-net visualization can make this distinction concrete:

```text
mechanical completion produces evidence
semantic completion accepts evidence against graph-derived gates
```

## Current limitations

- Static final markings only; no animation or actual firing sequence yet.
- The Petri interpreter is intentionally tiny: enabled/blocked explanation by input-token presence.
- Semantic guards are represented as transition metadata, not executable predicates.
- The graph is hand-positioned rather than automatically laid out.
