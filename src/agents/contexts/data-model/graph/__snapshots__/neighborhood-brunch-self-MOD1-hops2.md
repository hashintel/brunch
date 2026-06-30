anchor node
- MOD1: CommandExecutor — the graph mutation authority

upstream nodes (1) — review anchor if these change
- implements REQ1: All durable graph mutations route through one CommandExecutor authority

downstream nodes (1) — reconcile these if anchor changes
- required by API1: Public Brunch JSON-RPC session.* methods {hard}

+4 more relations among neighbors: T1, REQ2, INV1, CH1