# Pi UI Extension Patterns

This memo records evidence for the `pi-ui-extension-patterns` frontier. It is intentionally evidence-tiered: source audit, raw Pi harness observations, Brunch-host proof, RPC controllability, and remaining assumptions are separate.

## Current verdicts

| Area | Verdict | Required before downstream work? | Evidence tier |
| --- | --- | --- | --- |
| Built-in slash autocomplete allowlist | feasible-with-cost | desirable before M5 UI polish; not enough for policy | source audit |
| Built-in exact slash execution allowlist | requires-pi-change for strict suppression | required before claiming strict product-shell containment; not required for graph-command safety if dangerous effects are blocked separately | source audit + raw RPC probe |
| Branch-flow effect blocking (`/fork`, `/clone`) | proven for lifecycle/API effect cancellation; residual pre-cancel UI exposure remains | required for I19-L and already used by Brunch; `/tree` is now intentionally left native | source audit + raw RPC probe |
| Extension command collision override | not-feasible | product commands must avoid built-in names unless Pi adds policy | source audit |
| RPC-visible chrome/status degradation | proven for status/widget/title; no-op for header/footer/working indicator | informs fixture-driver expectations | Brunch wrapper unit oracle + raw RPC probe |
| Dynamic Brunch chrome wrapper | proven for deterministic product-state projection, branded startup identity, and TUI mounting; persistent activated chrome remains a manual polish check, not a frontier blocker | required before downstream M5/M6/M7 affordance wrappers call Pi UI primitives | Brunch-host tests + branded startup pty oracle + raw TUI transcript proof |
| Startup spec/session picker | proven for Brunch-owned pre-Pi activation with no implicit transcript resume | required for I22-L | Brunch coordinator/UI tests + `src/probes/scripts/verify-startup-no-resume.sh` pty probe oracle |
| In-session spec/session picker command | implemented/proven at command-handler seam; manual TUI walkthrough still useful | unlocks reusable spec/session selection beyond startup | Brunch extension command tests + coordinator store oracle |
| Structured-exchange response loop | proven for current deterministic public-RPC permutations and web observation; review/candidate/capture runtime migrations deferred | required before M5 lens/review affordances depend on structured elicitation | Brunch schema/TUI/editor tests + live Pi RPC editor proof + JSONL exchange-projection tests + public-RPC parity artifacts + web live-update tests |

## Evidence inventory

