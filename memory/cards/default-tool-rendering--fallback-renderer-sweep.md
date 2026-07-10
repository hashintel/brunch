# Default Pi tool renderer sweep

Frontier: default-tool-rendering
Status:   active
Mode:     sweep
Created:  2026-07-10

## Orientation

- The containing seam is Brunch's Pi adapter tool-definition surface under `src/.pi/`; the active frontier is `default-tool-rendering` (FE-1186).
- Pi owns the `ToolDefinition` contract; Brunch will project it through one `defineBrunchTool` helper rather than restating tool fields.
- The production-derived tool registry closes the inventory. This sweep covers Brunch-authored tools with no `renderCall` or `renderResult`; intentional custom renderers and Pi-owned definitions are excluded.
- Main risk: Pi renders call and result as separate slots. The one-line status contract must update the call component from `renderResult` through row-local state without exposing a second visible line; `withLateralPadding` must preserve Pi's one-column alignment in self-shell mode.

Posture: earned (inherited from `default-tool-rendering`).

## Sweep preflight

1. **Boundary:** Brunch-authored provider tools that currently rely on Pi fallback TUI rendering. Out: tools with intentional call/result renderers, Pi-owned built-ins/re-registrations, model-facing result content, and custom-message rendering.
2. **Source-of-truth inputs:** Pi's exported `ToolDefinition`, `ToolRenderContext`, `Theme`, and `defineTool` contracts; Brunch's production registrar inventory; each existing tool definition's `label` and `name`.
3. **Ownership and closure:** `src/.pi/extensions/shared/define-brunch-tool.ts` owns the default renderer; each tool family owns adoption; focused component tests and the production registry oracle close the rows.
4. **Classification:** buildable-now. The renderer contract, status inputs, and complete tool inventory exist.
5. **Closed inventory:** the required family rows below plus the shared renderer row. One newly discovered missing family may be added with justification; more than one new family or a new rendering seam routes back through `ln-plan`.

## Target contract

```text
running  ◉ Brunch: {tool.label || tool.name}  # accent dot
success  ◉ Brunch: {tool.label || tool.name}  # success dot
failure  ◉ Brunch: {tool.label || tool.name}  # error dot
         └─ all non-dot text uses the muted theme role
```

- `renderShell` is always `self`.
- `renderCall` owns the single visible `Text` component, wraps it with `withLateralPadding(component, 1)`, and stores the mutable text component in row-local renderer state.
- `renderResult` updates that text component's status dot and returns an empty component, so result text is never shown in the TUI—even when expanded.
- Tool results remain unchanged in transcript persistence and model context.

## Aggregate definition of done

No required row remains `spec`, `new`, or `partial`; every production-registered Brunch tool either carries the shared default renderer or belongs to the explicit intentional-custom/Pi-owned exclusion set.

