<!-- CARDS.md — short queue of prepared scope cards for one frontier item.
     Owned by ln-scope; consumed by ln-build. Delete when exhausted.
     Frontier: side-chat V3.1 + node-edit completion (FE-674 follow-up).
     Branch:   ka/fe-674-cascade-edit-and-agent
     Linear:   FE-674 (per user direction; same issue, separate stacked branch). -->

# Scope cards — V3.1 + node-edit completion

The frontier (PLAN.md §Next item 2) is **Side-chat V3.1 — agent-grouped reconciliation resolution**. The user's direction (T-019e08b9 conversation) folds in two adjacent improvements that close out node editing on the cascade surface: showing the source diff inline (Card A) and an Edit-target affordance per need (Card B). These compose against the V3.0 seam and are independent of the V3.1 agent.

Cards 1-3 are done and live in settled seams. Card 4 is a Figma-aligned visual polish pass over those surfaces (chat panel, staged-patches strip, Pending review section, direct-edit toolbar) that lands before the V3.1 agent UI builds on top — the agent's per-row status chips and proposal-diff actions reuse the polished `DiffPopover` and toolbar contracts that Card 4 introduces. Card 5 is the V3.1 agent backend (next, full scope card). Cards 6-7 (V3.1 client UI + bulk actions) are NOT queued yet — they depend on `ln-oracles` settling the LLM verification strategy and on what slice 5 actually feels like.

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

## 4 — Side-chat / pending-review polish — Figma alignment + `DiffPopover` primitive (client) — `done`

### Objective

Bring the V3.0 side-chat panel, staged-patches strip, pending-review section, and direct-edit toolbar in line with the HASH-SgAI Figma design language (file `nTw9n0blCJm1j9t22Jo72d`, node `969:13119`) and Linear-chat minimal-chrome conventions: kind-accent tints replace ad-hoc grays, a shared `DiffPopover` primitive replaces inline diff expanders, action chrome shrinks toward icon-only ghost shapes, and FE-only vocabulary unifies as `Note` / `Edit mode`. No backend or contract changes. The four sub-sections form a cohesive pass — split during build is allowed, but the kind-accent tint system, button shapes, and vocabulary must land together to feel coherent.

### Acceptance Criteria

**S1 — Vocabulary + chat-panel chrome** (`side-chat-popover.tsx`)

- ✓ FE-only string changes, no type renames:
  - Annotate button label `Annotate` → `Note`; aria `Annotate item` → `Add a note`.
  - Annotation composer aria `Annotation composer` → `Note composer`; summary placeholder `Summary` → `Title`; body placeholder `Note body` → `Details`.
  - Edit-mode button label `Edit` → `Edit mode` (off) / `Edit on` (active); tooltip → `Toggle edit mode — your messages propose changes for review`.
  - Promote-from-drawer aria `Add … to chat context` → `Add … to context`.
  - Patch kinds (`'annotate' | 'edit' | 'edge' | 'drill-down'`) and `mode` prop values stay unchanged at the type level.
- ✓ Top-right floating header buttons (layout-toggle, close) shrink from 24×24 to 20×20 ghost.
- ✓ The current right-side action row above the input (`[Annotate]   [Edit]`) is removed. Both actions move:
  - `+ note` becomes a 24×24 ghost icon button inside the input card's left action row, next to the disabled `+` attach button (`NotebookPen` icon, label only on hover/aria).
  - Notes(N) drawer button (rendered when `existingAnnotations.length > 0`) sits to its right in the same input-card left action row. Drawer still opens upward as a popover.
- ✓ `Edit mode` becomes a thin strip rendered **below** the input card (separate full-width row, ~28px tall): `[PencilLine icon] Edit mode  [toggle pill on right]`. When `mode === 'edit'`: strip bg `${kindAccent}10`, input placeholder swaps to `Suggest an edit…`, toggle pill reads `Edit on`.
- ✓ When `kindAccent` is null (untyped pinned item), all kind-accent tint values fall back to `#5424ff` so existing untyped-kind behavior is preserved.

**S2 — Staged-patches strip + diff color system + `DiffPopover`**

- ✓ Staged-patches `<section>` background flips from `bg-wash/60` to `${kindAccent}0a` with `${kindAccent}1f` border. Row hover bg `${kindAccent}05`.
- ✓ Per-row layout: `[kind chip with kind-specific lucide icon] [truncated title] [↗ view diff chip] [impact chip] [× discard]`.
  - Kind chip rendered on every staged patch (note / edit / edge / drill-down), 10px font, kind-accent-tinted bg.
  - `[↗ view diff]` chip rendered only when `kind === 'edit' && currentContent !== newContent`. Click opens `<DiffPopover>` anchored to this chip.
  - Today's inline `<details>` expander is removed.
  - Discard `×` shrinks to 14×14 ghost icon (`X` lucide), opacity 0 by default, opacity 1 on row hover or focus-within.
  - Impact chip moves to the right of the title (not next to kind chip).