- **Pi version/source:** `pi --version` reports `0.75.4`; audited installed docs under `npm-mariozechner-pi-coding-agent/0.73.1` whose package version is `0.75.4`, plus source at `~/Clones/earendil-works/pi/packages/coding-agent`.
- **Source audit oracle:** `src/core/slash-commands.ts`, `src/modes/interactive/interactive-mode.ts`, `src/core/agent-session.ts`, `src/core/extensions/runner.ts`, `docs/extensions.md`, `docs/rpc.md`, and `docs/keybindings.md`.
- **Raw Pi harness oracle:** a temporary project-local Pi extension was loaded with `pi --mode rpc --no-session -e ...`, then deleted after probing. This proves extension command handling, `input` handling, lifecycle cancellation, and RPC-visible `setStatus` / string `setWidget` events. It does **not** prove interactive autocomplete visual behavior.
- **Brunch-host oracle:** FE-744 now exposes a thin internal extension entrypoint at `src/tui-client/pi-extension-shell.ts`, with product modules for chrome (`src/tui-client/.pi/extensions/chrome.ts`), session-lifecycle binding (`session-lifecycle.ts`), command policy (`command-policy.ts`), the spec/session picker (`workspace-dialog.ts` plus private `src/tui-client/.pi/components/workspace-dialog/*` compatibility paths), operational-mode policy (`operational-mode.ts`), fixture-backed mention autocomplete (`mention-autocomplete.ts`), and alternatives cards (`alternatives.ts`). Tests prove one Brunch-owned wrapper drives `setHeader`, owns a live TUI footer compositor over product facts plus Pi footer telemetry, filters out a chrome-owned status key while rendering foreign status entries, publishes diagnostic `setWidget` content, and sets the terminal title from one product-state value. Existing branch-cancellation coverage still protects `I19-L`; spec/session picker tests prove decision UI remains separate from coordinator activation and runs as the same centered overlay component at startup and in-session. `src/probes/scripts/verify-startup-no-resume.sh` now supplies the Brunch-host branded startup pty oracle: the captured startup screen contains the compact Brunch wordmark, version/Pi line, selection copy, and no stale transcript before activation.
- **Raw TUI visual oracle:** a temporary extension loaded with `script -q /tmp/brunch-chrome-tui-proof.typescript /bin/bash -lc "pi --no-session -e <temp-extension>"`; the transcript contained `BRUNCH HEADER PROOF`, `BRUNCH FOOTER PROOF`, `Spec: Proof Spec`, `observer: running`, and `lens: problem-framing`, proving header/footer/widget text is actually visible in a live Pi TUI render. The temp extension was deleted after the run.
- **Raw RPC chrome oracle:** a temporary extension loaded with `pi --mode rpc --no-session -e <temp-extension>` emitted `extension_ui_request` events for `setStatus`, `setWidget`, and `notify`; header/footer/working-indicator calls produced no RPC events as expected from Pi's RPC implementation. The temp extension was deleted after the run.
- **Live structured-exchange RPC oracle:** `npm run test -- src/probes/structured-exchange-rpc-proof.test.ts` launches a real Pi RPC subprocess with a minimal Brunch structured-exchange proof extension, observes the documented `extension_ui_request(method: "editor")`, responds with `extension_ui_response(value: schema-tagged JSON)`, and asserts the persisted terminal result details use the same self-contained `brunch.structured_exchange.result` payload as the TUI/helper path.
- **Public Brunch RPC parity oracle:** `src/probes/public-rpc-parity-proof.ts` now drives the deterministic structured-exchange permutation set through Brunch JSON-RPC only (`rpc.discover`, `workspace.*`, `session.triggerExchange`, `session.pendingExchange`, `session.submitExchangeResponse`, `session.exchanges`) and persists `.fixtures/runs/public-rpc-parity/2026-05-29-public-rpc-parity/{session.jsonl,transcript.md,report.json}` as reviewable tuple-parity evidence.
- **Web observation oracle:** WebSocket subscription tests now prove RPC-originated structured-exchange mutations notify browser clients, which then refetch canonical projection handlers rather than reading a parallel view store.

## Command inventory and containment matrix

Policy buckets:

- **allow/product-owned:** acceptable only when routed through Brunch-owned behavior or harmless in product shell.
- **hide:** should not appear as a default Brunch affordance.
- **block effect:** dangerous downstream effect must be cancelled even if UI exposure remains.
- **requires Pi policy:** strict command suppression needs a Pi upstream/API seam.

