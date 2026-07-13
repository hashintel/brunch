# `.pi/components` — Reusable Pi TUI components

SPEC decisions: D52-L (sealed Pi-harness runtime surface), D123-L (Pi-native model/auth surface), D118-L (provider-facing tool-schema adapter).

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
├── alternatives.ts              standalone card-set renderer/tool; app composition injects the required
│                                D118-L tool-parameter adapter so the component never imports extensions
├── brunch-editor.ts             bordered `CustomEditor` wrapper for Brunch's persistent input editor;
│                                caller-injected labels/color keep runtime/session state out of the component
├── brunch-identity.ts
├── brunch-version.ts
├── cards.ts
├── choice-row.ts              shared described-option row projection and rendered-row accumulator for picker/menu affordances
├── chrome-header.ts
├── chrome-shortcuts.ts        shared shortcut constants/hint formatting consumed by chrome copy
│                                and the command registrar that binds those keys
├── consult-menu.ts            bordered session-orientation consult menu using the shared two-line
│                                choice-row projection, visible scroll thumb, role/spec top/bottom label
│                                channel, and `borderAccent` surface-identity border role
├── editor-lines.ts            shared pi-tui Editor border/rule stripping helpers for boxed
│                                editor surfaces
├── exchange-answer-editor.ts   bordered free-text exchange answer editor hosting pi-tui Editor
├── exchange-candidates-result.ts details-backed `present_candidates` transcript
│                                renderer; presents recognition proposals as
│                                rounded cards while model-facing content stays
│                                owned by agents/contexts/exchanges
├── exchange-decision-picker.ts bordered single-decision exchange response picker
├── exchange-review-set-result.ts details-backed `present_review_set` transcript
│                                renderer; presents proposed node/edge drafts and
│                                proposed graph codes as non-committal proposal cards
├── exchange-markdown-body.ts   shared structured-exchange markdown body projection/theme used by
│                                bordered answering components and transcript renderers
├── lateral-padding.ts          transparent horizontal padding wrapper
├── mode-border-theme.ts        Brunch-owned operational-mode border color roles shared by chrome
│                                and ask surfaces
├── multi-choice-picker.ts      bordered checkbox-style exchange response picker; supports
│                                restored checked state when an owning flow re-presents it
├── mouse-wheel.ts              parseWheelEvent() — SGR wheel-event decoder used by the dev
│                                preview harness; components still receive ordinary key bytes
├── rounded-box.ts              projectRoundedBox() + stackSections() — pure rounded-border primitive
│                                shared by bordered presentation components; the box module owns all
│                                spacing (padding inside the border, blank-line gaps between content
│                                sections) — content components supply lines only, never margin rows
├── scroll-viewport.ts          projectScrollViewport() — pure scroll-window + thumb-row primitive,
│                                consumed by bordered components that fold thumbs into the right edge
├── runtime-posture/             private sub-tree for runtime posture pickers
│   └── axis-picker.ts           public picker component (operational-mode picker)
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

`workspace-dialog/` is the cleanest example: `workspace-dialog.ts` at the root is the stable public entry; the folder holds private implementation. It owns only spec/session selection and renders no auth warning; provider onboarding belongs to Pi's native `/login` surface. `runtime-posture/` and `tui-lab/` follow the same private-folder spirit today; consumers import from the folder's public file (`runtime-posture/axis-picker.js`, `tui-lab/index.js`).

## Dependency rules

```pseudo
rules:
  .pi/components/  ->  .pi/components/*          [shared primitives within the seam]
  .pi/components/  ->  pi-tui Markdown            [render-only markdown projection for exchange bodies]
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

**Key matching convention:** `handleInput` implementations must match keys through pi-tui's `matchesKey`/`Key`, never raw byte comparison (`data === '\x1b[B'`, `data === '\x14'`). `ProcessTerminal` negotiates the kitty keyboard protocol where the terminal supports it (Ghostty, kitty, …), and keys then arrive as CSI-u sequences (e.g. `\x1b[1;1:1B` for a down-arrow press) that raw equality misses — the component freezes in exactly those terminals. Direct tests should include at least one kitty-encoding case per navigation family (see the "Ghostty regression" tests).

## Deferred patterns (non-goals for now)

These workbench patterns are intentionally out of scope until their tripwire fires:

- **Popper-style placement math** — `anchor: 'center'` is sufficient today. Port/adapt only when the first non-centered or trigger-relative overlay appears.
- **Anchor/geometry marker protocol** — invisible ANSI measurement markers for aligned overlays. Add only when centered/fixed positioning cannot serve ≥2 real use cases.
- **Workbench app/playground shell** — built as `src/dev/component-preview.ts` (`npm run dev:components`), not under this directory: it is dev tooling, not a Pi-native presentation component, so it lives with Brunch's other dev feedback loops (`src/dev/TOPOLOGY.md`). It reuses this directory's injectable-terminal entry points (`preflight.ts`) and mirrors each component's real `ctx.ui.custom` presentation contract rather than assuming a uniform overlay.
- **Ad-hoc SGR style helpers** — brunch uses the real `LabTheme` from `tui-lab/`; do not introduce one-off escape-sequence helpers.
