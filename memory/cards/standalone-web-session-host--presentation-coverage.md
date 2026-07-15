# Standalone web — presentation-family coverage sweep

Frontier: standalone-web-session-host
Status:   active
Mode:     sweep
Created:  2026-07-15

## Orientation

- **Containing seam:** the D128-L shared semantic presentation projection. The tracer materialized one transport-neutral decode (`src/projections/session/session-presentation.ts`) plus a target-addressed live overlay (`src/projections/session/live-session-events.ts` → `LiveSessionEvent` deltas), and one React adapter (`src/web/routes/session.tsx` + `src/web/features/session/live-overlay.ts`) that renders *from that projection* rather than re-decoding `toolResult.details` in the browser.
- **Frontier item:** `standalone-web-session-host` (FE-1200), branch `ln/fe-1200-web-session`. Slice 3 of 3 (tracer ✓, concurrency ✓); this sweep retires **I65-L breadth**.
- **Volatile state:** `HANDOFF.md` — tracer + concurrency accepted/committed; this ledger is the "immediate next action" it names. No unpushed dependency blocks scoping.
- **Main open risk:** row-grain honesty. The `ask` family has several answered/terminal detail shapes the tracer dropped (only `answered.text` is projected today); over-atomizing them or, conversely, hiding a genuinely-distinct control behind one row both break the ledger. Row boundaries below follow the *detail-shape + adapter-control* grain, source-of-truth-anchored to `src/exchanges/schemas/*` and `src/exchanges/projections/*`.

**Certainty posture:** `Posture: earned (inherited from standalone-web-session-host)`. Coverage sweep over a settled seam; each row is a thin earned closure fill. No row currently carries a load-bearing unknown (buildable-now, below). If any row surfaces a real unknown at build time, downgrade that row to `proving` and route back through `ln-plan`.

**Frontier-level cross-cutting obligations this sweep must preserve:**

- Shared-graph continuity vs session-local leakage (review finding R1): `worldUpdate` is *required continuity substrate*, not a rendered presentation family. No presentation row may surface another session's message/ask entries; graph continuity crosses only through the canonical `worldUpdate` carrier. Preserve this distinction — it is why the continuity custom types are excluded rather than required.
- Single-decode invariant (D128-L): React adapters render from the shared projection; the browser never independently decodes `toolResult.details`. TUI keeps its existing `src/.pi/extensions/exchanges/*` renderers (not re-owned here — see disposition D-TUI).
- Convergence metamorphic (I65-L): after settlement/reconnect, the web view equals a fresh JSONL-derived projection modulo declared ephemeral progress.

## Cold-start reads

```
- memory/SPEC.md   — invariants I65-L (target), I64-L (target addressing, done); decisions D128-L, D127-L, D104-L, D108-L, D17-L, D19-L; req 12, req 17, req 31, req 32
- memory/PLAN.md    — frontier: standalone-web-session-host (slice 3 presentation-coverage)
- HANDOFF.md        — tracer/concurrency acceptance; presentation-sweep boundary + do-not-reopen list
- src/projections/TOPOLOGY.md            — PROJECT-stage ledger; session-presentation is the owning module
- src/.pi/extensions/exchanges/TOPOLOGY.md — registered structured-exchange tool family + renderResult rule (D104-L)
- src/web/TOPOLOGY.md                     — React adapter home; single-decode + query-cache contract
```

## Sweep preflight

1. **Boundary.** *In:* transcript families a standalone **Specify** web session intentionally shows the user — ordinary `message` (user/assistant) plus the elicitor-reachable structured-exchange tool results and their answered/terminal/continuation detail variants. *Out:* generic tool output, graph/data views, internal continuity ledgers, legacy read-compat vocabulary, `present_alternatives`, executor `execute_*`, and `subagent` (dispositions below).
2. **Source-of-truth inputs.** The closed family list is derived from production registries, **not** from existing React components:
   - `src/agents/runtime/elicitor/active-tools.ts` — `LIVE_ELICITOR_ALLOWED_TOOL_NAMES` (what a Specify web session can emit).
   - `src/.pi/extensions/exchanges/index.ts` — `ACTIVE_STRUCTURED_EXCHANGE_TOOL_NAMES` = `[ask, present_review_set, present_candidates, present_digest]`; `LEGACY_STRUCTURED_EXCHANGE_TRANSCRIPT_TOOL_NAMES` = `[present_question, request_response]`.
   - `src/exchanges/projections/*` + `src/exchanges/schemas/*` — the per-family/per-mode answered/terminal detail shapes (`AskDetails` text/choice/choices/comment/cancelled/unavailable; `AskQuestionnaireDetails`; `AskDigestConfirmationDetails`; `PresentCandidates/ReviewSet/Digest` details).
   - `src/projections/session/continuity-entry-classifier.ts` — the continuity custom-type set (the exclusion authority for internal ledgers).
