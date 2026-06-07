# scripts/

SPEC decisions: D52-L

## Owns

Local executable utilities and script-facing helpers that are not product domain layers.

Current utilities:

- `render-preview.ts` — writes reviewable renderer previews from seeded fixtures without changing product runtime code.

Print-mode workspace-state projection/rendering moved to `projections/workspace/` and `renderers/workspace/`; `app/` now calls those shared seams directly.

## Does not own

- Durable graph or session semantics.
- Product host lifecycle and mode dispatch — `app/`.
- Reusable DTO projection — `projections/`.
- Reusable text renderers intended for multiple layers — `renderers/`.
## Dependency direction

`scripts/` may import domain/session types needed to produce utility output. Domain layers, adapters, RPC, and web must not import `scripts/`.
