# FE-806 runtime-posture proof

Deterministic product-path proof: `src/.pi/__tests__/prompting.test.ts` drives `createBrunchPiExtensionShell()` through `before_agent_start` with transcript-backed `brunch.agent_runtime_state` switches.

Contrasts recorded by the test:

- `step-wise-disambiguate` + `intent` pins the strategy manifest to `step-wise-disambiguate` and renders intent-lens selected-spec graph context.
- `propose-graph` + `design` pins the strategy manifest to `propose-graph` and renders design-lens selected-spec graph context over the same snapshot.

Accepted blind spots:

- Prompt/body quality is fitness evidence, not this deterministic merge gate.
- Graph-write reliability remains with `graph-tool-resilience`.
- Capture quality remains with `capture-response-to-graph`.
