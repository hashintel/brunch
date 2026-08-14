# Pi 0.84.x change-surface sweep

Frontier: pi-084-upgrade
Status:   active
Mode:     sweep
Created:  2026-08-11

## Orientation

- The containing seam is brunch's entire consumption surface over `@earendil-works/pi-coding-agent`, `pi-ai`, and `pi-tui` — 210 importing files and ~110 distinct imported symbols, pinned at `0.83.0` on `next`; the execution-start target is the current common package-family release, `0.84.2`.
- FE-1352 `pi-084-upgrade` is the containing coverage frontier. It stacks on completed FE-1348 and uses that frontier's closed inventory as its regression oracle; the evidence gate is satisfied.
- No `HANDOFF.md` exists. `main`'s PR #422 is a separate trunk's bump and is not this frontier's work; its migration target (`src/orchestrator/src/pi-actions.ts`) does not exist on `next`.
- Main risk: **the changelog is not the inventory.** Scoping found a hard breaking change absent from the published Breaking Changes section (row C1), so rows are enumerated from brunch's import graph — which is closed and derivable — not from changelog entries.

Posture: proving (inherited from `pi-084-upgrade`).

Cross-cutting obligations:

- I64-L single-writer authority and I65-L target-addressed semantic convergence must still hold on the moved baseline; the four `session-runtime-contract-*.slow.test.ts` witnesses are their oracle.
- D19-L's stream↔transcript differential (assembled `message_update` deltas == flushed JSONL) is the linchpin the event rows must preserve — `src/rpc/TOPOLOGY.md:400`.
- Canonical truth stays SQLite graph state plus active-branch Pi JSONL; no row may introduce a second store.
- The `PiClient`/`RemoteSession` verdict (row G1) is owed to the `shared-session-host-convergence` arc before `shared-session-host-cutover` deletes anything.
- Per `docs/praxis/pi-types.md`, a row does not close while its only guard is an untyped structural cast.

## Sweep preflight

### Boundary

**Included:** the three pinned packages plus lockfile; every brunch sub-seam that consumes a Pi symbol, enumerated from the import graph; typed-seam hardening wherever a load-bearing Pi seam is read through a structural cast; a recorded adopt/promote/decline verdict for each new-API area; re-run of FE-1321's four slow witnesses and the required FE-1348 subset; the `brace-expansion` 5.0.9 / `undici` 8.9.0 advisory clearance on `next`.

**Excluded:** adopting `RemoteSession`/`PiClient` into production (verdict only — the build belongs to `shared-session-host-cutover`); adopting fullscreen TUI mode as a product feature (row C1 covers only the forced construction change); any new product capability; changes to the Pi source-alias dev workflow; `main`'s PR #422; provider-quality campaigns and KA-owned evidence.

### Source-of-truth inputs

The closed enumeration derives from three inputs, all available now: the distinct symbol set brunch imports from `@earendil-works/*` (import graph); the published 0.84.0–0.84.2 release notes; and direct `.d.ts` diffs of 0.83.0 (installed) against 0.84.1 plus 0.84.1 against 0.84.2 (both packed to scratch). The type surfaces caught row C1 and the 0.84.2 SettingsManager row even though neither appeared as a published breaking change, which is why release notes and imports alone are insufficient.

### 0.84.2 execution-start refresh — 2026-08-14

- npm reports `0.84.2` as the latest common release of all three pinned packages; this sweep therefore targets exactly `0.84.2`, not the `0.84.1` available when it was first scoped.
- The incremental 0.84.1→0.84.2 `.d.ts` diff found no removal or required-signature break on a Brunch callsite. In-process `MessageUpdateEvent.message` remains required; Pi's JSON/RPC event instead regains constant-size cumulative `usage`.
- One new required adaptation surfaced: Pi added `SettingsManager.getDefaultTools()` and `getFullscreenExitOutput()`. Brunch deliberately audits the complete getter surface, so `BRUNCH_SETTINGS_AUDITED_GETTERS` must acknowledge both and the tool-default policy must remain sealed.
- Other additions amend existing component, runtime, and disposition rows below rather than opening another sub-seam: fullscreen search/exit behavior and optional search theme roles; explicit `sendUserMessage(..., { expandPromptTemplates })`; experimental strict schema sampling for default built-ins; and optional `ToolCall.namespace` / `AssistantMessage.endTurn` diagnostics.