3. **Owner + closure oracle per required row.** Canonical projection owner is `src/projections/session/session-presentation.ts` (durable) + `src/projections/session/live-session-events.ts` / `SessionPresentationDelta` (live); React adapter owner is `src/web/routes/session.tsx` + `src/web/features/session/*`. Closure oracle per row = projection shape/no-loss unit (`session-presentation.test.ts`) **and** React adapter render/answer test (`src/web/__tests__/session-route.test.tsx`) **and** the family's row in the live/persisted/reconnect differential (`src/dev/__tests__/standalone-web-session-host.tui-differential.test.ts`, extended per row).
4. **Buildability class: buildable-now.** Every required row is derivable from production registries + detail schemas that already exist. No spike/measurement/future-product-state gate. (No tripwired rows.)
5. **Inventory closed?** Yes — the registered elicitor-reachable structured-exchange surface is a closed set of 4 tools plus ordinary messages; the required rows below are their distinct presentation shapes. If building surfaces **more than one** genuinely-missing row or a new sub-seam, stop and route back through `ln-plan` (the inventory was not actually closed).

## Ledger

DoD = every `●` row is `have` or `built`. Each row's target *is* its acceptance criterion; build one row at a time and return for review.

### Sub-seam A — ordinary + `ask` terminal presentation

Owner: `session-presentation.ts` (durable decode) + `live-session-events.ts`/`SessionPresentationDelta` (live) + `web/routes/session.tsx` adapter.

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| A1 · ordinary message (user/assistant text) | `have` | ● | earned | tracer | Projected + rendered + live `assistant_text_delta` + settlement refetch. Regression-guard only. |
| A2 · `ask` free-text terminal (answered text / comment / `cancelled` / `unavailable`) | `built` | ● | earned | `session-presentation.ts` + `session.tsx` | Shared projection preserves the canonical `AskDetails` answered payload (text + optional comment), cancelled payload (optional message), and unavailable payload (required message) as a discriminated terminal; React renders only that semantic projection. Oracles: `session-presentation.test.ts` no-loss over all terminal variants + `session-route.test.tsx`; production-host consumers updated to the terminal shape. |
| A3 · `ask` single-select choice (options + selected `choice` + Other/`comment`) | `built` | ● | earned | `session-presentation.ts` + `session.tsx` | Shared projection preserves canonical question options plus the answered choice/option echo and optional Other/comment payload. React renders durable listed/Other selections and a live radio control from the semantic projection; listed choices answer through `session.answerExchange`. Oracles: projection no-loss over listed + Other terminals; adapter render/answer; focused headless, production-entry, differential, concurrency, and RPC contract suites. Existing D125-L ceiling remains: headless Other/comment collection is interactive-only and was not widened by this row. |
| A4 · `ask` multi-select choices (options + `choices[]` + Other/`comment`) | `spec` | ● | earned | `session-presentation.ts` + `session.tsx` | `answered.choices[]` + `options[]` shape (`projectAsk` choices branch). Close: project + render multi-select terminal. Oracle: projection no-loss over `choices[]`/comment + adapter. |
| A5 · `ask` bounded questionnaire terminal | `spec` | ● | earned | `session-presentation.ts` + `session.tsx` | `AskQuestionnaireDetails` (ordered per-question answers + `accepted_abstract`) via `projectDigestQuestionnaire`. One `ask` terminal, fixed ordered questions, no branching (req 17). Close: project the ordered question/answer list; render read-back. Oracle: projection preserves order + each keyed answer; adapter renders the set. |

### Sub-seam B — `present_*` offer results + declared continuations

