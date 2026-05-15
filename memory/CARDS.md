<!-- CARDS.md — derivative scope-card queue for the active frontier branch.
     Authority: execution sequencing inside ONE frontier item. Not canonical planning state.
     PLAN.md owns frontier items; CARDS.md owns the slice queue inside the active frontier.
     Cards live on the same Linear issue + Graphite branch by default; promote to a new
     frontier in PLAN.md only if the card itself reveals a durable seam/branch boundary. -->

# Cards — `chat-runtime-secondary-chats` (FE-716)

Branch: `ka/fe-716-chat-runtime-unified-secondary-chats`
Linear: [FE-716](https://linear.app/hash/issue/FE-716)
Stacked on: `ln/fe-709-reconciliations` (PR #139, awaiting merge to main)

## V1 framing

V1 = "every behavior the current side-chat (V3.1) ships today, surfaced through the elevated unified-workspace shape from `docs/design/UNIFIED_CHAT_UX.md`." Build only what that framing requires; defer the rest of the brief to follow-up frontiers. See PLAN.md `chat-runtime-secondary-chats` § V1 narrowing for the explicit defer list.

Vocabulary: **secondary chat** (matches PR #139's lexicon). The `chat.parent_chat_id IS NOT NULL` projection is the sole driver of "render inline as a secondary chat under parent."

## Card queue

### C0 — Bring forward `UNIFIED_CHAT_UX.md` design brief

- **Status:** **done** (2026-05-15) — Option B chosen (verbatim body + prepended `<!-- Reading note (FE-716) -->` translation header mapping `thread` → `secondary chat` and noting D153 substrate deferral).
- **What:** Copy `docs/design/UNIFIED_CHAT_UX.md` verbatim from PR #138 onto this branch. Body preserved unedited; reading-note header added for current readers. Brief stays the canonical UX ceiling for future tracks.
- **Why first:** Zero substrate dependency; gives downstream cards a single in-tree reference. Cheap to land alone.
- **Scope:** doc-only.
- **Verification:** `npm run check` — 0 errors (6 pre-existing warnings unrelated). Body matches PR #138 commit `cd48b49a` byte-for-byte.

### C1 — Substrate migration: four columns on `chat`, zero enum changes

- **Status:** **done** (2026-05-15) — `drizzle/0020_chat_secondary_chat_columns.sql` adds the four nullable integer/text columns + two non-unique indexes; `src/server/schema.ts` chat table promoted to `(table) => […])` form to declare the indexes. Real schema uses `integer` ids (HANDOFF's UUID was illustrative). Resolved: `invoked_in_turn_id` kept (denormalized anchor); `pinned_reconciliation_need_id` deferred; per-turn span-hint not in V1; `parent_chat_id` + `invoked_in_turn_id` indexed.
- **What:** Drizzle migration adding `parent_chat_id integer NULL REFERENCES chat(id)`, `invoked_in_turn_id integer NULL REFERENCES turn(id)`, `pinned_item_id integer NULL REFERENCES knowledge_item(id)`, `pinned_span_hint text NULL` + indexes `chat_parent_chat_id_idx` and `chat_invoked_in_turn_id_idx`. `chat.kind` enum unchanged; `chat.active_turn_id` preserved.
- **Verification:** `npm run verify` — 100 test files / 1272 tests pass; build clean. New tests in `src/server/chat-substrate.test.ts` cover column shape, index presence, FK integrity (parent_chat_id, pinned_item_id, invoked_in_turn_id all reject missing targets), nullable inserts, and `chat.active_turn_id` preservation.
- **Out of scope:** any new enum value; the `thread` table; `turn.thread_id`; `thread_context_item`.

### C2 — Server: `createSecondaryChat` + `createKickoffTurn` helpers

- **Status:** **done** (2026-05-15) — helpers + tests landed; route deferred to C3 to avoid speculative scaffolding (no consumer until UI wires up).
- **What:** Two new public DB helpers exported from [src/server/db.ts](file:///Users/kostandin/Projects/hashdev/brunch/src/server/db.ts):
  - `createSecondaryChat(db, specId, { parent_chat_id, invoked_in_turn_id?, pinned_item_id?, pinned_span_hint? })` — inserts a `chat` row with `kind='side_chat'` and the four C1 columns; returns `Chat`.
  - `createKickoffTurn(db, chatId, { phase, content })` — inserts a `turn` with `turn_kind='kickoff'`, `chat_id=chatId`, and `assistant_parts=content`; resolves the chat's `specification_id` automatically; returns `Turn`.
- **Verification:** `npm run verify` — 100 test files / 1277 tests pass. New tests in [src/server/chat-substrate.test.ts](file:///Users/kostandin/Projects/hashdev/brunch/src/server/chat-substrate.test.ts) cover happy-path persistence, optional column population, FK rejection, kickoff turn metadata, and error on missing chat.
- **Out of scope (moved to C3):** `POST /api/specifications/:id/secondary-chats` route. Building it without a consumer is speculative; C3 will define the route alongside the UI client that calls it.
- **Harvest reference:** `src/server/side-chat-route.ts`, `src/server/side-chat-prompt.ts`, PR #138's threads endpoint.

### C3 — Client: `secondary-chat-collapsible` inline component

- **What:** Build the inline collapsible UI for `chat.parent_chat_id IS NOT NULL` chats, anchored under their `invoked_in_turn_id` in the parent transcript. Driven entirely by the projection rule — no flavor enum needed. Replace `SideChatHost`'s popover plumbing with inline rendering inside `ContinuousWorkspaceView`.
- **Why fourth:** First user-visible artifact; depends on C1 + C2.
- **Verification:** rendering tests for inline placement and collapse/expand state; reload preserves expand/collapse; one-open-frontier-per-chat reflected in UI; manual walkthrough of side-chat creation through the new surface.
- **Harvest:** `thread-collapsible.tsx` from #138 (rename to `secondary-chat-collapsible.tsx`); `src/client/components/side-chat-host.tsx` shrinkage pattern (940 → 95 LOC in #138).
- **Out of scope:** popover deletion (C8), Ask/Edit toggle (C4), patch staging (C5), `#` injection (C6).

### C4 — Ask / Edit mode toggle on secondary chats

- **What:** Mode toggle (Ask = `explore`, Edit = `edit`) with per-mode tool sets via `getSideChatTools(mode)`; persist mode on the chat (column or `chat_strategy_state`-style metadata — decide during card; smallest viable storage).
- **Why fifth:** Re-establishes V3.1 functional parity for side-chat editing.
- **Verification:** mode toggle persistence test; tool-set selection test per mode; manual walkthrough for both modes.
- **Harvest:** `getSideChatTools(mode)`, V3.1 mode plumbing.

### C5 — In-thread patch staging on secondary chats

- **What:** Port #138's in-thread staged-patches strip onto the chat substrate. Patches stay turn artifacts; accepted mutations still flow through Brunch-owned handlers (no new source of semantic truth).
- **Why sixth:** Closes the Edit-mode loop end-to-end.
- **Verification:** staging/apply/cancel tests on a secondary chat; regression on the V3.1 side-chat edit flow.
- **Harvest:** #138's in-thread staging UI; `pendingPatches` plumbing.

### C6 — `#` knowledge-item symbol injection (V1 surface only)

- **What:** Implement `#REF-CODE` resolution in the secondary-chat composer that inserts an item context snapshot artifact into the next turn. **No** autocomplete chip; **no** `$` secondary-chat mention symbol; **no** snapshot builder lifecycle (those are Track 5 / `chat-context-provision`). Use a server-owned resolver scoped to the specification per `CONVERSATIONAL_WORKSPACE_RUNTIME.md` §3.5.
- **Why seventh:** Provides the V1 structured way to add item context, replacing the ad-hoc V3.1 anchoring path for in-flight mentions.
- **Verification:** resolver unit tests for valid/missing/ambiguous codes; turn-snapshot insertion test; manual walkthrough.

### C7 — Agent-run inline rendering + `chat.kind` decision

- **What:** Decide and implement: (a) keep enum at `interview` + `side_chat` and project `agent_run` flavor from `first_turn_role='system'`; (b) add a fifth `chat.kind='agent_run'` enum value. Default posture per HANDOFF: (a). Render agent-run secondary chats inline using the same component from C3. If (b) is chosen, this card carries a follow-up substrate migration.
- **Why eighth:** Agent-run inline is in V1 scope per HANDOFF; deferring to last lets the substrate decision settle after C1–C6 reveal whether projection-only is sufficient.
- **Verification:** agent-run secondary chat renders inline; system-first frontier turn invariant holds; if (b), enum migration applies cleanly.

### C8 — `SideChatPopover` retirement + `side-chat-host` shrinkage

- **What:** Delete `SideChatPopover`; shrink `side-chat-host` to its minimal post-popover form (target ~95 LOC per #138's harvest). Remove popover-only routes/state.
- **Why ninth:** Retire only after C3–C7 reach parity over durable secondary chats.
- **Verification:** `npm run verify`; manual regression on side-chat entry from substantive reconciliation rows; ensure no popover code paths remain reachable.

### C9 — Lightweight reconciliation-element view

- **What:** When a secondary chat is opened with a reconciliation context (entry bridge from a substantive reconciliation row), render a minimal "elements being reconciled" panel inside the secondary chat surface. **Not** the full target-grouped / classifier-state UX from the brief — that's Track 3 (`reconciliation-runtime`). `PendingReviewSection` retirement stays Track 3's job.
- **Why tenth:** Lightweight scope addition beyond pure side-chat parity per HANDOFF V1 list.
- **Verification:** rendering test with a reconciliation-need entry; regression on the V3.1 substantive-reconciliation → side-chat bridge.

### C10 — V1 closure: verification + manual walkthrough + frontier closeout

- **What:** Full `npm run verify`; outer-loop walkthrough of the side-chat V3.1 capability matrix on the new substrate; confirm SPEC.md A94 is satisfied (durable secondary chats over chat/turn without a `thread` table); update PLAN.md frontier status; draft PR description.
- **Why last:** Frontier-level closure gate.
- **Verification:** verify passes; walkthrough notes captured; A94 satisfied; PR ready for stack submission.

## Deferred — explicitly NOT in V1 (parking lot)

These belong to follow-up frontiers and should not be slipped into FE-716:

- `$` secondary-chat mention symbol → future `chat-context-provision` slice
- Mention autocomplete chip + per-kind prompt context builders → `chat-context-provision` (Track 5)
- Snapshot builder family (`buildIntentItemContextSnapshot`, neighborhood, economic-graph, historical) → `chat-context-provision` (Track 5)
- Item-version-gated handle refresh → `chat-context-provision` (Track 5; needs `changeset-ledger`)
- Full reconciliation runtime UX (target-grouped, async classifier states, "Reconcile Now") → `reconciliation-runtime` (Track 3)
- `PendingReviewSection` retirement → `reconciliation-runtime` (Track 3)
- QA composer refinements → follow-up frontier
- Strategy secondary-chat UI → follow-up frontier (substrate may already represent it)
- Layout-state header control (Compact / Side-docked / Maximize / Full) → follow-up frontier

## Open coordination items

- **Lexicon reconciliation:** none — branch adopts PR #139's "secondary chat" vocabulary throughout.
- **PR #139 dependency:** stack submits only after #139 merges (or per Lu's signal). Restack on `main` once #139 lands.
