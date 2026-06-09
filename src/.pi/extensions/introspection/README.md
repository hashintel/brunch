# introspection extension

Owns the dev-only D69-L agent-input introspection tap.

- **Owns:** read-only `before_provider_request` capture of the final provider payload and the dev `/introspect` command that reports base `getSystemPromptOptions()` inputs plus the latest passive capture.
- **Input:** Pi extension events from the explicit Brunch extension bundle.
- **Output:** in-memory capture records consumed by `src/dev/introspection-launcher.ts` and written under repo-root `.fixtures/scratch/introspection/<run-id>/`.
- **Used by:** developer feedback loops only. Product Brunch sessions omit this extension unless `createBrunchPiExtensions(..., { introspection: { enabled: true } })` is passed explicitly.

The extension observes only: hook handlers return `undefined` and never replace provider payloads or system prompts. It must be registered last in `brunch-pi-extensions.ts` when enabled so the passive tap sees the post-mutation provider payload.