| Command / source | Pi execution path | Brunch policy | Suppression seam | Blocker seam | Residual exposure | API ask |
| --- | --- | --- | --- | --- | --- | --- |
| `/settings` | `InteractiveMode.setupEditorSubmitHandler()` opens generic Pi settings | hide | autocomplete wrapper can hide suggestions | none found | exact command still opens settings in interactive mode | command policy needed for strict block |
| `/model` | interactive built-in; `Ctrl+L` also opens selector; `Ctrl+P` cycles model | hide or replace with Brunch policy | autocomplete/keybinding config can reduce visibility | no extension cancel hook; `model_select` is notification-only | exact slash and keybindings can expose model policy surface | command/keybinding policy needed if strict |
| `/scoped-models` | interactive built-in selector | hide | autocomplete wrapper | none found | exact command opens Pi selector | command policy needed |
| `/export` | interactive built-in export | hide unless Brunch adopts it deliberately | autocomplete wrapper | none found | exact command can export Pi session | command policy needed if disallowed |
| `/import` | interactive built-in import/resume flow | hide/block until Brunch validates session binding | autocomplete wrapper | no general import hook found; switch hooks may cover resulting session switch only | import UI can start before any cancel path | command policy needed |
| `/share` | interactive built-in gist share | hide/block | autocomplete wrapper | none found | exact command exposes non-Brunch sharing | command policy needed |
| `/copy` | interactive built-in clipboard copy | allow-with-low-risk or hide | autocomplete wrapper | none found | harmless but Pi-branded | optional |
| `/name` | interactive built-in session naming | hide/replace with Brunch session naming | autocomplete wrapper | none found | can mutate Pi display name outside Brunch vocabulary | command policy desirable |
| `/session` | interactive info pane | hide or allow diagnostic-only | autocomplete wrapper | none found | exposes Pi session stats/identity | optional/desirable |
| `/changelog` | interactive Pi changelog | hide | autocomplete wrapper | none found | exact command exposes Pi product surface | command policy desirable |
| `/hotkeys` | interactive Pi hotkeys | hide or replace with Brunch hotkeys | autocomplete wrapper | none found | exact command exposes Pi actions including branch actions | command policy desirable |
| `/fork` | interactive built-in branch creation after selector | hide + block effect | autocomplete wrapper | `session_before_fork` can cancel | selector/UI may appear before cancel depending path; exact command remains visible | command policy desirable; effect block available |
| `/clone` | interactive built-in branch duplication | hide + block effect | autocomplete wrapper | `session_before_fork` can cancel | command accepted before cancellation notice | command policy desirable; effect block available |
| `/tree` | interactive built-in branch navigator | allow native | n/a | no Brunch blocker; `session_before_tree` remains available if policy changes | native tree UI is exposed intentionally | no current ask |
| `/login` / `/logout` | interactive OAuth selectors | hide unless Brunch owns provider setup | autocomplete wrapper | none found | exposes Pi provider auth surface | command policy needed if disallowed |
| `/new` | interactive session replacement | replace with Brunch same-spec coordinator flow | autocomplete wrapper | `session_before_switch` can cancel raw new-session effect | exact command still starts Pi new-session path before cancellation | command policy or Brunch command replacement needed |
| `/compact` | interactive/manual compaction | allow only after Brunch context policy exists | autocomplete wrapper | `session_before_compact` can cancel/customize | exact command starts Pi compaction UI/path before cancellation | command policy desirable |
| `/resume` | interactive session picker | hide/block unless Brunch validates binding | autocomplete wrapper | `session_before_switch` can cancel selected switch | generic picker exposure remains | command policy desirable |
| `/reload` | interactive resource reload | allow for dev, hide in product | autocomplete wrapper | none found; extension command `ctx.reload()` exists for custom reload | exact command reloads Pi resources/extensions | command policy optional for POC, desirable for product shell |
| `/quit` | interactive shutdown | allow | autocomplete wrapper not needed | n/a | Pi command name acceptable or replace later | no |
| Hidden debug/easter egg commands (`/debug`, `/arminsayshi`, `/dementedelves`) | hardcoded in `setupEditorSubmitHandler()` but not advertised in `BUILTIN_SLASH_COMMANDS` | hide/block | not in normal autocomplete inventory | none found | exact command remains callable if known | command policy needed for strict block |
| Extension commands | `AgentSession.prompt()` checks extension commands before `input` | allow only Brunch-owned names | register only Brunch commands | handler routes writes through Brunch handlers / `CommandExecutor` | built-in name collisions do not override built-ins | no if product-named |
| Prompt templates | autocomplete + expansion after `input` | hide unless Brunch owns prompt surface | settings/resources policy; `input` can handle before expansion | `input` can intercept template text before expansion | not built-in interactive command risk | optional |
| Skill commands (`/skill:name`) | autocomplete if `enableSkillCommands`; expansion after `input` | hide in Brunch POC | disable skill commands or autocomplete wrapper | `input` can intercept before expansion | generic Pi skill surface | optional if disabled |
| RPC-only session commands (`new_session`, `switch_session`, `fork`, `clone`, `compact`) | RPC command handlers | Brunch RPC should expose named product methods instead | not slash autocomplete | lifecycle hooks cancel session replacement/fork effects | raw Pi RPC is not Brunch public API | Brunch wrapper/policy, not Pi interactive policy |
| Keybindings: model select/cycle, session new/tree/fork/resume, double-Escape tree/fork | `setupKeyHandlers()` and settings | hide/block branch/model/session generic flows except intentionally-native slash `/tree` navigation | keybindings config can unbind some defaults; Brunch currently sets double-Escape to `none` | lifecycle hooks for session replacement/fork; no `/tree` hook registered | keyboard route can bypass slash autocomplete visibility | command/keybinding policy desirable |

## Autocomplete and execution findings

### Autocomplete filtering

`InteractiveMode.createBaseAutocompleteProvider()` builds a `CombinedAutocompleteProvider` from:

1. `BUILTIN_SLASH_COMMANDS`,
2. prompt templates,
3. extension commands that do not conflict with built-ins,
4. skill commands when `settingsManager.getEnableSkillCommands()` is true.

