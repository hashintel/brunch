# `.pi/components` — Reusable Pi TUI components

SPEC decision: D52-L (sealed Pi-harness runtime surface).

This directory owns reusable components rendered inside the embedded Pi coding-agent harness: TUI overlays, chrome regions, message helpers, and the shared visual primitives (theme/badge/segment-track) they build on. These are **Pi-native presentation pieces**, not generic React components and not product wiring.

## Owns

- Pi TUI components consumed by `.pi/extensions/` (e.g. workspace dialogs, runtime axis pickers, chrome header).
- Shared visual primitives for those components: the `LabTheme`/`makeSolidBadge`/`renderSegmentTrack` substrate under `tui-lab/`, plus tiny layout wrappers such as `lateral-padding.ts` and focused response pickers such as `multi-choice-picker.ts`.
- Render-only component contracts whose props may use domain/session input types or DTOs needed to present Pi UI.

## Does NOT own

- Product wiring, session/runtime state, or graph mutation logic — those live in `session/`, `graph/`, and `.pi/extensions/`.
- React/web UI — `web/`.
- Generic projections and model-facing renders — `projections/` and `agents/contexts/`; human/product text stays beside its caller.
- A component playground or workbench shell (deferred; see below).

## Layout

Components grow by **fractal sub-tree**: when a component outgrows a single file, keep the original public entry and move private implementation into a same-named folder.

```text
components/
├── alternatives.ts              single-file components
├── brunch-identity.ts
├── brunch-version.ts
├── cards.ts
├── chrome-header.ts
├── lateral-padding.ts          transparent horizontal padding wrapper
├── multi-choice-picker.ts      focused checkbox-style exchange response picker
├── runtime-posture/             private sub-tree for runtime posture pickers
│   ├── axis-picker.ts           public picker components
│   └── strategy-picker.ts
├── tui-lab/                     shared visual primitives
│   ├── index.ts                 public seam for theme + segment-track helpers
│   ├── segment-track.ts
│   ├── style-palette.ts
│   └── style-lab-component.ts   reference-only demo Component (previewable via npm run dev:components -- tui-lab; no production call site)
├── workspace-dialog.ts          public entry re-exporting the folder below
└── workspace-dialog/            fractal sub-tree for the workspace/session picker
    ├── assets/                  logo assets colocated with the dialog
    ├── component.ts
    ├── index.ts
    ├── model.ts
    └── preflight.ts
```

`workspace-dialog/` is the cleanest example: `workspace-dialog.ts` at the root is the stable public entry; the folder holds private implementation. `runtime-posture/` and `tui-lab/` follow the same private-folder spirit today; consumers import from the folder's public file (`runtime-posture/axis-picker.js`, `tui-lab/index.js`).

## Dependency rules

```pseudo
rules:
  .pi/components/  ->  .pi/components/*          [shared primitives within the seam]
  .pi/components/  ->  graph/, session/, projections/ [render input types/DTOs only]
  .pi/extensions/  ->  .pi/components/*          [extensions consume components]
  .pi/components/  x>  .pi/extensions/           [components stay presentation-only]
  .pi/components/  x>  db/, rpc/, app/            [no persistence/RPC/product host wiring]
  .pi/components/  x>  product mutations          [components return decisions; owners execute]
```

## Build/test convention

Components are tested at two tiers:

1. **Direct-render tests** (`runtime-axis-picker.test.ts`) — cheap, precise assertions against `component.render(width)` and `component.handleInput()`. Use these for render logic, color/badge output, disabled/caution behavior, and direct method contracts.
2. **Harness integration tests** (`runtime-axis-picker.harness.test.ts`) — drive the component through a real `TUI(VirtualTerminal)`, presented the same way its real call site presents it (`tui.showOverlay` for overlay components, `tui.addChild` + `tui.setFocus` for inline-swap components like the runtime mode picker — see `component-preview.ts`'s registry for the per-component split). Use these for focus, real input routing, and render paths the direct test cannot reach.

The harness lives at `../__tests__/support/virtual-terminal.ts`. It is test-only infrastructure: production code must never import it, and it must never import production wiring.

Keep the two tiers **complementary**, not redundant: a direct test is the default; add a harness test only when the behavior requires the real TUI input/overlay path.

## Deferred patterns (non-goals for now)

These workbench patterns are intentionally out of scope until their tripwire fires:

- **Popper-style placement math** — `anchor: 'center'` is sufficient today. Port/adapt only when the first non-centered or trigger-relative overlay appears.
- **Anchor/geometry marker protocol** — invisible ANSI measurement markers for aligned overlays. Add only when centered/fixed positioning cannot serve ≥2 real use cases.
- **Workbench app/playground shell** — built as `src/dev/component-preview.ts` (`npm run dev:components`), not under this directory: it is dev tooling, not a Pi-native presentation component, so it lives with Brunch's other dev feedback loops (`src/dev/TOPOLOGY.md`). It reuses this directory's injectable-terminal entry points (`preflight.ts`) and mirrors each component's real `ctx.ui.custom` presentation contract rather than assuming a uniform overlay.
- **Ad-hoc SGR style helpers** — brunch uses the real `LabTheme` from `tui-lab/`; do not introduce one-off escape-sequence helpers.
