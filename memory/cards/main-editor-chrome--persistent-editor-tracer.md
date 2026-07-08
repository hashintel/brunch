# Persistent editor tracer

Frontier: main-editor-chrome
Status:   active
Mode:     single
Created:  2026-07-08

## Orientation note

- Containing seam: Brunch TUI chrome projection, with `src/.pi/extensions/chrome/` mounting Pi UI surfaces and `src/.pi/components/brunch-editor.ts` supplying the already-previewed editor component.
- Frontier item: `main-editor-chrome` / FE-1169 on branch `ln/fe-1169-editor-chrome`; this is thread 1 from `memory/PLAN.md` and the handoff's recommended first tracer.
- Volatile state: `HANDOFF.md` says FE-1169 planning is committed and no scratch artifact is needed; FE-1164 tie-off remains adjacent stack state, not a dependency for this card's local implementation.
- Main open risk: `ctx.ui.setEditorComponent` has not run through Brunch's production session-start path, so render height, focus routing, and no-UI degradation are still assumptions.

Posture: proving (inherited from `main-editor-chrome`)

## Target Behavior

Chrome initialization respects Pi UI capability when mounting Brunch-owned interactive surfaces.

## Full-card cold-start reads

- `memory/SPEC.md` — decisions / invariants / assumptions: D22-L, D35-L, D115-L, D34-L, D113-L, A18-L, I22-L, I59-L
- `memory/PLAN.md` — frontier: `main-editor-chrome`
- `HANDOFF.md` — FE-1169 next-step note and adjacent FE-1164 stack state
- `src/.pi/components/TOPOLOGY.md` — `BrunchEditorComponent` status and component test conventions
- `src/.pi/extensions/chrome/TOPOLOGY.md` — chrome renderer surface and dependency direction
- `src/.pi/extensions/TOPOLOGY.md` — adapter ownership, TUI launch chrome, no-UI/RPC notes, set-editor example pointers
- `src/dev/TOPOLOGY.md` — `dev:components` preview harness contract for `brunch-editor`
- `node_modules/@earendil-works/pi-coding-agent/docs/tui.md` — Pattern 7 / `setEditorComponent` factory contract
- `node_modules/@earendil-works/pi-coding-agent/examples/extensions/border-status-editor.ts` — current-version example for border/status editor mounting

## Boundary Crossings

```text
→ Brunch TUI session boot (`src/app/brunch-tui.ts` / `createBrunchPiExtensions`)
→ Pi extension registration (`src/app/pi-extensions.ts`)
→ Chrome `session_start` handler (`src/.pi/extensions/chrome/index.ts`)
→ Pi UI editor factory (`ctx.ui.setEditorComponent`)
→ `BrunchEditorComponent` (`src/.pi/components/brunch-editor.ts`)
→ Pi `CustomEditor` input/focus/render contract
```

Secondary guard path:

```text
→ `/brunch:switch` / workspace shortcut action
→ `src/.pi/extensions/workspace/index.ts`
→ Pi UI custom-dialog capability check
→ product-shaped cancel / needs-human / notification outcome
```

## Risks and Assumptions

- RISK: Boxing the default editor changes perceived editor height or focus behavior in real `InteractiveMode`. → MITIGATION: keep the first mount thin, drive the existing `BrunchEditorComponent` harness tests, add a product-path editor-mount test, and run one real TUI smoke.
- RISK: First labels duplicate or contradict footer chrome. → MITIGATION: mount only canonical chrome facts already in `BrunchChromeState` / live telemetry; leave richer mode-color and border-role semantics for later FE-1169 cards.
- RISK: Headless/RPC contexts still expose enough UI methods that a naive guard gives false confidence. → MITIGATION: test the actual degraded context shape used by Brunch fakes/Tier-2 boot and keep behavior product-shaped rather than Pi-exception-shaped.
- ASSUMPTION: Pi's `setEditorComponent` factory is safe to install from the same `session_start` handler that sets footer/header/title.
  → IMPACT IF FALSE: FE-1169's persistent-editor thread needs a different mounting seam before border semantics and mode-reactive input chrome can proceed.
  → VALIDATE: extension-level `session_start` test plus a product-path boot test that observes the editor factory installation.