`setupAutocompleteProvider()` then applies extension-provided autocomplete wrappers. `docs/extensions.md` documents `ctx.ui.addAutocompleteProvider((current) => ...)`, including delegation to the previous provider for file/path completion and custom `#` completions. Therefore a Brunch allowlist wrapper should be able to hide disallowed slash suggestions while delegating file/path and future `#` mention completion.

**Limit:** this is visibility suppression only. It does not change exact slash execution.

### Autocomplete persistence and reference interpretation

Pi autocomplete persists only the text inserted into the editor. For both file completion and custom providers such as Pi's `github-issue-autocomplete.ts`, the `AutocompleteItem.value` becomes ordinary user-message text in the session transcript; the popup `label` and `description` are display-only and do not become hidden session metadata. The GitHub example inserts `#123`; it does not persist issue title/state, nor provide a resolver tool by itself.

Brunch `#` mentions must therefore use a stable inserted handle (`#A12`, `#I7`, or a stable node id) as the durable transcript reference. If the agent needs deeper detail, Brunch must teach that convention through `before_agent_start` system-prompt injection and provide a read-only lookup/re-read tool that resolves the handle against the local graph DB. Any structured mention ledger or staleness state is Brunch-owned parsing/indexing work layered after insertion; it is not supplied by Pi autocomplete.

The product `src/tui-client/.pi/extensions/mention-autocomplete.ts` follows this model: it inserts stable graph-code handles from an injectable Brunch mention source, explains via `before_agent_start` that labels/descriptions are UI-only, and leaves deeper detail lookup to future Brunch graph read tools.

### Exact slash execution

`InteractiveMode.setupEditorSubmitHandler()` handles built-ins directly before normal `AgentSession.prompt()` flow. `AgentSession.prompt()` handles extension commands first, then emits `input`, then expands skills/templates. Therefore extension `input` interception cannot reliably block exact interactive built-ins such as `/settings`, `/model`, `/fork`, `/tree`, `/new`, `/compact`, `/resume`, or `/quit`, because they have already been consumed by interactive mode.

Raw RPC probe corroborates the order split rather than replacing the source audit:

- `/brunch-probe` extension command executed immediately and emitted RPC `extension_ui_request` events for `setStatus`, `setWidget`, and `notify`.
- `/brunch-block-me` was not an extension command; the `input` hook handled it and skipped agent execution.
- `/settings` in RPC mode was not a built-in command; it entered normal prompt flow as user text. This confirms built-ins are interactive-only; it does not prove interactive suppression.

### Extension command collisions

`InteractiveMode.getBuiltInCommandConflictDiagnostics()` warns on extension commands with built-in names and skips conflicting built-in-name extension commands from autocomplete. `ExtensionRunner.resolveRegisteredCommands()` suffixes duplicate extension commands (`name:1`, `name:2`). Extension commands therefore cannot override `/model`, `/settings`, or other built-ins. Brunch commands should use product names unless Pi grows a command-policy seam.

## Branch-flow guard evidence

Lifecycle hooks provide effect blocking for branch/session transitions even though they do not fully suppress the generic Pi UI surface.

- `session_before_fork` cancels `/fork`, `/clone`, and RPC `fork`/`clone` effects.
- `session_before_tree` can cancel `/tree` navigation effects, but Brunch intentionally does not register it now: native `/tree` is allowed as an inspection/navigation affordance.
- `session_before_switch` cancels `/new`, `/resume`, RPC `new_session`, and RPC `switch_session` effects.
- `session_before_compact` can cancel/customize `/compact`, but compaction policy is not identical to branch policy.

Raw RPC probe results with the temporary extension:

```json
{"id":"new","type":"response","command":"new_session","success":true,"data":{"cancelled":true}}
{"id":"clone","type":"response","command":"clone","success":true,"data":{"cancelled":true}}
```

The same probe emitted corresponding `notify` requests (`cancel switch new`, `cancel fork/clone`). No Brunch product transcript fixture was created; the probe used `--no-session`.

## Brunch extension layout and dynamic chrome proof

The Brunch extension entrypoint is intentionally a registration map. `src/tui-client/pi-extension-shell.ts` composes product-owned modules under `src/tui-client/.pi/extensions/*` by Pi surface/responsibility:

