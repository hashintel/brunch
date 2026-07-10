# Dev Feedback Loops

This directory owns Brunch-only development loops and curation seams. Nothing here is product runtime configuration, and nothing here may silently widen the sealed Pi profile.

## Ownership

`src/dev/**` owns five things:

- the human-facing dev launcher (`scripts/dev.ts` → `src/dev/dev-cli.ts`)
- the explicit graph-curation seam for fixture shaping (`graph-curation.ts`)
- faux/introspection/tier-2 harnesses used by tests and probes
- dev-only witnesses such as `generate-fan-out-witness.ts`
- the standalone component preview harness (`scripts/dev-components.ts` → `src/dev/component-preview.ts`) for previewing `.pi/components` in isolation on a real terminal, with no workspace/session/DB

It does not own published CLI behavior, public RPC contracts, or database imports from outside `graph/`.

## Launcher Surface

`npm run dev` is the front door for local workbenches.

- With no args, it prompts for a workbench, whether to start from current state or a reset seed, and whether to open the web sidecar.
- TUI is the default mode.
- Seeding is always explicit: the launcher only seeds when `--seed <name>/<variant> --reset` is present or chosen in the prompt flow.
- `rpc`, `mutate`, and `export` are explicit subcommands for scripted reads, graph curation, and fixture export.
- `npm run dev:raw -- ...` remains the escape hatch to the underlying app entrypoint.

Current subcommands:

```text
npm run dev
npm run dev -- --seed workspace-alpha-grounding/base --reset
npm run dev -- rpc graph.overview '{"specId":1}' --workspace .fixtures/workbenches/workspace-alpha-grounding
npm run dev -- mutate --workspace .fixtures/workbenches/workspace-alpha-grounding --params-file /tmp/mutate.json
npm run dev -- export --workspace .fixtures/workbenches/workspace-alpha-grounding --spec-id 1 --out .fixtures/seeds/custom/example.json
```

## Component Preview Harness

`npm run dev:components` boots a
real `ProcessTerminal` + `TUI` and shows a gallery of every registered `.pi/components` entry
(`src/dev/component-preview/registry.ts`) — no seeded workbench, session, or DB required, since these
components are render-only with injectable `theme`/props.

- `npm run dev:components -- <id>` deep-links straight into one entry, skipping the gallery.
- Each registry entry mirrors its component's *real* production presentation contract
  (`src/dev/component-preview/custom-ui.ts`'s `showComponentPreview` shim reimplements
  `ExtensionUIContext.custom`'s documented calling shape): overlay-with-options for components that
  opt into `{ overlay: true, overlayOptions }` in production (e.g. `workspace-dialog`), or an inline
  swap of the gallery's root content for components that call `ctx.ui.custom` with no options (e.g. the
  runtime-mode axis picker, the multi-choice picker). This is deliberate: those two presentation modes
  differ in production, and a preview tool that assumed "always overlay" would misrepresent how a
  component actually ships.
- Theme is a real `pi-coding-agent` `Theme` instance (`src/dev/component-preview/theme.ts`), not a
  duck-typed stand-in — a `SwitchableComponentPreviewTheme` subclass loading the shipped truecolor
  Brunch theme JSONs (`src/.pi/themes/brunch-{dark,light}.json`), since the package's `exports` map
  does not expose pi's shipped theme-loading internals outside a running session. **ctrl+t** toggles
  dark/light live — including while an entry is open — via a consuming TUI input listener plus
  `tui.invalidate()`; every color read delegates to the active variant, so no component needs a
  retheme contract. The terminal defaults follow the toggle too — OSC 10 sets the default
  foreground to the theme's `export.pageFg` reference (the assumed environment default the palette
  is designed against — deliberately *not* the `text` token, which is `""` = terminal default), so
  unstyled and `text`-token glyphs render on the intended page, and OSC 11 sets the page background
  to `export.pageBg`; OSC 110/111 reset
  both on exit — since theme colors only style explicitly wrapped glyphs. For terminals that ignore
  OSC 10/11 (Zed), `createThemePaintingTerminal` wraps the harness Terminal and injects the same
  base colors at the SGR level: frame writes are prefixed with the page fg/bg and default-reset
  codes are rewritten to the theme base, so the harness owns its page colors everywhere.
  **Simulation note:** a live pi/Brunch session paints neither — pi *detects* the terminal
  background and picks a theme half to harmonize (the `brunch-light/n` auto-sync setting); unstyled
  body text there is terminal-native. The harness paint answers "how does the palette read on its
  intended page?", which is the right truth environment for pinning values.
  `BRUNCH_PREVIEW_THEME=light` selects the initial variant. The theme JSONs also **hot-reload**:
  `watchComponentPreviewTheme` watches `src/.pi/themes/` and rebuilds the variant palettes on save
  (last-good palette kept across mid-edit invalid JSON), so theme-value work iterates against the
  live harness. The `theme-testbed` entry (`theme-testbed.ts`) is the companion surface: text style
  variations, border levels, every theme-file border role, the mode-reactive and surface-identity
  semantic border channels, the same markdown fixture through pi's assistant markdown theme (real
  highlight.js `syntax*` token colors, via pi's registered global theme symbol + a bound facade) and
  brunch's exchange markdown theme, plus a fg/bg contrast strip.
