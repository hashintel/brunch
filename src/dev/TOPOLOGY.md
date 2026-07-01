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
npm run dev -- --seed workspace-alpha-grounding/base --reset --open-web
npm run dev -- rpc graph.overview '{"specId":1}' --workspace .fixtures/workbenches/workspace-alpha-grounding
npm run dev -- mutate --workspace .fixtures/workbenches/workspace-alpha-grounding --params-file /tmp/mutate.json
npm run dev -- export --workspace .fixtures/workbenches/workspace-alpha-grounding --spec-id 1 --out .fixtures/seeds/custom/example.json
```

## Component Preview Harness

`npm run dev:components` (or `npm run dev:components:watch` for a `tsx watch`-backed edit loop) boots a
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
  duck-typed stand-in — seeded with Brunch's own established 256-color palette, since the package's
  `exports` map does not expose pi's shipped theme-loading internals outside a running session.
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
- A fourth, `[experimental]` entry (`brunch-editor`) previews `ctx.ui.setEditorComponent` —
  `BrunchEditorComponent` (`.pi/components/brunch-editor.ts`) wraps `CustomEditor` in a `│`-bordered box
  with runtime-state labels baked into the border corners, since the default `Editor` has no side
  borders at all. This is a design exploration for the `component-dx` frontier, not yet wired into
  `src/.pi/extensions/chrome/index.ts` — it mounts directly (`tui.addChild` + `onEscape` dismiss) rather
  than through `showComponentPreview` or `previewStaticComponent`, since it needs real focus and input
  routing that a static preview doesn't exercise.

## Debug Mirrors And Dev Tools

Source runs and local dev builds automatically mirror debug artifacts into `<workspace>/.brunch/debug/`.

- This automatic mirror is for passive observability only: system prompt captures, Brunch-owned tool content, origination records, and debug transcript rendering.
- Prompt-affecting dev surfaces stay explicit. `--dev-tools` is the opt-in for query tools and subagent affordances.
- TUI boots therefore have three states: product-default, debug-mirror-only, and debug-mirror plus dev tools.

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
