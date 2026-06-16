# renderers/ — reusable lossy text rendering

SPEC decisions: D52-L, D60-L, D62-L

## Owns

Reusable lossy renderers that turn domain or projection inputs into markdown, compact text, TOON-like summaries, or toolResult content text.

Renderers may import input types from `projections/`, `graph/`, `session/`, or `workspace/`, but they do not construct canonical DTOs, register Pi tools, handle RPC, or import web/app adapters.

## Directory layout

```pseudo
renderers/
  markdown.ts            shared markdown helpers (○ primitive)
  toon.ts                compact structured-data rendering stub (○ primitive/stub)
  graph/                 graph overview/neighborhood/command markdown
  session/               transcript + runtime-frame markdown
  exchanges/             durable exchange markdown
  workspace/             print/workspace-context markdown
```

## Dependency direction

```pseudo
renderers/* -> projections/, graph/, session/, workspace/ [input types/data]
renderers/  x> .pi/, rpc/, app/, web/
```

## Preview / golden authority

Renderer goldens stay test-local: each renderer's co-located test lives under `src/renderers/<domain>/__tests__/` and calls the renderer directly, writing markdown snapshots to the sibling `src/renderers/<domain>/__previews__/` via stock Vitest `toMatchFileSnapshot('../__previews__/<name>.md')` — no custom snapshot helper. Use `npm run test:renderers:update` to review/accept renderer preview diffs. Do not introduce a shared `npm run render` harness until a second non-test preview consumer appears.

Ledger statuses:

- `● required` — durable renderer row; must have a golden plus at least one semantic invariant.
- `◐ partial` — real renderer with some oracle coverage but missing the required golden/invariant pair.
- `✓ locked` — required row is covered.
- `○ deferred/stub/primitive` — intentionally outside this coverage frontier.

## Renderer ledger

| Row | Owner | Status | Agent-context toolResult target | TUI / presenter target | Oracle / next |
| --- | --- | --- | --- | --- | --- |
| `graph/graph-slice.ts` (`formatGraphSlice`) | `read_graph` overview/list modes; context seed full graph overview | ✓ locked | `read_graph` text; `brunch.context_seed` graph section | Tool result markdown | `graph/__tests__/graph-slice.test.ts` + `graph/__previews__/*`; invariants for bounded output / structural leakage. |
| `graph/node-neighborhood.ts` (`formatNeighborhood`) | `read_graph` neighborhood mode | ✓ locked | `read_graph` text | Tool result markdown | `graph/__tests__/node-neighborhood.test.ts` + `graph/__previews__/*`; invariants for stable codes and no raw ids/role tokens. |
| `graph/commit-result.ts` | Future command-result text, if needed | ○ deferred | none current | none current | Leave outside until a live consumer appears. |
| `graph/reconciliation-needs.ts` | Future reconciliation rendering | ○ topology stub | none current | none current | Leave untouched until coherence/reconciliation surfaces activate. |
| `workspace/workspace-state.ts` | print-mode `workspace.state` | ◐ partial | n/a | Print-mode state text | Card 2: add preview/golden; keep existing invariants for retired chrome/readiness fields. |
| `workspace/workspace-context.ts` | `read_workspace_context`; origination context seed workspace section | ◐ partial | `read_workspace_context` text; `brunch.context_seed` workspace section | Tool result markdown | Card 2: keep and lock both `cwd_inventory` and `workspace_overview`; live caller confirmed via `session/workspace-context.ts`. |
| `session/runtime-frame.ts` | `read_session_context` | ✓ locked | `read_session_context` text | Tool result markdown | `session/__tests__/runtime-frame.test.ts` + `session/__previews__/runtime-frame-ready.md`; invariant for projected handles. |
| `session/transcript.ts` | Brunch-semantic transcript rendering | ◐ partial | Probe/report transcript markdown | Transcript/report text, not Pi live display | Card 3: move text-shape lock into renderer home; keep parsing/wrapper tests in `session/`. |
| `exchanges/request-answer.ts` | `request_answer` | ◐ partial | Request result text | Tool result `renderResult` via exchange markdown adapter | Card 4: answered + non-answered goldens; invariants for cancel/unavailable copy and comments. |
| `exchanges/request-choice.ts` | `request_choice` | ◐ partial | Request result text | Tool result `renderResult` via exchange markdown adapter | Card 4: answered + non-answered goldens; invariants for label escaping and comments. |
| `exchanges/request-choices.ts` | `request_choices` | ◐ partial | Request result text | Tool result `renderResult` via exchange markdown adapter | Card 4: answered + non-answered goldens; invariants for editor/error branches and comments. |
| `exchanges/request-review.ts` | `request_review` | ◐ partial | Request result text | Tool result `renderResult` via exchange markdown adapter | Card 4: approve/change/reject + non-answered goldens. |
| `exchanges/present-question.ts` | `present_question` | ◐ partial | Present result text | Tool result `renderResult` via exchange markdown adapter | Card 5: heading/body golden + invariant. |
| `exchanges/present-options.ts` | `present_options` | ◐ partial | Present result text | Tool result `renderResult` via exchange markdown adapter | Card 5: hidden option-id comment + escaping invariant. |
| `exchanges/present-review-set.ts` | `present_review_set` | ◐ partial | Present result text / structural-illegal text | Tool result `renderResult` via exchange markdown adapter | Card 5: review-set narration + no raw internal refs invariant. |
| `exchanges/present-candidates.ts` | `present_candidates` named stub | ○ topology stub | none current | none current | Leave explicit stub until the candidate seam has a live consumer. |
| `markdown.ts` | shared markdown escaping/helpers | ○ primitive | indirect | indirect | Covered through owning renderers; no standalone golden. |
| `toon.ts` | compact structured-data rendering placeholder | ○ primitive/stub | none current | none current | Leave outside until a real row consumes it. |