Owner: `session-presentation.ts` (new family entries) + `session.tsx`/`features/session/*` adapters. TUI already renders these from details (`src/.pi/extensions/exchanges/present-*.ts`); this sweep adds the *shared projection + React* audience without re-owning the TUI renderer (D-TUI).

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| B1 · `present_candidates` offer (proposal cards) + `request_choice` continuation | `spec` | ● | earned | `session-presentation.ts` + `features/session` | Details-backed (`zPresentCandidatesDetails`, rendered in TUI by `ExchangeCandidatesResultComponent`). Declared continuation is an `ask({continues})` whose answer preserves `request_choice` wire vocabulary. Close: project the offer's candidate set (semantic, not markdown) + its continuation linkage; React renders proposal cards. Oracle: projection no-loss over candidate cards; adapter render + choice answer; malformed-detail classified result (parity with tracer's `ask` malformed path). |
| B2 · `present_review_set` offer (review proposal) + `request_review` continuation + committed receipt | `spec` | ● | earned | `session-presentation.ts` + `features/session` | Details-backed (`zPresentReviewSetDetails`, `ExchangeReviewSetResultComponent`); nodes/edges + grouped consequences. Approval invokes the session-owned settlement before `ask.execute` returns, so an approved terminal is a committed, receipt-bearing result (one LSN, one change-log entry). Whole-set only — no partial acceptance. Close: project review-set semantics + terminal decision (accepted/changes-requested/rejected) + receipt; render proposition-first. Coordinate visual treatment with FE-1187 `exchange-visual-design` (shared concern, not shared write path). Oracle: projection no-loss over review-set + terminal + receipt; adapter render + decision answer. |
| B3 · `present_digest` offer (digest prose) + feedback / questionnaire-confirmation continuation | `spec` | ● | earned | `session-presentation.ts` + `features/session` | Markdown pass-through in TUI (content is the presentation), but the *terminal* carries `AskDigestConfirmationDetails` / questionnaire (`projectDigestConfirmation`, `projectDigestQuestionnaire`) with `accepted_abstract`. Close: project the digest prose entry + its confirmation/feedback terminal; React renders digest + feedback affordance. Oracle: projection preserves digest content + terminal `accepted_abstract`/decision; adapter render + answer. |

## Excluded families — explicit dispositions

Every family in the elicitor tool set or the transcript custom-type registry that is **not** a required row above, with its disposition (`○`). The DoD requires each to be dispositioned, not silently absent.

| # | Family / source | Disposition (`○`) | Rationale |
| --- | --- | --- | --- |
| D-READ | `read`, `grep`, `find`, `ls`, `web_fetch`, `web_search` (`LIVE_ELICITOR_ALLOWED_TOOL_NAMES`) | n/a — generic tool output | Generic Pi-platform / read-tool parity; rendered as ordinary tool call/result, not a Brunch presentation family. Out of boundary. |
| D-GRAPH | `read_graph`, `mutate_graph`, `read_workspace_context`, `read_specification_context`, `read_session_context`, `read_elicitation_scratchpad`, `update_elicitation_scratchpad`, `read_reconciliation_needs`, `update_reconciliation_needs` | n/a — graph/dashboard views | Graph/data read-write surfaces. Graph state reaches the web session through the separate `graph.overview`/`graph.nodeNeighborhood` observer routes, not the transcript presentation. Out of boundary. |
| D-CONT | continuity custom types: `worldUpdate`, `brunch.context_seed`, `brunch.graph_overview_snapshot`, `brunch.own_mutation`, `brunch.mention`, `brunch.mention_staleness_hint`, `brunch.session_lifecycle`, `brunch.side_task_result`, `brunch.reviewer_drain`, `brunch.agent_runtime_state` (`continuity-entry-classifier.ts`) | n/a — internal continuity ledgers | Continuity/watermark substrate, not user-facing presentation entries. `worldUpdate` in particular is *required continuity* (R1) that must remain non-rendered as a transcript entry; surfacing it as a presentation family would re-introduce the cross-session leakage the concurrency oracle forbids. |
| D-LEGACY | `present_question`, `request_response` family (`request_answer`/`request_choice`/`request_choices`/`request_review`) (`LEGACY_STRUCTURED_EXCHANGE_TRANSCRIPT_TOOL_NAMES`) | n/a — legacy read-compat only | No longer registered tools; discriminants survive only so old persisted transcripts read and capture keeps historical wire vocabulary. The *live* `request_choice`/`request_review` discriminants ride B1/B2 continuations; no separate presentation owner. |
| D-ALT | `present_alternatives` (`alternatives-card-set`, `src/.pi/components/alternatives.ts`) | n/a — not elicitor-reachable | Registered production tool with a custom message renderer, but absent from `LIVE_ELICITOR_ALLOWED_TOOL_NAMES`, so a Specify web session never emits it. Re-enter only if a future decision admits it to the elicitor surface. |
| D-EXEC | executor `execute_*` tools (`src/.pi/extensions/executor/*`) | deferred — KA/Execute-mode owned | Execute-mode presentation is KA-stream owned and on the FE-1200 do-not-reopen list; executor runs surface through the `/runs` observer routes, not the Specify session transcript. Not this sweep's boundary. |
| D-SUB | `subagent` | n/a — not a presentation family | Spawns a subagent; produces no distinct Brunch transcript presentation family for the driving session. |
| D-TUI | TUI adapters on the shared projection (`src/.pi/extensions/exchanges/*` renderers) | non-goal for this web sweep | Existing TUI `renderResult` renderers already cover ask/present_* and are separately tested. This sweep owns the shared *projection* + *React* adapter so the browser never re-decodes details (D128-L single-decode). Migrating TUI onto the shared projection is a later reconciliation, not required to close I65-L breadth for standalone web. |