- `chrome.ts` owns `BrunchChromeState`, reusable formatting helpers, and `renderBrunchChrome()`.
- `session-lifecycle.ts` owns coordinator refresh calls on Pi session lifecycle events.
- `command-policy.ts` owns branch/session effect blocking for unsupported Pi flows.
- `workspace-dialog.ts` owns `/brunch`, `ctrl+shift+b`, and the in-session spec/session picker activation adapter.
- `operational-mode.ts` owns the current `elicit` read-only tool policy pending transcript-backed runtime state.
- `mention-autocomplete.ts` owns fixture-backed `#` mention autocomplete.
- `alternatives.ts` owns the transcript-persistent alternatives/card primitive, using reusable widgets from `src/tui-client/.pi/components/*`.
- `exchanges/` owns the remodeled present/request structured-exchange tool family; the active registry currently exposes `present_question`, `present_options`, `request_answer`, `request_choice`, and `request_choices`, while review/candidate modules are stubs until their product flows land.

`renderBrunchChrome(ctx.ui, state)` is the product-named wrapper downstream affordances should call instead of scattering raw Pi UI calls. The current code renders only facts present in `BrunchChromeState`:

- header: plain wordmark plus runtime-state initialization summary, active spec, real activated session id/label, and phase;
- footer: a live TUI compositor that combines product facts from `BrunchChromeState` with Pi footer telemetry (`footerData.getGitBranch()` and foreign `ctx.ui.setStatus()` entries);
- widget: cwd, spec, session, runtime, context, and chat-mode diagnostics;
- title: compact Brunch-owned terminal title derived from activated workspace state.

The wrapper uses the shared compact Brunch wordmark plus plain, narrow-terminal-safe text/glyphs (`brunch`, `·`) and does not depend on Pi branding/footer text as the primary product surface. Header/footer rendering is TUI-only; widget/title provide deterministic state strings for tests and RPC-compatible clients. `ctx.ui.setStatus(key, text)` remains available as a lateral contribution channel for other extensions and future dynamic Brunch state; the chrome wrapper does not publish a `brunch.chrome` status key and filters that key if a stale producer contributes it. The wrapper deliberately does not fabricate build version, worker state, coherence verdicts, establishment offers, or a working-indicator abstraction until those producers exist. `session_start` reconstructs chrome from the supplied product state, and replacement-session binding still runs through the existing session-lifecycle hooks before rendering. Reload/session replacement therefore requires callers to provide fresh product state; the wrapper does not own durable state.

Observed behavior:

| Scenario | Result | Evidence |
| --- | --- | --- |
| Idle TUI mount | Header, footer, status, diagnostic widget, and title are called from one product-state value; tests assert the same formatter output used by the wrapper. | `src/app/brunch-tui.test.ts` |
| `/reload` / extension reload | Chrome is not durable inside Pi UI; reload must rerun extension setup and call `renderBrunchChrome` with fresh Brunch state. | source/API behavior; wrapper is stateless by design |
| Session replacement / selected-session reopen | Existing Brunch extension calls the session-lifecycle binding hook on `session_start`, `before_agent_start`, and assistant `message_start`; `session_start` then renders chrome for the supplied workspace state. The `/brunch` settings-switcher action activates decisions through the coordinator, calls `ctx.switchSession()`, and renders fresh chrome/notification only through `withSession` replacement context. | `src/app/brunch-tui.test.ts` |
| RPC degradation | `setStatus`, string-array `setWidget`, `setTitle`, and `notify` emit RPC `extension_ui_request` events; `setHeader`, `setFooter`, and `setWorkingIndicator` are RPC no-ops. Brunch chrome currently uses TUI-only header/footer plus diagnostic widget/title; fixture drivers should not assert TUI-only header/footer or a chrome-owned status key. | Pi RPC source + temp RPC JSONL probe |

## Startup/splash logo asset decision

Brunch should render the startup/splash logo as TUI chrome, not as a session message, so it does not persist in the transcript/log. For the preferred blocky aesthetic, the selected rendering is a pre-generated Chafa Unicode-symbol asset rather than runtime image rendering:

- Source PNG copied from the legacy Brunch app to `src/tui-client/.pi/components/workspace-dialog/assets/brunch.png`.
- Preferred splash asset: `src/tui-client/.pi/components/workspace-dialog/assets/brunch-logo-quad-56x18.ansi`.
- Lower-color fallback asset: `src/tui-client/.pi/components/workspace-dialog/assets/brunch-logo-quad-56x18-240.ansi`.
- The build copies those assets to `dist/tui-client/.pi/components/workspace-dialog/assets` so runtime code can read them beside the compiled component.

