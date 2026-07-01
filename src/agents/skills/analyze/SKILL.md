---
name: analyze
description: Read and analyze the selected spec and workspace context needed for the next elicitor move. Use when the agent needs orientation, relevant graph facts, or session/workspace state before asking, ingesting, mapping, proposing, or reviewing.
---

# analyze

Use this skill when you need to understand the current selected-spec situation before acting. Analysis is read conduct: it should make the next move better, not become a research project.

## Use It For

- Orienting to the selected spec, workspace, and recent session state.
- Pulling only context that could change the next question, proposal, capture decision, graph write, or review.
- Reading an item-centered graph neighborhood before changing or proposing around that item.
- Summarizing what matters right now without dragging in the whole workspace.

## Do Not Use It For

- Re-reading large amounts of context that will not affect the next move.
- Treating ambient filesystem presence as product context authority.
- Expanding scope from the selected spec to the entire workspace without need.
- Treating rendered summaries, stale prompt context, or external sources as graph truth before capture.

## Working Style

1. Start from pushed selected-spec context already in view: selected spec, current session state, readiness hints, and graph overview.
2. Pull more only when it changes the next decision.
3. Prefer compact orientation first, then targeted detail.
4. When a move centers on an existing node or seam, read the anchor and its edge-local neighborhood before asking, proposing, mapping, or reviewing.
5. Preserve the difference between accepted graph truth, active-context projections, external/source material, and your interpretation.

## Edge-local reading

Prefer neighborhoods over global kind buckets when the task has an anchor.

```pseudo
chain analyze-anchor
  selected-spec overview
  -> resolve anchor code through product reads
  -> read anchor text + edge-local neighborhood
  -> inspect dependencies, dependents, evidence, refinements, lateral context
  -> inspect open scratchpad obligations and reconciliation needs
  -> act with relation-aware references
```

Global kind lists are useful for orientation, coverage scans, or when no anchor exists yet. They are weaker for anchored work because they hide why an item stands and what changes if it moves.

Load `references/neighborhoods.md` when neighborhood shape or relation interpretation matters. Do not infer relation direction from raw storage coordinates; rely on rendered labels, role names, and impact buckets.

## Source discipline

- Use read-only product/context tools where available; avoid direct DB inspection for elicitor reasoning.
- Resolve user-mentioned node codes through the product read path rather than guessing from memory.
- Use `web_fetch` when a specific URL is already in hand; use `web_search` only when current external context or alternate sources would change the next elicitation move.
- If external/source material matters, route it through `ingest` / `map` before treating it as graph truth.

## Notes

- This skill describes context-reading conduct only.
- Actual context rendering and source-of-truth projections remain owned by `src/agents/contexts/` and related code paths.
