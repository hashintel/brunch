# Pi UI Extension Patterns

This memo records evidence for the `pi-ui-extension-patterns` frontier. It is intentionally evidence-tiered: source audit, raw Pi harness observations, Brunch-host proof, RPC controllability, and remaining assumptions are separate.

## Current verdicts

| Area | Verdict | Required before downstream work? | Evidence tier |
| --- | --- | --- | --- |
| Built-in slash autocomplete allowlist | feasible-with-cost | desirable before M5 UI polish; not enough for policy | source audit |
| Built-in exact slash execution allowlist | requires-pi-change for strict suppression | required before claiming strict product-shell containment; not required for graph-command safety if dangerous effects are blocked separately | source audit + raw RPC probe |
| Branch-flow effect blocking (`/fork`, `/clone`, `/tree`) | proven for lifecycle/API effect cancellation; residual pre-cancel UI exposure remains | required for I19-L and already partly used by Brunch | source audit + raw RPC probe |
| Extension command collision override | not-feasible | product commands must avoid built-in names unless Pi adds policy | source audit |
| RPC-visible chrome/status degradation | partially proven | informs fixture-driver expectations | raw RPC probe |

## Evidence inventory

- **Pi version/source:** `pi --version` reports `0.75.4`; audited installed docs under `npm-mariozechner-pi-coding-agent/0.73.1` whose package version is `0.75.4`, plus source at `~/Clones/earendil-works/pi/packages/coding-agent`.
- **Source audit oracle:** `src/core/slash-commands.ts`, `src/modes/interactive/interactive-mode.ts`, `src/core/agent-session.ts`, `src/core/extensions/runner.ts`, `docs/extensions.md`, `docs/rpc.md`, and `docs/keybindings.md`.
- **Raw Pi harness oracle:** temporary project extension `.pi/extensions/brunch-command-probe.ts` was loaded with `pi --mode rpc --no-session -e .pi/extensions/brunch-command-probe.ts`, then deleted after probing. This proves extension command handling, `input` handling, lifecycle cancellation, and RPC-visible `setStatus` / string `setWidget` events. It does **not** prove interactive autocomplete visual behavior.
- **Brunch-host oracle:** not yet run for Card 1. Brunch already has Brunch TUI branch-cancellation coverage in SPEC I19-L; this card does not add a new Brunch wrapper.

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
| `/tree` | interactive built-in branch navigator | hide + block effect | autocomplete wrapper | `session_before_tree` can cancel/customize | tree UI may start before cancellation path | command policy desirable; effect block available |
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
| Keybindings: model select/cycle, session new/tree/fork/resume, double-Escape tree/fork | `setupKeyHandlers()` and settings | hide/block branch/model/session generic flows | keybindings config can unbind some defaults; settings can set double-Escape to `none` | lifecycle hooks for session replacement/fork/tree | keyboard route can bypass slash autocomplete visibility | command/keybinding policy desirable |

## Autocomplete and execution findings

### Autocomplete filtering

`InteractiveMode.createBaseAutocompleteProvider()` builds a `CombinedAutocompleteProvider` from:

1. `BUILTIN_SLASH_COMMANDS`,
2. prompt templates,
3. extension commands that do not conflict with built-ins,
4. skill commands when `settingsManager.getEnableSkillCommands()` is true.

`setupAutocompleteProvider()` then applies extension-provided autocomplete wrappers. `docs/extensions.md` documents `ctx.ui.addAutocompleteProvider((current) => ...)`, including delegation to the previous provider for file/path completion and custom `#` completions. Therefore a Brunch allowlist wrapper should be able to hide disallowed slash suggestions while delegating file/path and future `#` mention completion.

**Limit:** this is visibility suppression only. It does not change exact slash execution.

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
- `session_before_tree` cancels `/tree` navigation effects.
- `session_before_switch` cancels `/new`, `/resume`, RPC `new_session`, and RPC `switch_session` effects.
- `session_before_compact` can cancel/customize `/compact`, but compaction policy is not identical to branch policy.

Raw RPC probe results with the temporary extension:

```json
{"id":"new","type":"response","command":"new_session","success":true,"data":{"cancelled":true}}
{"id":"clone","type":"response","command":"clone","success":true,"data":{"cancelled":true}}
```

The same probe emitted corresponding `notify` requests (`cancel switch new`, `cancel fork/clone`). No Brunch product transcript fixture was created; the probe used `--no-session`.

## RPC controllability observations relevant to command containment

Raw Pi RPC success is not Brunch integration proof, but it matters for the fixture-driver oracle:

- Extension command handlers are RPC-invocable via `prompt` for extension command names.
- `ctx.ui.setStatus()` emits RPC `extension_ui_request` with method `setStatus`.
- `ctx.ui.setWidget()` emits RPC `extension_ui_request` with method `setWidget` when the widget is a string array.
- `ctx.ui.notify()` emits RPC `extension_ui_request` with method `notify`.
- Built-in interactive slash commands are not included in RPC `prompt` handling as built-ins; Brunch must not infer interactive command safety from RPC prompt behavior.

## Minimum Pi API ask

Strict Brunch product-shell containment needs an upstream command/keybinding policy seam. A minimal shape would be either session/interactive-mode options or extension API:

```ts
pi.setCommandPolicy({
  hiddenBuiltins: ["settings", "model", "scoped-models", "export", "import", "share", "fork", "clone", "tree", "login", "logout", "new", "resume"],
  blockedBuiltins: ["fork", "clone", "tree", "new", "resume", "settings", "model"],
  onBlockedBuiltin: async (name, ctx) => ctx.ui.notify(`/${name} is not available in Brunch`, "warning"),
});
```

Equivalent launch-time option:

```ts
allowedBuiltInCommands: ["compact", "reload", "quit"]
```

The policy must run before interactive-mode built-in dispatch and before autocomplete construction. Ideally it should also expose a keybinding-action policy for `app.model.*` and `app.session.*` actions so keyboard paths cannot bypass slash visibility.

## Downstream posture

- For the POC, Brunch can plausibly proceed if it hides disallowed commands from autocomplete and blocks branch/session effects with lifecycle hooks, **provided product documentation does not claim strict built-in suppression**.
- `I19-L` remains protected by effect blocking and transcript-reader fail-fast behavior, not by complete command invisibility.
- M5/M6/M7 should route Brunch actions through Brunch-owned command names and handlers; extension command collisions are not an override mechanism.
- A strict upstream Pi command-policy API is required before Brunch can honestly claim Pi's generic shell is unavailable rather than merely discouraged/guarded.

## Open evidence gaps

- Interactive autocomplete filtering was source-proven but not visually observed in a TUI session from this API-only run.
- Exact interactive `/fork`, `/tree`, `/new`, and `/resume` pre-cancel UI exposure should be manually observed in Brunch TUI or a controlled Pi TUI before product signoff.
- Keybinding unbinding/configuration strategy remains source-audited only; no Brunch-owned keybinding settings wrapper has been tested.