### Classification

**Evidence-gated.** The inventory is fully enumerable now, but the decisive rows cannot close by type-checking: B1/B2 read Pi events through structural casts that no type-aware lint sees through, so they need fresh witness evidence on the new baseline. Row C1 by contrast fails loudly and is buildable-now once the bump lands.

### Aggregate definition of done

- Every `●` row is `have` or `built`; none remains `partial`, `spec`, or `new`.
- `npm run check` and `npm run verify:full` pass on `0.84.2`.
- The four `session-runtime-contract-*.slow.test.ts` witnesses and the required FE-1348 subset re-pass on the moved baseline.
- Every `G` row carries a recorded verdict — adopted, promoted with a named owner, or declined with rationale.
- No `●` row's closure rests on an untyped structural cast.
- `npm run check:release-pack` passes and the two Pi-local advisory families are cleared in `package-lock.json`.
- A25-L is updated to validated or falsified with evidence.

## Ledger

### A · Runtime, session construction, and auth

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| Version pins + lockfile move to 0.84.2 | `partial` | ● | `earned` | `package.json`, `package-lock.json` | Three exact pins and the lockfile moved to 0.84.2; ordinary `npm install` materialized all three root Pi packages at 0.84.2, confirmed by their installed manifests and `npm ls --depth=0`. Parsed `package-lock.json` `packages` evidence: Pi-local `brace-expansion` is 5.0.9 and Pi-local `undici` is 8.9.0. Closure is blocked on the moved baseline: `npm run check` exits 1 on row C1's `TUI` class→interface failures (`TS1484`/`TS2693` across production and test construction sites) and row A3's null-preserving `ProviderHeaders` incompatibility at `src/.pi/extensions/compaction/registrar.ts:40` (`TS2345`). Those rows own the fixes; A1 must remain partial until the sweep restores the check. Release intent: patch changeset `.changeset/fresh-pi-baseline.md`. |
| `ModelRuntime` / `ModelRegistry` construction + `refresh()` | `partial` | ● | `earned` | `src/probes/faux-provider.ts:35`, `src/probes/executor-agent-runner-witness.ts:99` | `refresh()` now returns `ModelsRefreshResult`; `allowNetwork` survives in `ModelsRefreshOptions` (verified in pi-ai 0.84.2 `dist/models.d.ts`). Both sites discard the result. Closure: existing probe tests green + result's `errors` map surfaced or explicitly declined. |
| `getApiKeyAndHeaders()` null-preserving `ProviderHeaders` | `partial` | ● | `earned` | `src/.pi/extensions/compaction/registrar.ts:24` | Values are now `string \| null`, preserving deletion markers; brunch forwards `auth.headers` into `compact()` → `provider.streamSimple`. Closure: compaction tests green **and** a check that nothing strips nulls en route. |
| Direct `compact()` call site | `have` | ● | `earned` | `src/.pi/extensions/compaction/registrar.ts` | 0.84.0 changed compaction dispatch to route extension model calls through the coding-agent model runtime. Closure: existing compaction suite green; confirm brunch's direct call is still the sanctioned shape. |
| Session construction factories | `have` | ● | `earned` | `src/app/`, `src/dev/tier-2-harness.ts` | `createAgentSession*`, `CreateAgentSessionRuntimeFactory`, `createAgentSessionServices`. Closure: type-check plus `brunch-tui` and `tier-2-harness` suites. |
| `SessionManager` / JSONL entry types | `have` | ● | `earned` | `src/session/` | `SessionEntry`, `SessionHeader`, `SessionMessageEntry`, `CustomEntry`. 0.84.0 changed JSONL fork/torn-tail publication to be atomic and scoped session ids per-cwd. Closure: `src/session/__tests__/jsonl-session-viability.test.ts` green. |
| `InMemoryCredentialStore` | `have` | ● | `earned` | `src/dev/`, probes | 0.84.0 serialized concurrent credential mutations and added `CredentialSynchronizationError`. Closure: type-check + dev-harness suites. |
| `SettingsManager` getter/default-policy refresh | `spec` | ● | `earned` | `src/app/pi-settings.ts`, `src/app/__tests__/brunch-tui.test.ts` | 0.84.2 adds `getDefaultTools()` and `getFullscreenExitOutput()`. Brunch's completeness oracle intentionally fails on every unaudited getter. Closure: acknowledge both getters; prove ambient `defaultTools` cannot widen Brunch's explicit `noTools`/allowlist policy; pin neither default unless a product requirement needs it. |

