# Model recommendations

Brunch exposes Pi's native `/model` and `/login` surfaces without restricting providers, models, or thinking levels. The sealed profile supplies `anthropic` / `claude-opus-5` as a soft default; users can select any model supported by the embedded Pi harness.

## Latency evidence

The 2026-07-07 alpha walkthrough found that model size and thinking level materially affect interactive latency. With Claude Sonnet 4.6 at `thinking: low`, the opening kick took approximately 11–14.5 seconds and a question turn approximately 13 seconds. That historical measurement predates the current Claude Opus 5 default.

Use lower thinking levels for responsive walkthroughs. Increase thinking only when the task benefits enough to justify the added latency. These are recommendations rather than policy: Pi's full native thinking-level range remains available.
