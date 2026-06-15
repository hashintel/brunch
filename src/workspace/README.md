# workspace/

SPEC decisions: D52-L

## Owns

Cwd/package/workspace identity helpers and their tests.

Current state:

- `package-identity.test.ts` protects package-level CLI identity (`brunch`, version floor, executable bin shim).
- No reusable workspace identity source module has been extracted yet; add one here only when current code needs it.

## Does not own

- Spec/session selection and binding lifecycle — `session/`.
- Product host mode dispatch — `app/`.
- Graph truth or persistence.

## Dependency direction

`workspace/` may provide cwd/package identity facts to `app/`, `projections/`, `rpc/`, and `.pi` once source helpers exist. It must not depend on adapters, web code, or product entrypoints.