### B · Event and projection seam — highest risk

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| In-process cumulative `message` on `message_update` | `partial` | ● | `proving` | `src/projections/session/live-session-events.ts` | **The central hazard.** 0.84.0 strips cumulative `message`/`partial` from the **JSON/RPC wire only**; the in-process `MessageUpdateEvent` still declares `message: AgentMessage` in 0.84.2. This projection is fed in-process from `tui-live-session-adapter.ts` and `brunch-web.ts`, so it likely survives — but it reads the field through `event as { message?: … }`, so a shape change returns `null` for every update and silently emits zero deltas. Closure oracle: `session-runtime-contract-companion.slow.test.ts` + `-structured-ask` re-pass, **not** the type checker. |
| Subagent stream-update read | `partial` | ● | `proving` | `src/.pi/extensions/subagents/session.ts:509` | Same hazard, fully untyped (`asRecord(shaped['message'])`). Failure mode is silent loss of subagent stream previews. Closure: subagent suite green **with** an assertion that a preview is actually produced, not merely that nothing throws. |
| Wire-side JSON/RPC event consumers | `partial` | ● | `proving` | `src/dev/__tests__/web-driver-streaming*.ts` | These read relay frames (`frame.params.event.type`) and sit on the side the breaking change actually targets. 0.84.2 restores cumulative `usage` to Pi JSON/RPC `message_update` while still omitting cumulative `message`; Brunch imports neither `toJsonEvent` nor Pi's JSON-event types, so its own semantic projection should cross the wire. Confirm, do not assume. Closure: streaming + reconnect suites green and prove the relay carries Brunch deltas rather than raw Pi JSON events. |
| Typed-seam hardening for B1–B3 | `spec` | ● | `earned` | `docs/praxis/pi-types.md` | Convert the load-bearing casts to typed imports so the *next* bump fails at the type checker instead of at runtime. This is the row that discharges A25-L's real cost. Closure: no `●` row above retains a structural cast as its only guard. |