## Aggregate DoD

- No `●` row (A1–A5, B1–B3) remains `spec` / `new` / `partial`; each has: one canonical semantic projection owner (in `session-presentation.ts` / `SessionPresentationDelta`), a React adapter rendering from that projection, a live/persisted metamorphic (view after settle/reconnect == fresh JSONL projection), and a completeness/no-loss oracle.
- Every excluded family (D-* above) retains an explicit disposition.
- I65-L reconciled in `memory/SPEC.md`; FE-1200 done-definition and the `src/app`/`src/session`/`src/rpc`/`src/projections`/`src/web` topology homes reconciled; the `web-driver-streaming-residue` doc-only cleanup (group-4) closed or left with its named owner.
- This ledger deleted once exhausted (all `●` rows `built`).

## Promotion / escape rule

If a single row escapes row-sized work (e.g. `present_review_set` proposition-first presentation grows beyond an adapter fill because of the FE-1187 `exchange-visual-design` coupling), promote it to its own `memory/PLAN.md` frontier and keep this ledger open (row stays `spec`/`partial`) until that frontier lands. Do not fatten a row into a mini-frontier in place.

## Cross-cutting obligations

- Preserve the R1/R2 concurrency invariants: presentation rows are target-local; no row surfaces cross-session entries; `worldUpdate` continuity stays non-rendered.
- Single-decode (D128-L): React renders from `session-presentation.ts` output only; no `toolResult.details` decode in `src/web/*`.
- Malformed-detail honesty: every details-backed family returns the classified `malformed_detail` projection result (as `ask` does today) rather than throwing or rendering raw payload.
- Live overlay + convergence: any family with a live affordance (offer opened, ask opened) extends `SessionPresentationDelta` + `reduceLiveSessionOverlay` and discards the overlay for a durable refetch on `agent_settled`.

## Expected touched paths (tentative)

```
src/projections/session/
├── session-presentation.ts              ~   (per-row family + terminal-state projection)
├── session-presentation.test.ts         ~   (per-row no-loss oracle)
├── live-session-events.ts               ~   (offer/ask live deltas where a family has a live affordance)
└── __tests__/live-session-events.test.ts ~
src/session/
└── live-session-host.ts                 ~   (SessionPresentationDelta additions only, if a family needs a new live delta)
src/web/
├── routes/session.tsx                   ~   (adapter dispatch per family)
├── features/session/
│   ├── live-overlay.ts                  ~
│   └── (per-family presentation components) +
└── __tests__/session-route.test.tsx     ~   (adapter render + answer per row)
src/dev/__tests__/
└── standalone-web-session-host.tui-differential.test.ts ~ (live/persisted/reconnect row per family)
memory/SPEC.md                            ~   (I65-L reconciliation on exhaustion)
memory/PLAN.md                            ~   (frontier slice-3 status on exhaustion)
src/projections/TOPOLOGY.md               ?   (session-presentation family note)
src/web/TOPOLOGY.md                       ?   (session route family note)
```

Shared read-only inputs (not write targets): `src/exchanges/schemas/*`, `src/exchanges/projections/*`, `src/agents/runtime/elicitor/active-tools.ts`.
