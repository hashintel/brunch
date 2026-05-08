<!-- CARDS.md — short queue of prepared scope cards for one frontier item.
     Owned by ln-scope; consumed by ln-build. Delete when exhausted.
     Frontier: side-chat V3.1 + node-edit completion (FE-674 follow-up).
     Branch:   ka/fe-674-cascade-edit-and-agent
     Linear:   FE-674 (per user direction; same issue, separate stacked branch). -->

# Scope cards — V3.1 + node-edit completion

The frontier (PLAN.md §Next item 2) is **Side-chat V3.1 — agent-grouped reconciliation resolution**. The user's direction (T-019e08b9 conversation) folds in two adjacent improvements that close out node editing on the cascade surface: showing the source diff inline (Card A) and an Edit-target affordance per need (Card B). These compose against the V3.0 seam and are independent of the V3.1 agent.

Cards 1-3 below are queued because all three live in settled seams and none changes shape based on what the others reveal during build. Cards 4-6 (V3.1 agent + classification UI + bulk actions) are NOT queued yet — they depend on `ln-oracles` settling the LLM verification strategy and on what Card B's edit affordance actually feels like.

---

## 1 — Source-content snapshots on `reconciliation_need` (server) — `done`

### Objective

Each `reconciliation_need` row carries the source item's content snapshot from immediately before and after the edit that opened it, so downstream surfaces (Pending review row, V3.1 agent pre-image) can render or reason about the actual change without re-querying mutable item history.

### Acceptance Criteria

- ✓ `reconciliation_need` table has two new nullable columns: `source_previous_content TEXT`, `source_current_content TEXT`.
- ✓ `OpenReconciliationNeedInput` accepts and persists `sourcePreviousContent` and `sourceCurrentContent`; `openReconciliationNeed` writes them through.
- ✓ `handleApplyEdit` (edit-route hard path) passes the existing `previousContent` and the just-applied `parsed.data.content` into every `openReconciliationNeedIfAbsent` call.
- ✓ `ReconciliationNeedRecord` (shared type) gains the two fields so the client query exposes them.
- ✓ `GET /api/specifications/:id/reconciliation-needs` returns the new fields without breaking existing test payload assertions.
- ✓ Existing partial-unique-index dedupe still applies — re-applying the same edit does not open new rows or overwrite snapshots.
- ✓ Migration `0018_reconciliation_need_source_snapshots.sql` is generated via the standard drizzle pipeline.

### Verification Approach

- Inner: extend `cascade-producer.test.ts` / `reconciliation-need.test.ts` for the new columns; extend `edit-route.test.ts` to assert snapshots arrive on opened needs; extend `reconciliation-needs-route.test.ts` for the response shape. `npm run verify`.

### Promotion checklist

- [ ] Requirement change? **No** — extends existing Requirement 10 surface, no new requirement.
- [ ] Assumption change? **No** — A88 is preserved; A80 explicitly pre-authorizes extending the queue table with provenance fields.
- [ ] Non-trivial design decision? **No** — D139 already routes cascade through `reconciliation_need`; this just attaches the source delta to the queue row instead of re-deriving it.
- [ ] New seam-level invariant? **No** — snapshots are advisory render data, not load-bearing state. `caused_by_turn_id` already exists for stronger provenance.
- [ ] Crosses >2 major seams? **No** — schema + producer + shared type + route response.
- [ ] First touch in unfamiliar seam? **No** — same code paths as PR #115/#116.
- [ ] Cannot name containing seam from live docs? **No** — `cascade-producer.ts`, `db.openReconciliationNeed*`, `reconciliation-needs-route.ts`, SPEC.md A80/A88 + I112/I113.

→ Stays light.

---

## 2 — Source diff rendered inline on each Pending review row (client) — `done`

### Objective

Each row in `<PendingReviewSection>` shows the source item's before/after as a `<ContentDiff>` so the user can read what changed without leaving the cascade surface.

### Acceptance Criteria

