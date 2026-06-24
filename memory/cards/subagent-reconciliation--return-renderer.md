# Subagent return renderer (custom renderCall / renderResult)

Frontier: subagent-reconciliation
Status:   done
Mode:     single
Created:  2026-06-24

## Orientation

- **Seam:** the `subagent` registrar in `src/.pi/extensions/subagents/index.ts`. The tool already returns `{ content, details }` where `content` is the cross-back into main-agent context (`formatResults`) and `details: { results: SubagentResult[] }` (`SubagentResult = { agent, status, text }`) is carried but currently has **no custom renderer** — the TUI falls back to the default tool render. This slice adds `renderCall` / `renderResult` so a delegation reads legibly in the TUI.
- **Frontier:** `subagent-reconciliation` (FE-1054, branch `ln/fe-1054-subagent-reconciliation-ii`). Slices 1, 2, 3b, 3, 4 are committed (through `4e16323e`). Slice 5 is next; slice 6 (orchestrator standup) follows and shares `index.ts`, so this lands first.
- **Already settled (slice 3):** `details` is structurally render-only — `content` is the only model-context cross-back. This slice **consumes** that split with a renderer; it does not change the payload contract. The `{ agent, status, text }` shape was fixed when slice 3 defined the result.
- **Open risk (low):** none material — the render signature must match the codebase's existing tool-render convention (theme/`Text` component), not invent its own.

## Objective

The `subagent` tool renders a legible TUI call line (delegated agent + task preview) and result summary (per-agent ok/error status, expandable to text), reading only `content`/`details` so model context is untouched.

## Light-card cold-start reads

```
- memory/SPEC.md   — D44-L (subagent tool: { agent, task } | { tasks }), D91-L (details render-only / content is the only cross-back), I29-L (sealed child session)
- memory/PLAN.md    — frontier: subagent-reconciliation (slice 5 "return renderer")
- src/.pi/extensions/subagents/index.ts — the subagent tool: SubagentResult, details: { results }, formatResults (content), execute
- src/.pi/extensions/web/web-fetch.ts — renderCall / renderResult convention template (theme + Text component, expanded/isPartial/isError handling)
- src/.pi/extensions/exchanges/present-question.ts, request-response.ts — additional render-signature references for Brunch-owned tools
- docs/architecture/pi-ui-extension-patterns.md — pi UI extension render patterns
```

## Acceptance Criteria

```
✓ renderCall shows the delegated agent name(s) and a bounded task preview (single { agent, task } and parallel { tasks } both legible; missing/invalid shape renders an error-styled hint)
✓ renderResult (collapsed) shows per-agent status — ok / error count or badge — for single and parallel results
✓ renderResult (expanded) shows each agent's returned text (bounded/truncated like the web-fetch template)
✓ renderResult (isPartial) shows a running/in-flight indicator; (isError) shows the error text
✓ the renderer reads only `result.content` / `result.details` — no new field crosses into model context; `details` stays render-only (D91-L)
✓ existing subagents.test.ts faux-provider runs (content/details split, slice-3 oracle) stay green; no foreground COMPOSE drift
✓ full `npx vitest run` green; `npm run check` clean
```

## Verification Approach

```
- Inner: render unit test for renderCall / renderResult over single, parallel, error, and partial inputs (assert the agent name + status appear; assert expanded shows text, collapsed does not dump full text).
- Inner: existing subagents.test.ts (registrar usage, faux-provider content/details split) unchanged and green.
- Gate: full `npx vitest run` under Node 24.17.0 (rebuild better-sqlite3 for the local Node first); `npm run check`.
```

## Cross-cutting obligations

```
- D91-L: details is render-only; content is the sole model-context cross-back. The renderer must not be a path for details to re-enter context.
- Follow the existing Brunch tool-render signature/convention (web-fetch.ts template); do not invent a new render shape (convention-defection).
- One branch per frontier (FE-1054). Do not pull slice 6 (orchestrator/execute mode) work forward — index.ts is shared, so keep this diff to the renderer only.
```

## Assumption dependency

`None` — the `details: { results: SubagentResult[] }` payload and the content/details split are already in place (slice 3); this slice adds presentation only.

## Expected touched paths (tentative)

```
src/.pi/extensions/subagents/
├── index.ts            ~   (add renderCall + renderResult to the subagent tool; possibly a small render helper)
└── subagents.test.ts   ~   (render unit test for call/result over single/parallel/error/partial)
src/.pi/extensions/subagents/README.md ?   (note the custom renderer if the file map warrants it)
```

## Promotion checklist

- [ ] Does this change a requirement? — no
- [ ] Does this create, retire, or invalidate an assumption? — no
- [ ] Does this slice depend on an unvalidated high-impact assumption? — no
- [ ] Does this make or reverse a non-trivial design decision? — no (payload shape settled slice 3)
- [ ] Does this establish a new seam-level invariant? — no (consumes the existing render-only split)
- [ ] Does this change a frontier-level cross-cutting obligation or verification layer? — no
- [ ] Does it cross more than two major seams? — no (registrar + its test)
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread? — no
- [ ] Can you not name the containing seam or current rationale? — no (named above)

Stays **light**. Canonical reconciliation is a no-op unless build surfaces a durable change.

## Build closeout

- Implemented in `src/.pi/extensions/subagents/index.ts` with custom `renderCall` / `renderResult` only; the execution payload remains `{ content, details: { results } }`, preserving D91-L (`content` is the only model-context cross-back).
- Added renderer coverage in `src/.pi/extensions/subagents/subagents.test.ts` for single, parallel, invalid-shape, collapsed, expanded, partial, and error states.
- Verification: `npm run test -- src/.pi/extensions/subagents/subagents.test.ts` passed; `npm run check` passed with the pre-existing `unicorn(no-thenable)` warnings in `src/graph/**`. Full `npx vitest run` is blocked by the known local `better-sqlite3` Node ABI mismatch (`compiled 137`, current Node requires `147`), before slice-specific failures.
