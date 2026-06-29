# scripts/

SPEC decisions: D52-L

## Owns

Local executable utilities and script-facing helpers that are not product domain layers.

No standing script utilities are currently owned here.
Print-mode workspace-state projection moved to `projections/workspace/`, and its terse human rendering is app-local in `app/print-workspace-state.ts`; `app/` calls those seams directly.

## Does not own

- Durable graph or session semantics.
- Product host lifecycle and mode dispatch — `app/`.
- Reusable DTO projection — `projections/`.
- Model-facing text renderers — `agents/contexts/`; product/session-local human text stays beside its caller.
## Dependency direction

`scripts/` may import domain/session types needed to produce utility output. Domain layers, adapters, RPC, and web must not import `scripts/`.
