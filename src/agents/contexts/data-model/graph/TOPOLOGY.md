# agents/contexts/data-model/graph/ — graph context text

SPEC decisions: D60-L, D62-L, D83-L, D97-L, D99-L, I52-L

Owns reusable model-facing graph text: full selected-spec graph overviews, anchored neighborhoods, related-node reads, mutate-graph command results, and reconciliation-need agenda/update text. `graph-slice.ts` labels advisory items inline (`title (advisory)` for nodes, `relation (advisory)` for edges) so any consumer of the rendered overview sees settlement without a render-shape change; settled items render unlabeled. Callers provide already-read graph/projection inputs; this directory formats them without reading storage or registering tools.