## Agent-tool render anchor

Tool-owned render targets are ledgered by their durable renderer row when they use `src/renderers/` directly:

- Graph tools: `read_graph` is covered by `graph/graph-slice` and `graph/node-neighborhood`; `mutate_graph` currently formats command outcomes in the graph extension adapter, not a reusable renderer row.
- Elicitation-gap tools: `read_elicitation_gaps` and `update_elicitation_gaps` format in `src/.pi/extensions/elicitation`; no renderer row is admitted until a second consumer or drift-prone reusable surface appears.
- Context tools: `read_workspace_context` is covered by `workspace/workspace-context`; `read_session_context` is covered by `session/runtime-frame`.
- Structured-exchange tools: `present_*` and `request_*` rows are the exchange renderer family above; TUI presentation currently delegates to each tool's `renderResult` adapter over the same markdown text, so lock mechanism follows the renderer row unless a component-specific display diverges.
- Base file floor (`read`, `grep`, `find`, `ls`) and dev-only tools (`brunch_session_query`, `brunch_introspect_query`) are Pi/dev tool surfaces, not renderer-frontier rows.

## Entry-copy surfaces

Provider-visible strings composed outside `src/renderers/` carry the same drift risk as renderer text. They are tracked here for wording-oracle disposition, but remain owned by their source modules.

| Surface | Owner | Status | Oracle / next |
| --- | --- | --- | --- |
| `kickTurnMessage` | `src/session/originate-assistant-turn.ts` | ◐ partial | Origination follow-up Card 3 locks D78-L wording; not part of renderer coverage cards. |
| Mention-staleness hints | `src/session/mention-ledger.ts` / turn-boundary reconciler | ○ review-only | No renderer row until copy changes or drift appears. |
| Session lifecycle notices | `src/.pi/extensions/session/lifecycle.ts` | ○ review-only | Keep owner-local unless promoted by a wording bug. |
| Compaction copy / anchor rationale | `src/.pi/extensions/compaction/index.ts` | ○ review-only | Contract prose, not a renderer row. |
| Seed framing | `src/session/context-seed.ts` | ◐ partial | Covered indirectly through origination/context tests today; promote only if wording churn continues. |
