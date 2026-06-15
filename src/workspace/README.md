# workspace/

SPEC decisions: D52-L

## Owns

Cwd/package/workspace identity helpers and their tests.

Current state:

- `project-identity.ts` discovers the cwd project name/slug from shallow manifest files (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`) with directory basename fallback.
- `workspace-state-store.ts` reads/writes `.brunch/workspace.json`: project identity, posture fields, and the selected default `{specId, sessionId}`. It does not open graph stores or Pi sessions.
- `cwd-inventory.ts` inspects pure cwd facts for context tools: top-level entries, markdown files, and `.brunch/sessions/*.jsonl` file sizes without classifying Brunch session bindings.
- `package-identity.test.ts` protects package-level CLI identity (`brunch`, version floor, executable bin shim).

## Does not own

- Spec/session activation, Pi session creation/opening, and binding lifecycle — `session/`.
- Product host mode dispatch — `app/`.
- Graph truth or persistence.

## Dependency direction

`workspace/` provides cwd/package identity facts to `session/`, `app/`, `projections/`, `rpc/`, and `.pi` as needed. It must not depend on adapters, web code, product entrypoints, Pi, graph mutation surfaces, or session transcript mechanics.