The selected generator command for the preferred asset is:

```sh
chafa -f symbols \
  --symbols=quad \
  --colors=full \
  --color-space=din99d \
  --color-extractor=median \
  --bg=black \
  --size=56x18 \
  src/tui-client/.pi/components/workspace-dialog/assets/brunch.png > src/tui-client/.pi/components/workspace-dialog/assets/brunch-logo-quad-56x18.ansi
```

Runtime should **not** invoke Chafa on startup. The logo should be deterministic, cheap to render, and independent of host-installed CLI tools. Chafa is therefore a maintainer/dev tool at most, not a runtime dependency. Startup chrome should choose `brunch-logo-quad-56x18.ansi` when truecolor is available, otherwise `brunch-logo-quad-56x18-240.ansi`; for very limited terminals, a plain `brunch` wordmark is sufficient rather than carrying 16-color or 8-color assets.

## Workspace dialog implementation evidence

Startup now runs through Brunch-owned inventory and activation before Pi `InteractiveMode` starts. `.brunch/state.json` accelerates defaults but does not implicitly resume the prior transcript; the pure spec/session picker UI returns `continue` / `openSession` / `newSession` / `newSpec` / `cancel`, and `WorkspaceSessionCoordinator.activateWorkspace()` owns all session creation/opening, binding, and state-file effects.

The executable pty probe oracle is `src/probes/scripts/verify-startup-no-resume.sh`. It builds the project, seeds a scratch workspace with a unique stale transcript sentinel, launches `brunch --mode tui` under `script`, strips ANSI/control sequences, and asserts the first captured startup screen contains the compact Brunch wordmark, version/Pi line, spec/session picker markers, pre-agent-loop selection copy, and not the stale transcript text. A local run on 2026-05-30 passed with raw/stripped captures under the script-created `brunch-startup-oracle.*` workspace. This is a middle-loop/manual oracle, not part of `npm run verify`, because pty behavior is host-sensitive.

Persistent chrome still needs qualitative live-host observation after explicit activation: the startup probe deliberately stops before selecting a spec/session so it can prove `I22-L` no-resume behavior without driving the agent loop. Manual closeout should confirm the post-activation header/footer/widget/title read as Brunch-owned, include the active session id/label and spec title, avoid Pi-branded primary surface leakage, and preserve the `brunch.chrome` widget/status-key discipline.

The in-session product command is `/brunch` with `ctrl+shift+b`. It waits for idle, inspects inventory, renders the same typed centered spec/session picker with `ctx.ui.custom(..., { overlay: true })`, activates the returned decision through the coordinator, and then calls `ctx.switchSession()` only for the already-activated target file. Post-switch chrome and notification use the `withSession` replacement context only; cancel and `needs_human` decisions notify without switching. This does not override `/resume`, `/new`, or other built-ins; it is the Brunch-owned workspace adapter over Pi's session-replacement API.

## Pi example evidence not yet Brunch integration proof

Reviewed Pi docs/examples remain useful for downstream M5/M6/M7 affordance design, but they are not interchangeable with Brunch-host proof:

| Example/source affordance | Evidence status | Brunch interpretation |
| --- | --- | --- |
| `question` / `questionnaire` typed UI patterns | Pi example/source evidence | Suitable model for future structured elicitation/review surfaces; Brunch has only proven typed custom spec/session decisions so far. |
| `shutdown-command` | Pi example evidence | Confirms commands can drive lifecycle actions; Brunch has not added a product shutdown command beyond allowing Pi quit. |
| `structured-output` | Pi example evidence | Relevant to future agent/tool result rendering, not current workspace-dialog proof. |
| `titlebar-spinner` / working indicator examples | Pi example evidence only | Brunch leaves Pi's working indicator untouched; custom spinner styling is deferred until a live side-task/reviewer spinner is product-proven. |
| `custom-header` / `custom-footer` | Raw Pi TUI proof plus Brunch wrapper tests | Brunch uses header for product identity and restores the default footer; replacing the footer should remain intentional. |
| `status-line` / `border-status-editor` | Pi example plus Brunch wrapper tests | Supports lateral extension status contributions; Brunch chrome currently renders foreign statuses in the TUI footer and uses widget diagnostics rather than publishing its own status key or replacing the editor/border. |

## RPC controllability observations relevant to command containment and chrome

Raw Pi RPC success is not Brunch integration proof, but it matters for the fixture-driver oracle:

