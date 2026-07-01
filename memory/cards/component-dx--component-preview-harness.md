# component-dx — component preview harness (first slice)

Plan pointer: `memory/PLAN.md` → Parallel / Low-Conflict → `component-dx` (Linear: FE-1115, branch: `ln/fe-1115-component-preview-dx`).

This card covers the first shipped slice of `component-dx` (the preview harness). Later slices —
refining existing components, building new ones — get their own `component-dx--<slug>.md` cards on the
same branch/issue unless `ln-plan` splits the frontier further.

## Why

`.pi/components` are render-only Pi TUI components with injectable `theme`/props — testable without a
full seeded workbench/session. Today the only way to *see* one rendered is either reading vitest ANSI
assertions or booting the full app against a seeded workbench. Neither is a fast visual/interactive loop
for trying component design variations.

Investigated `pi-tui`/`pi-coding-agent` source first (see session notes) to find the right truth
environment rather than inventing one. Key findings that shape this design:

- pi-tui's own dev scripts (`packages/tui/test/chat-simple.ts`, `key-tester.ts`) are just
  `ProcessTerminal` + `TUI` + `addChild`/`start()` — validates a bare real terminal, no app boot.
- Overlays are a `TUI`-level primitive (`overlayStack`). Any component holding the real `tui` reference
  can call `tui.showOverlay(...)` itself; nesting is free and needs no special-casing.
- Brunch's components do **not** uniformly present as overlays in production. The real entry point,
  `ctx.ui.custom(factory, options)`, defaults `overlay: false` (inline editor-swap). Only
  `workspace/index.ts` opts into `{ overlay: true, overlayOptions: {...} }`. `commands/index.ts`
  (axis-picker) and `exchanges/shared/choices-editor.ts` (multi-choice-picker) call `ctx.ui.custom` with
  **no options** → inline swap, not a centered box.
- **Drift found, not fixed here:** `runtime-posture-axis-picker.harness.test.ts` wraps the picker in
  `tui.showOverlay(picker, { anchor: 'center', ... })` — a presentation mode production doesn't use for
  this component. Leave a note; don't silently reconcile as part of this tooling pass.
- `@earendil-works/pi-coding-agent`'s real `Theme` class + `ThemeColor` type are public exports, but the
  package's `exports` map blocks subpath access to the theme-loading internals (`getThemeByName`,
  `loadTheme`, the live singleton) — so the resolved default theme isn't reachable standalone. The
  right-sized move is constructing `new Theme(fgColors, bgColors, mode)` directly: the real class/method
  behavior, seeded with Brunch's own already-established 256-color palette (the same codes already
  asserted in `.pi/__tests__/support/tui-theme.ts`), not pi's exact shipped hex values.

## Scope (Tier 1 + 2 from the design conversation)

Real terminal, no gallery-assumes-overlay mistake, one command, `tsx watch` for the edit loop, optional
deep-link arg.

### Files

```
src/dev/component-preview.ts                 public entry point (fractal root, mirrors workspace-dialog.ts)
src/dev/component-preview/
  theme.ts                                   createComponentPreviewTheme() — real Theme instance
  custom-ui.ts                               showComponentPreview() — faithful ctx.ui.custom() shim
  static-preview.ts                          previewStaticComponent() + captureMessageRenderer() —
                                              transcript-message-renderer and persistent-chrome lanes
  registry.ts                                 COMPONENT_PREVIEW_REGISTRY — one entry per previewable component
  gallery-component.ts                        ComponentGalleryComponent — menu Component
  __tests__/
    custom-ui.test.ts
    static-preview.test.ts
    theme.test.ts
scripts/dev-components.ts                    tsx entry point, optional deep-link arg
```

### Behavior

- `runComponentPreviewGallery({ entryId? })`:
  - No `entryId`: boots `ProcessTerminal` + `TUI`, shows `ComponentGalleryComponent` (arrow/jk + enter +
    q), opening the selected entry via its own real presentation contract; returns to the gallery when
    the entry's `done()` fires.
  - `entryId` given: skip the gallery, open that one entry directly, exit when it resolves.
- `showComponentPreview(tui, theme, keybindings, factory, options)`:
  - `options?.overlay` true → `tui.showOverlay(component, resolvedOverlayOptions)`.
  - Otherwise → `tui.addChild(component); tui.setFocus(component)`, removed on `done()`.
  - Mirrors `ExtensionUIContext.custom`'s documented calling shape (public type), not private
    interactive-mode internals (those aren't importable — package `exports` map only allows `.` and
    `./rpc-entry`).