- `keybindings` is a real `pi-tui` `KeybindingsManager` (`createComponentPreviewKeybindings()`), not a
  stub — `BrunchEditorComponent`'s inherited `CustomEditor.handleInput` calls `.matches(...)` for
  app-level actions (escape-to-cancel, ctrl+d-to-exit), which a stub can't satisfy. Built from
  `TUI_KEYBINDINGS` plus the two app-level actions any `CustomEditor`-based preview entry needs, since
  pi-coding-agent's fuller app-action table isn't part of the package's public value exports.
- Two further lanes beyond `ctx.ui.custom` are covered by `src/dev/component-preview/static-preview.ts`,
  since neither has a `done()` callback of its own:
  - **Transcript message renderers** (e.g. `alternatives-card-set`) — `captureMessageRenderer` feeds the
    real registration function (`registerBrunchAlternatives`) a minimal fake `ExtensionAPI` slice to
    capture the renderer closure, then calls it directly with a sample message.
  - **Persistent chrome regions** (e.g. the startup header mounted via `ui.setHeader`) — these are
    already plain `Component`s with public constructors, so they preview like any other static content.
  - Both are mounted via `previewStaticComponent`, which wraps the component with a
    "press any key to return to the gallery" dismiss handler — a preview-only affordance, since in
    production these lanes have no dismissal at all (a transcript message persists; chrome stays mounted
    for the session).
  - The footer lane (`ui.setFooter`) is deliberately not previewed yet: it is driven by live
    token/model/coherence state rather than static layout, and is lower value to preview in isolation.
- A `workspace-dialog-scroll` entry reuses the same `workspace-dialog` mounting path with a 20-spec
  fixture long enough to overflow `WORKSPACE_DIALOG_MAX_VISIBLE_OPTIONS`, demonstrating
  `projectScrollViewport`'s windowing and `▐` border-folded scroll thumb
  (`.pi/components/scroll-viewport.ts`) live: `npm run dev:components -- workspace-dialog-scroll`,
  then arrow-down/up or wheel-scroll past the visible window. Wheel handling is an explicit
  `showComponentPreview(..., { wheelScroll: true })` opt-in for this preview entry: the shim owns
  SGR mouse enable/disable and forwards recognized wheel events as the same arrow-key bytes the
  component already handles. No new preview lane or wrapper component was needed — it is a fixture
  variation on the existing `ctx.ui.custom` overlay lane. Real physical terminal wheel emission
  remains a manual smoke-test residual; the automated harness injects the SGR bytes directly.
- The `brunch-editor` entries preview the same `BrunchEditorComponent` that production chrome installs
  via `ctx.ui.setEditorComponent`: a `CustomEditor` wrapped in a bordered box with caller-injected
  runtime labels and mode-reactive border colors. The ask rich-body entries likewise include Specify and
  Execute mode border variants. Editor entries mount directly (`tui.addChild` + `onEscape` dismiss)
  rather than through `showComponentPreview` or `previewStaticComponent`, since they need real focus and
  input routing that a static preview doesn't exercise.

## Debug Mirrors And Dev Tools

Source runs and local dev builds automatically mirror debug artifacts into `<workspace>/.brunch/debug/`.

- This automatic mirror is for passive observability only: system prompt captures, Brunch-owned tool content, origination records, and debug transcript rendering.
- Prompt-affecting dev surfaces stay explicit. `--dev-tools` is the opt-in for dev query tools only; product subagents are not dev-gated.
- TUI boots therefore have three states: product-default (including product subagents when registered), debug-mirror-only, and debug-mirror plus dev query tools.

## Graph Curation

`graph-curation.ts` is the canonical local fixture-shaping seam.

- It accepts the former dev-mutate grammar: create/patch/delete node and edge ops, with projected node-code resolution scoped to one spec.
- It resolves those projected references before entering `CommandExecutor.mutateGraph`, so fixture shaping still uses the product-owned mutation boundary.
- It is intentionally in-process, not a hidden RPC host flag. External agents should call the explicit `npm run dev -- mutate ...` or `npm run dev -- rpc ...` commands instead of relying on a long-lived write-enabled sidecar.

## Faux And Tier-2 Loops

- `createBrunchFauxHarness()` and `runBrunchFauxTurn()` are Tier-1 exact-payload loops.
- `runBrunchIntrospectionTurn()` writes paired subjective/mechanical artifacts for prompt inspection.
- `runTier2RealBootFauxTurn()`, `bootTier2RuntimeThroughRunBrunchTui()`, and `bootTier2RuntimeFromFixture()` own real-boot proofs: session activation, origination, restart/resume, and runtime registration.

Tier-2 means “real Brunch/Pi boot path,” not necessarily “real provider.” Tests may substitute only auth/model/provider services while keeping session construction, extension registration, transcript wiring, and origination choreography on the product path.

## Dependency Posture

Brunch now resolves `@earendil-works/pi-*` through installed packages only. The old `PI_SOURCE` Vite/Vitest alias path was retired because it no longer affected the real `tsx` dev loop and had become a non-consequent maintenance surface.

If a future slice needs alternate-source Pi iteration again, that slice must re-establish it as a current, end-to-end consequence rather than reviving dead ambient flags.
