# .pi/extensions/ — Pi adapter registrars

SPEC decisions: D34-L, D35-L, D37-L, D39-L, D40-L, D44-L, D52-L, D69-L, D71-L, D90-L, D91-L, D93-L, D98-L

## Owns

Pi-facing registration and adaptation only: lifecycle hooks, agent tool definitions, command/shortcut handlers, TUI chrome affordances, autocomplete wrappers, per-turn system-prompt append hooks, dev-gated read-only introspection taps, payload/session-log query tools, workspace dialogs, and Pi-specific tool result renderers.

## Does NOT own

- Agent role prompt definitions, skill resource bodies, prompt composition, and prompt-resource legality — `agents/`. `agent-runtime/` is now only the Pi hook/tool adapter for that central policy.
- Graph truth, graph mutation policy, or graph readers — top-level `graph/`.
- Pi JSONL/session semantics, runtime-state projection, workspace coordination, or transcript exchange projection — top-level `session/`, `projections/`, and related domain seams.
- Reusable DTO projection or reusable markdown/text rendering — top-level `projections/`, `agents/contexts/` for model-facing text, and local product/session owners for human/product text.
- Product transport handlers — `rpc/`, `app/`, and `web/`.

## Directory layout

```text
extensions/
├── TOPOLOGY.md
├── agent-runtime/          Pi adapter for central foreground runtime policy plus execute-mode tools
│   ├── runtime/            operational-mode Pi tool activation adapter
│   ├── system-prompts/     before_agent_start hook adapter into agents/runtime/foreground-policy
│   └── orchestrator-stub/
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
├── shared/                 projection/truncation helpers + Zod→Pi schema adapter for dev query tools
└── workspace/              spec/session picker command adapter
```

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
  .pi/extensions/* x> db/                                                            [no direct storage]
  graph/, session/    x> .pi/                                                        [domain layers never import adapters]
  agents/prompts/     x> .pi/extensions/                                             [prompt bodies do not register Pi hooks]
  projections/        x> .pi/, rpc/, app/, web/                                      [no transport/UI imports]
```

## TUI launch chrome

`chrome/` is the only product extension that should install Brunch's persistent TUI shell chrome. It receives launch facts from `src/app/brunch-tui.ts` through `BrunchChromeState`; it does not read web host, workspace, or activation state itself.

## Migration notes

`exchanges/schemas/` is the intentional current exception to "adapter-only": it owns the Zod-authored structured-exchange details schema per D37-L/D41-L until a separate schema-ownership slice moves or names that seam. Zod-to-Pi `TSchema` conversion is confined to two per-plane adapters: `exchanges/pi-schema.ts` (structured-exchange) and `shared/pi-tool-schema.ts` (dev-gated query tools). Both export JSON Schema draft 2020-12 (`z.toJSONSchema`), which strict provider validators require.

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