### C · pi-tui component surface

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| `TUI` class → interface | `built` | ● | `earned` | 13 files, 30 former `new TUI(` sites | **Breaking, and absent from the published Breaking Changes list.** All 30 non-fullscreen constructions now use Pi's public `TuiMainScreen` export; no fullscreen behavior was adopted. Focused component/harness verification: 10 files passed, 1 skipped; 77 tests passed, 1 pre-existing skipped. `npm run check` now reaches only row A3's separately owned `ProviderHeaders` TS2345 failure. |
| `Markdown` / `MarkdownTheme` / `getMarkdownTheme` | `built` | ● | `proving` | `src/.pi/components/exchange-markdown-body.ts`, `cards.ts` | 0.84.0 added Mermaid and LaTeX rendering inside markdown. Brunch's current exchange/card semantics remain correct without adopting or styling those capabilities: all 25 focused component test files passed (132 tests), including the existing snapshot, and the explicit card/exchange-answer/component-preview subset passed (3 files, 6 tests). No rendered output or golden changed. |
| `Editor` / `CustomEditor` / autocomplete | `built` | ● | `earned` | `src/.pi/components/brunch-editor.ts`, `mode-input.ts`, `exchange-answer-editor.ts` | Brunch preserves its existing editor semantics on Pi 0.84.2 without adaptation. The focused real-TUI/editor subset passed 4 files and 17 tests with no skips, covering typed input, programmatic text, boxed autocomplete at multiple widths, multiline input, submit, cancel/Escape, empty-submit warning, and inherited Ctrl-D behavior. |
| Keybindings surface | `built` | ● | `earned` | `src/app/pi-keybindings.ts` | Brunch's existing policy and input semantics need no adaptation on Pi 0.84.2. Focused verification passed 3 files and 31 tests with no skips, covering the live `KeybindingsManager` policy, `TUI_KEYBINDINGS`-backed editor input, `matchesKey`, and the component-preview `isKeyRelease` guard. Default audit: prompt-history and fullscreen line-scroll remain unbound; transcript search is fullscreen-only. Its `ctrl+g` next-match key overlaps Pi's `app.editor.external`, but the fullscreen viewport listener owns that key only while search is active, and Brunch remains on regular `TuiMainScreen`; therefore no active Brunch binding is shadowed. `npm run check` reaches only row A3's separately owned `ProviderHeaders` TS2345. |
| `Terminal` / `ProcessTerminal` / width utils | `built` | ● | `earned` | `src/.pi/components/`, `virtual-terminal.ts` | Brunch preserves its virtual-terminal-backed rendering and input semantics on Pi 0.84.2 without production adaptation. All 7 focused virtual-terminal/component/editor files passed (21 tests, no skips): a lone Escape still reaches `CustomEditor.onEscape`, while an `ESC+b` Alt sequence moves by one word without firing Escape. `PI_TUI_ESC_TIMEOUT` therefore remains an upstream `ProcessTerminal` latency control; Brunch's test terminal correctly forwards already-buffered chunks and needs no timeout emulation. Focused width oracles pin the changed Indic grapheme widths (`क्ष` = 2, `क्षेत्र` = 4) and OSC 8 truncation: `truncateToWidth` keeps the link over retained text, closes it before the ellipsis, and `visibleWidth` remains bounded. The broader width/render subset passed 10 files (43 tests, no skips). `npm run check` reaches only row A3's separately owned `ProviderHeaders` TS2345. |
| Theme surface | `partial` | ○ | `earned` | `src/.pi/themes/`, `src/dev/component-preview/theme.ts` | 0.84.x adds optional `scrollbarThumb`, `searchMatchText`, and `searchMatchBg` roles. Brunch's preview palette casts parsed colors to a total `Record<ThemeColor, string>` although shipped themes omit the new optional search role; safe for the current main-screen preview but worth a focused compile/render check. Do not add colors merely for symmetry. |

### D · Extension surface

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| `ExtensionAPI` / context shape / event-bus disposal | `have` | ● | `earned` | `src/.pi/extensions/` | 0.84.0 fixed extension event-bus listeners surviving session reloads and disposal — brunch registers many. Closure: extension suites green, including `ask-runtime-mount.test.ts`. |
| Tool definitions and built-in tool factories | `have` | ● | `earned` | `src/.pi/extensions/`, executor | `defineTool`, `create{Find,Grep,Ls,Read}Tool*`. 0.84.0 changed `find` glob/root path handling and tool argument validation for `anyOf`/`oneOf` unions. Closure: tool suites green. |
| Skills and resource loading | `have` | ● | `earned` | `src/agents/skills/registry.ts` | `loadSkills`, `ResourceLoader`, `DefaultResourceLoader`. 0.84.0 fixed recursive skill loading paths and malformed resource arrays crashing startup. Closure: skills registry suite green. |
| 0.84.2 session dispatch and system-prompt fixes | `partial` | ● | `earned` | `src/.pi/extensions/`, `src/agents/runtime/`, `src/app/` | `sendUserMessage()` gains explicit command/skill/template expansion control; `sendMessage(..., { triggerTurn: false })` and custom-system-prompt concatenation are fixed upstream. Brunch's public RPC prompts already use `session.prompt(..., { expandPromptTemplates: false })`, and its only extension `sendUserMessage` call sends literal proof text. Closure: existing command/runtime-system-prompt suites green and no product path opts into ambient expansion. |