- ✓ Footer Undo / Apply become 28×28 icon-only:
  - Undo: `Undo2` lucide, ghost (no bg), hover bg `${kindAccent}14`. Aria `Undo last change`. Hidden when `!canUndo`.
  - Apply: `Check` lucide, solid `${kindAccent}` bg, white icon, ring shadow. Aria `Apply N change(s)`. Stays the eye-anchor.
- ✓ The current `Saving change…` status moves into a small inline label adjacent to Apply (right-aligned), not its own row.
- ✓ A new component `<DiffPopover>` lands at `src/client/components/diff-popover.tsx`:
  - Props: `{ open, onClose, anchor, before, after, title, kindChip?, kindAccent? }`.
  - Floating popover, no backdrop dim. Click-outside and ESC close.
  - Viewport-aware absolute positioning (above by default, below if no space above). No floating-ui dependency.
  - Max-width 480px. Header bar `[kind chip] [title (truncated)] [✕]` over `${kindAccent}10` bg. Body `<ContentDiff before={…} after={…} />`. Container border `${kindAccent}1f`.
- ✓ `<ContentDiff>`'s inline tint colors (warm-amber removed, cool-blue added) are unchanged — the visual diff signal stays decoupled from kind-accent so it remains universally readable.

**S3 — `PendingReviewSection` redesign** (`pending-review-section.tsx`)

- ✓ Strip background softens from `rgba(255,219,168,0.35)` to `rgba(255,219,168,0.18)`.
- ✓ Strip header becomes `[AlertCircle, amber] N pending reviews` — count + icon, no chevron, no resolve-all.
- ✓ Per-row layout:
  ```
  ┃ [supersedes|confirm chip with Replace|CheckCircle2 icon]  #ID · {target excerpt}
  ┃   from #ID was edited                                         [↗ view source diff]
  ┃                                                              [✎ edit] [✓ resolve]
  ```
  - Left vertical bar (`┃`) is 2px wide, `rgba(255,219,168,0.6)` neutral-amber for v1 (target-item-kind enrichment is the deferred follow-up below).
  - Title shows raw `#ID` followed by `·` and the first ~80 chars of `target_current_content`, single-line truncate.
  - Sub-line `from #ID was edited` rendered only when `source_previous_content` and `source_current_content` are both present and differ. The `[↗ view source diff]` chip opens `<DiffPopover>` (same primitive from S2).
  - Today's inline `<ContentDiff>` block under the row is removed; the diff is reachable only through the chip.
  - Action row: `[✎ edit]` and `[✓ resolve]` 24×24, opacity 0.6 default, opacity 1 on row hover or focus-within. Edit is ghost. Resolve is solid `${kindAccent}` (target-kind-accent fallback to neutral amber when target kind unknown for v1). Tooltips and aria carry the labels.
- ✓ State icons:
  - Resolving in-flight: `Check` swaps to `Loader2` spinner.
  - Saving in-flight (inline edit form): `Check` swaps to `Loader2` spinner.
