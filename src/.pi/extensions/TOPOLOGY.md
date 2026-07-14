# .pi/extensions/ — Pi adapter registrars

SPEC decisions: D34-L, D35-L, D37-L, D39-L, D40-L, D44-L, D52-L, D69-L, D71-L, D90-L, D91-L, D93-L, D98-L, D109-L, D119-L, D120-L, D121-L, D122-L, D123-L

## Owns

Pi-facing registration and adaptation only: lifecycle hooks, agent tool definitions, command/shortcut handlers, TUI chrome affordances, autocomplete wrappers, per-turn system-prompt append hooks, dev-gated read-only introspection taps, payload/session-log query tools, workspace dialogs, and Pi-specific tool result renderers. Current-state adapters require Pi's `SessionManager.getBranch()`; they do not fall back to append-order `getEntries()` (D24-L, I19-L).

## Does NOT own

- Agent role prompt definitions, skill resource bodies, prompt composition, and prompt-resource legality — `agents/`. `agent-runtime/` adapts foreground runtime policy; `executor/` adapts executor run tools to Pi.
- Graph truth, graph mutation policy, or graph readers — top-level `graph/`.
- Pi JSONL/session semantics, runtime-state projection, workspace coordination, or transcript exchange projection — top-level `session/`, `projections/`, and related domain seams.
- Reusable DTO projection or reusable markdown/text rendering — top-level `projections/`, `agents/contexts/` for model-facing text, and local product/session owners for human/product text.
- Product transport handlers — `rpc/`, `app/`, and `web/`.

## Directory layout

```text
extensions/
├── TOPOLOGY.md
├── agent-runtime/          Pi adapter for central foreground runtime policy
│   ├── runtime/            operational-mode Pi tool activation adapter
│   └── system-prompts/     before_agent_start hook adapter into agents/runtime/foreground-policy
├── executor/               thin Pi adapters for executor `execute_*` tools and run-update observer
├── brunch-data/            Pi tools over selected Brunch graph/spec/workspace/session data
│   ├── graph/              mutate_graph/read_graph tools + selected-spec graph read seam
│   ├── context/            workspace/spec/session context tools
│   ├── elicitation/        read/update session elicitation-scratchpad tools (non-authoritative; no persisted register)
│   └── reconciliation/     read/update reconciliation-need register tools
├── session-hooks/          session lifecycle and boundary refresh hooks
│   └── session/
├── dev-mode/               dev-gated observability/query tools
│   ├── introspection/      passive provider-payload tap + /introspect command
│   ├── introspect-query/   brunch_introspect_query over captured payloads
│   └── session-query/      brunch_session_query over the current branch
├── web-tools/              web_fetch/web_search read tools for referenced-document acquisition
│   └── web/
├── subagents/              D44-L/D91-L sealed SDK child sessions and `subagent` tool
├── chrome/                 TUI header/title/footer/sidecar-widget chrome projection
├── commands/               /brunch:* commands, shortcut, branch/tree policy (exception: /brunch:land registers in executor/execute-land/ beside its read-only preflight tool)
├── compaction/             D43-L anchor contract + one session_before_compact native custom result
├── exchanges/              structured-exchange present_* + ask Pi tools
├── mentions/               #graph mention prompt hint + autocomplete provider
├── session-orientation/    session-entry-orientation descriptors, dialog adapter, juncture orchestrator, and gate state
├── shared/                 default Brunch tool definition/rendering + provider-facing schema adapter
└── workspace/              spec/session picker command adapter
```

