# Model recommendations

Brunch exposes Pi's native `/model` and `/login` surfaces without restricting providers, models, or thinking levels. The sealed profile supplies `anthropic` / `claude-sonnet-4-6` as a soft default; users can select any model supported by the embedded Pi harness.

## Latency evidence

The 2026-07-07 alpha walkthrough found that model size and thinking level materially affect interactive latency. With the recommended Claude Sonnet 4.6 default at `thinking: low`, the opening kick took approximately 11–14.5 seconds and a question turn approximately 13 seconds.

Use lower thinking levels for responsive walkthroughs. Increase thinking only when the task benefits enough to justify the added latency. These are recommendations rather than policy: Pi's full native thinking-level range remains available.