## Ledger

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| Shared `defineBrunchTool` contract and one-line status component | `built` | ● | `earned` | `src/.pi/extensions/shared/define-brunch-tool.ts` | Reuses `src/.pi/components/lateral-padding.ts` for transparent one-column alignment. Focused tests drive running, partial, success, and error render contexts; compile/type-aware lint witnesses parameter/details/state inference. |
| Workspace/spec/session context tools | `built` | ● | `earned` | `src/.pi/extensions/brunch-data/context/index.ts` | Three tools adopt the shared renderer; focused family inventory is green and the production registry remains the aggregate closure oracle. |
| Graph tools | `built` | ● | `earned` | `src/.pi/extensions/brunch-data/graph/index.ts` | `mutate_graph` and the shared `read_graph` factory adopt the wrapper; sealed-child graph reads inherit the same renderer. |
| Elicitation scratchpad tools | `built` | ● | `earned` | `src/.pi/extensions/brunch-data/elicitation/scratchpad-tools.ts` | Read/update pair adopts the shared renderer; family inventory and behavior tests are green. |
| Reconciliation tools | `built` | ● | `earned` | `src/.pi/extensions/brunch-data/reconciliation/index.ts` | Read/update pair adopts the shared renderer; family registration and behavior tests are green. |
| Dev session/introspection query tools | `built` | ● | `earned` | `src/.pi/extensions/dev-mode/{session-query,introspect-query}/index.ts` | Both query factories now use `defineBrunchTool`; focused dev-query and introspection suites are green. |
| Executor tool family | `partial` | ● | `earned` | `src/.pi/extensions/executor/execute-*/index.ts` | Closed by the production executor registrar inventory; observer-only `execute-run-updates` is not a tool row. |
| Standalone alternatives tool | `partial` | ● | `earned` | `src/.pi/components/alternatives.ts` | Its custom-message card renderer remains unchanged; only the fallback-rendered tool receipt adopts the wrapper. |
| Sealed-child worktree writer | `partial` | ● | `earned` | `src/.pi/extensions/subagents/session.ts` | `write_worktree_file` is Brunch-authored; SDK read tools and custom-rendered web tools stay excluded. |
| Production-registry classification oracle | `spec` | ● | `earned` | `src/.pi/extensions/__tests__/registry.test.ts` | Derive registered definitions, assert wrapper rendering on the fallback set, and pin the explicit custom/Pi-owned exclusion set without source-text scanning. |
| Intentional custom-renderer families | `have` | ○ | `earned` | Existing exchange, subagent, web, and agent-runtime owners | Must remain byte/behavior unchanged; guarded by their existing renderer suites. |

## Invariants preserved

- Existing custom-rendered structured exchanges keep their family-specific transcript behavior — guarded by: `src/.pi/extensions/__tests__/exchanges-extension.test.ts` and exchange renderer suites.
- `subagent`, `web_fetch`, `web_search`, and agent-runtime Pi-tool renderers remain unchanged — guarded by: existing subagent/web/runtime tests plus registry classification.
- Tool `execute` results, details, schemas, and model-facing content remain unchanged — guarded by: `src/.pi/extensions/__tests__/tool-schema.test.ts`, registry/schema baselines, and existing family tests.
- `present_alternatives` keeps its custom-message card renderer — guarded by: existing alternatives component tests and registry behavior tests.

## Verification approach

- **Inner:** focused wrapper/component tests plus type-aware lint — proves status transitions, one-line output, empty result slot, one-column lateral padding, label/name selection, and generic inference.
- **Middle:** production-registry classification — proves every in-boundary tool adopts the wrapper and every excluded tool already owns intentional rendering.
- **Regression:** existing family suites — prove no custom renderer or provider-facing tool contract changed.
- **Gate:** `npm run verify`.

## Expected touched paths (tentative)

```text
memory/
├── PLAN.md                                                        ~
└── cards/default-tool-rendering--fallback-renderer-sweep.md       +
src/.pi/
├── components/alternatives.ts                                     ~
└── extensions/
    ├── TOPOLOGY.md                                                 ~
    ├── __tests__/registry.test.ts                                  ~
    ├── shared/
    │   ├── define-brunch-tool.ts                                   +
    │   └── define-brunch-tool.test.ts                              +
    ├── brunch-data/
    │   ├── context/index.ts                                        ~
    │   ├── elicitation/scratchpad-tools.ts                         ~
    │   ├── graph/index.ts                                          ~
    │   └── reconciliation/index.ts                                 ~
    ├── dev-mode/
    │   ├── introspect-query/index.ts                               ~
    │   └── session-query/index.ts                                  ~
    ├── executor/execute-*/index.ts                                 ~
    └── subagents/session.ts                                        ~
```

No exchange, web-tool, foreground-subagent-renderer, or agent-runtime-renderer source file is in the write manifest.

## Promotion / disposal rule

If a row reveals a genuinely different renderer contract rather than wrapper adoption, promote that family to its own PLAN frontier and leave the row open until it lands. Delete this ledger after all required rows are `built` and `ln-sync` reconciles `memory/PLAN.md` plus `src/.pi/extensions/TOPOLOGY.md`.