- Registry entries carry their component's *real* production options, not a uniform guess:
  - `axis-picker` — no options (inline swap, matches `commands/index.ts`).
  - `multi-choice-picker` — no options (inline swap, matches `choices-editor.ts`).
  - `workspace-dialog` — `{ overlay: true, overlayOptions: { anchor: 'center', width: WORKSPACE_DIALOG_WIDTH, maxHeight: '90%', margin: 1 } }` (matches `workspace/index.ts`).
  - `tui-lab` (style palette + segment track) — `{ overlay: true }`. `TuiStyleLabComponent` now lives
    at `.pi/components/tui-lab/style-lab-component.ts` as a reference component with no production
    call site; the `registerBrunchTuiLab` extension registrar it used to live behind (`.pi/extensions/tui-lab/`)
    was retired — it never entered the product bundle and was inert even under Pi's ambient
    `.pi/extensions/` directory scan (see `memory/PLAN.md`'s `component-dx` frontier).
  - `alternatives` (transcript message renderer, not `ctx.ui.custom`) — `captureMessageRenderer` feeds
    `registerBrunchAlternatives` a minimal fake `ExtensionAPI` slice to capture the real
    `alternatives-card-set` renderer closure, then calls it directly with a sample message; mounted via
    `previewStaticComponent` (dismiss-on-any-key, since the renderer's output has no `done()` of its own).
  - `chrome-header` (persistent chrome region, not `ctx.ui.custom`) — `BrunchStartupHeader` is already a
    plain `Component` with a public constructor, so it previews like any other static content via
    `previewStaticComponent` with sample project/spec/session facts. The footer lane (`ui.setFooter`) is
    deliberately deferred — driven by live token/model/coherence state, lower value to preview statically.
  - `brunch-editor` `[experimental]` (editor slot, `ctx.ui.setEditorComponent`, not `ctx.ui.custom`) —
    a design exploration, not yet wired into production chrome. `BrunchEditorComponent`
    (`.pi/components/brunch-editor.ts`) subclasses `CustomEditor`, overriding only `render()` to wrap
    the inherited output in a `│`-bordered box (the default `Editor` has no side borders at all) with
    runtime-state labels baked into the border corners (`projectBorderedChrome`, a pure, reusable
    function — intended reuse target: the `request_*` question-form pickers). Facts are pulled fresh on
    every `render()` via a closure, matching `chrome/index.ts`'s existing `telemetry?.()` freshness
    contract. Because a real `Editor`'s bottom border is not reliably the last rendered line (autocomplete
    dropdown rows are appended after it), the bottom border is found by scanning backward for an
    `Editor`-shaped border line, not by a fixed index — confirmed against the real (non-compiled)
    `pi-tui` `Editor.render()` source, not just its `.d.ts`. This entry is also what forced
    `component-preview.ts`'s `keybindings` stub to become a real `pi-tui` `KeybindingsManager` (see
    `src/dev/TOPOLOGY.md`) — `CustomEditor.handleInput` needs `.matches()` for escape/ctrl+d handling.

### package.json

```json
"dev:components": "tsx scripts/dev-components.ts",
"dev:components:watch": "tsx watch scripts/dev-components.ts"
```

### Known ceilings (declared, not silently cut corners)

- `keybindings` (3rd factory arg) is a stub — no current component consumes it. If one starts to,
  revisit with a real minimal `KeybindingsManager` fixture.
- Theme colors are hand-authored (reusing Brunch's existing 256-color test palette), not pi's shipped
  `dark.json`/`light.json` — those require reimplementing a private `vars` → `colors` → ansi resolution
  pipeline that the package doesn't expose. Upgrade only if exact shipped colors become load-bearing.

## Acceptance / verification

- `npm run dev:components` runs against a real terminal with no workbench/session and shows the gallery.
- `npm run dev:components -- axis-picker` (etc.) deep-links directly into one entry.
- `custom-ui.test.ts` proves both overlay and inline-swap paths open/close correctly on a
  `VirtualTerminal`-backed real `TUI` (reusing `src/.pi/__tests__/support/virtual-terminal.ts`).
- `theme.test.ts` proves the constructed `Theme` renders the specific colors Brunch components already
  depend on, and that a real component (e.g. the axis-picker) renders without error when given it.
- `npm run fix` / relevant `vitest` run clean for the new files.