`session-orientation/` owns the Specify-mode and Execute-mode menu descriptors (Specify role label with by-decision/by-example/by-proposal/prep/ingest choices and the wait-flavored no-kick choice last; Execute role label with only D120-L workflow choices `prepare_execution` / `compile_plan` / `execute_plan` for design-oracle-commit preparation, plan compilation readiness, and plan execution), the dialog function (`index.ts`; custom component when `ctx.ui.custom` is available, `ctx.ui.select` fallback; escape/timeout resolves to the inert `dismissed` — entry recorded, never a kick), the UI-capable no-auth upstream gate over Pi's live `ctx.modelRegistry.getAvailable()` (when no provider auth resolves, J1 emits the shared Pi-native `/login` warning once while J1–J6 do not show a dialog, append an entry, or kick; J2–J6 emit no additional warning, the workspace dialog itself renders no auth warning, and no-UI degraded paths keep the origination backstop), the juncture orchestrator that composes dialog → entry → origination → live seed delivery → live-kick with two modes — `'follow-choice'` (J2/J3/J4/J6 and J5: kick unless the resolved choice is `dismissed` or matches the menu's `noKickChoice`; Specify uses `continue`, Execute has no no-kick choice) and `'boot'` (J1: originate+kick with `resumeOrigin: 'resume_debt'` unless the user dismissed the menu, honoring degraded-mode and the menu's no-kick choice for force-seed) — (`juncture.ts`), plus the manual-trigger kick helper used by explicit resume commands. The Pi event registrar wires the dialog to J1 (`session_start` reason `startup`, option-2 boot), J2 (`session_start` reasons `new`/`resume`), J3 (`session_tree`), and J4 (`agent_end` abort candidate resolved at `agent_settled`, C3 probe) (`registrar.ts`). The explicit J6 `/brunch:consult` command is owned by `commands/index.ts`; it claims the same shared gate, derives the menu from the current transcript-backed operational mode, and routes through `runJunctureForContext`. `/brunch:continue` is also owned by `commands/index.ts`; it first scans the current branch for the newest incomplete declared ask continuation, reuses the ask collector, and appends the recovered answer as the provider-legal synthetic `ask` toolCall/toolResult pair. If no declared ask is open, `/brunch:continue` resumes interrupted Brunch work by kicking the same origination seam with `resumeOrigin: 'manual_trigger'`, overriding prior dismissals; its command notice is derived from the classified kick completion outcome, so no-model, idle, and failed-send paths do not report success merely because origination was attempted, and retry after a failed kick reuses the already-delivered trailing seed rather than appending it again. Live junctures and explicit resume deliver `brunch.context_seed` before the triggering `brunch.kick` so the persisted transcript and in-memory provider context stay in sync after `AgentSession` creation. J5 uses Pi's synchronous live `sendMessage` enqueue; TUI boot's `AgentSession.sendCustomMessage` adapter in `src/app/brunch-tui.ts` preserves the same seed-before-kick order with a per-kick deferred serial chain while still returning to `session_start` immediately. J5 mode-switch is landed: the mode-switch path in `commands/index.ts` first settles any in-flight assistant turn only when abort + wait-for-idle are both observable (setting the registrar-shared suppress flag so the corresponding J4 does not fire), then fires the same juncture orchestrator with a table-selected menu when the switch target is `specify` (Specify menu) or `execute` (Execute menu). J2/J3/J4 event junctures also re-project `projectBrunchAgentState(...).operationalMode` at firing time so resume/tree/esc-abort menus match the active foreground agent. For J4, each low-level `agent_end` replaces the session-scoped abort candidate; a non-aborted retry or queued continuation clears it, and only `agent_settled` may open the abort juncture. A J5-owned abort consumes its suppression flag at `agent_end` and leaves no candidate for settlement. The shared `OrientationJunctureGate` is an ownership-aware claim plus resolution window: event-driven junctures read claim + window before running; J5/J6 write but do not read it, so explicit user mode switches/consults are never skipped while still suppressing ambient event echoes.

The former `tui-lab/` registrar (`registerBrunchTuiLab`, gated behind an `enabled`
option nothing ever set) was retired — it never entered the product bundle and
was inert even under Pi's ambient `.pi/extensions/` directory scan. Its
`TuiStyleLabComponent` moved to `.pi/components/tui-lab/` as a reference
component, previewable via `npm run dev:components -- tui-lab`.

`compaction/` registers exactly one `session_before_compact` hook. Its private selector and continuity-block modules choose dropped provider-visible carriers and serialize them deterministically; the registrar calls Pi's public native `compact(...)`, prefixes the block, preserves Pi file-operation details, and adds only a namespaced schema marker. Ledger-only anchors remain in append-only JSONL. Owned boundary, auth, serialization, or narrative failures notify and return `{ cancel: true }`; there is no pending queue, `session_compact` hook, or post-compaction send.

## Boundary rules

```pseudo
rules:
  .pi/extensions/* -> agents/, .pi/components/, graph/, session/, projections/ [adapter imports allowed]
  .pi/extensions/agent-runtime/* -> agents/runtime/foreground-policy [foreground prompt/tool policy]
  .pi/extensions/executor/* -> executor/, app/port types, rpc/product-updates [thin execute adapter surface]
  .pi/extensions/* x> db/                                                            [no direct storage]
  graph/, session/    x> .pi/                                                        [domain layers never import adapters]
  agents/prompts/     x> .pi/extensions/                                             [prompt bodies do not register Pi hooks]
  projections/        x> .pi/, rpc/, app/, web/                                      [no transport/UI imports]
```

## TUI launch chrome

`chrome/` is the only product extension that should install Brunch's persistent TUI shell chrome. It receives launch facts from `src/app/brunch-tui.ts` through `BrunchChromeState`; it does not read web host, workspace, or activation state itself.

## Provider-facing tool schemas

Provider-facing tool-parameter conversion is confined to `shared/tool-schema.ts`: Zod-owned tool boundaries emit JSON Schema draft 2020-12 via `z.toJSONSchema(..., { unrepresentable: 'throw' })`, while TypeBox-owned graph/DB boundaries pass through their canonical schema. The adapter requires an object root and rejects top-level `oneOf`/`anyOf`/`allOf`; `registry.test.ts` derives the complete 52-tool registrar/catalog inventory, rejects duplicate registrations, and pins adapter provenance and these bounded provider constraints. Compatibility beyond them remains tripwired to provider/model changes or live rejection evidence.

## Shared default tool rendering

`shared/define-brunch-tool.ts` owns the canonical self-shell one-line status renderer for Brunch-authored tools that do not need family-specific transcript rendering. `shared/tool-activity-labels.ts` maps every shared-default tool name to concise user-facing activity text; the production inventory test requires exact coverage so raw provider identifiers cannot leak into receipts. Its status-transition contract is scoped to Pi's live interactive TUI lifecycle; Pi HTML export remains an unsupported built-in under D34-L and is not a compatibility surface for this adapter. The production-derived registry classifies 41 shared-default tools, 11 intentional-custom tools, and 4 Pi-owned re-registrations; custom and Pi-owned renderers remain outside the wrapper. The custom set includes the four executor tools with dedicated result renderers (`execute_orchestrate`, `execute_plan_check`, `execute_snapshot`, and `execute_status`).

## Migration notes

`exchanges/schemas/` is the intentional current exception to "adapter-only": it owns the Zod-authored structured-exchange details schema per D37-L/D41-L until a separate schema-ownership slice moves or names that seam.

`exchanges/shared/markdown.ts` contains Pi-rendering helpers. Keep Pi `renderCall` / `renderResult` widgets and UI-only message components local to `.pi/`; reusable provider-visible exchange result text belongs in `agents/contexts/exchanges/`.

## Example extensions to reference for future work (relative to pi source)

Pattern notes
- use `ctx.ui.notify` when any operation completes

### enhancements

implement spinner/working feedback
- `packages/coding-agent/examples/extensions/titlebar-spinner.ts`
- `packages/coding-agent/examples/extensions/working-indicator.ts`
- `packages/coding-agent/examples/extensions/working-message-test.ts`

how to add a quit command
- `packages/coding-agent/examples/extensions/shutdown-command.ts`

how to name the session
- `packages/coding-agent/examples/extensions/session-name.ts`

### essentials

how to do RPC patterns correctly
- `packages/coding-agent/examples/extensions/rpc-demo.ts`
- `packages/coding-agent/examples/rpc-extension-ui.ts`

custom tool truncation
- `packages/coding-agent/examples/extensions/truncated-tool.ts`

custom compaction threshold and rules
- `packages/coding-agent/examples/extensions/trigger-compact.ts`

### executor-relevant

executor/cook tool state, as session state?
- `packages/coding-agent/examples/extensions/todo.ts`

how to have an event bus between extensions
- `packages/coding-agent/examples/extensions/event-bus.ts`

how to confirm destructive actions
- `packages/coding-agent/examples/extensions/confirm-destructive.ts`

how to pass session context to subagent
- `packages/coding-agent/examples/extensions/summarize.ts`

`terminate: true` param for agent tool-outputs which don't need a following agent summary
- `packages/coding-agent/examples/extensions/structured-output.ts`

a way of display "turn status" in the UI
- `packages/coding-agent/examples/extensions/status-line.ts`

blocking operations on certain paths
- `packages/coding-agent/examples/extensions/protected-paths.ts`

how to block dangerous commands
- `packages/coding-agent/examples/extensions/permission-gate.ts`

### elicitor-relevant

auto-confirmation of questions (take recommendation)
- `packages/coding-agent/examples/extensions/timed-confirm.ts`

### primary agents

how to customize system prompt dynamically
- `packages/coding-agent/examples/extensions/prompt-customizer.ts`

how to switch operational modes
- `packages/coding-agent/examples/extensions/preset.ts`

a fuller plan vs code mode, with UI feedback
- `packages/coding-agent/examples/extensions/plan-mode/README.md`

how to render status on the border of the editor
- `packages/coding-agent/examples/extensions/border-status-editor.ts`

how to set the hidden-thinking label (static)
- `packages/coding-agent/examples/extensions/hidden-thinking-label.ts`
