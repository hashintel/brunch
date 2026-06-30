anchor node
- REQ1: All durable graph mutations route through one CommandExecutor authority

upstream nodes (2) — review anchor if these change
- depends on T1: Spec
- expresses INV1: One spec-local LSN per commit; exactly one graph_clock row per spec

downstream nodes (2) — reconcile these if anchor changes
- implemented by MOD1: CommandExecutor — the graph mutation authority
- witnessed by CH1: Architectural boundary test: no db/ imports outside graph/