### E · Test substrate and witnesses

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| Faux provider registration | `have` | ● | `earned` | `src/probes/faux-provider.ts` | **Verified no-impact at scope time:** brunch's `ProviderConfig` is a static `models` array plus an optional `streamSimple` override — no `refreshModels`, no `context.store`. The provider-refresh `store`→`stored`/`publish()` break does not reach it. Closure: faux-harness suite green. |
| `InteractiveMode` production composition | `partial` | ● | `proving` | `src/app/brunch-tui.ts` | D141-L's normal-TUI composition and the `process.on('exit')` writer release (I64-L carried finding) both ride this. 0.84.0 refactored the TUI base classes; 0.84.2 adds optional fullscreen exit output and mounts managed-tool download status inside the TUI. Closure: `session-runtime-contract-tracer.slow.test.ts` re-passes including startup and bounded-cleanup leaves. |
| The four convergence witnesses | `partial` | ● | `proving` | `src/app/__tests__/session-runtime-contract-*.slow.test.ts` | tracer · companion · structured-ask · authority. These are the only oracles that would catch a silent B1 regression. Closure: all four green on 0.84.2 under `npm run test:slow:core`. |
| Required FE-1348 subset re-run | `spec` | ● | `proving` | FE-1348 ledger | Differential against the frozen 0.83.0 baseline. Closure: the required rows that touch Pi surfaces re-pass; divergences become findings, not silent updates. |

### F · Verified no-impact (closed at scope time, evidence recorded)

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| agent-core v4 `Session`/`SessionStorage`/`SessionRepo` | `have` | ● | `earned` | — | Largest changelog item. Zero call sites: no `AgentHarness`, `SessionRepo`, `JsonlSessionRepo`, or `InMemorySessionRepo` anywhere in `src/`. Re-confirm by grep after the bump; do not re-audit. |
| Required `FileSystem.renameFile()` | `have` | ● | `earned` | — | No custom harness `FileSystem` implementation exists. |
| `ModelsStreamTransforms` → `ModelsRequestTransforms` | `have` | ● | `earned` | — | Zero call sites. |
| `setRuntimeApiKey()` signature | `have` | ● | `earned` | — | Zero call sites on `next`; this is `main`/PR #422's migration, not ours. |
| `RemoteSession.sessions` → `SessionMetadata` | `have` | ● | `earned` | — | Zero call sites; relevant only if G1 adopts the client surface. |
| 0.84.2 no-impact type surface | `have` | ● | `earned` | — | Zero direct callsites for breaking `ensureTool()` callback-signature change or additive `ScrollView.scrollTo()` options, Cloudflare binding helpers, constrained-sampling helpers, and fullscreen search classes. Optional `ToolCall.namespace` and `AssistantMessage.endTurn` are safely ignored by current transcript/projection readers. Re-confirm by grep after the bump; do not create adapters. |

### G · New-API disposition — verdict required, adoption not assumed

Each row closes on a recorded verdict: **adopted** (folded into this sweep), **promoted** (named owner + re-entry trigger), or **declined** (rationale). Adoption is in-scope here only when it removes an existing brunch workaround or is required for parity.

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| `PiClient` / `RemoteSession` / CBOR / Unix-socket transport | `new` | ● | `proving` | `shared-session-host-cutover` | **Load-bearing.** Owed to the `shared-session-host-convergence` arc *before* it deletes `SessionEventRelay` and `/rpc/driver`. Does not by itself un-retire A47-L — it is a client for a remote session and says nothing about releasing `InteractiveMode.run()`. Verdict must state whether upstream now ships the seam the arc plans to hand-build. |
| `assistantMessageEvent` deltas as the direct source | `new` | ● | `proving` | row B1 | Upstream removed the cumulative field because it grew quadratically; brunch's prefix-diff re-derivation now works against the grain. Strongest adopt-now candidate — it removes a real workaround and retires the B1 hazard at its root rather than guarding it. |
| `pi.registerMarkdownTransformer()` | `new` | ● | `earned` | `src/.pi/components/` | Display-only markdown transformation; brunch owns heavy custom rendering. Verdict only. |
| `tool_call` `terminate` | `new` | ● | `earned` | executor | Lets all-terminating batches skip the follow-up model call. Verdict only. |
| `AGENTS.override.md` per-directory context | `new` | ● | `earned` | comparison harness | Bears on target isolation in `/compare-specs`. Verdict only; adoption would belong to `comparison-machine-interface-cutover`. |
| `pi auth check` | `new` | ● | `earned` | comparison harness, release-pack smoke | Credential preflight. Verdict only. |
| `AgentOptions.shouldStopAfterTurn` | `new` | ● | `earned` | executor | Graceful stop after a completed turn. Verdict only. |
| Vendor-neutral telemetry contracts | `new` | ● | `earned` | Horizon `mechanism-trace` / `agent-tracing` | Verdict only; those Horizon items are trigger-gated and this is a candidate trigger. 0.84.2's optional `ToolCall.namespace` and `AssistantMessage.endTurn` are related diagnostics inputs, not reasons to build telemetry here. |
| Configurable `defaultTools` + experimental strict built-in sampling | `new` | ● | `earned` | row A8, tool policy | Verdict required. Brunch currently disables built-ins or supplies explicit allowlists, and strict sampling covers Pi's default read/bash/edit/write tools only; adoption must not widen Brunch tool authority. |
| `sendUserMessage(..., { expandPromptTemplates })` | `new` | ● | `earned` | row D4 | Verdict required. Product machine-control paths intentionally suppress ambient command/resource expansion; adopt only if a named Brunch-owned command-dispatch path needs it. |
| `samplingParams` / vLLM `thinking_token_budget` | `new` | ○ | `earned` | model config | Deferred — no current Brunch need. Record the decline. |
| Fullscreen TUI mode, transcript search, exit output, and per-run theme | `new` | ○ | `earned` | Horizon | Deferred and explicitly out of boundary. Rows C1/C4/C6 and E2 cover only forced compatibility and regression checks, not adopting fullscreen product behavior. |

