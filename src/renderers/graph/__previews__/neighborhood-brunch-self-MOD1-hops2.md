[Selected-spec node context]
- anchor: [MOD1] design/module: CommandExecutor — the graph mutation authority
- upstream (review anchor if these change):
  - implements [REQ1] intent/requirement: All durable graph mutations route through one CommandExecutor authority
- downstream (reconcile if anchor changes):
  - required by [API1] design/interface: Public Brunch JSON-RPC session.* methods {hard}
- (+4 edge(s) among neighbors, not incident on anchor)
