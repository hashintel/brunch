---
name: analyze
description: Read and analyze the selected spec and workspace context needed for the next elicitor move. Use when the agent needs orientation, relevant graph facts, or session/workspace state before asking, ingesting, mapping, or reviewing.
---

# analyze

Use this skill when you need to understand the current selected-spec situation before acting.

## Use It For

- Orienting to the selected spec, workspace, and recent session state
- Pulling only the context that could change the next question or action
- Summarizing what matters right now without dragging in the whole workspace

## Do Not Use It For

- Re-reading large amounts of context that will not affect the next move
- Treating ambient filesystem presence as product context authority
- Expanding scope from the selected spec to the entire workspace without need

## Working Style

1. Start from the selected spec and pushed context already in view.
2. Pull more only when it changes the next decision.
3. Prefer compact orientation first, then targeted detail.
4. Preserve the difference between observed graph truth and your interpretation of it.

## Notes

- This skill describes context-reading conduct only.
- Actual context rendering and source-of-truth projections remain owned by `src/agents/contexts/` and related code paths.
