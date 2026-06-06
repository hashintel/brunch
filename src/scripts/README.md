# scripts/

SPEC decisions: D52-L

## Owns

Local executable utilities and script-facing helpers that are not product domain layers.

Current utilities:

- `print-snapshot.ts` — projects a workspace/session state into the CLI print-mode snapshot text.

## Does not own

- Durable graph or session semantics.
- Product host lifecycle and mode dispatch — `app/`.
- Reusable text renderers intended for multiple layers — target `renderers/` when that seam is materialized.

## Dependency direction

`scripts/` may import domain/session types needed to produce utility output. Domain layers must not import `scripts/`.