- Extension command handlers are RPC-invocable via `prompt` for extension command names.
- `ctx.ui.setStatus()` emits RPC `extension_ui_request` with method `setStatus`.
- `ctx.ui.setWidget()` emits RPC `extension_ui_request` with method `setWidget` when the widget is a string array.
- `ctx.ui.setTitle()` emits RPC `extension_ui_request` with method `setTitle`.
- `ctx.ui.notify()` emits RPC `extension_ui_request` with method `notify`.
- `ctx.ui.setHeader()`, `ctx.ui.setFooter()`, and `ctx.ui.setWorkingIndicator()` are TUI-only in current Pi RPC mode and should be treated as no-ops for fixture-driver expectations.
- Built-in interactive slash commands are not included in RPC `prompt` handling as built-ins; Brunch must not infer interactive command safety from RPC prompt behavior.

## Minimum Pi API ask

Strict Brunch product-shell containment needs an upstream command/keybinding policy seam. A minimal shape would be either session/interactive-mode options or extension API:

```ts
pi.setCommandPolicy({
  hiddenBuiltins: ["settings", "model", "scoped-models", "export", "import", "share", "fork", "clone", "login", "logout", "new", "resume"],
  blockedBuiltins: ["fork", "clone", "new", "resume", "settings", "model"],
  onBlockedBuiltin: async (name, ctx) => ctx.ui.notify(`/${name} is not available in Brunch`, "warning"),
});
```

Equivalent launch-time option:

```ts
allowedBuiltInCommands: ["tree", "compact", "reload", "quit"]
```

The policy must run before interactive-mode built-in dispatch and before autocomplete construction. Ideally it should also expose a keybinding-action policy for `app.model.*` and `app.session.*` actions so keyboard paths cannot bypass slash visibility.

## Structured-exchange product relay status

The remaining FE-744 closeout is no longer generic structured-exchange relay work or branded/themed chrome recovery. Brunch has proven the private adapter/projection parts of the structured-exchange loop and the public product relay: present/request structured-exchange tools persist semantic display and response state through `toolResult.content`/`details`, rich TUI paths can collect answers through `ctx.ui.custom()`, raw Pi RPC can round-trip schema-tagged JSON through `ctx.ui.editor()` in a live subprocess proof, real Pi RPC validates same-assistant-message sequential `present_options → request_choice` result/UI/persistence ordering, public Brunch RPC drives ten distinct assistant-first structured-exchange tuples from a fresh cwd without raw Pi RPC, web clients observe RPC-originated structured-exchange updates through the product invalidation/refetch path, and session exchange projection classifies terminal structured-exchange `toolResult.details` (including cancelled/unavailable) as response-side transcript entries while preserving ordinary tool results as prompt-side. Brunch has also recovered product-owned startup/persistent chrome identity through shared TUI primitives, the chrome wrapper, and the branded startup pty oracle. The remaining residue is the accepted A18-L command-containment limitation: strict built-in command suppression still requires a Pi API seam.

Pi source/docs already give strong evidence for the primitive:

- `docs/usage.md` states that the editor can be temporarily replaced by custom extension UI.
- `docs/tui.md` documents `ctx.ui.custom<T>()` for editor-area replacement and `ctx.ui.setEditorComponent()` for replacing the main input editor.
- `examples/extensions/question.ts` proves a registered tool can ask a single-choice question with optional freeform input and persist the answer in `toolResult.details`.
- `examples/extensions/questionnaire.ts` proves a registered tool can ask a multi-question questionnaire and persist the full answer set in `toolResult.details`.
- `examples/extensions/rpc-demo.ts` and `examples/rpc-extension-ui.ts` prove Pi RPC can carry supported extension UI requests, including `editor`, through `extension_ui_request` / `extension_ui_response`.
- `examples/extensions/message-renderer.ts` proves custom transcript display, but display alone does not collect a response.

The seam Brunch has now proven is the product relay and parity loop around that composition: assistant structured-exchange tools → pending Brunch structured-exchange state/event over the single public RPC surface → product response from a CLI probe over Brunch RPC → durable present/request tool results in Pi JSONL → response-side exchange projection → browser observer invalidation/refetch from canonical projection handlers. TUI-originated observation remains acceptable only if it reuses the same product invalidation path rather than inventing a parallel browser view store.

