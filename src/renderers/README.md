# renderers/ — reusable lossy text rendering

SPEC decisions: D52-L, D60-L, D62-L, D83-L

## Owns

Reusable lossy renderers that turn domain or projection inputs into markdown, compact text, TOON-like summaries, or toolResult content text.

**Context-render house style (D83-L).** LLM-facing agent context renders use one dialect: a markdown frame via **md-pen** (`markdown.ts` wrapper seam), uniform record sets as **TOON** via `@toon-format/toon` (`toon.ts` wrapper seam), file hierarchy as a fenced ` ```tree ` block from a pure-JS tree renderer (stringify-tree) fed by `workspace/cwd-inventory.ts` (never the system `tree` binary), and each top-level block wrapped in an XML-style `<section>` tag. Format follows reader legibility, not internal shape — prose where structure would mislead (e.g. the neighborhood no-structural-leak rule). Agent context clusters into `<workspace>` / `<specification>` / `<session>` scopes (D19-L); these are distinct from the `workspace.state` product-state projection (D60-L). Rollout is incremental (workspace + specification first); this frontier's ledger re-scopes around the dialect as renderers migrate.

Renderers may import input types from `projections/`, `graph/`, `session/`, or `workspace/`, but they do not construct canonical DTOs, register Pi tools, handle RPC, or import web/app adapters.

## Directory layout

```pseudo
renderers/
  markdown.ts            shared md-pen-backed markdown helpers (○ primitive)
  toon.ts                @toon-format/toon record-set helpers (○ primitive)
  tree.ts                stringify-tree ASCII hierarchy helpers (○ primitive)
  section.ts             XML-style context section wrapper (○ primitive)
  graph/                 graph overview/neighborhood/command markdown
  session/               transcript + runtime-frame markdown
  specification/         selected-specification context markdown
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
| `graph/graph-slice.ts` (`formatGraphOverview`) | `read_graph` overview/list modes; origination context seed full graph overview | ✓ locked | `read_graph` text; `brunch.context_seed` graph section | Tool result markdown | G-D dual markdown tables: legend, plane·band node sections, impact-normalized edge table, uncapped golden/invariants, and a band-filtered invariant that dual-band nodes group under the requested band and nonmatching filtered nodes fail loud. |
| `graph/node-neighborhood.ts` (`formatNeighborhood`) | `read_graph` neighborhood mode | ✓ locked | `read_graph` text | Tool result markdown | G-C prose: anchor node, upstream/downstream/lateral sections, per-section compact density via `maxExpandedEdges`, deeper-hop relation line, and invariants for stable codes, `{hard}`-only strength, and no raw ids/role tokens. |
| `graph/commit-result.ts` | Future command-result text, if needed | ○ deferred | none current | none current | Leave outside until a live consumer appears. |
| `graph/reconciliation-needs.ts` | Future reconciliation rendering | ○ topology stub | none current | none current | Leave untouched until coherence/reconciliation surfaces activate. |
| `workspace/workspace-state.ts` | print-mode `workspace.state` | ◐ partial | n/a | Print-mode state text | Remaining: decide the `brunch print` house-style/status fork, then add preview/golden if it stays durable. |
| `workspace/workspace-context.ts` | `read_workspace_context`; origination context seed workspace section | ✓ locked | `read_workspace_context` text; `brunch.context_seed` workspace section | Tool result markdown | `workspace/__tests__/workspace-context.test.ts` + `workspace/__previews__/*`; invariants for `<workspace>` wrapper, no sessions, table specs, fenced topology, and no ATX headings. |
| `specification/specification-context.ts` | `read_specification_context` | ✓ locked | `read_specification_context` text | Tool result markdown | `specification/__tests__/specification-context.test.ts` + `specification/__previews__/specification-context.md`; embeds the shared G-D graph overview and locks `<specification>` wrapper, Overview → Graph → Gaps → Sessions order, spec-scoped sessions, TOON gaps, and no ATX headings. |
| `session/readiness-estimate.ts` | Shared soft-readiness line for seed + specification context | ✓ locked | `brunch.context_seed`; `read_specification_context` overview line | Tool result markdown where embedded | `agent-context-seed.test.ts` + `specification-context.test.ts`; parity invariant keeps seed/specification readiness over the same full gap register. |
| `session/runtime-frame.ts` | `read_session_context` | ✓ locked | `read_session_context` text | Tool result markdown | `session/__tests__/runtime-frame.test.ts` + `session/__previews__/runtime-frame-ready.md`; invariant for projected handles. |
| `session/transcript.ts` | Brunch-semantic transcript rendering | ◐ partial | Probe/report transcript markdown | Transcript/report text, not Pi live display | Remaining: migrate `<session>` transcript shape into the renderer home when the session context render is scoped. |
| `exchanges/request-answer.ts` | `request_answer` | ◐ partial | Request result text | Tool result `renderResult` via exchange markdown adapter | Remaining: request-family goldens for answered/non-answered branches; invariants for cancel/unavailable copy and comments. |
| `exchanges/request-choice.ts` | `request_choice` | ◐ partial | Request result text | Tool result `renderResult` via exchange markdown adapter | Remaining: request-family goldens for answered/non-answered branches; invariants for label escaping and comments. |
| `exchanges/request-choices.ts` | `request_choices` | ◐ partial | Request result text | Tool result `renderResult` via exchange markdown adapter | Remaining: request-family goldens for answered/non-answered branches; invariants for editor/error branches and comments. |
| `exchanges/request-review.ts` | `request_review` | ◐ partial | Request result text | Tool result `renderResult` via exchange markdown adapter | Remaining: request-family goldens for approve/change/reject + non-answered branches. |
| `exchanges/present-question.ts` | `present_question` | ◐ partial | Present result text | Tool result `renderResult` via exchange markdown adapter | Remaining: present-family golden for heading/body/options. |
| `exchanges/present-review-set.ts` | `present_review_set` | ◐ partial | Present result text / structural-illegal text | Tool result `renderResult` via exchange markdown adapter | Remaining: present-family review-set narration + no raw internal refs invariant. |
| `exchanges/present-candidates.ts` | `present_candidates` | ◐ partial | Present result text | Tool result `renderResult` via exchange markdown adapter | Projection/renderer/registration tests cover candidate title + user rubric rendering and meta-rubric suppression; remaining: house-style golden if candidate output becomes drift-prone. |
| `markdown.ts` | shared md-pen-backed markdown escaping/helpers | ○ primitive | indirect | indirect | Unit-covered substrate; existing graph goldens guard byte-stable helper behavior. |
| `toon.ts` | @toon-format/toon record-set + fenced-block helpers | ○ primitive | future context rows | future context rows | Unit-covered substrate; first real context render consumes it in Card 2/3. |
| `tree.ts` | stringify-tree hierarchy + fenced-block helpers | ○ primitive | future documents tree | future documents tree | Unit-covered substrate; workspace documents tree consumes it in Card 2. |
| `section.ts` | XML-style context section wrapper | ○ primitive | future context rows | future context rows | Unit-covered substrate; context scope renders consume it in Card 2/3. |

## Agent-tool render anchor

Tool-owned render targets are ledgered by their durable renderer row when they use `src/renderers/` directly:

- Graph tools: `read_graph` overview/list modes are covered by `graph/graph-slice` (G-D) and neighborhood mode by `graph/node-neighborhood` (G-C); `mutate_graph` currently formats command outcomes in the graph extension adapter, not a reusable renderer row. **Gap:** `read_graph` `related` mode is rendered by `formatRelatedNodesResult` in `.pi/extensions/graph/command-adapter.ts` (not a `renderers/` row) and still emits structural leaks (`-[category/direction]->` arrows, raw `#id`, `plane/kind`) — it must migrate onto the prose vocabulary and relocate into `renderers/` (tracked under `renderer-golden-coverage` in `memory/PLAN.md`).
- Elicitation-gap tools: `read_elicitation_gaps` and `update_elicitation_gaps` format in `src/.pi/extensions/elicitation`; no renderer row is admitted until a second consumer or drift-prone reusable surface appears.
- Context tools: `read_workspace_context` is covered by `workspace/workspace-context`; `read_specification_context` is covered by `specification/specification-context`; `read_session_context` is covered by `session/runtime-frame`.
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
