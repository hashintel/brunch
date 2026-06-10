# introspect-query

Owns the dev-gated, read-only query tool over Brunch introspection captures.

- **Owns:** `brunch_introspect_query`, which projects values from the latest captured `before_provider_request` payload plus base `getSystemPromptOptions` input.
- **Input:** `BrunchIntrospectionStore` from `../introspection/`; the store is injected by `brunch-pi-extensions.ts` only when dev introspection is enabled.
- **Output:** verbatim projected rows returned as a Pi tool result, with shared projection/truncation behavior from `../shared/query-projection.ts`.
- **Used by:** `createBrunchPiExtensions(..., { introspection: { enabled: true } })`; never loaded in the product default path.

Decisions: D39-L sealed profile, D40-L active-tool policy, D69-L final provider-payload capture, D71-L dev-only introspection wiring. The tool is read-only and dev-gated; it observes the payload plane without shaping prompts or product behavior.
