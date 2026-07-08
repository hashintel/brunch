# Theme demo expansion — text variations, border levels, border-semantics witness

Frontier: main-editor-chrome
Status:   active
Mode:     single
Created:  2026-07-08

Orientation:

- Containing seam: the `dev:components` preview harness (`src/dev/component-preview/`), specifically the theme testbed and gallery.
- Frontier: `main-editor-chrome` (FE-1169) thread 6's demo half. Sequenced **last** in the frontier: it witnesses the border-semantics roles the mode-reactive-chrome and commands-and-menus files create (mode-reactive + surface-identity channels).
- Main open risk: none structural — this is a dev-tooling witness surface; the risk is scope creep into restyling components (fenced out: demo only).

Posture: earned (downgraded from the frontier's proving — this card closes and witnesses roles other cards created; nothing unknown).

## Card (light) — gallery demos text variations, border levels, and both border-semantics channels

### Objective

`npm run dev:components` gains a theme-demo section showing text style variations, border levels, and every named border-semantics role (mode-reactive roles per operational mode; surface-identity roles per surface) in both light and dark themes, so a theme edit is visually verifiable in one pass.

### Light-card cold-start reads

```
- memory/SPEC.md   — None binding (dev tooling); D35-L for role vocabulary naming
- memory/PLAN.md    — frontier: main-editor-chrome, thread 6
- src/dev/component-preview/{theme-testbed,static-preview,registry}.ts — existing lanes and testbed
- src/.pi/themes/brunch-light.json + brunch-dark.json — the roles to enumerate
```

### Acceptance Criteria

```
✓ theme.test.ts (dev/component-preview) — the demo enumerates border-semantics roles from the theme
  files programmatically (a role added to the theme appears in the demo without a demo edit; a role
  used by a component but missing from the theme fails the existing role-coverage test)
✓ static-preview / gallery — new entries render text variations (emphasis, dim, accent, markdown
  body sample) and border levels side by side; snapshot per theme
✓ manual check — npm run dev:components walks the demo in light + dark (theme toggle)
```

### Verification Approach

```
- Inner: preview registry/theme tests + snapshots
- Outer: manual gallery walk, both themes (closes the frontier's demo obligation)
```

### Cross-cutting obligations

```
- Demo-only fence: no component restyling in this card; gaps found here become findings for the
  frontier walkthrough notes, not drive-by fixes
- Enumerate roles from theme data, not a hardcoded list (the develop-mode third role must appear
  for free when it lands)
```

### Assumption dependency

None — sequenced after the role-creating cards land (mechanical ordering, not epistemic).

### Expected touched paths (tentative)

```
src/dev/component-preview/
├── theme-testbed.ts                          ~
├── static-preview.ts                         ~
├── registry.ts                               ~
└── __tests__/theme.test.ts                   ~
```
