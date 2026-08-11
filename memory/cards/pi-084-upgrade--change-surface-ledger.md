# Pi 0.84.x change-surface sweep

Frontier: pi-084-upgrade
Status:   active
Mode:     sweep
Created:  2026-08-11

## Orientation

- The containing seam is brunch's entire consumption surface over `@earendil-works/pi-coding-agent`, `pi-ai`, and `pi-tui` — 210 importing files and ~110 distinct imported symbols, pinned at `0.83.0` on `next`.
- FE-1352 `pi-084-upgrade` is the containing coverage frontier. It stacks on FE-1348 and is gated on that frontier's five open required rows, because FE-1348's closed inventory is this sweep's regression oracle. Do not begin rows until that evidence lands.
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

The closed enumeration derives from three inputs, all available now: the distinct symbol set brunch imports from `@earendil-works/*` (import graph); the published 0.84.0 and 0.84.1 release notes; and a direct `.d.ts` diff of 0.83.0 (installed) against 0.84.1 (packed to scratch). The third input is what caught row C1, and is why the first two alone are not sufficient.

### Classification

**Evidence-gated.** The inventory is fully enumerable now, but the decisive rows cannot close by type-checking: B1/B2 read Pi events through structural casts that no type-aware lint sees through, so they need fresh witness evidence on the new baseline. Row C1 by contrast fails loudly and is buildable-now once the bump lands.

### Aggregate definition of done

- Every `●` row is `have` or `built`; none remains `partial`, `spec`, or `new`.
- `npm run check` and `npm run verify:full` pass on `0.84.1`.
- The four `session-runtime-contract-*.slow.test.ts` witnesses and the required FE-1348 subset re-pass on the moved baseline.
- Every `G` row carries a recorded verdict — adopted, promoted with a named owner, or declined with rationale.
- No `●` row's closure rests on an untyped structural cast.
- `npm run check:release-pack` passes and the three advisory families are absent from `package-lock.json`.
- A25-L is updated to validated or falsified with evidence.

## Ledger

### A · Runtime, session construction, and auth

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| Version pins + lockfile move to 0.84.1 | `spec` | ● | `earned` | `package.json`, `package-lock.json` | Three pins: `pi-ai`, `pi-coding-agent`, `pi-tui`. Closure oracle: `npm run check` clean and 0 occurrences of `brace-expansion-5.0.7`, `undici-8.5.0` in the lockfile. |
| `ModelRuntime` / `ModelRegistry` construction + `refresh()` | `partial` | ● | `earned` | `src/probes/faux-provider.ts:35`, `src/probes/executor-agent-runner-witness.ts:99` | `refresh()` now returns `ModelsRefreshResult`; `allowNetwork` survives in `ModelsRefreshOptions` (verified in pi-ai 0.84.1 `dist/models.d.ts:29`). Both sites discard the result. Closure: existing probe tests green + result's `errors` map surfaced or explicitly declined. |
| `getApiKeyAndHeaders()` null-preserving `ProviderHeaders` | `partial` | ● | `earned` | `src/.pi/extensions/compaction/registrar.ts:24` | Values are now `string \| null`, preserving deletion markers; brunch forwards `auth.headers` into `compact()` → `provider.streamSimple`. Closure: compaction tests green **and** a check that nothing strips nulls en route. |
| Direct `compact()` call site | `have` | ● | `earned` | `src/.pi/extensions/compaction/registrar.ts` | 0.84.0 changed compaction dispatch to route extension model calls through the coding-agent model runtime. Closure: existing compaction suite green; confirm brunch's direct call is still the sanctioned shape. |
| Session construction factories | `have` | ● | `earned` | `src/app/`, `src/dev/tier-2-harness.ts` | `createAgentSession*`, `CreateAgentSessionRuntimeFactory`, `createAgentSessionServices`. Closure: type-check plus `brunch-tui` and `tier-2-harness` suites. |
| `SessionManager` / JSONL entry types | `have` | ● | `earned` | `src/session/` | `SessionEntry`, `SessionHeader`, `SessionMessageEntry`, `CustomEntry`. 0.84.0 changed JSONL fork/torn-tail publication to be atomic and scoped session ids per-cwd. Closure: `src/session/__tests__/jsonl-session-viability.test.ts` green. |
| `InMemoryCredentialStore` | `have` | ● | `earned` | `src/dev/`, probes | 0.84.0 serialized concurrent credential mutations and added `CredentialSynchronizationError`. Closure: type-check + dev-harness suites. |