| Residual affordance | Current posture | Carry-forward obligation |
| --- | --- | --- |
| Elicitation-first session loop | Proven for deterministic public RPC parity plus browser observation of RPC-originated updates. | A session can begin from a system/assistant question or offer without ambient user chat; unresolved interactions own the response surface until answered, cancelled, marked unavailable, or explicitly display-only. |
| Registered structured-exchange tool seam | Brunch present/request tests cover markdown `toolResult.content`, self-contained `toolResult.details`, non-semantic `renderCall`, unmatched-present recovery, `request_choices` JSON-editor fallback, terminal cancelled/unavailable closure, option content/rationale parity, and a real Pi RPC same-assistant-message sequential ordering proof for `present_options → request_choice`. | Continue classifying by typed details, not tool name, so unrelated tool results remain prompt-side; RPC consumers should not require `request_*` `tool_execution_start` before extension UI because the UI request can arrive first. |
| TUI input replacement | Brunch adapter tests prove `ctx.ui.custom()` collection for freeform and listed-choice responses; multi-choice now has an RPC-compatible `request_choices` path, while review/candidate tools remain named stubs until their product flows land. | Keep UX refinements separate from the proof seam; future richer surfaces should reuse the same terminal-result discipline. |
| JSON-editor RPC fallback | Brunch helper tests and `npm run test -- src/probes/structured-exchange-rpc-proof.test.ts` prove schema-tagged JSON over Pi RPC `ctx.ui.editor` at the adapter level; the public product relay now exercises the same multi-choice semantics through Brunch RPC. | Treat JSON-over-editor as a Pi adapter behind Brunch public RPC, not as a second product API or raw UX contract. |
| Review-set decisions | Depends on the same terminal structured-result discipline. | Approve routes to one `acceptReviewSet` command; request-changes appends a successor proposal; reject persists a terminal response. |
| Pickers and orientation views | Workspace switcher proves pure decision UI. | Reuse the same decision-returning shape; coordinator or command-layer code owns mutations. |
| Live Pi harness probes | Useful for fast source/API validation but not Brunch-host proof. | Keep scratch extensions temporary, record evidence tier, and promote only product-named wrappers that survive the spike. |

## Downstream posture

- For the POC, Brunch can plausibly proceed if it hides disallowed commands from autocomplete and blocks branch/session effects with lifecycle hooks, **provided product documentation does not claim strict built-in suppression**.
- Dynamic Brunch chrome is strong enough to make the startup and primary idle/working TUI surface read as Brunch-owned; exact built-in commands remain a residual shell-containment risk for product review.
- `I19-L` remains protected by fork/clone effect blocking and transcript-reader fail-fast behavior, not by complete command invisibility or `/tree` suppression.
- M5/M6/M7 should route Brunch actions through Brunch-owned command names and handlers; extension command collisions are not an override mechanism.
- M5/M6/M7 chrome/status affordances should call Brunch product wrappers (`renderBrunchChrome` or successors) instead of raw Pi `ctx.ui.*` primitives.
- Future switcher/review/elicitation commands should follow the `/brunch` menu pattern: product-owned names, typed default `ctx.ui.custom()` decision components unless richer modal behavior is specifically needed, coordinator/command-layer activation, and replacement-session work only through `withSession` contexts.
- A strict upstream Pi command-policy API is required before Brunch can honestly claim Pi's generic shell is unavailable rather than merely discouraged/guarded.

## Open evidence gaps

- Interactive autocomplete filtering was source-proven but not visually observed in a TUI session from this API-only run.
- Exact interactive `/fork`, `/new`, and `/resume` pre-cancel UI exposure should be manually observed in Brunch TUI or a controlled Pi TUI before product signoff; `/tree` should be manually observed as an intentionally-native affordance.
- Keybinding unbinding/configuration strategy remains source-audited only; no Brunch-owned keybinding settings wrapper has been tested.
- The branded startup no-resume oracle is executable and passed locally, but it is intentionally not a default CI gate because pty/script behavior is host-sensitive.
- The in-session `/brunch` menu and workspace/session action are unit-proven at the handler/replacement-context seam; a qualitative manual TUI walkthrough should still confirm interaction feel and final chrome/session id in a live Pi runtime.
- Persistent activated chrome remains a qualitative manual walkthrough item because the no-resume oracle intentionally stops before activation to avoid obscuring the startup invariant; this is visual-polish debt, not a blocked FE-744 seam.
