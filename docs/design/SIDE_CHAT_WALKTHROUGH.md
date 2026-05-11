# Side-chat — End-to-End Walkthrough

> Reference companion to `docs/design/SIDE_CHAT.md`. Use this to walk a reviewer (or yourself) through what currently ships across the FE-657 / FE-665 / FE-673 / FE-674 stack, scenario by scenario, against a real running app.
>
> Meta-level demo content: the side-chat **feature design itself** (Linear: FE-656, FE-673, FE-674, FE-657, FE-665) is used as the example *spec content* being inspected and edited inside the app. So when a scenario says "user edits item `C1`", `C1` is the actual concept "Side-chat is a popover-to-panel surface" — the same surface they're standing inside.

---

## 1. TL;DR — what ships, in one page

The spec is a structured graph of knowledge items (goals · terms · context · constraints · decisions · assumptions · requirements · criteria) connected by typed edges (`depends_on` · `derived_from` · `constrains` · `verifies` · `refines`). Users mutate this graph through **two interaction surfaces today** (a third — the architect loop — is future work):

1. **Direct edit** on a structured-list row — inline Save / Cancel.
2. **Side-chat** opened from a row's `chat-with` affordance — three modes: **Explore · Edit · Note**.

Both surfaces stage their mutations into the same **patch list** (the `N change(s)` · `Undo` · `Apply` strip), and both ultimately route through the same server endpoint (`POST /api/specifications/:id/items/:itemId`). Routing is by **impact tier**, computed deterministically from the item's downstream-edge count and whether the item (or any downstream) sits in an *active review set* (i.e. a `phase_outcome` with `status = 'proposed'` in `requirements` or `criteria`):

| Tier | Trigger | What happens on Apply |
| --- | --- | --- |
| **None** | 0 downstream | Content updates. Done. |
| **Soft** | 1–2 downstream, none in active review set | Content updates + inline "may need refresh" hint. |
| **Hard** | 3+ downstream **or** any anchor/downstream is in an active review set | Content updates atomically + **one `reconciliation_need` row opens per dependency edge incident on the changed item**. Those rows surface as a **Pending review** section in the patch list overlay. The user clicks **Resolve** on each row to mark the consequence acknowledged. |

The Hard tier is the cascading half. Each `reconciliation_need` row is a *piece of process debt* — the source content moved, the target item *might* need attention. Resolve is idempotent and **does not mutate the target**; if the user wants to actually change the target, they edit it inline (re-entrant — that edit may itself open new needs).

V3.1 adds three things on top of V3.0: (a) **source content snapshots** frozen on the `reconciliation_need` row at open time, (b) an anchored **DiffPopover** that shows the source before/after when the user clicks `↗ view source diff` on a Pending-review row, and (c) an **inline edit-target form** so the user can change the target item from within the Pending-review row without leaving the overlay.

Card 4 (polish) renames `annotate → note` in the UI, relocates the saved-toast and `PatchListOverlay` into the structured-list view, and tightens visual language.

### Linear → PR → frontier map

