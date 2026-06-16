[Selected-spec node context]
- anchor: [REQ1] intent/requirement: All durable graph mutations route through one CommandExecutor authority
- upstream (review anchor if these change):
  - depends on [T1] intent/term: Spec
  - expresses [INV1] intent/invariant: One spec-local LSN per commit; exactly one graph_clock row per spec
- downstream (reconcile if anchor changes):
  - implemented by [MOD1] design/module: CommandExecutor — the graph mutation authority {soft}
  - witnessed by [CH1] oracle/check: Architectural boundary test: no db/ imports outside graph/ {soft}