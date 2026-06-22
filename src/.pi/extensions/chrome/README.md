# .pi/extensions/chrome/ — Brunch TUI shell chrome projection

SPEC decisions: D35-L (chrome is a Brunch projection wrapper over Pi UI primitives); D21-L (workspace boot seam supplies the launch facts).

## Owns

Projection of canonical workspace/session facts into Pi's TUI shell surfaces — footer, terminal title, and startup header — through one Brunch-owned renderer (`renderBrunchChrome`). The projection is stateless: it holds no mutable chrome state and derives every surface from the `BrunchChromeState` value it is handed plus render-time telemetry.

## Does NOT own

- Launch/activation choreography and how `BrunchChromeState` is assembled — parent [`.pi/extensions/README.md`](../README.md) §TUI launch chrome.
- Session display-name minting (`sessionDisplayName` = `` `${specTitle} — session ${ordinal}` ``) — `session/` (`workspace-session-coordinator.ts`). Chrome only renders whatever label it is given.
- The reusable header widget — [`.pi/components/chrome-header.ts`](../../components/chrome-header.ts).
- Web host, workspace, or activation state — received via `BrunchChromeState`, never read here.

## Public surface

`renderBrunchChrome`, `registerBrunchChrome`, `chromeStateForWorkspace`, `projectBrunchChromeFooterLines`, and the `BrunchChromeState` / `BrunchChromeFooterTelemetry` / `BrunchChromeRenderOptions` types. The `default` export (`brunchChrome`) exists only for dev `/reload` iteration (D39-L).

## State shape (`BrunchChromeState`)

`cwd` / `spec` / `session` (from `WorkspaceSessionChromeState`), `project?`, `session { id, label? }`, `webSidecarUrl?`, and `startupHeader? { decision: continue | openSession | newSpec | newSession }`. The `runtime?` / `build?` / `contextUsage?` / `worker?` / `coherence?` fields are forward-only optional slots; the footer reads `runtime`/`contextUsage` as fallback when telemetry is absent, and `worker`/`coherence`/`build` are defined but not yet rendered. <!-- ceiling: wire or drop the worker/coherence/build slots when that surface actually lands -->

## Render surfaces

- **Footer** (`projectBrunchChromeFooterLines`): (1) `spec / session` keyed part, with an `ui: <sidecarUrl>` right column when a sidecar URL is present; (2) the Brunch status line — `mode` / `strategy` / `lens` from the projected agent state (telemetry) or `chrome.runtime` fallback; (3) model label + a context-usage gauge; (4) other extensions' statuses, then a trailing blank line.
- **Title** (`formatChromeTitle`): `brunch — <project>` or `brunch — <project> · <spec>`.
- **Startup header**: rendered via `BrunchStartupHeader` only when `startupHeader` is set; installed for every non-cancel launch activation so the shell never falls back to Pi's quiet empty header.

## Telemetry & refresh

`footerTelemetryFromContext` reads at render time: `sessionName` (overrides the launch-time label after `/name`), live context usage, model, thinking level, and the projected agent state (`projectBrunchAgentState`). The footer surfaces also read `footerData.getExtensionStatuses()` and `getAvailableProviderCount()`. `registerBrunchChrome` re-renders the footer on `model_select`, `thinking_level_select`, and `turn_end`, and exposes a refresh trigger via `bindChromeRefresh`.

## Status-key policy

Chrome never publishes a `brunch.chrome` status key (test-locked) — it filters that key out (`sanitizeChromeStatuses`) and renders only other extensions' statuses. `ctx.ui.setStatus(key, text)` stays a lateral contribution channel for other extensions and future dynamic Brunch state.

## RPC visibility

Header, footer, and working-indicator are TUI-only in current Pi RPC mode; only the terminal title and sidecar/widget-compatible string arrays cross to RPC clients.

## Dependency direction

Imports `projections/session` (runtime-state), `session/` types, and `.pi/components/chrome-header`. Adapter layer — does not import `db/`, `rpc/`, `web/`, or `app/`. Launch facts flow `app/ → chrome` one-way through `BrunchChromeState`.

## Migration notes

- The startup-header expand affordance was removed 2026-06-11 (no advertised unwired behavior); it may return only with a real input path.
- `getGitBranch` is no longer read by the footer compositor.

Tests: [`src/app/__tests__/brunch-tui.test.ts`](../../../app/__tests__/brunch-tui.test.ts) ("requests startup header chrome for every activated launch decision"; `brunch.chrome` widget absence).