- ASSUMPTION: Non-TUI workspace switching must not call `ctx.ui.custom` directly.
  → IMPACT IF FALSE: headless/RPC clients can hit a TUI-only dialog path instead of the product-shaped `needs_human` degradation promised by req 5 / D115-L.
  → VALIDATE: targeted `runBrunchWorkspaceAction` test with a non-custom UI context.

## Posture check

- Proof of life: lights up the first production path through `ctx.ui.setEditorComponent` using Brunch-owned chrome state.
- Invariants: stabilizes D35 by keeping persistent input chrome under the chrome renderer seam instead of adding a separate app-layer mount.
- Uncertainty: retires the render-height / focus-routing assumption for the editor component in the real Brunch extension path.

## Acceptance Criteria

✓ `src/.pi/extensions/__tests__/chrome.test.ts` — `registerBrunchChrome` installs a `ctx.ui.setEditorComponent` factory during `session_start` when the UI context supports it.
✓ `src/.pi/extensions/__tests__/chrome.test.ts` — the installed factory returns `BrunchEditorComponent` labels derived from activated chrome state plus live telemetry, not hardcoded placeholders.
✓ `src/app/__tests__/brunch-tui.test.ts` — the `createBrunchPiExtensions` product path wires the editor mount through the same chrome registrar used by normal Brunch TUI launch.
✓ `src/app/__tests__/brunch-tui.test.ts` — a non-custom/headless workspace action does not call `ctx.ui.custom`.
✓ `src/app/__tests__/brunch-tui.test.ts` — a non-custom/headless workspace action surfaces product-shaped degradation instead of throwing.
✓ `src/.pi/components/__tests__/brunch-editor.harness.test.ts` — existing typing, escape, and ctrl-d behavior stays green under the production-mounted component.
✓ Manual outer smoke — one real terminal run shows the mounted editor does not corrupt input height or focus after typing and submitting one prompt.

## Invariants preserved

- Startup chrome still renders footer/title/header through `renderBrunchChrome` — guarded by: `src/.pi/extensions/__tests__/chrome.test.ts` and `src/app/__tests__/brunch-tui.test.ts` existing chrome assertions.
- `BrunchEditorComponent` remains a presentation component with domain labels injected by caller — guarded by: `src/.pi/components/TOPOLOGY.md` dependency rules and component tests.
- No-auth / no-UI degraded paths must not start model turns or require TUI dialogs — guarded by: existing I59-L suites plus this card's headless workspace-action test.
- Pi app keybindings inherited by `CustomEditor` keep working — guarded by: `src/.pi/components/__tests__/brunch-editor.harness.test.ts`.

## Verification Approach

- Inner: targeted Vitest — chrome registrar tests, Brunch TUI wiring tests, and `BrunchEditorComponent` harness tests prove mount, labels, degradation, and input behavior.
- Middle: product-path extension factory test — proves the card is wired through Brunch's real extension bundle, not only a direct component injection.
- Outer: manual TUI smoke — run a real terminal with either `npm run dev:components -- brunch-editor` plus a normal `npm run dev` session, then record any render-height/focus anomaly in the build handoff or PR notes.

## Cross-cutting obligations

- Preserve D35 single-renderer discipline: persistent editor mounting belongs to the chrome seam, not scattered app wiring.
- Preserve D22/I22 startup ordering: no transcript rendering or agent loop before workspace activation.
- Preserve D115/I59 no-auth degradation: UI chrome work must not backdoor a provider turn.
- Keep border styling semantic through theme tokens; do not introduce raw border colors while wiring the first mount.
- Do not pull in FE-1169 later threads (`shift+tab` mode cycling, details-driven transcript rendering, `/brunch:*` command reshaping) except for the minimum labels needed to retire this tracer's assumption.

## Expected touched paths (tentative)

```text
src/.pi/extensions/
├── chrome/
│   ├── index.ts          ~
│   └── TOPOLOGY.md       ~
├── workspace/
│   └── index.ts          ~
├── __tests__/
│   └── chrome.test.ts    ~
└── TOPOLOGY.md           ?
src/.pi/components/
├── brunch-editor.ts      ?
├── TOPOLOGY.md           ~
└── __tests__/
    └── brunch-editor.harness.test.ts ?
src/app/
├── pi-extensions.ts      ?
└── __tests__/
    └── brunch-tui.test.ts ~
src/dev/
└── TOPOLOGY.md           ~
```