| Linear | PR | What it lands |
| --- | --- | --- |
| **FE-656** | parent issue | Side-chat overall — graph-launched chat with patch-list staging. |
| **FE-673** | [#105](https://github.com/hashintel/brunch/pull/105) | Side-chat **V2** — Edit / Edge / Drill-down chat-driven flows; Edit-mode toggle. |
| **FE-665** | [#107](https://github.com/hashintel/brunch/pull/107) · [#108](https://github.com/hashintel/brunch/pull/108) | Diff visualization on staged-patch rows + per-patch overlay diff list. |
| **FE-657** | [#109](https://github.com/hashintel/brunch/pull/109) | Direct inline edits on structured-list rows. |
| **FE-674 V3.0** | [#115](https://github.com/hashintel/brunch/pull/115) · [#116](https://github.com/hashintel/brunch/pull/116) · [#117](https://github.com/hashintel/brunch/pull/117) · [#118](https://github.com/hashintel/brunch/pull/118) | Hard-edit cascade: open `reconciliation_need` rows on apply → Pending-review section → per-row Resolve. Drops the V2 "deferred" banner. |
| **FE-674 V3.1** | [#119](https://github.com/hashintel/brunch/pull/119) · [#120](https://github.com/hashintel/brunch/pull/120) | Source content snapshots on the need row · inline source diff (`DiffPopover`) · inline target edit form · atomic classifier claim. |
| **FE-674 Card 4** | [#121](https://github.com/hashintel/brunch/pull/121) | Polish — `note` vocabulary; `+ note` / `Notes(N)` move into composer; saved-toast relocated; `DiffPopover` primitive; pending-review chrome. |

---

## 2. The pipeline — how the pieces compose

```
                  ┌──────────────────────────┐
   Entry surface  │  Structured-list row     │           ┌──────────────────┐
   ─────────────  │  · `Edit` (FE-657)       │           │ Side-chat panel  │
                  │  · `chat-with` button    │ ─ open ─▶ │ Explore / Edit / │
                  └──────────────────────────┘           │ Note  (FE-673)   │
                              │                          └──────────────────┘
                              │                                   │
                              ▼                                   ▼
                  ┌──────────────────────────────────────────────────────┐
                  │  Patch list  (in-memory, per session)                │
                  │  `N change(s) · Undo · Apply`                        │
                  │  Per-row: kind chip · ↗ view diff (FE-665 / Card 4)  │
                  └──────────────────────────────────────────────────────┘
                              │ user clicks Apply
                              ▼
                  ┌──────────────────────────────────────────────────────┐
                  │  POST /api/specifications/:id/items/:itemId          │
                  │  classifyEditImpact(downstreamCount, inReviewSet)    │
                  └──────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────────────┐
              ▼               ▼                       ▼
           none            soft                    hard
       update only     update + hint     update + open one
                                          reconciliation_need
                                          per dependency edge
                                          (atomic, idempotent)
                                                  │
                                                  ▼
                                  ┌──────────────────────────────┐
                                  │ Pending review section       │
                                  │  per row: ↗ view source diff │
                                  │           [Edit target]      │
                                  │           [Resolve]          │
                                  │  (V3.1: classifier reclassifies
                                  │   open needs in the background)
                                  └──────────────────────────────┘
```

Two entry surfaces, one staging layer, one apply endpoint, three durability outcomes, one cascade surface.

---

## 3. Seeding the demo content (live interview)

We're driving the live interview to produce side-chat-design items naturally — the slower but most faithful path. The doc below names items as if `SIDE_CHAT.md` were already in the spec graph; the actual items your interview produces will be similar in *shape* (kind, downstream count, review-set membership) but the exact wording will differ.

### Kickoff prompt

In a fresh dev DB, start a new specification with this problem statement (paste into the kickoff input):

> *"I'm designing a side-chat surface for a structured spec view. Users should be able to open a popover-to-panel chat anchored to any item in the graph, attach context by clicking the item or highlighting text inside it, run free-form Explore conversations, stage Edit / Edge / Drill-down patches into a patch list, and leave per-item Notes (annotations). Edits route by impact: leaf edits apply directly, edits with 1–2 downstream items show an affected-items hint, and high-impact edits open a cascade through a reconciliation queue that the user resolves row by row."*

### Checkpoints to hit

| Phase | Drive the interview toward | Why |
| --- | --- | --- |
| **Grounding** | Close after capturing platform / users / scope (it's a web product, internal users, single-spec session). | Closed phase → §3.1 None-tier demo target. |
| **Design** | Close after the interview produces concept-shaped items: a **popover-to-panel surface** (→ `C1`), a **patch list staging surface** (→ `C2`), an **edit impact tiering** decision (→ `D139`), an **active-review-set** definition (→ `D113`-ish), and a few assumptions (→ `A71`, `A72`). | Closed phase + rich downstream topology → §3.2 / §3.3 / §3.4 / §3.5 demo targets. |
| **Requirements** | Generate the requirements review **and stop before accepting it**. | Phase outcome `status = 'proposed'` → puts every reviewed requirement into the **active review set** → triggers the Hard-tier branch for items that would otherwise be Soft. Needed for §3.3 and §3.4. |
| **Criteria** | Don't run. Or run and leave proposed. | Optional. Same review-set mechanic if you want a second source of in-review-set items. |

### What "good enough" looks like before walking the scenarios

Before §3.1 onward, eyeball the structured-list view and confirm at least:

- One item with **0 outgoing edges** (a graph leaf).
- One item with **1–2 outgoing edges**, none pointing into items in the active review set.
- One item with **3+ outgoing edges**, OR any single edge pointing into an item that's in the active review set.
- A **chain** of three items `A → B → C` (so editing `A` cascades to `B`, and editing `B` would itself cascade to `C` — re-entrant demo).

If the interview underproduced edges, fall back to the **structured-list inline `Add relationship` affordance** to wire up a couple of edges manually before walking the scenarios.

---

## 4. Cascade walkthroughs (PRIMARY)

Each scenario is click-by-click. All entries use the **side-chat Edit mode** as the entry surface (direct inline edit produces identical server behaviour — covered in §5).

### 4.1 Scenario — None tier (leaf edit, no cascade)

**Setup.** Item `A73 — Architect / generator loop` is a leaf concept in the closed `design` phase. Zero outgoing edges.

**Steps.**

1. Navigate to `/specification/$id/graph`.
2. Locate `A73` in the structured-list view.
3. Click the row's `chat-with` button. → Side-chat popover opens, anchored to the row; `A73` shows as a pinned context card.
4. Toggle the composer **Edit on** pill (top-right of the input card).
5. Type: *"Soften the framing — say 'agent that proposes changes for human review' instead of 'autonomous agent'."*
6. Press send. → The chat model surfaces a staged patch: kind chip `edit`, anchor `A73`, summary string.
7. Verify the **patch list strip** at the bottom of the side-chat shows one staged row with `kind = edit` and an impact-tier chip reading `none` (1-line summary visible).
8. Click `Apply` in the strip (aria-label `Apply 1 change`).

**Expected.**

- Apply request fires `POST /api/specifications/:id/items/A73-id` with `{ content, rationale }`.
- Server response: `{ impact: 'none', affectedItems: [], updated: true, previousContent, previousRationale }`.
- Patch list closes; saved-toast banner slides in from the top with an emerald check + `Change saved`.
- `A73`'s content in the structured-list view reflects the new wording.
- **No** Pending review section appears.

**Durable state.** `knowledge_item.content` updated for `A73`. Zero `reconciliation_need` rows opened.

**Verification hook.** `edit-route.test.ts → "applies content update with impact = none for leaf items"`.

---

### 4.2 Scenario — Soft tier (1–2 downstream, no review-set member)

**Setup.** Item `D127 — Progressive-detail seam` in the closed `design` phase, with two outgoing `refines` edges to items that are themselves in *closed* phases (so not in the active review set).

**Steps.**

1. Click `chat-with` on `D127`'s row.
2. Edit-mode on. Type: *"Rename 'progressive-detail seam' to 'progressive-depth seam' throughout."*
3. Send. → One staged patch, kind chip `edit`, impact chip `soft`.
4. Click `Apply` (aria-label `Apply 1 change`).

**Expected.**

- Server response: `{ impact: 'soft', affectedItems: [{ id, kind, referenceCode, content } x2], updated: true, previousContent, previousRationale }`.
- Patch list closes; saved-toast `Change saved`.
- A **one-shot inline confirmation** lists the 2 affected items: *"`[ref1]`, `[ref2]` may need a refresh."*
- **No** Pending review section. The two downstream items are visually unchanged in the structured-list (Soft tier doesn't auto-mutate them).

**Durable state.** `knowledge_item.content` updated for `D127`. Zero `reconciliation_need` rows opened.

**Verification hook.** `edit-route.test.ts → "applies content update with impact = soft when downstream count ≤ 2 and not in review set"`.

---

### 4.3 Scenario — Hard tier (V3.0 — open `reconciliation_need` rows + Resolve)

**Setup.** Item `C1 — Side-chat is a popover-to-panel surface anchored to items in the structured spec view` in the closed `design` phase, with **4 outgoing edges** to: `R39` (multi-chat requirement, in active review set), `D139` (hard-impact reads queue decision), `A71` (patch ledger assumption), `I112` (cascade invariant).

`R39` lives in the **proposed** `requirements` phase (interview stopped at review-ready, not accepted yet) → `R39` is in the active review set → Hard tier locked in even without the count.

**Steps.**

1. Click `chat-with` on `C1`'s row.
2. Edit-mode on. Type: *"Tighten C1 — emphasise that the surface is reachable from anywhere a knowledge item is rendered, not just the graph view."*
3. Send. → One staged patch. Impact chip reads `hard`.
4. Click `Apply` (aria-label `Apply 1 change`).

**Expected — server side.**

- Server atomically (one DB transaction):
  1. Writes the new content on `C1`.
  2. For each of the 4 outgoing dependency edges, calls `openReconciliationNeedIfAbsent({ specificationId, sourceItemId=C1, targetItemId, kind=relationToKind(relation), causedByTurnId, sourcePreviousContent, sourceCurrentContent })`.
  3. Returns `{ impact: 'hard', affectedItems: [...x4], updated: true, previousContent, previousRationale, openedNeedIds: [...x4] }`.

**Expected — UI side.**

- Patch list closes; saved-toast `Change saved`.
- A new **Pending review** section materialises at the top of the structured-list view (just above the structured list). Strip background `rgba(255,219,168,0.18)`, header renders a `Replace` icon + `N pending review[s]` (so `4 pending reviews` here).
- Each row renders:
  - Kind chip (amber bg) — `supersedes` or `needs_confirmation` depending on the original edge relation type.
  - Raw `#{needId} · {target excerpt}` title.
  - Sub-line `from #C1 was edited [↗ view source diff]`.
  - Right-side action cluster: icon-only `Edit` button + solid kind-accent `Resolve` button.
- Rows are grouped by `kind` — `supersedes` first, then `needs_confirmation` (V3.0 mechanical grouping; no agent classification yet).

**Resolve walk.**

5. Click `Resolve` on the first row.
6. → Button swaps to a spinner with aria `Resolving`. Server atomically claims the row (`open → resolved` via `UPDATE … WHERE status = 'open'`, idempotent).
7. → On success, row disappears from the section. Counter decrements (`3 pending reviews`).
8. Repeat for rows 2, 3, 4.
9. After the last row resolves, the Pending review section unmounts.

**Durable state.**

- `C1.content` updated.
- 4 `reconciliation_need` rows transitioned `open → resolved` with `resolved_at = now`.
- **No** target items were mutated. (Resolve is acknowledgment, not edit.)

**Verification hooks.**

- `edit-route.test.ts → "opens reconciliation_need rows on hard apply"`.
- `reconciliation-needs-route.test.ts → "atomic open-to-resolved transition"`.
- `pending-review-section.test.tsx → "renders one row per open need; resolve removes the row"`.

---

### 4.4 Scenario — Hard tier with V3.1 source-diff popover + inline target edit

**Setup.** Same as §4.3 — `C1` edit just applied, Pending review section showing 4 rows.

**Steps — Source-diff popover.**

1. Click `↗ view source diff` on the first Pending-review row.
2. → `DiffPopover` portals into `document.body` and anchors below-right of the chip. Header shows the kind chip + title; body shows `<ContentDiff before={sourcePreviousContent} after={sourceCurrentContent}>` (the snapshots frozen on the `reconciliation_need` row at open time — V3.1 Card 1).
3. The popover body is capped at `max-h-[min(70vh,40rem)]` with internal scroll.
4. Scroll the page. → Popover **flips above** if the anchor moves close to the viewport bottom.
5. Press `Esc` (or click outside). → Popover closes.

**Steps — Inline target edit.**

6. On a Pending-review row whose target you actually want to update, click the icon-only `Edit` button.
7. → A kind-accent-tinted card expands inline below the row, containing an `ItemEditTextarea` pre-filled with the current target content.
8. Edit the text. While typing, the textarea shows a 2px focus ring in the kind-accent color (Card 4 polish — expressed via CSS `focus:` state, not imperative style).
9. Click `Save`.
10. → The form disables while the request flies (FE-674: *"Disable edit-target form while row is resolving"*).
11. → Server updates the target's content via the standard edit endpoint. **This is a re-entrant edit** — if the target has its own downstream edges or sits in the active review set, the response will itself be `impact: 'hard'`, opening *new* `reconciliation_need` rows that surface in the same Pending review section after the next refetch. (See §4.5.)
12. → The Pending-review row resolves automatically as part of the same atomic operation (V3.1: edit-target on a need row resolves that need atomically — the need is acknowledged-by-fixing).

**Expected.**

- DiffPopover shows the exact before/after content frozen on the need row at the moment `C1` was applied — *not* a live read of `C1` (which could have moved again).
- After Save, the edited row's content reflects the new wording in the structured-list.
- The Pending-review counter decrements by 1; any newly-opened needs from the target edit appear as fresh rows.

**Durable state.**

- Target item's `knowledge_item.content` updated.
- The need row that hosted the inline edit: `status = 'resolved'`, `resolved_at = now`.
- Possibly N additional `reconciliation_need` rows opened against the target's downstream.

**Verification hooks.**

- `diff-popover.test.tsx` (9 tests — portal, viewport flip, esc, click-outside).
- `pending-review-section.test.tsx → "inline edit-target form atomically resolves the need"`.

---

### 4.5 Scenario — Re-entrant cascade

**Setup.** Chain `C1 → D139 → I112`. Each is in a closed phase. `D139` has its own downstream edges (`I112`, and one more).

**Steps.**

1. Apply a hard edit on `C1` as in §4.3. → Pending review section opens with rows for `D139`, `I112`, plus 2 others.
2. On the `D139` row, click inline `Edit`, change `D139`'s content, Save. → §4.4 step 9–11 path.
3. Watch the Pending review section refresh.

**Expected.**

- The `D139` need row resolves (the row disappears, counter decrements).
- **A new Pending review row appears** for each `D139`-downstream edge — including a fresh `I112` row (the *same* target item, but a different `reconciliation_need` keyed on `(D139, I112, kind)` — the partial unique index allows it because the older `(C1, I112, kind)` row already resolved).
- If `I112` was *also* affected by the original `C1` edit (it was), the user may see two distinct need rows about `I112` over the lifetime of the cascade: one caused by `C1`, one caused by `D139`. Each is resolved independently.

**Why this matters.** Re-entrancy is intentional — every link in the cascade chain becomes its own piece of process debt, surfaced and acknowledged independently. There's no auto-collapse or auto-propagation in V3.0 / V3.1.

---

### 4.6 Scenario — Undo of an applied batch

**Setup.** Apply any Hard edit (§4.3). Pending review section showing N rows.

**Steps.**

1. Click `Undo last change` in the patch list strip (top-right of the structured-list view).
2. → Client sends an undo request that:
   - Restores `C1.content` and `C1.rationale` to `previousContent` / `previousRationale` from the apply response.
   - Closes the opened `reconciliation_need` rows (transitions `open → resolved` with a `resolved_at` and a flag that they were resolved via undo).
3. The Pending review section unmounts. Saved-toast hides only on actual undo transition (Card 4 polish fix — toast doesn't flicker on unrelated state churn).

**Expected.**

- `C1` content reverts.
- All 4 (or N) `reconciliation_need` rows that were opened by this apply are resolved.
- **No throw on hard-only batches** (V3.0 polish fix — earlier versions tried to reclassify and threw on undo with no soft/none patches in the batch).

**Verification hooks.**

- `edit-applier.test.ts → "undo restores previousContent and resolves opened needs"`.
- `patch-list-overlay.test.tsx → "hard-only batch undo succeeds without throwing"`.

---

## 5. Other surfaces (narrative)

### 5.1 Direct edit mode (FE-657)

Each row in the structured-list view exposes an inline `Edit` affordance: click → the row's content cell becomes a textarea with explicit `Save` and `Cancel` buttons. On Save, the client trims the textarea content and sends the same `POST /api/specifications/:id/items/:itemId` request the side-chat uses. **Cascade routing is identical** — editing `C1` directly on the row triggers the exact same Hard-tier path described in §4.3, opening the same Pending review section. The two entry surfaces share the same downstream pipeline; the difference is conversational framing, not durability behaviour. The Save button is disabled when the trimmed content equals the initial content (FE-657: *"Trim initialContent in canSave comparison"*).

### 5.2 Side-chat modes (FE-673 + Card 4)

Three modes selectable from the composer toggle:

- **Explore** — pure conversation. The chat reasons over the pinned item(s) and responds in text. **No patches stage.** Useful for "what does this item mean?" / "what depends on this?" / "is this consistent with X?"
- **Edit** — conversation that produces staged patches. The chat (model-driven) infers the *kind* of mutation from the dialogue: a wording change → `edit`, a relationship proposal → `edge`, a "deepen this area" intent → `drill-down`. All three kinds land in the same patch list; only `edit` runs through the impact-tier pipeline. `edge` validates against the typed relation registry and persists. `drill-down` emits a detail-focus intent for the next interview turn.
- **Note** *(renamed from `Annotate` in Card 4)* — captures a per-item note. Doesn't open the chat dialogue; opens an inline annotation form directly. See §5.3.

Mode persists in `localStorage` under `brunch.side-chat.mode` (Card 4). A newly pinned item adopts the stored mode instead of defaulting to `explore` — so users who live in Edit mode don't toggle on every re-pin.

Visual cues:

- Edit-mode strip sits **below** the composer input card (Card 4 layout).
- The mode toggle pill renders in the kind-accent color when active (e.g. blue for Edit, amber for Note).
- The `+ note` button and `Notes (N)` button live in the composer's left action row.

### 5.3 Annotations / Notes (FE-673)

A Note is a durable per-item comment, stored as an `annotation` row keyed by `(specification_id, item_kind, item_id, author_turn_id_or_null)`. Two flavours:

- **Item-level** — entered from the composer `+ note` button or via the Note mode. Attaches to the pinned item; no selection range.
- **Span-anchored** *(when entered through the floating selection menu)* — carries `selectionRange: { start, end, snapshotText }`. The note row stores the range alongside the text; `snapshotText` is the highlighted phrase at save time, used for fuzzy reattach if the parent content later changes.

Surfacing rules:

- Structured-list row — count badge in the action rail (`Notes (N)` button); hover preview lists existing notes.
- Side-chat `Notes (N)` panel — clicking opens an in-panel list of notes for the pinned item, with the span excerpt rendered above the note text for span-anchored entries.

Notes and per-item review-comments share one comment store (`annotation` table with an `origin` discriminator). One annotation IS one comment.

### 5.4 Diff visualization (FE-665 + Card 4 `DiffPopover`)

Two surfaces use diffs:

- **Staged-patch rows** (in the side-chat patch list strip and the structured-list patch overlay) — each row has a `↗ view diff` chip. Clicking opens a `DiffPopover` showing the patch's proposed before/after, with the patch's kind chip in the popover header.
- **Pending review rows** — each row has a `↗ view source diff` chip. Clicking opens a `DiffPopover` showing the *source* item's content snapshot, frozen on the `reconciliation_need` row at open time (not a live read — so the diff stays correct even if the source moves again).

The `DiffPopover` is a portal-mounted, viewport-aware primitive (Card 4). It:

- Portals into `document.body` so it escapes the side-chat dialog's transformed/clipped ancestors.
- Prefers below-anchor; flips above when there isn't room. Right-aligns with the anchor.
- Repositions on scroll / resize.
- Closes on `Esc` and click-outside.
- Caps the body region at `max-h-[min(70vh,40rem)]` with internal scroll so large diffs stay reachable.

### 5.5 Patch list + saved-toast + undo (Card 4 relocation)

The `PatchListOverlay` was previously mounted in the page top-bar (`route.tsx`). Card 4 moves it into `-structured-list-view.tsx`, immediately above the Pending review section. It's no longer sticky — it sits in flow with the structured list.

The **saved-toast** banner (the emerald-check `Change saved` strip) shows when:

- `lastBatchId` changes, AND
- the app is no longer applying, AND
- `stagedCount === 0`.

This broader trigger (Card 4) is intentional — it also fires for Note batches (annotate-only applies), which weren't surfacing the toast in V3.0.

The toast only **hides** on actual undo transitions (`d2a3611` — *"Only hide saved-toast on actual undo transition"*), not on unrelated state churn that incidentally re-renders the overlay.

---

## 6. Reference appendix

### 6.1 Out of stack — design-spec only (not implemented in this stack)

- **Refine path on open-phase items** (`SIDE_CHAT.md §5`, §6.2). The design says an edit applied to an item whose phase is still **open** should route to a same-phase successor turn with a revision card, instead of through impact-tier routing. The current `edit-route.ts` does not fork on phase status — it always classifies impact. This is design-spec future work, not in the FE-674 stack.
- **V3.1 reconciliation agent — grouped resolutions.** The classifier (`agent_status` column on `reconciliation_need`) is wired but the **grouped UI** (auto-confirm / auto-edit / substantive cohorts described in `SIDE_CHAT.md §5.3` V3.1) is not implemented. Today every open need surfaces as an individual row.
- **Architect / generator loop.** Symmetric to the side-chat in *what* it does (proposes patches into the patch list) but different in *who* drives. Future Horizon item.
- **Patch ledger.** When this lands, `reconciliation_need.caused_by_patch_id` will populate and undo will be reconstructible from durable patches. Currently `caused_by_turn_id` is the only provenance link.

### 6.2 Code pointers

| Concern | File |
| --- | --- |
| Edit endpoint + impact tier routing | `src/server/edit-route.ts` |
| Impact tier classifier | `src/server/edit-impact.ts` |
| `reconciliation_need` schema + `openReconciliationNeedIfAbsent` | `src/server/schema.ts`, `src/server/db.ts` |
| Reconciliation needs route (`resolve`, `list-open`) | `src/server/reconciliation-needs-route.ts` |
| Active-review-set detection | `src/server/db.ts:isItemInActiveReviewSet` |
| Side-chat route (SSE) | `src/server/side-chat-route.ts` |
| Structured-list view + Pending review host | `src/client/routes/specification/$id/-structured-list-view.tsx` |
| Pending review section | `src/client/components/pending-review-section.tsx` |
| Patch list overlay | `src/client/components/patch-list-overlay.tsx` |
| Side-chat popover/panel + composer | `src/client/components/side-chat-popover.tsx` |
| Side-chat host (transcript state) | `src/client/components/side-chat-host.tsx` |
| `DiffPopover` primitive | `src/client/components/diff-popover.tsx` |
| Inline direct edit textarea | `src/client/routes/specification/$id/-structured-list-view.tsx` (search `ItemEditTextarea`) |

### 6.3 Verification commands

| Goal | Command |
| --- | --- |
| Run everything (fmt-check, lint, test, build) | `npm run verify` |
| Cascade-producer tests only | `npm run test -- cascade-producer` |
| Reconciliation route tests only | `npm run test -- reconciliation-needs-route` |
| Pending review section tests only | `npm run test -- pending-review-section` |
| Diff popover tests only | `npm run test -- diff-popover` |
| Side-chat route tests only | `npm run test -- side-chat-route` |

### 6.4 Branch / Graphite stack at time of writing

```
main
└── ka/fe-673-side-chat-v2-edit-mode               (#105 FE-673 V2)
    ├── ka/fe-665-staged-edit-diffs                (#107 FE-665 staged diffs)
    │   └── ka/fe-665-overlay-diff-details         (#108 FE-665 overlay diffs)
    │       └── ka/fe-657-direct-edits             (#109 FE-657 direct edit)
    │           └── ka/fe-674-cascade-producer     (#115 V3.0 card 1)
    │               └── ka/fe-674-cascade-pending-review  (#116 V3.0 card 2)
    │                   └── ka/fe-674-cascade-resolve     (#117 V3.0 card 3)
    │                       └── ka/fe-674-cascade-polish  (#118 V3.0 polish)
    │                           └── ka/fe-674-plan-v3-1-verification (#119)
    │                               └── ka/fe-674-cascade-edit-and-agent (#120 V3.1)
    │                                   └── ka/fe-674-card-4-polish     (#121 Card 4)
    │                                       └── ka/fe-675-side-chat-persistence-v4a-planning (planning only)
```
