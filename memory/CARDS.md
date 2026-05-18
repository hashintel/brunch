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

C3 has been split into three sub-cards (C3a / C3b / C3c) for verifiable thin slices. Original "What" preserved below for reference.

- **C3 original What:** Build the inline collapsible UI for `chat.parent_chat_id IS NOT NULL` chats, anchored under their `invoked_in_turn_id` in the parent transcript. Driven entirely by the projection rule — no flavor enum needed. Replace `SideChatHost`'s popover plumbing with inline rendering inside `ContinuousWorkspaceView`.
- **Out of scope (across all sub-cards):** popover deletion (C8), Ask/Edit toggle (C4), patch staging (C5), `#` injection (C6).

#### C3a — Server: `listSecondaryChatsForSpecification` + bundle field

- **Status:** **done** (2026-05-15) — list helper, `SecondaryChatWithKickoff` type, bundle `secondaryChats` field, and Zod schema all landed.
- **What:** New helper `listSecondaryChatsForSpecification(db, specId) → SecondaryChatWithKickoff[]` returns secondary chats (rows with `parent_chat_id IS NOT NULL`) with each chat's first kickoff turn (or null). `readSpecificationStateProjection` includes the projected `secondaryChats` field; `specificationStateSchema` extended with `secondaryChatStateSchema`.
- **Verification:** `npm run verify` — 100 test files / 1283 tests pass. New tests cover empty/single/multi-spec scoping, kickoff turn population, missing-kickoff null fallback, primary-chat exclusion, and bundle inclusion via `getSpecificationState`.

#### C3b — `<SecondaryChatCollapsible>` standalone component

