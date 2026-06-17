# `.pi/components` — Reusable Pi TUI components

SPEC decision: D52-L (sealed Pi-harness runtime surface).

This directory owns reusable components rendered inside the embedded Pi coding-agent harness: TUI overlays, chrome regions, message helpers, and the shared visual primitives (theme/badge/segment-track) they build on. These are **Pi-native presentation pieces**, not generic React components and not product wiring.

## Owns

- Pi TUI components consumed by `.pi/extensions/` (e.g. workspace dialogs, runtime axis pickers, chrome header).
- Shared visual primitives for those components: the `LabTheme`/`makeSolidBadge`/`renderSegmentTrack` substrate under `tui-lab/`.
- A test harness for driving components through a real pi-tui `TUI` end-to-end: `../__tests__/support/virtual-terminal.ts`.

## Does NOT own

- Product wiring, session/runtime state, or graph mutation logic — those live in `session/`, `graph/`, and `.pi/extensions/`.
- React/web UI — `web/`.
- Generic project/render projections — `projections/` and `renderers/`.
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
├── runtime-posture/             private sub-tree for runtime posture pickers
│   ├── axis-picker.ts           public picker components
│   └── strategy-picker.ts
├── tui-lab/                     shared visual primitives
│   ├── index.ts                 public seam for theme + segment-track helpers
│   ├── segment-track.ts
│   └── style-palette.ts
├── workspace-dialog.ts          public entry re-exporting the folder below
└── workspace-dialog/            fractal sub-tree for the workspace/session picker
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
  .pi/extensions/  ->  .pi/components/*          [extensions consume components]
  .pi/components/  x>  .pi/extensions/           [components stay presentation-only]
  .pi/components/  x>  graph/, session/, rpc/     [no domain wiring]
```

## Build/test convention

Components are tested at two tiers:

1. **Direct-render tests** (`runtime-axis-picker.test.ts`) — cheap, precise assertions against `component.render(width)` and `component.handleInput()`. Use these for render logic, color/badge output, disabled/caution behavior, and direct method contracts.
2. **Harness integration tests** (`runtime-axis-picker.harness.test.ts`) — drive the component through a real `TUI(VirtualTerminal)` overlay. Use these for focus, real input routing, and overlay render paths that the direct test cannot reach.

The harness lives at `../__tests__/support/virtual-terminal.ts`. It is test-only infrastructure: production code must never import it, and it must never import production wiring.

Keep the two tiers **complementary**, not redundant: a direct test is the default; add a harness test only when the behavior requires the real TUI input/overlay path.

## Deferred patterns (non-goals for now)

These workbench patterns are intentionally out of scope until their tripwire fires:

- **Popper-style placement math** — `anchor: 'center'` is sufficient today. Port/adapt only when the first non-centered or trigger-relative overlay appears.
- **Anchor/geometry marker protocol** — invisible ANSI measurement markers for aligned overlays. Add only when centered/fixed positioning cannot serve ≥2 real use cases.
- **Workbench app/playground shell** — a standalone component playground. Build only if an explicit decision creates a separate Brunch TUI component playground; brunch already has injectable-terminal entry points (`preflight.ts`) and the test harness.
- **Ad-hoc SGR style helpers** — brunch uses the real `LabTheme` from `tui-lab/`; do not introduce one-off escape-sequence helpers.
