# tool-schema-convergence — sweep ledger

Mode: sweep
Frontier: `tool-schema-convergence` (memory/PLAN.md) · [FE-1163](https://linear.app/hash/issue/FE-1163/tool-schema-convergence-one-adapter-two-schema-sources-build-time)
Authored: 2026-07-07 (ln-plan; ledger mapped at admission per user request — ln-scope refines row slices before build)

## Layer boundary

**In:** every Brunch-authored tool schema that reaches a provider as `input_schema` — all `pi.registerTool` / `defineTool` sites under `src/.pi/extensions/**` (46 tools, 9 families; re-based 2026-07-08 after FE-1164 retired `present_question` + `request_response` and registered `ask`).

**Out:**

- Pi's own built-in tool schemas, including the 4 read-only re-registrations in `agent-runtime/runtime/index.ts` (`read`/`grep`/`find`/`ls` spread `getReadOnlyTools(...)` — Brunch overrides render/execute, never the schema).
- Non-provider-facing schema use: RPC method params (`src/rpc/**`), web/query schemas, graph command-layer schemas (they stay canonical *sources* for tool rows, not rows themselves).

## Convergence rule (the one property this sweep normalizes)

Every in-boundary tool's `parameters` is produced by **one shared adapter** (`src/.pi/extensions/shared/tool-schema.ts`, consolidating today's duplicate `exchanges/pi-schema.ts` + `shared/pi-tool-schema.ts`) from a runtime schema with **two permitted sources**:

- **Zod v4** (`z.toJSONSchema(..., { unrepresentable: 'throw' })`) where the tool boundary owns the shape (exchanges, dev-mode, and any future boundary-owned tool).
- **TypeBox** where the graph/DB layer already owns the shape (graph, executor, and other `Static<typeof …>` families) — no re-declaration of graph truth in Zod (source-of-truth rule; `mutate_graph` embeds `NODE_DETAIL_JSON_SCHEMAS`/`CLAIM_FORM_JSON_SCHEMAS` from the drizzle-typebox layer).

The adapter enforces **provider legality at authoring time**: throw on top-level `oneOf`/`anyOf`/`allOf` (Anthropic-family 400, witnessed live 2026-07-07 on `read_graph`), so an illegal schema fails unit tests, not a live turn. Hand-authored `as const` JSON literals are retired as an authoring style.

Context that bounds ambition: pi-ai already validates every tool call against `parameters` pre-execute (`validateToolArguments`, TypeBox `Value.Check` + coercion). Rows do **not** add a redundant validation layer; Zod-family `.parse()` at execute stays as defense-in-depth where it already exists.

## Aggregate DoD

No required (`●`) row remains `spec` / `partial`. Concretely: both legacy adapters deleted; no in-boundary `parameters:` site bypasses the shared adapter; the registry-wide legality oracle is green; `npm run verify` green.

## Rows

Status vocabulary: `spec` (defined, not built) · `partial` · `done`. One row = one family normalized (shared authoring site), except rows 1 and 11 which are the seam and the oracle.

