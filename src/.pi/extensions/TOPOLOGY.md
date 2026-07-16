# .pi/extensions/ — Pi adapter registrars

SPEC decisions: D24-L, D34-L, D35-L, D37-L, D39-L, D40-L, D43-L, D44-L, D52-L, D69-L, D71-L, D90-L, D91-L, D93-L, D98-L, D109-L, D119-L, D120-L, D121-L, D122-L, D123-L, I19-L, I28-L

## Owns

Pi-facing registration and adaptation only: lifecycle hooks, agent tool definitions, command/shortcut handlers, TUI chrome affordances, autocomplete wrappers, per-turn system-prompt append hooks, dev-gated read-only introspection taps, workspace dialogs, and Pi-specific tool result renderers. Current-state adapters require Pi's `SessionManager.getBranch()`; they do not fall back to append-order `getEntries()` (D24-L, I19-L).

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
├── dev-mode/               dev-gated passive observability
│   └── introspection/      passive provider-payload tap + /introspect command
├── web-tools/              web_fetch/web_search read tools for referenced-document acquisition
│   └── web/
├── subagents/              D44-L/D91-L sealed SDK child sessions and `subagent` tool
├── chrome/                 identity header/title, one-time welcome widget, stable telemetry footer, editor shell
├── commands/               /brunch:* commands (`spec-menu` workspace picker), alt+s/mode shortcuts, branch/tree policy (exception: /brunch:land registers in executor/execute-land/ beside its read-only preflight tool)
├── compaction/             D43-L anchor contract + one session_before_compact native custom result
├── exchanges/              structured-exchange present_* + ask Pi tools
├── mentions/               #graph mention prompt hint + autocomplete provider
├── session-orientation/    session-entry-orientation descriptors, dialog adapter, juncture orchestrator, and gate state
├── shared/                 default Brunch tool definition/rendering + provider-facing schema adapter
└── workspace/              spec/session picker command adapter
```

`session-orientation/` owns the Pi-facing style/process-move menus and juncture choreography (D98-L/D109-L). Specify always exposes the three persistent styles and marks/preselects the current style; its deterministic fallback hides `move_to_execution`. Execute's deterministic fallback exposes only `prepare_execution`. Pure caller-supplied availability may reveal only the matching mode-appropriate process moves; the conservative local fallback has no evaluator/model dependency. A selected changed style appends `brunch.elicitation_style`; a selected action appends `brunch.process_move`; same-style selection appends nothing but may still originate, while Escape/timeout, unavailable choices, and append failure produce no carrier, seed, or kick. Automatic menu opening is limited to style-less startup and operational-mode switch. Established startup follows normal boot origination without a menu; resume, session switch, tree navigation, and assistant abort register no orientation juncture. `/brunch:consult` explicitly reopens the current-mode menu and `/brunch:continue` remains the resume-interrupted-work path. Provider-auth gating and seed-before-kick delivery remain shared with the existing origination seam.

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

`chrome/` is the only product extension that should install Brunch's persistent TUI shell chrome. It receives launch facts from `src/app/brunch-tui.ts` through `BrunchChromeState`; it does not read web host, workspace, or activation state itself. New spec/session facts install one borderless non-transcript welcome widget once; the persistent editor carries mode/spec identity and the stable footer carries only optional web URL plus model/thinking/context telemetry.

## Provider-facing tool schemas

Provider-facing tool-parameter conversion is confined to `shared/tool-schema.ts`: Zod-owned tool boundaries emit JSON Schema draft 2020-12 via `z.toJSONSchema(..., { unrepresentable: 'throw' })`, while TypeBox-owned graph/DB boundaries pass through their canonical schema. The adapter requires an object root and rejects top-level `oneOf`/`anyOf`/`allOf`; `registry.test.ts` derives the complete 50-tool registrar/catalog inventory, rejects duplicate registrations, and pins adapter provenance and these bounded provider constraints. Compatibility beyond them remains tripwired to provider/model changes or live rejection evidence.

## Shared default tool rendering

`shared/define-brunch-tool.ts` owns the canonical self-shell one-line status renderer for Brunch-authored tools that do not need family-specific transcript rendering. `shared/tool-activity-labels.ts` maps every shared-default tool name to concise user-facing activity text; the production inventory test requires exact coverage so raw provider identifiers cannot leak into receipts. Its status-transition contract is scoped to Pi's live interactive TUI lifecycle; Pi HTML export remains an unsupported built-in under D34-L and is not a compatibility surface for this adapter. The production-derived registry classifies 39 shared-default tools, 11 intentional-custom tools, and 4 Pi-owned re-registrations; custom and Pi-owned renderers remain outside the wrapper. The custom set includes the four executor tools with dedicated result renderers (`execute_orchestrate`, `execute_plan_check`, `execute_snapshot`, and `execute_status`).

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
