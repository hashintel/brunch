# .pi/extensions/ — Pi adapter registrars

SPEC decisions: D34-L, D35-L, D37-L, D39-L, D40-L, D44-L, D52-L, D69-L, D71-L, D90-L, D91-L, D93-L, D98-L, D109-L, D115-L, D118-L

## Owns

Pi-facing registration and adaptation only: lifecycle hooks, agent tool definitions, command/shortcut handlers, TUI chrome affordances, autocomplete wrappers, per-turn system-prompt append hooks, dev-gated read-only introspection taps, payload/session-log query tools, workspace dialogs, and Pi-specific tool result renderers.

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
├── commands/               /brunch:* commands, shortcut, branch/tree policy
├── compaction/             auto-compaction anchor contract and future hook
├── exchanges/              structured-exchange present_* / request_* Pi tools
├── mentions/               #graph mention prompt hint + autocomplete provider
├── session-orientation/    session-entry-orientation descriptors, dialog adapter, juncture orchestrator, and gate state
├── shared/                 projection/truncation helpers + shared provider-facing tool schema adapter
└── workspace/              spec/session picker command adapter
```

`session-orientation/` owns the Specify-mode and Execute-mode menu descriptors, the dialog function (`index.ts`; custom component when `ctx.ui.custom` is available, `ctx.ui.select` fallback; escape/timeout resolves to the inert `dismissed` — entry recorded, never a kick), the UI-capable no-auth upstream gate over live `ctx.modelRegistry.getAvailable()` (J1 shows the app-supplied notice; J1–J6 otherwise do not show a dialog, append an entry, or kick; no-UI degraded paths keep the origination backstop), the juncture orchestrator that composes dialog → entry → origination → live seed delivery → live-kick with two modes — `'follow-choice'` (J2/J3/J4/J6 and J5: kick unless the resolved choice is `dismissed` or matches the menu's `noKickChoice`; Specify uses `continue`, Execute has no no-kick choice) and `'boot'` (J1: originate+kick with `resumeOrigin: 'resume_debt'` unless the user dismissed the menu, honoring degraded-mode and the menu's no-kick choice for force-seed) — (`juncture.ts`), and the Pi event registrar wiring the dialog to J1 (`session_start` reason `startup`, option-2 boot), J2 (`session_start` reasons `new`/`resume`), J3 (`session_tree`), and J4 (`agent_end` esc-abort, C3 probe) (`registrar.ts`). The explicit J6 `/brunch:consult` command is owned by `commands/index.ts`; it claims the same shared gate and routes through `runJunctureForContext`. `/brunch:continue` is also owned by `commands/index.ts`; it scans the current branch for the newest incomplete declared ask continuation, reuses the ask collector, and appends the recovered answer as the provider-legal synthetic `ask` toolCall/toolResult pair. Live junctures deliver `brunch.context_seed` before the triggering `brunch.kick` so the persisted transcript and in-memory provider context stay in sync after `AgentSession` creation. J5 uses Pi's synchronous live `sendMessage` enqueue; TUI boot's `AgentSession.sendCustomMessage` adapter in `src/app/brunch-tui.ts` preserves the same seed-before-kick order with a per-kick deferred serial chain while still returning to `session_start` immediately. J5 mode-switch is landed: the mode-switch path in `commands/index.ts` first settles any in-flight assistant turn only when abort + wait-for-idle are both observable (setting the registrar-shared suppress flag so the corresponding J4 does not fire), then fires the same juncture orchestrator with a table-selected menu when the switch target is `specify` (Specify menu) or `execute` (Execute menu). The shared `OrientationJunctureGate` is an ownership-aware claim plus resolution window: event-driven junctures read claim + window before running; J5/J6 write but do not read it, so explicit user mode switches/consults are never skipped while still suppressing ambient event echoes.

The former `tui-lab/` registrar (`registerBrunchTuiLab`, gated behind an `enabled`
option nothing ever set) was retired — it never entered the product bundle and
was inert even under Pi's ambient `.pi/extensions/` directory scan. Its
`TuiStyleLabComponent` moved to `.pi/components/tui-lab/` as a reference
component, previewable via `npm run dev:components -- tui-lab`.

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

## Migration notes

`exchanges/schemas/` is the intentional current exception to "adapter-only": it owns the Zod-authored structured-exchange details schema per D37-L/D41-L until a separate schema-ownership slice moves or names that seam. Provider-facing tool-parameter conversion is now confined to `shared/tool-schema.ts`: Zod-owned tool boundaries emit JSON Schema draft 2020-12 via `z.toJSONSchema(..., { unrepresentable: 'throw' })`, TypeBox-owned graph/DB boundaries pass through their canonical schema, and the adapter requires an object root and rejects top-level `oneOf`/`anyOf`/`allOf` before provider registration tests can go live.

Migration note (FE-1163 `tool-schema-convergence`, reopened 2026-07-10): the sweep collapsed the two legacy Zod adapters into the shared adapter with the build-time provider-legality guard (Anthropic-family backends 400 on top-level unions, witnessed live on `read_graph` during the FE-1159 walkthrough) and relinked all 51 Brunch-authored provider-facing tool schemas through that adapter. Closure evidence is being repaired against the restored ledger: object-root enforcement plus the exchanges, dev-mode, graph, context, scratchpad, and reconciliation pre/post semantic differentials are now covered; the exact 32-tool executor inventory (including both artifact registrations) and pure-TypeBox web pair are covered; all authoring-representation differentials are closed, the foreground/sealed-child subagent pair is covered, while exact 51-tool aggregate provenance remains active.

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
