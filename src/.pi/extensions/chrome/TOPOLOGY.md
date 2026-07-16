# .pi/extensions/chrome/ — Brunch TUI shell chrome projection

SPEC decisions: D35-L (chrome is a Brunch projection wrapper over Pi UI primitives); D21-L (workspace boot seam supplies the launch facts).

## Owns

Projection of canonical workspace/session facts into Pi's TUI shell surfaces — stable telemetry footer, terminal title, startup identity header, one-time welcome widget, and the persistent input editor — through Brunch-owned chrome installers (`renderBrunchChrome` plus `registerBrunchChrome`'s editor factory). The projection is stateless: it holds no mutable chrome state and derives every surface from the `BrunchChromeState` value it is handed plus render-time telemetry.

## Does NOT own

- Launch/activation choreography and how `BrunchChromeState` is assembled — parent [`.pi/extensions/TOPOLOGY.md`](../TOPOLOGY.md#tui-launch-chrome).
- Session display-name minting (`sessionDisplayName` = `` `${specTitle} — session ${ordinal}` ``) — `session/` (`workspace-session-coordinator.ts`). Chrome only renders whatever label it is given.
- The reusable header widget — [`.pi/components/chrome-header.ts`](../../components/chrome-header.ts).
- Web host, workspace, or activation state — received via `BrunchChromeState`, never read here.

## Public surface

`renderBrunchChrome`, `registerBrunchChrome`, `chromeStateForWorkspace`, `projectBrunchChromeFooterLines`, and the `BrunchChromeState` / `BrunchChromeFooterTelemetry` / `BrunchChromeRenderOptions` types. `registerBrunchChrome` also installs `BrunchEditorComponent` via Pi's `ctx.ui.setEditorComponent` when that UI capability exists; headless/stub contexts are guarded by capability check. The `default` export (`brunchChrome`) exists only for dev `/reload` iteration (D39-L).

## State shape (`BrunchChromeState`)

`cwd` / `spec` / `session` (from `WorkspaceSessionChromeState`), `project?`, `session { id, label? }`, `webSidecarUrl?`, and `startupHeader? { decision: continue | openSession | newSpec | newSession, resumeFacts? }`. The optional `startupHeader.resumeFacts` (`{ specTitle?, nodeCount?, edgeCount?, modeLabel? }`) drives the F16a resume state/status block; it is sampled once at chrome-state assembly time in `app/brunch-tui.ts` and rendered only for `openSession`. The `runtime?` / `build?` / `contextUsage?` / `worker?` / `coherence?` fields are forward-only optional slots; the footer reads `runtime`/`contextUsage` as fallback when telemetry is absent, and `worker`/`coherence`/`build` are defined but not yet rendered. <!-- ceiling: wire or drop the worker/coherence/build slots when that surface actually lands -->

## Render surfaces

- **Input editor**: `registerBrunchChrome` installs `BrunchEditorComponent` through `ctx.ui.setEditorComponent` on `session_start` when present. Its labels and border color are sampled fresh on every render: top-right operational mode and mode-keyed border role from `projectBrunchAgentState(ctx.sessionManager.getBranch())`, bottom-right spec title from `BrunchChromeState`, and a below-line sidecar URL when available.
- **Footer** (`projectBrunchChromeFooterLines`): one dim stable line containing optional `ui: <sidecarUrl> |` followed by `model … | thinking … | context …`, then a trailing blank line. Extension statuses and working messages remain outside these stable fields; supplied telemetry is rendered without changing model-resolution ownership.
- **Title** (`formatChromeTitle`): `brunch — <project>` or `brunch — <project> · <spec>`.
- **Startup identity + welcome**: `BrunchStartupHeader` owns identity/sidecar chrome only. New spec/session activation additionally installs one borderless `BrunchWelcomeCard` widget; resumed, switched, and reloaded sessions install neither welcome widget nor transcript entry.

## Telemetry & refresh

`footerTelemetryFromContext` reads at render time: `sessionName` (overrides the launch-time label after `/name`), live context usage, model, thinking level, and the projected agent state (`projectBrunchAgentState`). The footer surfaces also read `footerData.getExtensionStatuses()` and `getAvailableProviderCount()`. `registerBrunchChrome` re-renders the footer on `model_select`, `thinking_level_select`, `turn_end`, and final `agent_settled`, and exposes a refresh trigger via `bindChromeRefresh`.

## Status-key policy

Chrome never publishes a `brunch.chrome` status key (test-locked) — it filters that key out (`sanitizeChromeStatuses`) and renders only other extensions' statuses. `ctx.ui.setStatus(key, text)` stays a lateral contribution channel for other extensions and future dynamic Brunch state. The former `brunch.kick` status key was retired 2026-07-03 (F14): kick activity now drives Pi's `ctx.ui.setWorkingMessage(...)` from the origination-decision callback in `app/brunch-tui.ts`, and chrome resets the message to the default at `agent_settled`, after retries, compaction retries, and queued continuations are exhausted, so a kick-scoped message never disappears mid-run or leaks into a later user-initiated run.

## RPC visibility

Header, footer, and working-indicator are TUI-only in current Pi RPC mode; only the terminal title and sidecar/widget-compatible string arrays cross to RPC clients.

## Dependency direction

Imports `projections/session` (runtime-state), `session/` types, and `.pi/components/chrome-header`. Adapter layer — does not import `db/`, `rpc/`, `web/`, or `app/`. Launch facts flow `app/ → chrome` one-way through `BrunchChromeState`.

## Migration notes

- The startup-header expand affordance was removed 2026-06-11 (no advertised unwired behavior); it may return only with a real input path.
- `getGitBranch` is no longer read by the footer compositor.

Tests: [`src/app/__tests__/brunch-tui.test.ts`](../../../app/__tests__/brunch-tui.test.ts) ("requests startup header chrome for every activated launch decision"; persistent editor mount through the normal extension bundle; `brunch.chrome` widget absence).
