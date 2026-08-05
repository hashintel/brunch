# Probe topology

`src/probes/**` owns development-time product-verification probes and their focused test helpers. It is distinct from `src/dev/**`, which owns launchers, harnesses, comparison controllers, and curation workflows (SPEC D68-L; see also I30-L and A40-L).

## Boundaries

- Top-level TypeScript modules are buildable probe operations, reports, RPC clients, deterministic witnesses, or shared probe-only fixtures. CLI-capable modules guard their own process entry.
- `scripts/run-ship-gate-composition.sh` and `scripts/verify-startup-no-resume.sh` are the shell entry points for the built composition proof and real-PTY startup oracle.
- Tests under `__tests__/` may import probe helpers directly. `src/dev/**` may compose probes; product runtime code must not depend on this directory.
- Probes may import public product seams to measure them. They do not own product state, graph authority, or runtime contracts.

## Build and package

`tsconfig.build.json` emits top-level modules to `dist/probes/**` because local scripts and controlled test lanes execute those paths. The npm package excludes `dist/probes/**`; probes are local verification infrastructure, not a published Brunch API.

## Dependency direction

```text
scripts / tests / src/dev
  -> src/probes
  -> public product seams
```

A probe can report or falsify behavior; it cannot become the authority that makes the behavior true.
