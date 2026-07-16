# Dev Feedback Loops

This directory owns Brunch-only development loops and curation seams. Nothing here is product runtime configuration, and nothing here may silently widen the sealed Pi profile.

## Ownership

`src/dev/**` owns six things:

- the human-facing dev launcher (`scripts/dev.ts` → `src/dev/dev-cli.ts`)
- the explicit graph-curation seam for fixture shaping (`graph-curation.ts`)
- faux/introspection/tier-2 harnesses used by tests and probes
- dev-only witnesses such as `generate-fan-out-witness.ts`
- the standalone component preview harness (`scripts/dev-components.ts` → `src/dev/component-preview.ts`) for previewing `.pi/components` in isolation on a real terminal, with no workspace/session/DB
- the agent-drivable PTY walkthrough fallback (`npm run tui-driver` → `src/dev/tui-driver.ts`): named `expect`-pumped PTY sessions with guarded fifo control, headless-xterm screen rendering, and wait-for-text; use it when the canonical project-local `pi-interactive-shell` overlay cannot bind in a sandbox/headless host; sessions live under gitignored `.fixtures/scratch/tui-driver/`

It does not own published CLI behavior, public RPC contracts, database imports from outside `graph/`, or the external `pi-interactive-shell`/`zigpty` runtime. The extension is permanent project development tooling declared under root `.pi` for host-capable manual runs; it never enters Brunch's shipped package manifest, sealed `src/.pi` profile, or runtime dependency graph. `docs/praxis/manual-testing.md` owns the measured priority order, install/health check, trust and auto-install implications, takeover/return, artifact bounds, and teardown procedure.

## Launcher Surface

`npm run dev-cli` is the front door for local workbenches; `npm run dev` directly launches the product CLI from TypeScript source.

- With no args, the launcher offers a bare temporary instance, a new named workbench, an existing unseeded workbench, or a seed-derived reset.
- `--temp` creates an auto-named directory under the system temp directory; `--workbench <name>` resolves under `.fixtures/workbenches/`; `--workspace <path>` accepts an arbitrary path.
- TUI is the default mode.
- Seeding is always explicit: the launcher only seeds when `--seed <name>/<variant> --reset` is present or chosen in the prompt flow.
- `rpc`, `mutate`, and `export` are explicit subcommands for scripted reads, graph curation, and fixture export.
- `trajectory` joins one workspace's normalized debug events to Pi's canonical active session branch and an optional bounded viewport. It requires explicit workspace/session/run inputs and replaces `<workspace>/.brunch/debug/trajectory.json` plus `trajectory-report.md` on each run (latest-wins); the report is diagnostic attribution, not product truth or a causality claim.
- `evaluate-consequential-fact` applies the fixed review-diff rubric to Pi's canonical active branch, a runtime-validated joined `trajectory.json` with matching run identity, and a spec-scoped graph read. It writes atomic evidence-linked verdicts plus the joined report's real directive/transcript diagnostic references only under repo-root `.fixtures/scratch/evaluations/<run-id>/`, never mutates either store, and supports deterministic scorer calibration rather than campaign or causal claims.
- `consequential-fact-campaign.ts` owns the fixed six-run warrant-ablation manifest, deterministic reveal/approval actor, mechanical-invalid boundary, and predeclared 2/3-versus-1/3 aggregation. Its scenario lives beside the evaluator implementation; campaign output remains scratch until human calibration and deliberate promotion.

Current subcommands:

```text
npm run dev-cli
npm run dev-cli -- --temp
npm run dev-cli -- --workbench my-workbench
npm run dev-cli -- --seed workspace-alpha-grounding/base --reset
npm run dev-cli -- rpc graph.overview '{"specId":1}' --workspace .fixtures/workbenches/workspace-alpha-grounding
npm run dev-cli -- mutate --workspace .fixtures/workbenches/workspace-alpha-grounding --params-file /tmp/mutate.json
npm run dev-cli -- export --workspace .fixtures/workbenches/workspace-alpha-grounding --spec-id 1 --out .fixtures/seeds/custom/example.json
npm run dev-cli -- trajectory --workspace .fixtures/workbenches/workspace-alpha-grounding --session .fixtures/workbenches/workspace-alpha-grounding/.brunch/sessions/<session>.jsonl --run-id <run-id> [--viewport <bounded-file>]
npm run dev-cli -- evaluate-consequential-fact --workspace <workspace> --session <session.jsonl> --spec-id <id> --scenario <scenario.json> --trajectory <trajectory.json> --run-id <run-id>
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

## Debug Mirrors

Source runs and local dev builds automatically mirror debug artifacts into `<workspace>/.brunch/debug/`.

- This automatic mirror is passive observability only: system prompt captures, Brunch-owned tool content, origination records, trajectory events, and debug transcript rendering.
- `trajectory.ndjson` is a bounded, secret-filtered diagnostic input. `trajectory-report.ts` reads it alongside `openActiveSessionBranch` and writes latest-wins `trajectory.json` + `trajectory-report.md` beside it; none of these files feed product behavior.
- Product subagents remain governed by the operational-mode policy; no prompt-affecting developer tool channel exists.

## Graph Curation

`graph-curation.ts` is the canonical local fixture-shaping seam.

- It accepts the former dev-mutate grammar: create/patch/delete node and edge ops, with projected node-code resolution scoped to one spec.
- It resolves those projected references before entering `CommandExecutor.mutateGraph`, so fixture shaping still uses the product-owned mutation boundary.
- It is intentionally in-process, not a hidden RPC host flag. External agents should call the explicit `npm run dev-cli -- mutate ...` or `npm run dev-cli -- rpc ...` commands instead of relying on a long-lived write-enabled sidecar.

## Faux And Tier-2 Loops

- `createBrunchFauxHarness()` and `runBrunchFauxTurn()` are Tier-1 exact-payload loops.
- `runBrunchIntrospectionTurn()` writes paired subjective/mechanical artifacts for prompt inspection.
- `runTier2RealBootFauxTurn()`, `bootTier2RuntimeThroughRunBrunchTui()`, and `bootTier2RuntimeFromFixture()` own real-boot proofs: session activation, origination, restart/resume, and runtime registration.

Tier-2 means “real Brunch/Pi boot path,” not necessarily “real provider.” Tests may substitute only auth/model/provider services while keeping session construction, extension registration, transcript wiring, and origination choreography on the product path.

## Dependency Posture

Brunch now resolves `@earendil-works/pi-*` through installed packages only. The old `PI_SOURCE` Vite/Vitest alias path was retired because it no longer affected the real `tsx` dev loop and had become a non-consequent maintenance surface.

If a future slice needs alternate-source Pi iteration again, that slice must re-establish it as a current, end-to-end consequence rather than reviving dead ambient flags.