| # | Req | Row | Owner (authoring site) | Source kind | Status | Closure oracle |
|---|-----|-----|------------------------|-------------|--------|----------------|
| 1 | ● | `shared-adapter` — single adapter with legality guard; delete `exchanges/pi-schema.ts` + `shared/pi-tool-schema.ts` | `src/.pi/extensions/shared/tool-schema.ts` (new) | both | spec | adapter unit test (legal passes, top-level-union throws); zero imports of the two retired adapters |
| 2 | ● | `exchanges-family` (4: `ask`, `present_review_set`, `present_candidates`, `present_digest` — re-based 2026-07-08 for FE-1164; `present_question`/`request_response` retired). **Legality note:** `zAskParams` is deliberately one object + `superRefine`, *not* `z.union` — a top-level union would emit the exact `anyOf` illegality row 1's guard rejects; do not "normalize" it into a union. | `src/.pi/extensions/exchanges/*.ts` | Zod (already) | spec | emitted JSON schema unchanged (snapshot before/after relink); existing exchange tests green |
| 3 | ● | `dev-mode-family` (2: `brunch_session_query`, `brunch_introspect_query`) | `src/.pi/extensions/dev-mode/*/index.ts` | Zod (already) | spec | same relink oracle as row 2 |
| 4 | ● | `graph-family` (2: `read_graph`, `mutate_graph`) — retire `read_graph`'s hand literal to TypeBox builder; both through adapter | `src/.pi/extensions/brunch-data/graph/tool-schemas.ts` | TypeBox | spec | `brunch-data-graph.test.ts` + `observed-shapes-coverage` + `spec-ownership` green; emitted schema semantically unchanged |
| 5 | ● | `context-family` (3: `read_workspace_context`, `read_specification_context`, `read_session_context`) — literals → TypeBox builder + adapter | `src/.pi/extensions/brunch-data/context/index.ts` | TypeBox | spec | context tool tests green; schema snapshot unchanged |
| 6 | ● | `scratchpad-family` (2: `read_elicitation_scratchpad`, `update_elicitation_scratchpad`) — literals → TypeBox + adapter | `src/.pi/extensions/brunch-data/elicitation/scratchpad-tools.ts` | TypeBox | spec | scratchpad tests green; snapshot unchanged |
| 7 | ● | `reconciliation-family` (2: `read_reconciliation_needs`, `update_reconciliation_needs`) — literals → TypeBox + adapter; nested `target.oneOf` is legal (below top level), keep | `src/.pi/extensions/brunch-data/reconciliation/index.ts` | TypeBox | spec | reconciliation tests green; snapshot unchanged |
| 8 | ● | `executor-family` (27 `execute_*` tools incl. both host-promotion tools) — already TypeBox builders; route through adapter | `src/.pi/extensions/executor/execute-*/index.ts` | TypeBox | spec | executor tool tests green; registry-wide legality oracle covers execute-mode toolset |
| 9 | ● | `web-tools-family` (2: `web_fetch`, `web_search`) | `src/.pi/extensions/web-tools/web/*.ts` | TypeBox | spec | web-tools tests green; snapshot unchanged |
| 10 | ● | `subagents-family` (2: `subagent`, `write_worktree_file`) | `src/.pi/extensions/subagents/{index,session}.ts` | TypeBox | spec | subagents tests green; snapshot unchanged |
| 11 | ● | `registry-legality-oracle` — widen the FE-1159 Tier-2 assertion (elicitor boot payload only, 21 tools) to the **full registry across modes** (elicitor + executor toolsets; static registration-level test, not just one boot payload) | `src/dev/__tests__/` (+ support) | n/a | spec | one test enumerates every registered in-boundary tool and asserts adapter provenance + no top-level union |
| 12 | ○ | `pi-readonly-reregistrations` (4: `read`, `grep`, `find`, `ls`) — Pi-owned schemas, tripwired: acts only if a Pi upgrade ships an illegal schema (row 11's oracle would catch it) | `src/.pi/extensions/agent-runtime/runtime/index.ts` | Pi upstream | deferred | covered transitively by row 11 |
| 13 | ● | `exchanges-blank-carriers` — extend the trim-based `zNonBlankMarkdown` boundary across the remaining required prose carriers that still accept blank: candidate rubric fields, `zPresentOption.content`, `zAnsweredOptionEcho.content` (folded 2026-07-08 from the retired Horizon `blank-carrier-sweep`; ask params already born non-blank per FE-1164). Different property from the adapter rule but same authoring sites as row 2 — close it while row 2's files are open. | `src/exchanges/schemas/present.ts` / `request.ts` | Zod | spec | schema unit tests reject blank/whitespace values per carrier; existing exchange suites green |

Row-count note: 4+2+2+3+2+2+27+2+2 = **46 in-boundary tools**; enumeration verified 2026-07-07 against `rg "registerTool|defineTool"` plus the Tier-2 provider payload dump, re-based 2026-07-08 after the FE-1164 ask cutover (exchanges 5 → 4). Re-verify the enumeration at row-1 build time — this ledger has already absorbed one membership change from a parallel lane.

## Rider (not a row)

- **D117-L sweep-classifier constant anchoring** (2026-07-08 grill; direct fix, not a sweep property): `src/projections/session/sweep-watermark.ts` still classifies the exchange terminal by the raw `'ask'` string literal — the same fixture-vs-real drift class as W1, which this ledger was already told to stay alert for. Land it while row 2's exchanges files are open: anchor the classifier to the canonical terminal-name constant (`ASK_TOOL`, today in `src/.pi/extensions/exchanges/ask.ts`). Watch dependency direction: `src/projections/` should not import from `src/.pi/extensions/`, so the constant likely hoists into the `src/exchanges/` core (D108-L home) with the extension re-exporting it — resolve at build time. Outside the layer boundary and the convergence rule, so it is **not** a row and does not enter the row count or aggregate DoD; the FE-1164 regression test in `sweep-watermark.test.ts` guards the behavior either way.

## Sequencing inside the sweep

Row 1 first (everything relinks through it), row 11 second (oracle watches the rest of the pass), then families in any order — suggested: 2–3 (pure relinks, no schema rewrite) before 4–7 (literal→TypeBox rewrites, need snapshots) before 8–10 (bulk relink).

## Promotion / disposal rule

A row escapes to its own PLAN frontier only if it stops being row-sized (e.g. a family rewrite forces a schema-behavior change visible to the model). Adding >1 missing row means the inventory was not closed — stop, route back through `ln-plan`. Ledger is exhausted only when every `●` row is `done`; then delete this file (aggregate evidence goes to the frontier's completion note).

## Candidate durable promotions (record via ln-sync at first landing)

- SPEC decision: the two-source authoring rule + single adapter seam.
- SPEC invariant candidate: "every provider-facing tool schema is provider-legal at build time" (supersedes ad-hoc vigilance; the FE-1159 walkthrough 400 is the motivating evidence).