### B · Event and projection seam — highest risk

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| In-process cumulative `message` on `message_update` | `partial` | ● | `proving` | `src/projections/session/live-session-events.ts` | **The central hazard.** 0.84.0 strips cumulative `message`/`partial` from the **JSON/RPC wire only**; the in-process `MessageUpdateEvent` still declares `message: AgentMessage` (0.84.1 `dist/core/extensions/types.d.ts:568`). This projection is fed in-process from `tui-live-session-adapter.ts` and `brunch-web.ts`, so it likely survives — but it reads the field through `event as { message?: … }`, so a shape change returns `null` for every update and silently emits zero deltas. Closure oracle: `session-runtime-contract-companion.slow.test.ts` + `-structured-ask` re-pass, **not** the type checker. |
| Subagent stream-update read | `partial` | ● | `proving` | `src/.pi/extensions/subagents/session.ts:509` | Same hazard, fully untyped (`asRecord(shaped['message'])`). Failure mode is silent loss of subagent stream previews. Closure: subagent suite green **with** an assertion that a preview is actually produced, not merely that nothing throws. |
| Wire-side JSON/RPC event consumers | `partial` | ● | `proving` | `src/dev/__tests__/web-driver-streaming*.ts` | These read relay frames (`frame.params.event.type`) and sit on the side the breaking change actually targets. brunch never calls `toJsonEvent`, so its own semantic projection is what crosses the wire — confirm, do not assume. Closure: streaming + reconnect suites green. |
| Typed-seam hardening for B1–B3 | `spec` | ● | `earned` | `docs/praxis/pi-types.md` | Convert the load-bearing casts to typed imports so the *next* bump fails at the type checker instead of at runtime. This is the row that discharges A25-L's real cost. Closure: no `●` row above retains a structural cast as its only guard. |

### C · pi-tui component surface

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| `TUI` class → interface | `spec` | ● | `earned` | 13 files, 30 `new TUI(` sites | **Breaking, and absent from the published Breaking Changes list.** 0.83.0: `export declare class TUI extends Container`. 0.84.1: `export interface TUI extends Component`, with `TuiMainScreen implements TUI` and `TuiAltScreen implements ViewportTUI` as the concrete classes. 14 value-imports break at import, not just at type. Production sites: `src/.pi/components/workspace-dialog/preflight.ts:24`, `src/dev/component-preview.ts`. Closure: all sites construct a named concrete class and the component/harness suites are green. Fails loudly — that is the good case. |
| `Markdown` / `MarkdownTheme` / `getMarkdownTheme` | `partial` | ● | `proving` | `src/.pi/components/exchange-markdown-body.ts`, `cards.ts` | 0.84.0 added Mermaid and LaTeX rendering inside markdown. brunch renders exchange bodies through this; goldens may shift. Closure: existing golden/preview suites green, or goldens deliberately regenerated per the repo's pre-release posture. |
| `Editor` / `CustomEditor` / autocomplete | `partial` | ● | `earned` | `src/.pi/components/brunch-editor.ts`, `mode-input.ts`, `exchange-answer-editor.ts` | 0.84.0 fixed custom editors not inheriting the default autocomplete dropdown limit, and added Ctrl-modified editor bindings. Closure: editor harness suites green. |
| Keybindings surface | `have` | ● | `earned` | `src/app/pi-keybindings.ts` | `KeybindingsManager`, `TUI_KEYBINDINGS`, `matchesKey`, `isKeyRelease`. 0.84.0/0.84.1 added prompt-history and fullscreen-viewport bindings. Closure: keybinding suite green; confirm no brunch binding is shadowed by a new default. |
| `Terminal` / `ProcessTerminal` / width utils | `have` | ● | `earned` | `src/.pi/components/`, `virtual-terminal.ts` | `truncateToWidth`, `visibleWidth` retained; 0.84.1 adds `stripTerminalSequences`, `getOsc8LinkAtColumn`. Indic grapheme width and OSC 8 truncation changed. Closure: virtual-terminal-backed component suites green. |
| Theme surface | `have` | ○ | `earned` | `src/.pi/components/mode-border-theme.ts`, `tui-lab/` | New optional `scrollbarThumb` color; additive. Deferred unless C1 forces a theme touch. |

### D · Extension surface

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| `ExtensionAPI` / context shape / event-bus disposal | `have` | ● | `earned` | `src/.pi/extensions/` | 0.84.0 fixed extension event-bus listeners surviving session reloads and disposal — brunch registers many. Closure: extension suites green, including `ask-runtime-mount.test.ts`. |
| Tool definitions and built-in tool factories | `have` | ● | `earned` | `src/.pi/extensions/`, executor | `defineTool`, `create{Find,Grep,Ls,Read}Tool*`. 0.84.0 changed `find` glob/root path handling and tool argument validation for `anyOf`/`oneOf` unions. Closure: tool suites green. |
| Skills and resource loading | `have` | ● | `earned` | `src/agents/skills/registry.ts` | `loadSkills`, `ResourceLoader`, `DefaultResourceLoader`. 0.84.0 fixed recursive skill loading paths and malformed resource arrays crashing startup. Closure: skills registry suite green. |

