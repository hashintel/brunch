# agents/contexts/workspace/ — workspace context text

SPEC decisions: D19-L, D60-L, D83-L

Owns the `<workspace>` context render for cwd/project/topology/spec-roster facts. It is agent context, not `workspace.state`; human print-mode workspace state stays in `src/renderers/workspace/workspace-state.ts`.