- ✓ Inline edit form (when `editDrafts` has the row's id) wraps textarea + Cancel/Save in `${kindAccent}10`-tinted card with `${kindAccent}1f` border. Cancel and Save shapes match S4's direct-edit toolbar contract.
- ✓ Existing data-attribute selectors (`data-need-id`, `data-need-kind`, `data-edit-target-form`) stay so the existing tests still resolve rows.

**S4 — Direct-edit toolbar** (`ItemEditTextarea` in `routes/specification/$id/-structured-list-view.tsx`)

- ✓ Textarea drops `shadow-[var(--shadow-card)]` and the heavy `border-rule`. Border `border-[${kindAccent}1f]`; focus ring `${kindAccent}33` at 2px (down from `ring-3`). Background stays `bg-background`.
- ✓ Cancel becomes icon-only — drop the word `Cancel`, keep the `X` icon, set `aria-label="Cancel edit"` and `title="Cancel"`.
- ✓ Save loses the hard-coded blue gradient and `ring-1 ring-[#1060d6]`. Becomes small kind-accent-solid (`bg-[${kindAccent}]`), white text, `Check` icon + word `Save`, `size="xs"` retained. Disabled state: `opacity-40`, no special bg.
- ✓ Keyboard hint row (`⌘↵ save · esc cancel`) stays unchanged.
- ✓ Vertical footprint shrinks ~6px versus today (the dropped shadow and thinner ring carry the savings).
- ✓ The same toolbar contract is reused inside `PendingReviewSection`'s inline edit form — same Cancel / Save composition, same kindAccent ring derivation, same disabled-state recipe.

**Cross-section invariants**

- ✓ Kind-accent values are derived everywhere from the existing `kindAccentHex` map in `knowledge-card.tsx`. No new color tokens; tints are computed inline via hex+alpha string concatenation following the existing precedent in `side-chat-popover.tsx`.
- ✓ All four surfaces share the same `kindAccent` fallback (`#5424ff`) when a kind cannot be determined.
- ✓ `npm run verify` passes with all existing component tests, plus extensions for the new primitive and the relabeled affordances.

### Verification Approach

- **Inner**:
  - `side-chat-popover.test.tsx`: extend to assert (a) Note/Edit-mode label changes, (b) `+ note` button lives inside the input card's left action row, (c) Edit-mode strip renders below the input card with the toggle reflecting `mode`, (d) Undo/Apply are icon-only, (e) staged-patch rows expose `[↗ view diff]` chip when content differs, (f) discard `×` only visible on row hover/focus.
  - `pending-review-section.test.tsx`: extend to assert (a) `[↗ view source diff]` chip opens `<DiffPopover>` instead of inline `<ContentDiff>`, (b) per-row `[✎ edit]` and `[✓ resolve]` icon buttons render with correct ARIA, (c) inline edit form uses the new toolbar shape (icon-only Cancel, kindAccent Save), (d) `Loader2` spinner replaces `Check` during in-flight states.
  - New `diff-popover.test.tsx`: rendering with/without `kindChip`, ESC closes, click-outside closes, viewport-aware position falls back to below when no space above, focus management.
  - Structured-list-view tests: extend `ItemEditTextarea` assertions to confirm icon-only Cancel and small kindAccent Save (no blue gradient), keyboard hints unchanged.
  - `npm run verify` (lint + format + tests + build).
- **Outer**: manual walkthrough — open side-chat on items of three different kinds, stage and diff-popover-inspect a few edits, apply, undo. Trigger a hard cascade, walk the Pending review surface, source-diff popover, edit-target inline, save, see re-entrant cascade rerender. Direct-edit a row from the structured-list view, confirm the toolbar feels thin and ⌘↵ flow is unchanged.

### Promotion checklist

- [ ] Requirement change? **No** — pure visual + vocabulary polish over already-shipped V3.0 surfaces. No new product capability.
- [ ] Assumption change? **No** — A88 (Path 1 sufficiency) and A80 (HITL contract) untouched.
- [ ] Non-trivial design decision? **Possibly** — the `DiffPopover` primitive's shape (anchored vs modal, kindAccent vs neutral chrome) is a small reusable contract. Reversible if a future surface needs a different popover shape.
- [ ] New seam-level invariant? **No** — kind-accent tints are render-time derived, not stored.
- [ ] Crosses >2 major seams? **No** — four components in `src/client/`, one new primitive, no server / shared / contract changes.
- [ ] First touch in unfamiliar seam? **No**.
- [ ] Cannot name containing seam from live docs? **No** — `side-chat-popover.tsx`, `pending-review-section.tsx`, `content-diff.tsx`, `structured-list-view.tsx#ItemEditTextarea`, all in PR #115/#116/#117 territory.

→ Stays light.

### Polish follow-up — reference-code & target-kind enrichment on the listing endpoint (deferred)

Card 4's S3 keeps raw `#ID` references and a neutral-amber row left bar because the current `GET /api/specifications/:id/reconciliation-needs` payload does not carry `target_reference_code`, `target_title`, `source_reference_code`, or `target_item_kind`. A small follow-up card (~30 lines in `reconciliation-needs-route.ts` plus a join per row) can enrich these fields, after which:

- The Pending review row title flips from `#12 · {excerpt}` to `AS-12 · {excerpt}`.
- The sub-line flips from `from #9 was edited` to `from AS-9 was edited`.
- The row left bar derives its color from the target's `kindAccentHex` instead of the v1 neutral amber.
- Resolve button bg derives from target-kind-accent.

Queue this only after Card 4 ships and the v1 polish has corpus signal.

---

## 5 — V3.1 agent backend (schema + classifier + run-agent endpoint) — `done` (full scope card)

### Target Behavior

`POST /api/specifications/:id/reconciliation-needs/run-agent` classifies every open `reconciliation_need` row in the given specification whose `agent_status` is `null`, persisting one of `{auto-confirm, auto-edit, substantive}` plus an optional text proposal per row, while transitioning each row through `null → queued → classifying → classified | failed`.

### Boundary Crossings

```
→ POST /api/specifications/:id/reconciliation-needs/run-agent  (route)
→ handleRunReconciliationAgent  (server/reconciliation-agent-route.ts, new)
→ list open + agent_status=null needs (db.ts; existing query, new filter)
→ enrich each need with sourceItem + targetItem  (existing getKnowledgeItem)
→ classifyNeed(need, sourceItem, targetItem, getRelationKind, llm) → { classification, proposal? }  (server/reconciliation-agent.ts, new pure function)
   → loadPrompt('reconciliation-classifier')  (prompt-loader; new asset src/server/prompts/reconciliation-classifier.md)
   → generateText({ model, system, prompt }) on the AI SDK adapter already used by side-chat-route
   → parse single-shot response into label + optional proposal
→ updateReconciliationNeedAgentFields(needId, { agent_status, agent_classification, agent_proposal })  (db.ts; new helper, transitions one row at a time)
→ 200 OK { specId, ranAt, classifiedCount, failedCount }  (route response)
```

### Risks and Assumptions

```
- RISK: LLM returns a label outside the three-value vocabulary
  → MITIGATION: classifyNeed validates against the literal union; on parse failure, transition to 'failed' with the parser error message persisted into agent_proposal as 'Parse error: ...'.

- RISK: classifying N needs in a single request with a synchronous LLM call blocks the route past the typical proxy timeout when N is large
  → MITIGATION: V3.1 first cut runs in-process with a per-need iteration so partial progress persists; the route returns once the loop completes. Single-digit open-need counts per spec (same as the N+1 caveat in Card 3) keep this acceptable for the MVP. Promote to a queue substrate (BullMQ / pg-boss / inline scheduler) only if outer-loop walkthroughs surface user-visible blocking.

- RISK: Re-running the agent against rows already classified clobbers prior classification
  → MITIGATION: route filters strictly on agent_status IS NULL; per-row Re-run (slice 6) re-sets a single row to null first, so the re-run path stays explicit and per-need.

- ASSUMPTION: The lifecycle (null → queued → classifying → classified | failed) plus the three-label vocabulary is enough seam to support slices 6-7 (status chips, action buttons) without further schema change. → VALIDATE: build slice 6 against the schema as-is; if a new column appears in slice 6 (e.g. confidence score, retry count), promote that as an A### at slice-6 scoping. → memory/SPEC.md §Assumptions A88 (Path 1 sufficiency) is the umbrella; this is a sub-assumption under it.

- ASSUMPTION: Single-shot LLM call (one prompt → one structured response, no tool use, no multi-turn) is sufficient classification quality for the three-label decision when the prompt has source previous + current content (Card 1) and target current content (Card 3) in context. → VALIDATE: the middle-loop golden-fixture corpus (see Verification Approach) is the only oracle that proves this; if classification is unstable across runs at temperature 0, promote to multi-shot or add confidence scoring as a follow-up slice. → memory/SPEC.md §Acknowledged Blind Spots row "V3.1 classifier multi-run determinism" already names this; current mitigation is the per-need Re-run button shipping in slice 6.
```

No spike required — both LLM seam (`generateText` via the existing AI SDK adapter) and the prompt registry (`prompt-loader` + markdown assets) are already in production use. The classifier is novel only in *what* it classifies, not *how* it talks to the model.

### Acceptance Criteria

```
✓ schema: reconciliation_need.test.ts — three new nullable columns (agent_status TEXT, agent_classification TEXT, agent_proposal TEXT) round-trip through openReconciliationNeed* and the listing query; defaults are all null on existing rows
✓ schema: migration 0019_reconciliation_need_agent_columns.sql is hand-written + journal entry added (per HANDOFF.md non-TTY caveat); structural test asserts column presence
✓ classifier (state-machine, stubbed LLM): reconciliation-agent.test.ts — happy path null → queued → classifying → classified with label='auto-confirm' on a leaf need; auto-edit returns a non-null proposal; substantive returns null proposal
✓ classifier (state-machine, stubbed LLM): reconciliation-agent.test.ts — failure path null → queued → classifying → failed when the stub throws; agent_classification stays null; agent_proposal carries the error message
✓ classifier (state-machine, stubbed LLM): reconciliation-agent.test.ts — invalid label from the stub transitions to failed with a 'Parse error: ...' proposal; agent_classification stays null
✓ classifier (pure): reconciliation-agent.test.ts — classifyNeed is pure: same (need, source, target, relationKind) input + stubbed LLM returning the same string yields the same { classification, proposal } output
✓ route: reconciliation-agent-route.test.ts — POST .../run-agent returns 200 with { classifiedCount, failedCount } and persists agent_status/classification on every previously-null open need; rows already classified stay untouched
✓ route: reconciliation-agent-route.test.ts — POST .../run-agent on a spec with zero open needs returns 200 with { classifiedCount: 0, failedCount: 0 }
✓ route: reconciliation-agent-route.test.ts — POST .../run-agent on a missing or non-owned spec returns the same 404 / 403 shape as the existing reconciliation-needs route (auth parity)
✓ wire: reconciliation-needs-route.test.ts — GET .../reconciliation-needs response now exposes agent_status, agent_classification, agent_proposal on every row; existing test fixtures stay typesafe by adding null defaults to makeNeed
✓ wire: ReconciliationNeedRecord (shared type) gains the three fields with doc-comments naming the lifecycle and label vocabulary
```

### Verification Approach

```
- Inner: deterministic state-machine tests over the lifecycle with a stubbed classifier (per SPEC.md row 553); structural unit tests for new schema columns + classifyNeed purity; route-level tests for the run-agent endpoint and the listing-endpoint wire-shape change. `npm run verify`.

- Middle: golden-fixture corpus of (source change, target content, relation kind) → expected classification tuples, evaluated against the live AI SDK adapter behind a recorded-or-live model. **Seed bootstrap (this slice ships the seed; the corpus harness itself is built incrementally as classification probes lands)**:
    1. (no semantic source change, target unchanged, depends_on)                  → auto-confirm
    2. (rename "user" → "customer" in source, target verbatim references "user", refines)   → auto-edit, proposal replaces "user" with "customer" in target text
    3. (constraint loosened in source, target encodes the older constraint, constrains)     → substantive, proposal null (judgment required)
    4. (added counterexample to source, target unaffected, illustrates)             → auto-confirm
    5. (verifier replaced in source, target derives_from old verifier, derived_from)        → substantive
  Per SPEC.md §Verification Design row 554, the corpus lives outside `npm run verify` (recorded-or-live model adapter). The five seed tuples land as a test-resources directory next to reconciliation-agent.test.ts so slice 6/7 can extend them; the harness that runs the corpus against the live adapter is its own slice (not this one). This slice's middle-loop deliverable is **the seed corpus + the prompt asset that the corpus exercises**, not the runner.

- Outer: deferred to after slice 7 (UI actions land), per SPEC.md row 555. The walkthrough on dense specs validating A88 is the only ring that says whether grouping helps.
```

### Promotion notes

- New invariant lands as **I114** in SPEC.md §Invariants: lifecycle + label vocabulary + structural recoverability (`agent_proposal` text-only, never auto-applied; `failed` is reachable from `classifying` and is recoverable via per-need Re-run in slice 6). Add I114 row to SPEC.md during build (per ln-scope traceability rule for full cards). The "planned I114" placeholder already in SPEC.md rows 553-554 gets replaced with the live id.
- No new D### unless the in-process loop turns out to be the wrong shape under outer-loop walkthrough; per HANDOFF.md it stays a deliberate MVP choice with a documented promotion trigger.
- A88 stays open — this slice does **not** validate it; slice 7 outer-loop walkthrough does.

---

## Not yet queued (depends on slice 5 findings)

6. **V3.1 agent client** — extend `useSpecificationOpenReconciliationNeeds` to expose the three new fields; "Run agent" button + thin progress strip ("Agent: 2 of 4 classified") + per-row status chips; 1-second polling while any need is `queued` / `classifying`. Per-row Re-run button. Reuses Card 4's `<DiffPopover>` and toolbar primitives — chips dock onto the polished row layout, not today's bare row.
7. **V3.1 actions + bulk** — per-class buttons (`auto-confirm` → one-click Confirm; `auto-edit` → render `agent_proposal` inside `<DiffPopover>` + Apply / Skip; `substantive` → render note + "Open side-chat"); "Confirm all (N)" + "Apply all suggested (N)". Apply suggested edit reuses Card 3's inline-textarea machinery (with Card 4's polished toolbar contract) pre-filled by `agent_proposal`. Outer-loop walkthrough validates A88.

Re-scope each only after slice 5 ships and the schema + lifecycle hold up under one walkthrough.