### E · Test substrate and witnesses

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| Faux provider registration | `have` | ● | `earned` | `src/probes/faux-provider.ts` | **Verified no-impact at scope time:** brunch's `ProviderConfig` is a static `models` array plus an optional `streamSimple` override — no `refreshModels`, no `context.store`. The provider-refresh `store`→`stored`/`publish()` break does not reach it. Closure: faux-harness suite green. |
| `InteractiveMode` production composition | `partial` | ● | `proving` | `src/app/brunch-tui.ts` | D141-L's normal-TUI composition and the `process.on('exit')` writer release (I64-L carried finding) both ride this. 0.84.0's fullscreen work refactored the TUI base classes underneath it. Closure: `session-runtime-contract-tracer.slow.test.ts` re-passes including the bounded-cleanup leaf. |
| The four convergence witnesses | `partial` | ● | `proving` | `src/app/__tests__/session-runtime-contract-*.slow.test.ts` | tracer · companion · structured-ask · authority. These are the only oracles that would catch a silent B1 regression. Closure: all four green on 0.84.1 under `npm run test:slow:core`. |
| Required FE-1348 subset re-run | `spec` | ● | `proving` | FE-1348 ledger | Differential against the frozen 0.83.0 baseline. Closure: the required rows that touch Pi surfaces re-pass; divergences become findings, not silent updates. |

### F · Verified no-impact (closed at scope time, evidence recorded)

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| agent-core v4 `Session`/`SessionStorage`/`SessionRepo` | `have` | ● | `earned` | — | Largest changelog item. Zero call sites: no `AgentHarness`, `SessionRepo`, `JsonlSessionRepo`, or `InMemorySessionRepo` anywhere in `src/`. Re-confirm by grep after the bump; do not re-audit. |
| Required `FileSystem.renameFile()` | `have` | ● | `earned` | — | No custom harness `FileSystem` implementation exists. |
| `ModelsStreamTransforms` → `ModelsRequestTransforms` | `have` | ● | `earned` | — | Zero call sites. |
| `setRuntimeApiKey()` signature | `have` | ● | `earned` | — | Zero call sites on `next`; this is `main`/PR #422's migration, not ours. |
| `RemoteSession.sessions` → `SessionMetadata` | `have` | ● | `earned` | — | Zero call sites; relevant only if G1 adopts the client surface. |

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
| Vendor-neutral telemetry contracts | `new` | ● | `earned` | Horizon `mechanism-trace` / `agent-tracing` | Verdict only; those Horizon items are trigger-gated and this is a candidate trigger. |
| `samplingParams` / vLLM `thinking_token_budget` | `new` | ○ | `earned` | model config | Deferred — no current brunch need. Record the decline. |
| Fullscreen TUI mode as a product feature | `new` | ○ | `earned` | Horizon | Deferred and explicitly out of boundary. Row C1 covers only the *forced* construction change, not adopting the mode. |

## Row discipline

- Rows E2, E3, and F re-confirm existing contracts; they close by re-running named suites, never by re-auditing.
- Rows B1–B3 do **not** close on a green type-check. Their oracle is a witness that asserts output is *produced*, not merely that nothing throws.
- A row that turns out to need its own full card spawns a sibling `single` file under `memory/cards/`; leave the pointer in that row's Owner cell rather than fattening this ledger.
- The list is closed. Scoping already widened it once (C1, and the C/D/E sub-seams generally) relative to the frontier's original changelog-driven framing — that reconciliation is recorded in `memory/PLAN.md`. If execution discovers **more than one** further genuinely-missing row or a new sub-seam, stop and route back through `ln-plan`.

## Execution order

1. Land the version pins and lockfile (row A1); capture the advisory-clearance evidence immediately, before any adaptation muddies the diff.
2. Take the loud failures first: row C1, then the rest of C and D. These fail at the type checker and bound the mechanical work.
3. Take A2–A7 — small, settled, type-guided.
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
└── app/__tests__/session-runtime-contract-*.slow.test.ts ?   # E3, only if contracts move
memory/
├── PLAN.md                                               ~
├── SPEC.md                                               ~   # A25-L disposition
└── cards/pi-084-upgrade--change-surface-ledger.md        ~
```