- ✓ When `source_previous_content` and `source_current_content` are both present and non-equal, the row renders a `<ContentDiff>` block under the source/target reference line.
- ✓ When either snapshot is null (legacy rows opened before Card 1), the row renders today's bare layout — no diff block, no error.
- ✓ Diff styling reuses FE-665's `<ContentDiff>` component verbatim; no new diff library, no duplicated tokenization.
- ✓ The diff block does not push the Resolve button below the fold of the overlay's normal scroll height — verified by snapshot of an existing test fixture.
- ✓ A small "Source change" label sits above the diff so it's not confused with the (future) target diff.

### Verification Approach

- Inner: extend `pending-review-section` component test (or add one) using the existing fixture in `__tests__/reconciliation-need-fixtures.ts` extended with snapshots; assert `<ContentDiff>` renders only when snapshots are present and non-equal.
- Outer: manual walkthrough of an apply that opens 4 needs — the diff should make the source change legible at a glance.

### Promotion checklist

- [ ] All seven items: **No**. Pure UI composition over an existing component using fields just added in Card 1. No new decisions, no new seams.

→ Stays light.

---

## 3 — "Edit target" affordance per Pending review row (client + reuse) — `done`

### Objective

Each row gets an "Edit target" button that expands an inline textarea pre-filled with the target item's current content; saving runs through the existing edit pipeline (`PATCH /knowledge-items/:id`) and then resolves the need (`POST /reconciliation-needs/:needId/resolve`).

### Acceptance Criteria

- ✓ Each row exposes `[ Edit target ]` alongside the existing `[ Resolve ]`.
- ✓ Clicking Edit target expands an inline textarea with the target item's current content; ⌘↵ saves, esc cancels.
- ✓ Save calls `PATCH /knowledge-items/:id` (or whichever existing edit-route endpoint FE-657 uses) with content + rationale; on success, calls the existing resolve endpoint and refetches the needs query.
- ✓ If the edit returns `impact === 'hard'` with new opened needs, the new needs surface immediately in the same Pending review section — re-entrant cascade works without a page reload.
- ✓ While save is in flight, both Edit target's Save button and the row's Resolve are disabled.
- ✓ Existing per-row Resolve behavior is unchanged when the editor is collapsed.
- ✓ The target's current content used to pre-fill the textarea comes from a single source of truth — either the existing knowledge-items query already mounted on the overlay surface, or a newly threaded field on `ReconciliationNeedRecord`. Pick one and document the choice in the commit body.

### Verification Approach

- Inner: extend the pending-review section test to drive the inline-edit flow against a mocked edit endpoint; assert the resolve endpoint is called only after the edit succeeds; assert re-entrant cascade rows appear after save.
- Outer: manual walkthrough — open a hard apply that creates needs, edit one target inline, confirm the cascade rerenders and Resolve clears the row.

### Promotion checklist

- [ ] Requirement change? **No** — already implicit in Requirement 10's HITL contract.
- [ ] Assumption change? **No**.
- [ ] Non-trivial design decision? **Possibly** — choosing whether the target content is read from the items query vs threaded onto `ReconciliationNeedRecord`. Both are reversible. Not promoting unless the chosen direction surfaces a durable invariant.
- [ ] New seam-level invariant? **No**.
- [ ] Crosses >2 major seams? **No** — UI + existing edit-route + existing resolve endpoint.
- [ ] First touch in unfamiliar seam? **No**.
- [ ] Cannot name containing seam? **No** — `pending-review-section.tsx`, FE-657 inline-edit pattern, V2 edit-route.

→ Stays light.

---

## Not yet queued (out of order, depends on oracle design and Card 3 findings)

The following V3.1 agent slices are deferred until `ln-oracles` updates SPEC.md §Verification Design with the LLM-classification oracle strategy, and until Card 3's inline-edit shape is known (so the auto-edit Apply button can reuse it):

4. V3.1 agent backend — schema columns (`agent_status`, `agent_classification`, `agent_proposal`), `classifyNeed()` pure function + LLM prompt, `POST .../run-agent` endpoint, in-process classification.
5. V3.1 agent client — "Run agent" button, progress strip, per-row status chips, 1-second polling while classifying.
6. V3.1 actions — agent-proposal diff for `auto-edit`, "Confirm all" / "Apply all suggested" group buttons, substantive-note rendering with side-chat handoff.

Do not pre-scope these. Re-run `ln-scope` for slice 4 after `ln-oracles` and after Card 3 ships.
