# DX introspection live — preflight hardening

Frontier: dx-introspection-live | n/a
Status:   active
Mode:     chain
Created:  2026-06-09

## Orientation

- **Containing seam:** `dx-introspection-live` over `src/dev/`, `.fixtures/`, and the dev-gated introspection extension. This is preliminary hardening before conversational/live TUI work, not a new frontier.
- **Frontier:** `dx-introspection-live` (PLAN §Frontier Definitions), building on completed `dx-feedback-loops` / FE-825.
- **Posture:** proving (inherited from `dx-introspection-live`) — the work is dev-substrate, and each slice should prove the substrate is portable, gated, and buildable through real entrypoints.
- **Main open risk:** treating dev convenience as product behavior. Keep every affordance behind explicit dev gates and keep scratch output separate from curated probe evidence.

Frontier-level cross-cutting obligations this slice carries:

- Preserve D39-L sealing: dev instrumentation observes only and never becomes ambient product behavior.
- Preserve D67-L: default runtime/types resolve installed `dist`; pi source aliasing is opt-in and runtime-gated.
- Preserve D68-L/D70-L: dev loops are iteration loops; durable evidence is curated under `.fixtures/runs/`, while exploratory dev output belongs under `.fixtures/scratch/`.
- Preserve I42-L: dev-only substrate must not affect product/prod behavior or leak global environment changes.

---

## Card 1 — Make the `PI_SOURCE` alias portable and exact · status: next

### Objective

The dev-only `PI_SOURCE` alias has no user-local default baked into code/docs and resolves package roots separately from package subpaths.

### Cold-start reads

- `memory/SPEC.md` — D67-L; A25-L; I42-L
- `memory/PLAN.md` — frontiers: `dx-feedback-loops`, `dx-introspection-live`
- `src/dev/README.md` — dev-loop front door and source-alias behavior

### Acceptance Criteria

```txt
✓ `DEFAULT_PI_SOURCE_ROOT` is derived portably (for example from `os.homedir()` or a repo-relative convention) and remains overrideable by `PI_SOURCE_ROOT`; no `/Users/lunelson/...` default remains in code or docs.
✓ Root package aliases are exact matches, and subpath imports such as `@earendil-works/pi-ai/oauth`, `@earendil-works/pi-coding-agent/hooks`, and generic package subpaths resolve to their intended source files.
✓ Tests cover root and subpath alias behavior, including that the alias stays inert unless `PI_SOURCE=1` and the checkout exists.
✓ Docs state the vite/vitest-only alias boundary accurately; do not claim `tsx` uses the alias unless this slice actually implements a tsx dev tsconfig path.
```

### Verification Approach

- Inner: `src/dev/pi-source-alias.test.ts` with root/subpath cases.
- Inner: `npm run check` for type/lint/format drift in touched files.

### Cross-cutting obligations

- Do not add unconditional `tsconfig.json` paths; D67-L explicitly keeps editor/default type resolution on installed packages.
- Do not require a personal checkout path for ordinary contributors.

### Assumption dependency

Depends on: A25-L — already partially validated by FE-825; this slice hardens the dev alias without changing product behavior.

### Expected touched paths (tentative)

```txt
src/dev/
├── pi-source-alias.ts       ~
├── pi-source-alias.test.ts  ~
└── README.md                ~
memory/PLAN.md               ?
```

---

## Card 2 — Keep structured-exchange proof buildable outside `src/dev` · status: next

### Objective

`structured-exchange-ordering-proof` remains runnable from built/package contexts without importing build-excluded `src/dev/**` files from its generated extension.

### Cold-start reads

- `memory/SPEC.md` — D68-L; I42-L
- `memory/PLAN.md` — frontiers: `dx-feedback-loops`, `dx-introspection-live`
- `src/dev/README.md` — dev harness ownership boundary
- `src/probes/README.md` or nearest probe docs if present — probe-vs-dev-loop distinction (omit if absent)

### Acceptance Criteria

```txt
✓ The generated ordering-proof extension no longer imports `src/dev/faux-harness.ts` by absolute source path.
✓ The fix preserves the D68-L distinction: product-verification probes do not depend on build-excluded dev-only modules at runtime.
✓ A focused test or source assertion fails if a probe-generated extension imports `src/dev/**` again.
✓ The probe keeps using the same faux model/provider behavior; no real provider, network, key, or token is introduced.
```

### Verification Approach

- Inner: focused vitest/source assertion around `structured-exchange-ordering-proof` generated extension content.
- Inner: `npm run build` or the relevant probe test if available, because the failure mode is dist/package buildability.

### Cross-cutting obligations

- If shared faux wiring must move, move only the minimum build-included helper that probes need; do not turn `src/dev` into product build surface.
- Preserve `tsconfig.build.json` exclusion of `src/dev/**`.

### Assumption dependency

Depends on: A25-L only indirectly through the pi faux-provider substrate; no new unvalidated assumption.

### Expected touched paths (tentative)

```txt
src/probes/structured-exchange-ordering-proof.ts  ~
src/probes/*ordering*.test.ts                     ?
src/dev/faux-harness.ts                           ?
src/dev/README.md                                 ?
tsconfig.build.json                               ? (only to assert exclusion, not to remove it)
```

---

## Card 3 — Route introspection artifacts to scratch, not cwd-local runs · status: next

### Objective

`runBrunchIntrospectionTurn` writes exploratory introspection artifacts under repo-root `.fixtures/scratch/introspection/<run-id>/`, independent of the workspace cwd it targets.

### Cold-start reads

- `memory/SPEC.md` — D69-L; D70-L; D71-L; I38-L; I42-L
- `memory/PLAN.md` — frontier: `dx-introspection-live`
- `.fixtures/README.md` — four-role fixture topology if present; otherwise this card may create/update it only for scratch semantics
- `src/dev/README.md` — introspection-loop artifact contract
- `src/.pi/extensions/introspection/README.md` — introspection extension contract

### Acceptance Criteria

```txt
✓ `.fixtures/scratch/` is gitignored and documented as ephemeral dev-loop output; `.fixtures/runs/` remains curated/promoted evidence only.
✓ `runBrunchIntrospectionTurn` (or a narrow artifact-path helper it calls) resolves artifact output to repo-root `.fixtures/scratch/introspection/<run-id>/`, not `join(cwd, '.fixtures', 'runs', ...)`.
✓ A test launches/constructs the launcher with a workbench-like cwd and proves no `<workbench>/.fixtures/...` path is produced.
✓ SPEC/PLAN/dev README wording is reconciled so D69-L/D70-L/PLAN agree on scratch vs runs and on the current `tsx` alias boundary.
```

### Verification Approach

- Inner: `src/dev/introspection-launcher.test.ts` path-resolution assertion.
- Inner: `.gitignore` / docs source assertion if an existing fixture-topology test exists; otherwise focused review plus `npm run check`.

### Cross-cutting obligations

- Do not promote scratch output into tracked `.fixtures/runs/` automatically.
- Do not implement the whole live TUI wiring or conversational self-report surface in this preflight card.
- Do not use naked global environment mutation for any offline/default lift.

### Assumption dependency

Depends on: A26-L only as future context; this card does not attempt conversational self-report and should not claim to validate A26-L.

### Expected touched paths (tentative)

```txt
.fixtures/
├── README.md          ~
└── scratch/           + (gitignored directory path only, no tracked run artifacts)
.gitignore             ~
src/dev/
├── introspection-launcher.ts       ~
├── introspection-launcher.test.ts  ~
└── README.md                       ~
src/.pi/extensions/introspection/README.md ?
memory/SPEC.md        ?
memory/PLAN.md        ?
```
