# introspection extension

Owns the dev-only D69-L agent-input introspection tap.

- **Owns:** read-only `before_provider_request` capture of the final provider payload, `tool_result` mirroring for explicit Brunch-owned text results, and the dev `/introspect` command that reports base `getSystemPromptOptions()` inputs plus the latest passive capture.
- **Input:** Pi extension events from the explicit Brunch extension bundle.
- **Output:** in-memory capture records consumed by `src/dev/introspection-launcher.ts` and written under repo-root `.fixtures/scratch/introspection/<run-id>/`; under `BRUNCH_DEV` real TUI launches, the latest captured final system prompt is also mirrored to `.brunch/debug/system-prompt.md`, explicit Brunch-owned text tool results append to `.brunch/debug/tool-contents.md`, and Brunch continuity entries (seed, `worldUpdate`, drains, staleness hints) append to `.brunch/debug/entry-contents.md` via `appendEntryContentToDebugCache` hooked at the **append seam** — so seeded-but-unkicked sessions are observable with zero provider calls (the gap that masked the origination-kick defect).
- **Used by:** developer feedback loops only. Product Brunch sessions omit this extension unless `createBrunchPiExtensions(..., { introspection: { enabled: true } })` is passed explicitly.

The extension observes only: hook handlers return `undefined` and never replace provider payloads, system prompts, or tool results. It must be registered last in `brunch-pi-extensions.ts` when enabled so the passive tap sees the post-mutation provider payload. The `.brunch/debug/` mirror is a dev cache of captured bytes, not scratch evidence and not a prompt or TUI-render reconstruction path.