## Row discipline

- Rows E2 and E3 re-confirm existing contracts by rerunning their named witnesses. F rows remain closed unless their named post-bump grep/reconfirmation contradicts the recorded no-impact evidence.
- Rows B1–B3 do **not** close on a green type-check. Their oracle is a witness that asserts output is *produced*, not merely that nothing throws.
- A row that turns out to need its own full card spawns a sibling `single` file under `memory/cards/`; leave the pointer in that row's Owner cell rather than fattening this ledger.
- The list is closed at the 0.84.2 execution-start target. Scoping first widened it for C1 and the C/D/E sub-seams; the 2026-08-14 refresh added only the required SettingsManager policy row and folded every other 0.84.2 delta into existing sub-seams. If execution discovers **more than one** further genuinely-missing row or a new sub-seam, stop and route back through `ln-plan`.

## Execution order

1. Land the version pins and lockfile (row A1); capture the advisory-clearance evidence immediately, before any adaptation muddies the diff.
2. Take the loud failures first: row C1, then the rest of C and D. These fail at the type checker and bound the mechanical work.
3. Take A2–A8 — small, settled, type-guided; the SettingsManager completeness test should make A8 loud.
4. Take B1–B3 with witnesses, not types. Then B4 hardens the seams so the next bump is loud.
5. Re-run E2/E3, then the required FE-1348 subset as a differential.
6. Record every G verdict. Promote what needs design; decline what does not, with rationale.
7. Reconcile `memory/PLAN.md` and A25-L in `memory/SPEC.md` to the evidence actually obtained.

## Expected touched paths (tentative)

```text
package.json                                              ~
package-lock.json                                         ~
.changeset/                                               +
src/
├── projections/session/live-session-events.ts            ~   # B1
├── .pi/
│   ├── extensions/subagents/session.ts                   ~   # B2
│   ├── extensions/compaction/registrar.ts                ~   # A3
│   └── components/
│       ├── workspace-dialog/preflight.ts                 ~   # C1 production
│       ├── exchange-markdown-body.ts                     ?   # C2 goldens
│       └── __tests__/                                    ~   # C1 harnesses
├── dev/
│   ├── component-preview.ts                              ~   # C1 production
│   └── __tests__/web-driver-streaming*.ts                ~   # B3
├── probes/
│   ├── faux-provider.ts                                  ~   # A2
│   └── executor-agent-runner-witness.ts                  ~   # A2
└── app/
    ├── pi-settings.ts                                    ~   # A8
    ├── __tests__/brunch-tui.test.ts                      ~   # A8
    └── __tests__/session-runtime-contract-*.slow.test.ts ?   # E3, only if contracts move
memory/
├── PLAN.md                                               ~
├── SPEC.md                                               ~   # A25-L disposition
└── cards/pi-084-upgrade--change-surface-ledger.md        ~
```