- **Status:** **done** (2026-05-15) — component + tests landed; mounting deferred to C3c (where there's a real consumer to drive it).
- **What:** New `src/client/components/secondary-chat-collapsible.tsx` renders a Radix-`Collapsible`-backed secondary chat surface. Header always renders; body shows the kickoff turn's `assistant_parts` and is collapsed by default. Supports `kickoffTurn=null` (renders an empty body when expanded).
- **Verification:** `npm run verify` — 101 test files / 1287 tests pass. New tests in `src/client/components/__tests__/secondary-chat-collapsible.test.tsx` cover header presence, collapsed-by-default, expand-on-click reveals content, and empty-body fallback for missing kickoff.
- **Scope adjustment from original C3b:** mounting in `-continuous-workspace-view.tsx` deferred to C3c. Reason: `WorkspaceTranscriptArtifacts` (556 LOC) is the actual turn-render seam; threading the collapsible through it is invasive enough to merit landing alongside the trigger that creates the rows in the first place. Building mounting now without a creation flow would require fixture-seeding side-channels.

#### C3c-route — Server: `POST /api/specifications/:id/secondary-chats`

- **Status:** **done** (2026-05-15) — route + handler landed; client wiring + view mounting deferred to C3c-mount and C3c-wire.
- **What:** New `src/server/secondary-chat-route.ts` exports `handleCreateSecondaryChatRequest(db, req, res)`. Body schema: `{ parentChatId, invokedInTurnId, itemKind, itemId, spanHint? }`. Validates spec exists, validates body shape, resolves the item via `getKnowledgeItem` (rejects if missing or wrong kind/spec), calls `createSecondaryChat` + `createKickoffTurn`, returns `{ chatId, kickoffTurnId }`. Kickoff content templated as `Anchored to '<item-content-snippet>'.` (with `, focused on '<spanHint>'` when provided) — minimal V1 wording; richer per-mode templates from UNIFIED_CHAT_UX.md §6 land alongside C4 (Ask/Edit toggle).
- **Verification:** `npm run verify` — 101 test files / 1292 tests pass. New tests in `src/server/app.test.ts` cover happy path with bundle round-trip, span-hint persistence, 400 on bad body, 404 on missing spec, and 404 on missing item.

#### C3c-mount — View: thread `secondaryChats` through to `<SecondaryChatCollapsible>` mounting

- **Status:** **done** (2026-05-15) — controller projects a `secondaryChatsByInvokedTurnId: ReadonlyMap<number, readonly SecondaryChatState[]>` from `specificationState.secondaryChats`; view threads it into [WorkspaceTranscriptArtifacts](file:///Users/kostandin/Projects/hashdev/brunch/src/client/routes/specification/%24id/_view/-workspace-transcript-artifacts.tsx); a new `getArtifactAnchorTurnId` helper resolves the anchor turn id for each artifact kind (`answered-turn`, `prefaced-question`, `answered-review-turn`, `answered-revision-review`, `collapsed-review-turn`, `accepted-closure`, `persisted-turn`, `active-prefaced-question`, `phase-summary`); `<SecondaryChatCollapsible>` instances are rendered in a `data-testid="secondary-chats-for-turn-{id}"` slot beneath each matching artifact.
- **What:** `WorkspaceTranscriptArtifacts` accepts a `secondaryChatsByInvokedTurnId` map prop and renders `<SecondaryChatCollapsible>` after each turn artifact whose id matches a key. `-continuous-workspace-controller.ts` projects `specificationState.secondaryChats` into the map and threads it through; `-continuous-workspace-view.tsx` passes it to the artifacts renderer.
- **Acceptance:** fixture-seeded secondary chat appears under the right turn; collapsed by default; no orphan render when the parent turn is unrendered. All three covered by tests.
- **Verification:** `npm run verify` — 102 test files / 1295 tests pass; build clean. New tests:
  - [`-workspace-transcript-artifacts.test.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/routes/specification/%24id/_view/__tests__/-workspace-transcript-artifacts.test.tsx) — 4 tests covering inline rendering after the matching turn, collapsed-by-default, no-orphan when the anchor turn isn't in the stream, and multiple chats per turn.
  - [`-continuous-workspace-view.test.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/routes/specification/%24id/_view/__tests__/-continuous-workspace-view.test.tsx) — added prop-threading test asserting the controller's `secondaryChatsByInvokedTurnId` reaches the artifacts renderer by reference.

#### C3c-wire — Client: trigger that calls the C3c-route POST + invalidates bundle

- **Status:** **done** (2026-05-15) — `useCreateSecondaryChatMutation` mutation + `SecondaryChatTriggerProvider` context landed in [src/client/components/secondary-chat-trigger.tsx](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/secondary-chat-trigger.tsx); provider is mounted in `route.tsx` alongside `SideChatHost`; `ItemActionRail` in [-structured-list-view.tsx](file:///Users/kostandin/Projects/hashdev/brunch/src/client/routes/specification/%24id/-structured-list-view.tsx) gains an `Open inline chat` button (`data-graph-action="open-inline-chat"`, MessagesSquare icon) alongside the existing chat-with popover trigger. `specificationSchema` now exposes `primary_chat_id` (nullable+optional for transition) so the client can resolve the parent chat without a new endpoint.
- **What:** New `useCreateSecondaryChatMutation(specificationId)` hook posts to `/api/specifications/:id/secondary-chats` with `{ parentChatId, invokedInTurnId, itemKind, itemId, spanHint? }` and invalidates the bundle on success. `SecondaryChatTriggerProvider` reads `specificationState.specification.primary_chat_id` (parent) + `active_turn_id` (anchor) and exposes a `create({ kind, id })` callback through `useSecondaryChatTrigger()`. The button is disabled when either is missing or while a create is in flight.
- **Acceptance:** clicking the new trigger creates a secondary chat and reveals an inline collapsible (via C3c-mount) without disturbing the existing popover path. Verified by mutation tests + bundle invalidation; UI button surfaces alongside (not replacing) the chat-with popover trigger.
- **Verification:** `npm run verify` — 103 test files / 1302 tests pass; build clean. New tests in [`secondary-chat-trigger.test.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/__tests__/secondary-chat-trigger.test.tsx) cover canCreate=true happy path, canCreate=false when `primary_chat_id` or `active_turn_id` is missing, POST payload shape, bundle invalidation on success, and no-POST when canCreate is false.

### C4 — Ask / Edit mode toggle on secondary chats

- **Status:** **done** (2026-05-15) — `mode` column added to `chat` (nullable text enum `explore | edit`); `createSecondaryChat` defaults to `'explore'`; new `setSecondaryChatMode` helper + `PATCH /api/specifications/:id/secondary-chats/:chatId/mode` route; `secondaryChatStateSchema.chat.mode` propagates through the bundle; `SecondaryChatCollapsible` gains an Ask/Edit toggle (sibling to the trigger to avoid nested-button); a thin `SecondaryChatCollapsibleWithMode` wrapper subscribes to `useSetSecondaryChatModeMutation` and bundle invalidation.
- **What:** Mode toggle (Ask = `explore`, Edit = `edit`) with per-mode tool sets via `getSideChatTools(mode)`; persist mode on the chat (column-based, smallest viable storage). The actual streaming-with-tools wiring for secondary chats remains a follow-up — C4 lands persistence + UI selection. `getSideChatTools(mode)` is unchanged and continues to gate edit tools when called with `chat.mode`.
- **Why fifth:** Re-establishes V3.1 functional parity for side-chat editing.
- **Verification:** `npm run verify` — 103 test files / 1317 tests pass; build clean. New tests:
  - [`chat-substrate.test.ts`](file:///Users/kostandin/Projects/hashdev/brunch/src/server/chat-substrate.test.ts) — default mode='explore', explicit mode='edit', `setSecondaryChatMode` updates + invariants (rejects non-secondary chats and missing chats).
  - [`app.test.ts`](file:///Users/kostandin/Projects/hashdev/brunch/src/server/app.test.ts) — PATCH happy path with bundle round-trip, 400 on invalid mode, 404 on cross-spec chatId, 404 when targeting the primary interview chat.
  - [`secondary-chat-collapsible.test.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/__tests__/secondary-chat-collapsible.test.tsx) — toggle reflects persisted mode, falls back to explore when null, click invokes `onSetMode`, no-op when clicking active mode, disabled while pending or read-only.
- **Harvest:** `getSideChatTools(mode)` (unchanged), V3.1 mode plumbing pattern (Ask/Edit semantics).
- **Out of scope (deferred to C5):** wiring the persisted mode into the secondary-chat streaming pipeline + edit-tool registration; in-thread patch staging.

### C5 — In-thread patch staging on secondary chats

C5 has been split into three sub-cards (C5a / C5b / C5c) for verifiable thin slices. Original "What" preserved below for reference.

- **C5 original What:** Port #138's in-thread staged-patches strip onto the chat substrate. Patches stay turn artifacts; accepted mutations still flow through Brunch-owned handlers (no new source of semantic truth).
- **Why sixth:** Closes the Edit-mode loop end-to-end.
- **Verification (umbrella):** staging/apply/cancel tests on a secondary chat; regression on the V3.1 side-chat edit flow; `npm run verify` green at C5c.
- **Harvest:** [side-chat-route.ts](file:///Users/kostandin/Projects/hashdev/brunch/src/server/side-chat-route.ts), [side-chat-prompt.ts](file:///Users/kostandin/Projects/hashdev/brunch/src/server/side-chat-prompt.ts), [side-chat-stream.ts](file:///Users/kostandin/Projects/hashdev/brunch/src/client/lib/side-chat-stream.ts), [side-chat-host.tsx](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/side-chat-host.tsx) (staging strip render), [patch-list-host.tsx](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/patch-list-host.tsx) + [patch-list-reducer.ts](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/patch-list-reducer.ts) (`pendingPatches` plumbing).

#### Cross-cutting design decision (Shape A — patch-list partition seam)

C5c needs `PatchListProvider` to keep one global event log while letting each secondary chat see *only its own* staged patches. **Decision (this thread):** add `producerChatId: number | null` to `PatchBase` and expose a new `usePatchListForChat(chatId)` hook that filters the staged slice and scopes apply/discard/editSummary to that chat's patch ids. Existing `usePatchList()` keeps current behavior (popover sees all patches; safe during transition). Reducer logic is unchanged; the partition lives at the selector layer. C8 (popover retirement) deletes the legacy `producerChatId === null` branch.

Considered alternatives and rejected:
- **Shape B (one provider per chat):** N reducers + N applier injections; popover and inline use disjoint logs.
- **Shape C (`Map<Scope, PatchList>` reducer):** principled but over-engineered for V1's "popover + N inline" reality; large reducer churn.
- **Shape D (no shared abstraction):** inline duplicates the popover machinery until C8.

Shape A wins on Ousterhout's depth test (one new field + one new hook hides the partitioning concern) and is forward-compatible with A71's future server `appendPatch(spec, patch[])` signature.

#### C5a — Server: secondary-chat streaming endpoint + edit-tool registration

- **Status:** **next**
- **What:** New server seam `POST /api/specifications/:id/secondary-chats/:chatId/messages` (or equivalent — confirm naming during build) that resolves the chat by id, validates `chat.parent_chat_id IS NOT NULL`, calls `getSideChatTools(chat.mode)` to gate `propose_edit` / `propose_edge` / `propose_drill_down` on Edit mode, streams an assistant turn under the secondary chat using the existing SSE shape from `side-chat-route.ts`, and persists user/assistant turns under the secondary chat's `chat_id`. Reuse `side-chat-prompt.ts` for system instructions; per-mode kickoff template enrichment (deferred from C4) lands here as a side-effect of touching the prompt path.
- **Boundary crossings:** HTTP route → spec/chat lookup → `getSideChatTools(mode)` → AI SDK stream → `appendTurn(chat_id, role, parts)`. Same shape as `side-chat-route.ts`, scoped to secondary chats.
- **Risks/assumptions:**
  - RISK: `side-chat-route.ts` may have popover-specific assumptions baked in (e.g. anchor item lookup from request body) → MITIGATION: read it once before mirroring; lift only the streaming/tools shell, not the request envelope.
  - ASSUMPTION: secondary chats stream into `assistant_parts` of a freshly-created turn under the secondary chat (mirrors interview chat shape) → VALIDATE: round-trip oracle (POST a message, GET the bundle, see the new turn under `secondaryChats[i].turns`). May require extending the `SecondaryChatState` bundle to include turns beyond the kickoff — confirm during build.
- **Acceptance:**
  - ✓ POST with mode=`explore` streams an assistant turn; bundle round-trip surfaces the new turn under the secondary chat.
  - ✓ POST with mode=`edit` registers edit tools; SSE event for `propose_edit` is emitted.
  - ✓ POST against a primary chat returns 404 (refuses non-secondary chats — same invariant as PATCH mode route).
  - ✓ POST against a missing chat returns 404.
  - ✓ Existing `POST /side-chat` (popover) regression unaffected.
- **Verification:** Inner — Vitest integration tests in `app.test.ts` covering happy paths + 404 invariants + tool gating. Middle — round-trip oracle (POST → GET bundle → assert turn presence). No outer-loop verification at this slice.
- **Out of scope:** client composer (C5b); staging strip (C5c); per-chat patch list partition (C5c).

#### C5b — Client: composer + stream consumer for inline secondary chats

- **Status:** **next** (after C5a)
- **What:**
  1. Promote a `<SecondaryChatHost chatId>` component (per the C0–C4 review finding #1) that owns *all* per-chat mutation/streaming hooks and renders `<SecondaryChatCollapsible>` with the wired props. Replaces the current `SecondaryChatCollapsibleWithMode` wrapper. Wires:
     - `useSetSecondaryChatModeMutation(chatId)` (existing)
     - `useSecondaryChatStream(chatId)` (new — wraps the C5a SSE response into staged turns + activity)
  2. Add a small composer (text input + Send) inside the collapsible body, posting to C5a and reusing `side-chat-stream.ts` parser.
  3. Render the chat's existing turns under the collapsible body (kickoff first, then user/assistant pairs).
- **Boundary crossings:** `<SecondaryChatHost>` → `useSecondaryChatStream` → `fetch` POST → SSE parser → derived turn list → `<SecondaryChatCollapsible>` body.
- **Risks/assumptions:**
  - RISK: `SecondaryChatState` bundle currently exposes only `chat` + `kickoffTurn`; rendering subsequent turns needs either a per-chat `turns: Turn[]` field on the bundle or a separate `useSecondaryChatTurns(chatId)` query → MITIGATION: extend the bundle if cheap (preferred), else add a per-chat turn-list query.
  - ASSUMPTION: Existing `side-chat-stream.ts` parser is generic enough to consume the C5a response without forking → VALIDATE: read the parser once during build; fork only if the SSE event vocabulary diverges.
- **Acceptance:**
  - ✓ Typing in the composer + Send POSTs to C5a and renders the streaming assistant turn live in the collapsible body.
  - ✓ After stream completes, bundle invalidation reveals the persisted turn unchanged on next mount.
  - ✓ `<SecondaryChatHost>` replaces `SecondaryChatCollapsibleWithMode` in `-workspace-transcript-artifacts.tsx` with no regression in the C4 mode-toggle tests.
  - ✓ Multiple secondary chats can be composed against in parallel without state cross-talk (no shared in-flight ref).
- **Verification:** Inner — happy-dom Vitest covering composer → POST → stream consumption → derived turn list. Middle — bundle round-trip after stream ends. Reuse `secondary-chat-collapsible.test.tsx` patterns for harness.
- **Out of scope:** patch staging strip (C5c); patch list partition (C5c); typing-while-streaming queue.

#### C5c — Per-chat patch staging strip + partition seam

- **Status:** **next** (after C5b)
- **What:** Land the Shape A partition seam (above) and surface the staged-patches strip *inside* `<SecondaryChatHost>`'s collapsible body, scoped to the host's chat id.
  1. **Reducer change:** add `producerChatId: number | null` to `PatchBase` and `StagePatchInput`. Existing call sites (popover, manual tests) pass `null`.
  2. **Provider change:** new `usePatchListForChat(chatId)` hook that returns the filtered staged slice + scoped actions (apply/discard/editSummary auto-filter by chat id; apply uses `patchIds` derived from the slice).
  3. **Stream wire-up:** C5b's `useSecondaryChatStream(chatId)` translates `propose_*` SSE tool calls into `actions.stage({ ...patch, producerChatId: chatId })`.
  4. **UI:** harvest `SideChatPopover`'s staged-patches strip render shape (`stagedPatches`, `onApply`, `onUndo`, `<ContentDiff>` for `edit` patches, `<ImpactChip>`) into a `<SecondaryChatStagingStrip chatId>` component mounted inside `<SecondaryChatHost>`'s collapsible body.
- **Boundary crossings:** SSE stream → `usePatchListForChat(chatId).actions.stage` → reducer event log → `usePatchListForChat(chatId).staged` → strip UI → `actions.apply()` → existing `makeEditApplier` (unchanged).
- **Risks/assumptions:**
  - RISK: existing call sites (popover, side-chat-host derived state at lines 578–602) need `producerChatId: null` threaded through without semantic change → MITIGATION: type the field as required-but-nullable on `PatchBase`; let the type system surface every site.
  - RISK: undo currently reverses the last apply batch globally; per-chat undo could cross chats if a popover apply followed an inline apply → MITIGATION: for V1 ship per-`apply()`-batch undo (chat scope is implicit because each chat's apply only touches its own patch ids); document the invariant in the reducer header.
  - ASSUMPTION: `<ImpactChip>` and `<ContentDiff>` are reusable as-is outside the popover → VALIDATE: read both during build; lift to a shared location if needed (no new abstraction unless the second caller forces it).
- **Acceptance:**
  - ✓ Staging an `edit` proposal during streaming surfaces it in the host's strip; popover does NOT see it via `usePatchList()` (filter excludes per-chat patches by default — adjust if popover-during-transition wants the full union view).
  - ✓ Apply on the strip mutates the anchor item via `makeEditApplier`; undo reverses it; bundle round-trip reflects the change.
  - ✓ Popover staging path (V3.1) is unaffected: existing side-chat tests pass with `producerChatId: null`.
  - ✓ Two open inline secondary chats can stage edits in parallel; each strip shows only its own patches.
- **Verification:** Inner — reducer/state unit tests for `producerChatId` filtering; per-chat hook unit tests; popover regression in `side-chat-host.test.tsx`. Middle — round-trip: stage → apply → bundle reflects mutation. Outer — manual: open two inline secondary chats, stage edits in each, apply one, verify the other strip is untouched. (Capture in the C10 walkthrough.)
- **Out of scope:** rendering staged patches as turn artifacts (deferred — patches stay UI state, not turn-persisted, until a future card promotes them); cross-chat undo; deletion of `usePatchList()` (waits for C8).

##### Order discipline

C5a (server) → C5b (client composer + host) → C5c (partition + strip). Sequential because C5b consumes C5a's response shape; C5c's stream wire-up plugs into C5b's host. None of C5b's interface should change based on C5a build findings beyond response-shape details (those are absorbed in `useSecondaryChatStream`); C5c's interface is independent of either earlier slice.

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

- **Status:** **done** (2026-05-17) — `drizzle/0022_chat_pinned_reconciliation_need.sql` adds the nullable FK column on `chat`; `createSecondaryChat` + the `POST /api/specifications/:id/secondary-chats` payload accept an optional `reconciliationNeedId` (server rejects cross-spec needs with 404); `listSecondaryChatsForSpecification` joins the need + both knowledge items at read time and surfaces a `pinnedReconciliationNeed: { needId, kind, sourceItemId/RefCode/Excerpt, targetItemId/RefCode/Excerpt }` projection on each `SecondaryChat`; `SecondaryChatTriggerItem.reconciliationNeedId` is threaded through `useCreateSecondaryChatMutation`; `PendingReviewSection.handleOpenSideChat` passes `need.id` alongside `target_item_kind`/`target_item_id`; `SecondaryChatCollapsible` renders a small `data-testid="secondary-chat-reconciliation-panel"` band (kind label + per-endpoint ref code + truncated excerpt) when the field is populated. Other trigger paths (StructuredListView, etc.) are unchanged and continue to omit `reconciliationNeedId`.
- **What:** When a secondary chat is opened with a reconciliation context (entry bridge from a substantive reconciliation row), render a minimal "elements being reconciled" panel inside the secondary chat surface. **Not** the full target-grouped / classifier-state UX from the brief — that's Track 3 (`reconciliation-runtime`). `PendingReviewSection` retirement stays Track 3's job.
- **Verification:** `npm run verify` — 104 test files / 1252 tests pass; build clean. New tests:
  - [`app.test.ts`](file:///Users/kostandin/Projects/hashdev/brunch/src/server/app.test.ts) — POST persists `pinned_reconciliation_need_id`, bundle round-trip surfaces `pinnedReconciliationNeed` with `kind` + source/target ref-code & excerpt joins; cross-spec need id returns 404.
  - [`secondary-chat-collapsible.test.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/__tests__/secondary-chat-collapsible.test.tsx) — panel renders kind label + source/target ref codes & excerpts when populated; no panel when `pinnedReconciliationNeed` is null.
  - [`pending-review-section.test.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/__tests__/pending-review-section.test.tsx) — assertion updated to include `reconciliationNeedId: need.id` in the substantive `Open side-chat` trigger payload.

### C10 — Substrate verification + initial PR draft

- **Status:** **done** (2026-05-17). `npm run verify` green at 4dc1083d (104 test files / 1252 tests pass; build clean). The substrate hypothesis behind SPEC.md A94 (durable secondary chats over chat/turn with no `thread` table) is satisfied. PR description drafted (below).
- **Note (2026-05-18):** V1 closure has since been re-scoped to include the unified chat shell (C11–C16); the PLAN.md `V1 done` status set by this card was rolled back. **The verification snapshot and the SPEC.md A94 evidence stay valid** — only the "this closes V1" framing moves to C16, which also rewrites the PR description below.
- **What:** Full `npm run verify`; outer-loop walkthrough of the side-chat V3.1 capability matrix on the new substrate; confirm SPEC.md A94 is satisfied; update PLAN.md frontier status; draft PR description.

#### PR description (draft)

**Title:** `FE-716: Walking skeleton chat runtime — inline secondary chats over chat/turn`

**Body:**

> **What**
>
> Lands V1 of the Conversational Workspace Runtime Track 2 (`chat-runtime-secondary-chats`): every behavior the V3.1 side-chat ships today, surfaced through the elevated unified-workspace shape from `docs/design/UNIFIED_CHAT_UX.md`. Durable side-chats are now durable secondary chats over the existing `chat`/`turn` substrate; the legacy `SideChatPopover` is retired; lightweight reconciliation entry now renders inline; the `thread` table remains deferred per A94.
>
> **Substrate (no new tables)**
>
> - `chat.parent_chat_id`, `chat.invoked_in_turn_id`, `chat.pinned_item_id`, `chat.pinned_span_hint`, `chat.mode`, `chat.pinned_reconciliation_need_id` (drizzle/0020, 0021, 0022). No enum changes; secondary chats are projected from `parent_chat_id IS NOT NULL`.
>
> **Server**
>
> - `createSecondaryChat`, `createKickoffTurn`, `appendSecondaryChatTurn`, `setSecondaryChatMode`, `listSecondaryChatsForSpecification` in `specification-store.ts`.
> - `POST /api/specifications/:id/secondary-chats` (create), `PATCH …/mode` (mode toggle), `POST …/messages` (streaming SSE with `getSideChatTools(mode)` edit-tool gating + `#REF-CODE` mention resolution).
> - Bundle hydrates `secondaryChats[*]` with kickoff turn, post-kickoff turns, pinned-item kind, and joined reconciliation-need projection.
>
> **Client**
>
> - `SecondaryChatTriggerProvider` + `useSecondaryChatTrigger()` exposes one `create({ kind, id, spanHint?, reconciliationNeedId? })` callback + an `inlineChatRoute` descriptor so non-transcript callers can navigate to the transcript view.
> - `<SecondaryChatHost>` wires per-chat mutation/streaming hooks; `<SecondaryChatCollapsible>` renders the kickoff card, mode toggle, composer, streaming assistant, staged-patches strip slot, and the C9 "Elements being reconciled" panel.
> - Patch-list partitioning by `producerChatId` (Shape A) — `usePatchListForChat(chatId)` returns a per-chat staged slice while the legacy popover hook keeps the global view; `<SecondaryChatStagingStrip>` mounts inside the collapsible body.
> - Triggers: `PendingReviewSection` substantive row + `StructuredListView` item-action rail both call into `useSecondaryChatTrigger()`; `SideChatPopover` and `SideChatHost` are deleted.
>
> **Verification**
>
> - `npm run verify` — 104 test files / 1252 tests pass; build clean.
> - Coverage spans schema invariants, route happy-paths + 404 invariants, SSE chunk round-trip + bundle round-trip, partition-seam reducer + per-chat hook tests, popover-regression sweeps, and the C9 reconciliation-panel render.
>
> **Deferred (parking lot — follow-up frontiers)**
>
> `$` mention symbol, mention autocomplete, snapshot builder family, item-version-gated handle refresh, full target-grouped reconciliation UX, `PendingReviewSection` retirement, QA composer refinements, strategy sub-chat UI, layout-state header control, and C7 agent-run inline rendering (the substrate is ready; no producer exists yet).
>
> **Stacking**
>
> Stacked on `ln/fe-709-reconciliations` (PR #139). Restack on `main` once #139 lands.

### C11 — Strip inline-under-turn rendering + retire "Secondary chat" label

- **Status:** **done** (2026-05-18) — controller no longer projects `secondaryChatsByInvokedTurnId`; `WorkspaceTranscriptArtifacts` drops the projection prop, `getArtifactAnchorTurnId` helper, and `<SecondaryChatHost>` mounting (no chat surface beneath turn artifacts); `SecondaryChatCollapsible` header renders `<SecondaryChatKindChip>` (PencilLine + "Edit" / MessageCircleQuestion + "Ask", `data-testid="secondary-chat-kind-chip"`, `data-kind="edit" | "ask"`) instead of the literal "Secondary chat" label. Tests updated as planned.
- **What:** Tear out the inline-under-turn mounting so the unified shell (C12) can host secondary chats instead:
  - Remove the `secondaryChatsByInvokedTurnId` projection from [-continuous-workspace-controller.ts](file:///Users/kostandin/Projects/hashdev/brunch/src/client/routes/specification/$id/_view/-continuous-workspace-controller.ts) and stop threading it through [-continuous-workspace-view.tsx](file:///Users/kostandin/Projects/hashdev/brunch/src/client/routes/specification/$id/_view/-continuous-workspace-view.tsx).
  - Remove `<SecondaryChatHost>` rendering and the `getArtifactAnchorTurnId` helper from [-workspace-transcript-artifacts.tsx](file:///Users/kostandin/Projects/hashdev/brunch/src/client/routes/specification/$id/_view/-workspace-transcript-artifacts.tsx); the artifacts renderer drops the `secondaryChatsByInvokedTurnId` prop.
  - Replace the literal `"Secondary chat"` header label in `<SecondaryChatCollapsible>` with a kind chip per `UNIFIED_CHAT_UX.md` §8 (`PencilLine` for Edit, `MessageCircleQuestion` for Ask) — neutral chrome + subtle accent only on the kind chip per §7 dec 3.
- **Tests:** delete `inline rendering after the matching turn` / `no-orphan` / `multiple chats per turn` cases from `-workspace-transcript-artifacts.test.tsx`; drop the controller projection test for the map; update `secondary-chat-collapsible.test.tsx` to assert the kind chip in the header instead of the "Secondary chat" string.
- **Out of scope:** the unified shell itself (C12); layout modes (C13); trigger wire-up (C14); motion (C15).
- **Verification:** `npm run verify` green; no orphan calls into the removed projection; the workspace transcript no longer renders any chat surface beneath turn artifacts.

### C12 — `<UnifiedChatShell>` skeleton (Side-docked default)

- **Status:** **done** (2026-05-18) — `src/client/components/unified-chat-shell.tsx` lands as a peer of `<ContinuousWorkspaceView>` inside [_view/route.tsx](file:///Users/kostandin/Projects/hashdev/brunch/src/client/routes/specification/$id/_view/route.tsx); the shell reads `useSpecificationBundleData()`, renders a header (spec name spine label + four layout-mode buttons + close affordance) and a body listing every active `secondaryChats[*]` (already returned in `chat.id` ascending order from `listSecondaryChatsForSpecification`) as `<SecondaryChatHost>` collapsibles. The shell defaults to side-docked at ~50% width; the workspace center (existing Outlet + EntitySidebar) reflows into the left 50%. Spine resolution: the shell is a *lightweight spine indicator + secondary-chats slot*, not a re-mounted transcript — the workspace center remains the canonical transcript + composer surface. Tests in [`unified-chat-shell.test.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/__tests__/unified-chat-shell.test.tsx) cover header presence, default mode, empty-state, host order, close↔expand round-trip, and layout-mode callback forwarding.
- **What:** New `src/client/components/unified-chat-shell.tsx` mounted in the specification route as a peer to `<ContinuousWorkspaceView>`. The shell renders:
  - The **interview spine** (the primary chat's transcript) as its always-visible body — sourced from the same bundle the workspace center already reads.
  - **Active secondary chats** for the spec as inline collapsibles inside the shell body (ordered by `chat.created_at` ascending — confirm during build), using the existing `<SecondaryChatHost>` per chat. No "Secondary chat" label; kind chip from C11.
  - A **header strip** with a layout-mode toggle (buttons present but inert until C13) and a close affordance that switches the shell to a collapsed bar.
- **Mounting:** default layout state **Side-docked** (~50% width right rail per `UNIFIED_CHAT_UX.md` §4). Workspace center reflows to remaining width. The shell is a sibling of `<ContinuousWorkspaceView>` inside `route.tsx`'s layout, not a child of it.
- **Out of scope:** localStorage persistence (C13); width/mode transitions (C13); trigger auto-expand (C14); motion (C15).
- **Verification:** shell renders the interview spine + lists all active secondary chats; nothing renders under turn artifacts; existing transcript scrolls in the workspace center pane; build + test green.

### C13 — Layout modes + header control + localStorage

- **Status:** **done** (2026-05-18) — new `useChatLayoutMode(specificationId)` hook in [`use-chat-layout-mode.ts`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/use-chat-layout-mode.ts) persists the chosen mode under per-spec localStorage key `brunch:chat-layout-mode:{id}`, defaulting to `side-docked`; document-level Esc keydown decrements one tier via the exported `decrementChatLayoutMode` helper (Full → Maximize → Side-docked → Compact, no-op below). [_view/route.tsx](file:///Users/kostandin/Projects/hashdev/brunch/src/client/routes/specification/$id/_view/route.tsx) gains three layout components: `ResizableLayout` (50/50 for Side-docked, 30/70 for Maximize; `key={mode}` remounts the ResizablePanelGroup on mode change for clean defaultSizes), `CompactLayout` (floating dock 360–420 px bottom-right, workspace center fills), `FullLayout` (chat at 100%, center hidden). 9-test suite in [`use-chat-layout-mode.test.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/__tests__/use-chat-layout-mode.test.tsx) covers default, persistence, rehydration, junk rejection, Esc tier walk, defaultPrevented skip, and per-spec switching. **Open question kept open:** default stays Side-docked; revisit Compact-as-default only if walkthrough surfaces friction.
- **What:** Implement the four layout states from `UNIFIED_CHAT_UX.md` §4:
  - **Compact** — small floating dock, ~360–420 px.
  - **Side-docked** *(default)* — right rail, ~50% width.
  - **Maximize** — wide center, ~70% with rails.
  - **Full** — 100% workspace.
- New `useChatLayoutMode(specificationId)` hook backed by `localStorage` (key per workspace; default Side-docked). Header strip in the shell renders four mode buttons; current mode highlighted. **Esc** decrements one tier per §10.
- **Out of scope:** motion (C15); mode chip on the composer (deferred); suggestions row (deferred).
- **Verification:** four modes render at correct footprints; workspace center reflows correctly; toggle persists across reload; Esc steps the mode down.
- **Open question (resolve in build):** brief defaults to Side-docked, but Compact is closer to the retired V3.1 popover footprint. Keep Side-docked unless walkthrough surfaces friction — revisit in C16.

### C14 — Trigger wire-up: open shell + auto-expand new chat

- **Status:** **done** (2026-05-18) — new `ChatShellPresenceProvider` ([`chat-shell-presence.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/chat-shell-presence.tsx)) supplies `{ isCollapsed, expand, collapse, focusedChatId, focusChat, clearFocus, jumpToAnchor }`; mounted in [parent route.tsx](file:///Users/kostandin/Projects/hashdev/brunch/src/client/routes/specification/$id/route.tsx) above `<SecondaryChatTriggerProvider>` so the trigger can `focusChat(response.chatId)` after a successful create (expands shell + sets focused id). `SecondaryChatCollapsible` gained controlled `open`/`onOpenChange` props plus an `onJumpToAnchor` handler that renders a `Crosshair`-iconed "Jump" button (data-testid `secondary-chat-jump-to-anchor`) when the chat carries an `invoked_in_turn_id`. `SecondaryChatHost` watches `focusedChatId === chatId` and auto-opens its collapsible via the controlled open prop. `WorkspaceArtifactRow` accepts `anchorTurnId` and exposes `data-anchor-turn-id`; threaded through `answered-turn`, `prefaced-question`, `answered-review-turn`, `answered-revision-review`, `accepted-closure`, `persisted-turn`, `active-prefaced-question`. `jumpToAnchor` does `document.querySelector('[data-anchor-turn-id="X"]')?.scrollIntoView({ behavior: 'smooth' })` plus a 1.5 s ring highlight. Tests in [`chat-shell-presence.test.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/__tests__/chat-shell-presence.test.tsx) cover trigger → expand + focus, Jump button rendering and scroll dispatch, absence when `invoked_in_turn_id` is null, and auto-open on focus.
- **What:** Extend `useSecondaryChatTrigger().create()` (or add a sibling effect inside the shell) so that creating a secondary chat:
  1. Ensures the shell is visible (if user collapsed it to a bar, expand to its last layout mode).
  2. Auto-expands the newly-created chat's collapsible inside the shell.
  3. Adds a "Jump to anchor" link in the collapsible header that scrolls the workspace center pane to `invoked_in_turn_id` (highlight briefly).
- Trigger sites (`PendingReviewSection`, `StructuredListView`) are unchanged externally.
- **Verification:** clicking the trigger from either site opens the shell with the new chat expanded; reconciliation-pinned chats still render the C9 panel inside; jump-to-anchor scrolls correctly; reload keeps the persisted chat (no regression on substrate); per-chat collapse state stays component-local.

### C15 — Motion + spring transitions

- **Status:** **done** (2026-05-18) — `motion` v12.38.0 was already a dep; no new install required. New [`use-prefers-reduced-motion.ts`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/use-prefers-reduced-motion.ts) hook + exported `CHAT_SHELL_SPRING` constant (mass 0.6, stiffness 220, damping 30 per §7 dec 5). `SecondaryChatCollapsible` wraps the streaming-assistant text in a `motion.div` that pulses opacity at ~1.4s (per §8 live-state); pulse collapses to `opacity: 1` when reduced-motion is requested. `UnifiedChatShell` switches its root containers to `motion.div` with spring fade-ins and uses `<AnimatePresence>` with `layout` per secondary-chat-host wrapper for smooth add/remove transitions; all transitions short-circuit to `{ duration: 0 }` under reduced-motion. Tests in [`use-prefers-reduced-motion.test.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/__tests__/use-prefers-reduced-motion.test.tsx) cover canonical spring config, matchMedia true/false branches, and missing-matchMedia fallback.
- **What:** Wire `motion` (Framer Motion) per `UNIFIED_CHAT_UX.md` §7 dec 5 / §8:
  - Spring on collapsible expand/collapse: mass 0.6, stiffness 220, damping 30, ~250 ms.
  - Animate shell width across layout-mode changes.
  - Streaming live-state pulse on the kickoff card.
- Confirm `framer-motion` dep state before adding; honor `prefers-reduced-motion` to disable springs.
- **Verification:** transitions feel smooth across all four modes; no layout thrash during workspace reflow; reduced-motion preference disables springs.

### C16 — V1 closure (unified shell) + verification + PR description rewrite

- **Status:** **done** (2026-05-18) — supersedes C10 as the V1 closeout. `npm run verify` green: 108 test files / 1273 tests pass; build clean; only the 6 pre-existing `rendered is declared but never used` warnings in `InterviewView.test.tsx` (not introduced here). `memory/PLAN.md` frontier `chat-runtime-secondary-chats` status updated to **V1 done** in both the Sequencing list and the Frontier Definition. PR description draft rewritten below to reflect the full V1 surface (substrate + unified shell). PR submits once #139 merges or per Lu's signal.
- **Outer-loop walkthrough (deferred to operator):** the mechanical four-mode walkthrough across Compact ↔ Side-docked ↔ Maximize ↔ Full, with one open secondary chat from each trigger site (`PendingReviewSection` substantive row + `StructuredListView` item-action rail), localStorage round-trip across reload, reconciliation panel rendering inside the C9 band, and staging strip scoped per chat — performed by the human operator before clicking "Ready for review". The unit/integration coverage above asserts each mechanism in isolation; the outer-loop run confirms the integrated UX.

#### PR description (final draft, supersedes C10)

**Title:** `FE-716: Walking skeleton chat runtime — durable secondary chats + unified chat shell`

**Body:**

> **What**
>
> Lands V1 of Conversational Workspace Runtime Track 2 (`chat-runtime-secondary-chats`): every behavior the V3.1 side-chat shipped, now surfaced through the layoutable unified chat shell from `docs/design/UNIFIED_CHAT_UX.md`. Durable side-chats become durable secondary chats over the existing `chat`/`turn` substrate; the legacy `SideChatPopover` is retired; the inline-under-turn rendering from the earlier substrate slice is replaced by a peer chat surface with Compact / Side-docked / Maximize / Full layout modes. The `thread` table stays deferred per A94.
>
> **Substrate (no new tables)**
>
> - `chat.parent_chat_id`, `chat.invoked_in_turn_id`, `chat.pinned_item_id`, `chat.pinned_span_hint`, `chat.mode`, `chat.pinned_reconciliation_need_id` (drizzle/0020, 0021, 0022). No enum changes; secondary chats are projected from `parent_chat_id IS NOT NULL`.
>
> **Server**
>
> - `createSecondaryChat`, `createKickoffTurn`, `appendSecondaryChatTurn`, `setSecondaryChatMode`, `listSecondaryChatsForSpecification` in `specification-store.ts`.
> - `POST /api/specifications/:id/secondary-chats` (create), `PATCH …/mode` (mode toggle), `POST …/messages` (streaming SSE with `getSideChatTools(mode)` edit-tool gating + `#REF-CODE` mention resolution).
> - Bundle hydrates `secondaryChats[*]` with kickoff turn, post-kickoff turns, pinned-item kind, and joined reconciliation-need projection.
>
> **Client — substrate (C0–C9)**
>
> - `SecondaryChatTriggerProvider` + `useSecondaryChatTrigger()` exposes one `create({ kind, id, spanHint?, reconciliationNeedId? })` callback + an `inlineChatRoute` descriptor.
> - `<SecondaryChatHost>` wires per-chat mutation/streaming hooks; `<SecondaryChatCollapsible>` renders the kickoff card, mode toggle, composer, streaming assistant, staged-patches strip slot, and the C9 reconciliation panel.
> - Patch-list partitioning by `producerChatId` (Shape A) — `usePatchListForChat(chatId)` returns a per-chat staged slice; `<SecondaryChatStagingStrip>` mounts inside the collapsible body.
> - Triggers: `PendingReviewSection` substantive row + `StructuredListView` item-action rail both call `useSecondaryChatTrigger()`; `SideChatPopover` and `SideChatHost` are deleted.
>
> **Client — unified shell (C11–C15)**
>
> - C11 — Inline-under-turn rendering retired. `WorkspaceTranscriptArtifacts` no longer mounts secondary chats; the controller no longer projects `secondaryChatsByInvokedTurnId`. `SecondaryChatCollapsible` renders a kind chip (`PencilLine` = Edit, `MessageCircleQuestion` = Ask) instead of the literal "Secondary chat" label.
> - C12 — `<UnifiedChatShell>` mounts in `_view/route.tsx` as a peer of `<ContinuousWorkspaceView>`. Header (spec-name spine indicator + four layout-mode buttons + close affordance) + body (active secondary chats as `<SecondaryChatHost>` collapsibles, id-ascending order). The workspace center remains the canonical transcript+composer surface; the shell is the spine indicator + secondary-chats slot.
> - C13 — `useChatLayoutMode(specificationId)` persists Compact / Side-docked / Maximize / Full under per-spec localStorage; default Side-docked. Esc decrements one tier (Full → Maximize → Side-docked → Compact, no-op below) per §10. Each mode has its own layout component: ResizableLayout (50/50 or 30/70), CompactLayout (floating dock 360–420 px), FullLayout (100%).
> - C14 — `<ChatShellPresenceProvider>` provides `expand`/`focusChat`/`jumpToAnchor`. The trigger calls `focusChat(response.chatId)` on successful create so the shell expands and the new chat auto-opens. `<SecondaryChatCollapsible>` renders a Jump-to-anchor button when `invoked_in_turn_id` is set; `WorkspaceArtifactRow` exposes `data-anchor-turn-id` on rendered turn rows so jumps scroll into view with a brief highlight ring.
> - C15 — `motion` springs (mass 0.6 / stiffness 220 / damping 30 per §7 dec 5); streaming live-state pulse on the secondary-chat streaming text per §8; AnimatePresence on the chat list for smooth add/remove. `usePrefersReducedMotion` short-circuits every animation to a duration-0 step per §10.
>
> **Verification**
>
> - `npm run verify` — 108 test files / 1273 tests pass; build clean.
> - Coverage spans schema invariants, route happy-paths + 404 invariants, SSE chunk round-trip + bundle round-trip, partition-seam reducer + per-chat hook tests, popover-regression sweeps, the C9 reconciliation panel render, the unified shell skeleton + layout-mode persistence + Esc decrement + presence-focused auto-expand + jump-to-anchor scroll dispatch, and the prefers-reduced-motion hook.
>
> **Deferred (parking lot — follow-up frontiers)**
>
> `$` mention symbol, mention autocomplete, snapshot builder family, item-version-gated handle refresh, full target-grouped reconciliation UX, `PendingReviewSection` retirement, QA composer refinements, strategy sub-chat UI, mode chip + Shift+Tab toggle on the composer, suggestions row per mode, per-kind kickoff copy variations, item-anchored badge in structured-list / graph view, Ladle prototype, C7 agent-run inline rendering (the substrate is ready; no producer exists yet).
>
> **Stacking**
>
> Stacked on `ln/fe-709-reconciliations` (PR #139). Restack on `main` once #139 lands.

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
- Mode chip on composer + Shift+Tab toggle (`UNIFIED_CHAT_UX.md` §2) → follow-up frontier (Ask/Edit toggle in the collapsible header is the V1 affordance)
- Suggestions row per mode (§2) and per-kind kickoff copy variations (§6) → follow-up frontier
- Mention autocomplete chip UI for `#` (§3) → follow-up frontier (server-side resolution shipped in C6; only the UI affordance is deferred)
- Item-anchored badge in structured-list / graph view (§7 dec 6) → follow-up frontier
- Ladle prototype (§13) → follow-up frontier

## Open coordination items

- **Lexicon reconciliation:** "secondary chat" stays as the *internal* substrate/code vocabulary (column names, types, helpers, hooks) per PR #139. After C11 it is no longer a user-facing label — the UI uses the kind chip (Edit / Ask) and the unified shell branding only.
- **PR #139 dependency:** stack submits only after #139 merges (or per Lu's signal). Restack on `main` once #139 lands.
