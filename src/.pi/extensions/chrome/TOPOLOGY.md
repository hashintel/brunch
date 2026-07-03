# .pi/extensions/chrome/ — Brunch TUI shell chrome projection

SPEC decisions: D35-L (chrome is a Brunch projection wrapper over Pi UI primitives); D21-L (workspace boot seam supplies the launch facts).

## Owns

Projection of canonical workspace/session facts into Pi's TUI shell surfaces — footer, terminal title, and startup header — through one Brunch-owned renderer (`renderBrunchChrome`). The projection is stateless: it holds no mutable chrome state and derives every surface from the `BrunchChromeState` value it is handed plus render-time telemetry.

## Does NOT own

- Launch/activation choreography and how `BrunchChromeState` is assembled — parent [`.pi/extensions/TOPOLOGY.md`](../TOPOLOGY.md#tui-launch-chrome).
- Session display-name minting (`sessionDisplayName` = `` `${specTitle} — session ${ordinal}` ``) — `session/` (`workspace-session-coordinator.ts`). Chrome only renders whatever label it is given.
- The reusable header widget — [`.pi/components/chrome-header.ts`](../../components/chrome-header.ts).
- Web host, workspace, or activation state — received via `BrunchChromeState`, never read here.

## Public surface

`renderBrunchChrome`, `registerBrunchChrome`, `chromeStateForWorkspace`, `projectBrunchChromeFooterLines`, and the `BrunchChromeState` / `BrunchChromeFooterTelemetry` / `BrunchChromeRenderOptions` types. The `default` export (`brunchChrome`) exists only for dev `/reload` iteration (D39-L).

## State shape (`BrunchChromeState`)

`cwd` / `spec` / `session` (from `WorkspaceSessionChromeState`), `project?`, `session { id, label? }`, `webSidecarUrl?`, and `startupHeader? { decision: continue | openSession | newSpec | newSession, resumeFacts? }`. The optional `startupHeader.resumeFacts` (`{ specTitle?, nodeCount?, edgeCount?, modeLabel? }`) drives the F16a resume state/status block; it is sampled once at chrome-state assembly time in `app/brunch-tui.ts` and rendered only for `openSession`. The `runtime?` / `build?` / `contextUsage?` / `worker?` / `coherence?` fields are forward-only optional slots; the footer reads `runtime`/`contextUsage` as fallback when telemetry is absent, and `worker`/`coherence`/`build` are defined but not yet rendered. <!-- ceiling: wire or drop the worker/coherence/build slots when that surface actually lands -->

## Render surfaces

- **Footer** (`projectBrunchChromeFooterLines`): (1) `spec / session` keyed part, with an `ui: <sidecarUrl>` right column when a sidecar URL is present; (2) the Brunch status line — live `mode` from the projected agent state (telemetry) or `chrome.runtime` fallback; legacy `strategy` / `lens` values may render only when supplied by quarantined compatibility projections and are not a live D98 runtime contract; (3) model label + a context-usage gauge; (4) other extensions' statuses, then a trailing blank line.
- **Title** (`formatChromeTitle`): `brunch — <project>` or `brunch — <project> · <spec>`.
- **Startup header**: rendered via `BrunchStartupHeader` only when `startupHeader` is set; installed for every non-cancel launch activation so the shell never falls back to Pi's quiet empty header. The header composes an identity block plus, conditional on decision, a rounded-box welcome element (F13: `newSpec`/`newSession`) or a rounded-box resume state/status element (F16a: `openSession`).

## Telemetry & refresh

`footerTelemetryFromContext` reads at render time: `sessionName` (overrides the launch-time label after `/name`), live context usage, model, thinking level, and the projected agent state (`projectBrunchAgentState`). The footer surfaces also read `footerData.getExtensionStatuses()` and `getAvailableProviderCount()`. `registerBrunchChrome` re-renders the footer on `model_select`, `thinking_level_select`, and `turn_end`, and exposes a refresh trigger via `bindChromeRefresh`.

## Status-key policy

Chrome never publishes a `brunch.chrome` status key (test-locked) — it filters that key out (`sanitizeChromeStatuses`) and renders only other extensions' statuses. `ctx.ui.setStatus(key, text)` stays a lateral contribution channel for other extensions and future dynamic Brunch state. The former `brunch.kick` status key was retired 2026-07-03 (F14): kick activity now drives Pi's `ctx.ui.setWorkingMessage(...)` from the origination-decision callback in `app/brunch-tui.ts`, and chrome resets the message to the default in its `turn_end` handler so a kick-scoped message never leaks into a later turn.

## RPC visibility

Header, footer, and working-indicator are TUI-only in current Pi RPC mode; only the terminal title and sidecar/widget-compatible string arrays cross to RPC clients.

## Dependency direction

Imports `projections/session` (runtime-state), `session/` types, and `.pi/components/chrome-header`. Adapter layer — does not import `db/`, `rpc/`, `web/`, or `app/`. Launch facts flow `app/ → chrome` one-way through `BrunchChromeState`.

## Migration notes

- The startup-header expand affordance was removed 2026-06-11 (no advertised unwired behavior); it may return only with a real input path.
- `getGitBranch` is no longer read by the footer compositor.

Tests: [`src/app/__tests__/brunch-tui.test.ts`](../../../app/__tests__/brunch-tui.test.ts) ("requests startup header chrome for every activated launch decision"; `brunch.chrome` widget absence).
