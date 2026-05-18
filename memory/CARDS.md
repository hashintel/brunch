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

### C17 — Hide Full + Minimize/Maximize toggle + close vs minimize semantics

- **Status:** **done** (2026-05-18) — four iterations on the same day per walkthrough feedback. Final shape:
  - **Header layout-button row (left → right):** Minimize · Side-docked · Compact↔Maximize-toggle. The toggle is a single button whose icon + click target flip with state (Maximize2 when not maxed → click to Maximize; Minimize2 when maxed → click to Compact). Pressed state lights when current mode is compact or maximize.
  - **Full mode hidden** entirely. Substrate type union + `CHAT_LAYOUT_MODE_ORDER` intact; `useChatLayoutMode` clamps any persisted `'full'` to `'maximize'` so older reloads stay safe.
  - **Close (X) vs Minimize semantics** lifted into `ChatShellPresenceProvider` as `appearance: 'expanded' | 'minimized' | 'closed'`:
    - `X` close (top-right of header) → `presence.close()` → shell renders `null`. The route layout drops the shell's panel slot so the workspace center fills the freed space (no empty pane).
    - `Minimize` (first in layout-button row, `Minus` icon) → `presence.minimize()` → fixed bottom-right "Ask Brunch" pill with `Send` icon. Pill click restores via `presence.expand()`. Context persists (the chat substrate is untouched).
    - Trigger-driven `focusChat()` always restores `appearance='expanded'` so creating a chat re-opens a closed shell.
  - **Route layout:** `_view/route.tsx` consults `presence.isCollapsed` first. When collapsed, the workspace center renders at full width and the shell mounts at root (renders pill or null). When expanded, the layout dispatches per `layoutMode` (compact dock / resizable / full) as before.
  - **Comments cleanup:** stripped the FE-716-C17 narrative comments and the C12/C13/C14/C15 docstring sections per "remove unnecessary comments" direction.
- **What:** User direction (2026-05-18): three layout modes (Compact / Side-docked / Maximize) exposed as a Minimize + Side-docked + Compact↔Maximize-toggle row; X closes the shell entirely (workspace reclaims the space, no empty pane); Minimize sends the shell to a bottom-right pill while preserving chat state.
  - [`unified-chat-shell.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/unified-chat-shell.tsx) — extend `LAYOUT_MODE_BUTTONS` entries with an optional `disabled: true` flag; mark `'full'` disabled; OR the render's `disabled` prop with the per-button flag; add a `title="Coming soon"` (or similar) hint.
  - [`use-chat-layout-mode.ts`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/use-chat-layout-mode.ts) — clamp persisted `'full'` to `'maximize'` on read (and rewrite storage); refuse to write `'full'` (silently clamp). The type stays `'compact' | 'side-docked' | 'maximize' | 'full'` so the substrate can re-enable later without a migration.
- **Tests:** update [`unified-chat-shell.test.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/__tests__/unified-chat-shell.test.tsx) — Full button is rendered but always `disabled`; clicking it does not fire `onLayoutModeChange`. Update [`use-chat-layout-mode.test.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/__tests__/use-chat-layout-mode.test.tsx) — persisted `'full'` reads back as `'maximize'`; `setLayoutMode('full')` clamps to `'maximize'`; Esc decrement chain stays valid mechanically but starts from `'maximize'`.
- **Out of scope:** removing `'full'` from the union type or `CHAT_LAYOUT_MODE_ORDER`; rewriting motion transitions; re-styling Maximize.
- **Verification:** `npm run verify` green.

### C18 — Single scratch chat per spec + click-to-anchor injection

- **Status:** **done** (2026-05-18) — substrate pivot landed. `npm run verify` green: 108 test files / 1278 tests pass; build clean.
  - **Migration `0023_chat_anchored_items.sql`:** adds `chat.anchored_item_ids text NOT NULL DEFAULT '[]'` (JSON array). Schema column added; journal updated.
  - **Server helpers:** `findScratchSecondaryChat(db, specId, parentChatId)` returns the unique per-spec scratch (one with `parent_chat_id = primary AND pinned_reconciliation_need_id IS NULL`). `appendAnchorToScratchChat(db, specId, input)` is the public entry: find-or-create the scratch (carries `invoked_in_turn_id` from the first call), parse anchored ids, no-op if itemId already present, else push id + append a mode-aware kickoff turn ("Editing '<excerpt>'." for edit-mode, "Anchored to '<excerpt>'." otherwise). Returns `{ chat, kickoffTurnId, anchoredItemIds }`.
  - **Route repointed:** `POST /api/specifications/:id/secondary-chats` now branches — when `reconciliationNeedId` is set, falls through to the existing dedicated-chat path (preserves FE-716 C9 reconciliation chat behavior); otherwise calls `appendAnchorToScratchChat`. Response shape: `{ chatId, kickoffTurnId | null, anchoredItemIds }`.
  - **Bundle projection:** `SecondaryChatWithKickoff.anchoredItemIds: number[]` derived from the new column; threaded through `core.ts` and the Zod `secondaryChatStateSchema`. The first kickoff turn is what `listSecondaryChatsForSpecification` already returns via `limit(1)`, so subsequent anchor kickoffs are recorded in the substrate but invisible to the UI (Option b from the open question).
  - **Shell filter:** [unified-chat-shell.tsx](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/unified-chat-shell.tsx) picks the single scratch chat (`pinned_reconciliation_need_id === null`) from `secondaryChats` and renders one `<SecondaryChatHost>` only. Reconciliation-pinned chats stay in the bundle data but the shell hides them until Track 3 defines their UX. `AnimatePresence` dropped since only one chat renders.
  - **Tests:** all existing fixtures gained `anchoredItemIds: []` (bulk perl insert across four test files + manual for the populated reconciliation case). The shell test that asserted "renders one host per chat" now asserts "renders only the scratch chat" with multiple secondary chats in the bundle. Server tests (`app.test.ts`, `secondary-chat-route.test.ts`) continue to pass — the `invoked_in_turn_id` invariant and mode-aware "Editing" kickoff verb both preserved by threading those through to `appendAnchorToScratchChat`.
- **What:** Behavioral pivot away from "one secondary chat per item-click" to "one persistent scratch chat per spec, items injected as anchors over time."
  - **Migration `drizzle/0023_chat_anchored_items.sql`** — add `chat.anchored_item_ids text NOT NULL DEFAULT '[]'` (JSON array of knowledge-item ids). Index not required at this volume.
  - **Server:**
    - `getOrCreateScratchSecondaryChat(db, specId, primaryChatId)` — find-or-create the unique secondary chat for the spec (uniqueness enforced at create time; identified as the one with `parent_chat_id = primary`). First-call also seeds the chat with `pinned_item_id` from the inbound itemId so the existing C9 reconciliation-pin and prompt context paths keep working unchanged.
    - `appendAnchorToScratchChat(db, specId, primaryChatId, { itemId, itemKind, spanHint? })` — parses `anchored_item_ids`, pushes the id if absent, persists; appends a kickoff-style turn (`Anchored to '<excerpt>'.`) but the UI filters post-first kickoffs (see Open question below).
    - Repoint `POST /api/specifications/:id/secondary-chats` from "create new chat per click" to call `appendAnchorToScratchChat`. Response shape extends to `{ chatId, kickoffTurnId, anchoredItemIds }`.
    - Bundle: `secondaryChatStateSchema.chat.anchoredItemIds: number[]` projected from the new column.
  - **Client:**
    - `useSecondaryChatTrigger().create()` keeps its public signature; just hits the rebound route. Call sites (`StructuredListView`, `PendingReviewSection`) need no change.
    - [`unified-chat-shell.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/unified-chat-shell.tsx) line 69 — filter `secondaryChats` to the scratch chat (the one whose `parent_chat_id = primary_chat_id`; substrate uniqueness guarantees ≤1). The `AnimatePresence` list renders one host max.
    - Composer stays. Ask/Edit toggle stays. No mention chip; no expansion popout.
- **Tests:** 
  - Server: `chat-substrate.test.ts` — `getOrCreateScratchSecondaryChat` is idempotent; `appendAnchorToScratchChat` appends idempotently (no duplicate ids); `anchored_item_ids` survives reload.
  - Server: `app.test.ts` — first POST creates the scratch chat + seeds anchor; second POST against a different item appends to the existing scratch chat (no new row in `chat`); response carries `anchoredItemIds`.
  - Client: `unified-chat-shell.test.tsx` — given two secondary chats in the bundle (legacy + scratch), only the scratch chat renders.
  - Client: existing `secondary-chat-trigger.test.tsx` — POST payload + bundle invalidation still pass (the public signature is unchanged); add an assertion that two `create` calls against different items produce one chat row.
- **Out of scope:** workspace selection styling (C19); deleting legacy per-item chats from existing local DBs (pre-release posture per `CLAUDE.md` — operator nukes `.brunch/brunch.db`); `chat_anchor` join table (not needed for V1).
- **Verification:** `npm run verify` green; manual probe: open spec, click dash on item A → scratch chat appears; click dash on item B → same scratch chat, both items in `anchoredItemIds`; reload → state persists.
- **Open question (resolve in build):** does the per-anchor kickoff-style turn render in the transcript or stay hidden?
  - **(a)** Visible — self-documenting context history; slightly noisier.
  - **(b)** Hidden — filter out post-first kickoffs at render time; cleaner UI.
  - **Default per user direction:** (b). Substrate still records the turns; UI just doesn't show post-first kickoffs. Easy to flip later by removing the filter.

### C19 — Workspace selection styling for anchored items

- **Status:** **next** (after C18)
- **What:** Items in `StructuredListView` whose ids appear in `scratchChat.anchoredItemIds` render with a selected/anchored visual state using `kindAccentHex` from [`knowledge-card.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/knowledge-card.tsx) — subtle background tint + accent border matching the item's kind. Clicking the dash icon on an already-anchored item is idempotent.
- **Optional polish:** a small "Anchored: A12, GOAL3" mini-band in the chat shell's header strip listing current anchor ref-codes. Defer until walkthrough surfaces a need.
- **Tests:** `structured-list-view.test.tsx` — items not in `anchoredItemIds` render without selection class; items in it render with the kind-accented selected class; the dash button label flips between `aria-label="Anchor to chat"` and `aria-label="Anchored"` (or similar).
- **Out of scope:** anchor-removal UX (defer until walkthrough demands it); selection in graph view (defer to a follow-up frontier per the parking lot's item-anchored badge entry).
- **Verification:** `npm run verify` green; outer-loop walkthrough confirming the selection styling matches the chat's anchor state across click + reload + mode toggle.

## V1 re-narrowing (proposed, 2026-05-18)

V1 was originally "every behavior the V3.1 side-chat ships today, surfaced through the elevated unified-workspace shape." C20–C25 propose absorbing **ai-elements adoption for the secondary-chat surface** into the same frontier and PR, on the basis that the design brief (`docs/design/UNIFIED_CHAT_UX.md` §Constraints) names ai-elements composition as non-negotiable for the terminal state. The Ladle prototype phases A–D in §13 are explicitly skipped; visual decisions are tested against real workspace state instead. If accepted, V1 = "V3.1 parity through unified shell **+ ai-elements parity with the interview spine**." PLAN.md frontier description for `chat-runtime-secondary-chats` updates to match. Cards land sequentially after C18 / C19 so they target the post-scratch-chat-pivot shape.

### C20 — Adopt `<Conversation>` + `<Message>` for turn rendering

- **Status:** **done** (2026-05-18) — `npm run verify` green: 1280 tests pass; build clean.
  - **Client:** `secondary-chat-collapsible.tsx` now wraps persisted turns + the streaming-assistant pulse in `<Conversation>` → `<ConversationContent>`. `SecondaryChatTurnRow` renders `<Message from="user|assistant">` + `<MessageContent>`. Assistant text routes through `<MessageResponse>` (→ `MarkdownRenderer`); user text stays plain `whitespace-pre-wrap`.
  - **Tests:** `secondary-chat-collapsible.test.tsx`, `secondary-chat-host.test.tsx`, and `chat-shell-presence.test.tsx` add `vi.mock` shims for `@/client/components/ai-elements/conversation.js` + `message.js` (matching the `InterviewView.test.tsx` pattern). New test in collapsible suite asserts that an assistant turn with `**bold**` renders `<strong>bold</strong>` (markdown shim in the mock makes it deterministic in happy-dom).
  - **Note:** Cards described `<Conversation>` / `<Message>` / `<PromptInput>` as "already used by `question-cards.tsx` / the interview spine." Reality: those primitives were vendored but unused; only `Reasoning` + `Task` had real consumers. C20 introduces the first real consumer of `<Conversation>` + `<Message>` + `<MessageResponse>` in production code.
- **What:** Replace the bespoke `SecondaryChatTurnRow` (in [`secondary-chat-collapsible.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/secondary-chat-collapsible.tsx) lines 228–244) with the vendored ai-elements `<Conversation>` shell and `<Message role="user|assistant">` rows already used by `question-cards.tsx` / the interview spine. Wire `streamdown` markdown rendering for assistant `assistant_parts`; user `user_parts` stay plain-text. Keep the existing kickoff-content rendering as-is for one card so the diff stays scoped.
- **Why first:** Smallest delta from the current shape; proves the pattern is portable from interview to secondary chat without a streaming or composer refit.
- **Boundary crossings:** `<SecondaryChatCollapsible>` body → `<Conversation>` → `<Message>` × turns. No new server work; no bundle shape change; no test-mock surface change beyond importing the ai-elements mocks already used in `InterviewView.test.tsx`.
- **Risks / assumptions:**
  - ASSUMPTION: `secondary-chat-collapsible.test.tsx` can mock `@/client/components/ai-elements/*` the way `InterviewView.test.tsx` does → VALIDATE: copy the mock pattern; expect a 5–10 line bump in setup.
  - RISK: `streamdown` may render trailing whitespace differently than the current `whitespace-pre-wrap` div → MITIGATION: validate the existing `secondary-chat-collapsible.test.tsx` expectations and adjust string assertions to `toContain` rather than `toEqual` if needed.
- **Tests:** existing collapsible tests adapt to new harness; add one test asserting that an assistant turn with markdown (`**bold**`) renders strong instead of literal asterisks.
- **Out of scope:** composer refit (C21); streaming live-state (C22); suggestions (C23); `useChat` (C24); mentions (C25).
- **Verification:** `npm run verify` green; manual walkthrough confirms transcripts render identically to today on a real spec for plain-text turns, with markdown rendered for assistant turns.

### C21 — Replace composer with `<PromptInput>` + leading-edge mode chip

- **Status:** **done** (2026-05-18) — `npm run verify` green: 1282 tests pass; build clean.
  - **Client:** `SecondaryChatComposer` in `secondary-chat-collapsible.tsx` rebuilt on `<PromptInput>` + `<PromptInputBody>` + `<PromptInputTextarea>` + `<PromptInputFooter>` + `<PromptInputTools>` + `<PromptInputSubmit>`. The mode toggle moved from the collapsible header into the composer footer (leading-edge tools slot); `Shift+Tab` inside the textarea flips Ask↔Edit via the textarea's `onKeyDown` (preventDefault). The header retains a read-only `SecondaryChatKindChip` so collapsed state still surfaces kind. Testids preserved (`secondary-chat-composer`, `secondary-chat-composer-input`, `secondary-chat-composer-send`).
  - **Tests:** `secondary-chat-collapsible.test.tsx` mode-toggle tests now expand the collapsible and pass `onSubmitMessage` so the composer (and its toggle) mounts; new tests assert (a) toggle is absent without a composer, (b) `Shift+Tab` calls `onSetMode('edit')` from `'explore'`. Submit test switched to `fireEvent.submit` on the form + microtask flush because `PromptInput.onSubmit` `await`s `Promise.all([])` before invoking the user callback.
  - **Note:** This is the first real production consumer of `<PromptInput>` (the vendored primitives were previously unused outside `InterviewView.test.tsx` mocks).
- **What:** Retire the hand-rolled `SecondaryChatComposer` (`<form>` + `<input>` + `<button>`, lines 246–280) in favor of ai-elements `<PromptInput>` matching the interview composer. Move the mode chip from the collapsible header into the composer's leading edge per `UNIFIED_CHAT_UX.md` §2; wire Shift+Tab to toggle Ask ↔ Edit. The collapsible header's `SecondaryChatKindChip` becomes a passive read-only badge (visible when collapsed) or retires; default posture for build: keep it as a read-only badge so collapsed-state still shows kind without expanding.
- **Boundary crossings:** `<SecondaryChatCollapsible>` body → `<PromptInput>` with `onSubmit` → existing `onSubmitMessage` callback (unchanged signature) → `<SecondaryChatHost>` → existing `streamSecondaryChatMessage`. Mode-chip click and Shift+Tab call `setSecondaryChatMode` (existing C4 PATCH route).
- **Risks / assumptions:**
  - RISK: Shift+Tab is a browser-managed key combo for reverse tab order; intercepting it inside the composer is safe but the brief explicitly notes "preserves browser tab behavior outside the composer" (§10) — confirm focus boundary during build.
  - RISK: mode-chip in composer + persisted-kind badge in header is mildly redundant — could collapse to one. Default: keep both during build; settle in C26-style polish if walkthrough flags it.
  - ASSUMPTION: `<PromptInput>` exposes a slot for the mode chip and a submit shortcut hook → VALIDATE: read `ai-elements/prompt-input.tsx` once; fork or wrap only if the slot is missing.
- **Tests:** update `secondary-chat-collapsible.test.tsx` composer tests to drive `<PromptInput>` instead of `<input>`; new tests for Shift+Tab toggle and mode-chip click; assert ⌘/Ctrl+Enter submits.
- **Out of scope:** streaming live-state (C22); suggestions (C23); mentions (C25); composer mode chip styling beyond the §2 chip vocab.
- **Verification:** `npm run verify` green; manual walkthrough confirms typing, ⌘/Ctrl+Enter submit, Shift+Tab toggle, and mode persistence across reload.

### C22 — Adopt `<Reasoning>` live-state pattern for streaming assistant

- **Status:** **done** (2026-05-18) — `npm run verify` green: 1284 tests pass; build clean.
  - **Client:** the streaming-assistant pulse in `secondary-chat-collapsible.tsx` swapped its bespoke `motion.div` for ai-elements `<Reasoning isStreaming defaultOpen>` + `<ReasoningTrigger>` + `<ReasoningContent>`. New `<SecondaryChatStreamingAssistant>` helper short-circuits to a static `<div>` when `usePrefersReducedMotion()` reports true (no Reasoning/Shimmer animation). `motion` import dropped from this file. Testid `secondary-chat-streaming-assistant` preserved on the outer wrapper.
  - **Tests:** `vi.mock` shims for `@/client/components/ai-elements/reasoning.js` added to `secondary-chat-collapsible.test.tsx`, `secondary-chat-host.test.tsx`, `chat-shell-presence.test.tsx` (matching the InterviewView pattern; the collapsible mock forwards `isStreaming` via `data-is-streaming` so the test can distinguish the Reasoning path from the reduced-motion path). New tests: (a) streaming pulse renders the `data-is-streaming="true"` Reasoning wrapper, (b) prefers-reduced-motion regression renders the static text block (no `data-is-streaming` attribute).
- **What:** Replace the `motion.div` streaming pulse (lines 135–144) with the ai-elements `<Reasoning>` live-state pattern (`ReasoningTrigger` + `ReasoningContent`) so the streaming-assistant indicator reads as a coherent thinking/typing surface mirroring `question-cards.tsx`'s usage. Animate the kickoff card's "generating…" indicator per `UNIFIED_CHAT_UX.md` §8.
- **Boundary crossings:** `<SecondaryChatHost>`'s streaming state → `streamingAssistantText` prop → `<Reasoning isStreaming>` inside the collapsible body.
- **Risks / assumptions:**
  - ASSUMPTION: `<Reasoning>` supports an `isStreaming` mode that auto-pulses without a custom motion config → VALIDATE: read `ai-elements/reasoning.tsx` once.
  - RISK: streaming-assistant text currently renders inline as plain text; `<Reasoning>` may wrap it in a collapsible region by default → MITIGATION: configure as always-open during stream; fall through to a `<Message>` row when stream completes.
- **Tests:** update `secondary-chat-collapsible.test.tsx` streaming-assistant assertions; add prefers-reduced-motion regression covering `<Reasoning>` short-circuiting (re-uses `usePrefersReducedMotion` from C15).
- **Out of scope:** sources / tool render (skip until QA-mode needs it); typed `thread.agent_progress` data parts (defer to Track 5 or follow-up).
- **Verification:** `npm run verify` green; manual walkthrough confirms the live-state indicator visually matches the interview spine's "generating…" pulse.

### C23 — Turn-zero `<Suggestions>` row (static per mode)

- **Status:** **done** (2026-05-18) — `npm run verify` green: 1288 tests pass; build clean.
  - **Client:** new [`secondary-chat-suggestions.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/secondary-chat-suggestions.tsx) exports `<SecondaryChatSuggestions>` + `getSecondaryChatSuggestions(mode, reconciliationKind)`. Six static prompt arrays (3 per slot) keyed by `(mode, reconciliation-kind | null)`: Ask + Edit each have a generic set, a `supersedes` set, and a `needs_confirmation` set. `secondary-chat-collapsible.tsx` lifts the composer draft into `useState`, mounts the row above the composer iff `secondaryChat.turns.length === 0` AND `onSubmitMessage` is provided, and a suggestion click writes the prompt into the draft. Composer textarea is now controlled (`value` + `onChange`) so the lifted draft updates the input; submit clears the draft. Suggestions vendor a simple `<button>` row (no ai-elements `Suggestions` primitive is vendored in this codebase — confirmed via `ls src/client/components/ai-elements/`).
  - **Tests:** 4 new tests in `secondary-chat-collapsible.test.tsx`: (a) 3 explore-mode suggestions at turn-zero + hidden after a user turn, (b) edit mode keys the suggestion set + `data-reconciliation-kind="none"`, (c) reconciliation-kind threads into the row's data attribute, (d) clicking a suggestion populates the composer textarea value. Existing submit test switched to `waitFor()` for the textarea-cleared assertion (the lifted controlled value requires a React commit after `setDraft('')`).
- **What:** On turn-zero (i.e. when the secondary chat has only the kickoff turn and no user-authored turns yet), render an ai-elements `<Suggestions>` row above the composer with **three** static prompts keyed by `(chat.mode, optional reconciliation-kind)` per `UNIFIED_CHAT_UX.md` §2. Clicking a suggestion populates the composer; submitting clears the row. LLM-generated suggestions stay deferred.
- **Why fourth:** Cheapest concrete value-add now that the composer hosts the chip + ai-elements (§2 explicitly says suggestions replace the empty composer for turn-zero).
- **Boundary crossings:** `<SecondaryChatCollapsible>` body → `<Suggestions>` (visible iff `turns.length === 0` and no `user_parts` exist anywhere) → click handler sets composer draft state.
- **Risks / assumptions:**
  - DECISION: keep the static prompt lists in a new `src/client/components/secondary-chat-suggestions.tsx` keyed by mode + reconciliation-kind. Per-mode arrays of 3 strings; ~6–9 prompts total. Easy to swap for LLM-generated later.
  - RISK: the V1 framing already deferred suggestions to a follow-up frontier — re-narrowing it into FE-716 is the V1-re-narrowing decision above; confirm before building.
- **Tests:** new test asserting turn-zero renders 3 suggestions for `mode='explore'`, different set for `mode='edit'`, hidden once a user turn exists; click populates composer.
- **Out of scope:** LLM-generated suggestions; per-kind kickoff copy variations (different concern — §6 — stays parked).
- **Verification:** `npm run verify` green; manual walkthrough confirms suggestions show on a fresh chat, disappear after first user message, and change with the mode toggle.

### C24 — `useChat<BrunchUIMessage>` refit for secondary-chat streaming

C24 has been split into four scope cards (C24a / C24b / C24c / C24d) via an `ln-scope` pass (2026-05-18). Original "What" + investigation notes preserved below for reference; sub-cards live underneath.

- **Status:** **superseded by C24a–C24d** (2026-05-18). Investigation during the C21–C25 serial pass confirmed the card's "largest single card; consider an `ln-scope` pass before build" framing. Concretely:
  - **Server side** is the heavy lift, not the client. `src/server/secondary-chat-route.ts` (~460 LOC) emits a bespoke SSE envelope (`text-delta` / `patch-proposal` / `[DONE]` chunks consumed by `parseSideChatSSEBuffer` in `src/client/lib/side-chat-stream.ts`). The interview spine's `/api/specifications/:id/chat` route uses the AI-SDK protocol instead: `validateUIMessages<BrunchUIMessage>` for the request body, `createUIMessageStream<BrunchUIMessage>` + `writer.merge(streamText(...).toUIMessageStream(...))` for the response. Migrating the secondary-chat route means re-implementing the request shape, the streaming response shape, and the way `propose_edit` / `propose_edge` / `propose_drill_down` tool calls surface (today as bespoke `patch-proposal` chunks; under `useChat` they'd become `tool-*` UIMessage parts that `useSecondaryChatStream` would need to translate to chat-scoped staged patches via the existing partition seam).
  - **Client side** then changes too: `useSecondaryChatStream` in `secondary-chat-host.tsx` (the per-chat in-flight + delta accumulator + patch-stage router) is replaced by `useChat<BrunchUIMessage>` mounted per chat with a `DefaultChatTransport` pointed at the new route. The partition-seam invariant (C5b/C5c) must survive — two parallel chats still can't cross-talk patch IDs.
  - **Test surface** ripples: `secondary-chat-host.test.tsx`'s `mockStream` mock disappears in favor of the `useChat` mock pattern from `InterviewView.test.tsx` (lines ~339–397); `secondary-chat-route.test.ts` + `app.test.ts` route tests need to assert UIMessage-stream output instead of the bespoke envelope; per-event tool-call coverage shifts.
- **Why stopping serial execution here:** This is the explicit "server-side SSE shape needing non-trivial revision before the client refit" stop condition from the ln-build session brief. Estimated as a multi-slice frontier-scale change (likely C24a server route refit + C24b client useChat + C24c test/route-shape coverage) — at minimum an `ln-scope` pass to define the right cuts; possibly an `ln-spike` first to validate the tool-call → staged-patch translation works under the UIMessage protocol.
- **C25 dependency:** C25 (`#` mention chip UI) operates entirely on the composer surface and does NOT depend on the C24 refit; it can proceed independently against the current `<PromptInput>` from C21.
- **What:** Replace `streamSecondaryChatMessage` (the bespoke SSE pump in [`secondary-chat-host.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/secondary-chat-host.tsx) line 63) with `useChat<BrunchUIMessage>` mounted per secondary chat, matching how `-interview-controller.ts` already mounts it for the spine. The server route stays — only the client transport changes — but the SSE event shape may need to align with what `useChat` expects, which could mean either (a) the route already emits a compatible shape or (b) a thin server-side adapter normalizes the events. Determine during build.
- **Why fifth:** Establishes the typed-data-parts substrate (`BrunchUIMessage`) for secondary chats, which downstream work (typed `thread.kickoff` / `thread.suggestions` / `thread.reconciliation_summary` / `thread.agent_progress` data parts per §11) can compose against. Without it, secondary chats remain typed-data-parts-blind.
- **Boundary crossings:** `<SecondaryChatHost>` mounts `useChat({ api: ..., id: chatId, initialMessages: ... })` per chat → `useChat` owns streaming-text + finalize → on completion, invalidate the bundle so the persisted turns reload.
- **Risks / assumptions:**
  - RISK: SSE event shapes diverge between `side-chat-route.ts` and `useChat`'s expected protocol → MITIGATION: read the interview spine's route once; mirror that shape in `secondary-chat-route.ts` if needed; or fork a normalizer.
  - RISK: per-chat `useChat` mounts mean N hooks in the shell when N secondary chats exist. C18 collapses to one chat per spec, so post-C18 this is at most 1 mount — manageable.
  - RISK: existing `secondary-chat-host.test.tsx` mocks `streamSecondaryChatMessage` directly; the refit requires changing the mock surface to `useChat` → MITIGATION: copy `InterviewView.test.tsx`'s `useChat` mock pattern.
  - ASSUMPTION: typed-data-parts schemas (`BrunchUIMessage`, `brunchDataPartSchemas`) can carry the secondary-chat surface without new schema entries in this card → VALIDATE during build; if a new schema entry is needed it stays minimal.
- **Tests:** rework `secondary-chat-host.test.tsx` to assert `useChat` is mounted, message submit flows through, and bundle invalidation fires on completion; preserve the "two parallel chats don't cross-talk" invariant from C5b.
- **Out of scope:** new typed data parts (defer); migrating the popover patch-list partition seam (`producerChatId`) — stays untouched.
- **Verification:** `npm run verify` green; manual walkthrough confirms streaming, finalize, and reload-persistence match today's behavior; partition-seam regression (C5c) still passes.

#### C24a — Shared chat types: register secondary-chat tools + `edit-impact` data part

- **Status:** **done** (2026-05-18) — `npm run verify` green: 109 test files / 1298 tests pass; build clean.
  - **Shared types:** [`src/shared/chat.ts`](file:///Users/kostandin/Projects/hashdev/brunch/src/shared/chat.ts) now hosts the canonical `proposeEditInputSchema` / `proposeEdgeInputSchema` / `proposeDrillDownInputSchema` (lifted out of `side-chat-prompt.ts` to keep the substrate self-contained; `api-types.ts` imports from `chat.ts` so the 5-value `edgeRelationSchema` is duplicated as a private `sideChatEdgeRelationSchema` rather than crossed back through the cycle). New `editImpactTierSchema` + `editImpactDataSchema` carry `{ toolCallId, tier }` for the C24b sibling-data-part contract; type alias `EditImpactTier` matches the server-side enum literally.
  - **BrunchUITools / BrunchDataParts / BrunchAssistantPart:** extended with `propose_edit | propose_edge | propose_drill_down` tool entries and the `edit-impact` data part. Extracts in `BrunchAssistantPart` updated; `INTERNAL_TOOL_PART_TYPES` now hides the propose_* tool labels from `getActivityToolLabel` so they never leak into the interview's activity summary.
  - **brunchValidationTools / brunchDataPartSchemas:** registry now exposes `proposeEditValidationTool`, `proposeEdgeValidationTool`, `proposeDrillDownValidationTool`, and an `edit-impact` data-part schema entry. C24b's `validateUIMessages<BrunchUIMessage>` consumes them directly.
  - **persistedAssistantPartSchema:** admits the new `tool-propose_*` and `data-edit-impact` shapes for forward-compat (decoder accepts them if any future writer emits them; C24a doesn't change today's plain-text persistence path for secondary chats).
  - **Tests:** new [`src/shared/chat.test.ts`](file:///Users/kostandin/Projects/hashdev/brunch/src/shared/chat.test.ts) covers the type registry (`expectTypeOf<BrunchUITools>().toHaveProperty(...)` for all 6 tools), the validation-tools registry, and `brunchDataPartSchemas['edit-impact']` round-trip (parses well-formed payloads, admits all three tier values, rejects unknown tiers, rejects missing `toolCallId`).
  - **Note:** `src/server/side-chat-prompt.ts` still owns its private `proposeEdit*`/`proposeEdge*`/`proposeDrillDown*` schemas + `tool({...})` defs because it carries the `execute: async (input) => ...` echo bodies that the AI SDK needs at the server tool boundary. The shape is identical to the new shared schemas; C24b will reconcile during the server refit (either re-export from shared or keep both, depending on whether `streamText`'s tool input type stays compatible).
- **Weight:** full scope card
- **Target Behavior:** `BrunchUITools` and `brunchDataPartSchemas` in [`src/shared/chat.ts`](file:///Users/kostandin/Projects/hashdev/brunch/src/shared/chat.ts) admit secondary-chat tool calls (`propose_edit`, `propose_edge`, `propose_drill_down`) and an `edit-impact` data part as typed UIMessage parts, with zero observable runtime change.
- **Boundary Crossings:**
  ```
  → src/shared/chat.ts (BrunchUITools, BrunchDataParts, brunchDataPartSchemas, BrunchAssistantPart, persistedAssistantPartSchema)
  → src/server/edit-impact.ts (re-use existing EditImpactTier; lift to shared if needed)
  → src/client/routes/specification/$id/_view/-interview-controller-core.ts (exhaustive switch sites adopt new branches as no-ops)
  → src/client/routes/specification/$id/_view/-interview-view.tsx (control-marker projection switches)
  ```
- **Risks and Assumptions:**
  - DECISION: extend the existing `BrunchUITools` rather than introduce a sibling `BrunchSecondaryUITools` — the interview spine already filters by tool name when projecting view models, so a single registry keeps the protocol unified at the cost of one no-op branch per exhaustive call site. → MITIGATION: precise input types so interview-side switches compile-error if branches are forgotten.
  - ASSUMPTION: `EditImpactTier` is the only side-channel field the bespoke envelope carries beyond raw tool inputs → VALIDATE: re-read [`secondary-chat-route.ts`](file:///Users/kostandin/Projects/hashdev/brunch/src/server/secondary-chat-route.ts) lines 209–258 once during build; if another field surfaces, fold it into the same `edit-impact` data part or a sibling.
  - RISK: `persistedAssistantPartSchema` currently knows only interview tools; secondary-chat assistant turns persist as raw text (`assistant_parts` strings). → MITIGATION: keep persistence shape unchanged in C24a (server still concatenates assistant text). Persistence-shape change is **out of scope** and explicitly deferred (it would promote C24d).
- **Acceptance Criteria:**
  ```
  ✓ `BrunchUITools` exports `propose_edit | propose_edge | propose_drill_down` alongside today's interview tools.
  ✓ `brunchDataPartSchemas` includes an `edit-impact` entry keyed by `toolCallId` + `tier`.
  ✓ `npm run check` clean; interview-side switches either compile-extend with no-op branches or compile-error and are extended.
  ✓ No production runtime behavior change.
  ```
- **Verification Approach:**
  - Inner: `npm run check` (typecheck-first); targeted schema-parse Vitest in `src/shared/chat.test.ts` or sibling.
  - Middle: n/a (types-only).
- **Out of scope:** server route refit (C24b); client refit (C24c); persisting tool-call parts on secondary chats; ai-elements wiring for tool rendering.

#### C24b — Server route refit: secondary-chat `POST .../messages` → AI-SDK UIMessage protocol

- **Status:** **next** (after C24a)
- **Weight:** full scope card
- **Target Behavior:** `POST /api/specifications/:id/secondary-chats/:chatId/messages` accepts a `validateUIMessages<BrunchUIMessage>` body and emits a `createUIMessageStream<BrunchUIMessage>` response, with `propose_*` tool calls surfacing as typed `tool-*` UIMessage parts and edit-impact arriving as a `data-edit-impact` part joined by `toolCallId`.
- **Boundary Crossings:**
  ```
  → HTTP POST .../secondary-chats/:chatId/messages
  → secondaryChat lookup + mode resolution (unchanged)
  → validateUIMessages<BrunchUIMessage>(req.body.messages, dataSchemas, tools)
  → parseIntentItemReferences + resolveIntentItemReferences (unchanged C6 contract)
  → buildSideChatPrompt(...) (unchanged)
  → getSideChatTools(mode) (already AI-SDK tool defs; confirm `toUIMessageStream` surfaces them)
  → createUIMessageStream<BrunchUIMessage>({ execute: ({ writer }) => writer.merge(streamText(...).toUIMessageStream({ sendReasoning: false, sendFinish: false })) })
  → on edit tool call: writer.write({ type: 'data-edit-impact', data: { toolCallId, tier } }) (lazy compute as today)
  → onFinish: appendSecondaryChatTurn(user) + appendSecondaryChatTurn(assistant) using extractTextFromMessage(responseMessage)
  → pipeUIMessageStreamToResponse(stream, res)
  ```
- **Risks and Assumptions:**
  - RISK: today's user-turn persistence happens *before* the stream so mid-stream disconnects leave a recoverable transcript; under `validateUIMessages` the canonical user turn lives in the request payload. → MITIGATION: persist the user turn synchronously after `validateUIMessages` returns, before the `createUIMessageStream` `execute` runs (mirrors the interview spine's `applyChatRouteTransition`).
  - RISK: edit-impact today rides on each `propose_edit` chunk; under UIMessage protocol the natural shape is a sibling `data-edit-impact` part keyed by `toolCallId`. Consumers (C24c patch-stage router) join by `toolCallId`. → MITIGATION: write the data part *immediately after* the tool-call surfaces; document the join contract in the route header.
  - RISK: `appendSecondaryChatTurn(role: 'assistant', content: string)` stores plain text — UIMessage carries structured assistant parts. → MITIGATION: derive assistant text via `extractTextFromMessage(responseMessage)` in `onFinish` and persist as today. Persistence-shape change stays deferred.
  - ASSUMPTION: `getSideChatTools(mode)` returns `streamText`-compatible tool defs such that `toUIMessageStream` surfaces them as `tool-*` parts → VALIDATE during build by reading `side-chat-prompt.ts`; add a thin adapter if not.
- **Acceptance Criteria:**
  ```
  ✓ Route consumes `{ messages: BrunchUIMessage[] }` (replacing `{ message: string }`) and responds with the UIMessage stream protocol.
  ✓ Round-trip: POST user UIMessage → response stream contains a `text` assistant part → user + assistant turns persist with same `user_parts` / `assistant_parts` text as today.
  ✓ Edit mode: `propose_edit` surfaces as a `tool-propose_edit` part AND a subsequent `data-edit-impact` referencing the same `toolCallId`.
  ✓ Mode invariants preserved (C5a): 404 on primary chat / missing chat / missing pinned item; 400 on invalid payload.
  ✓ `#REF-CODE` mention block from C6 still resolves and is prepended to system + persisted in `user_parts`.
  ✓ `secondary-chat-route.test.ts` rewritten against the new envelope (no bespoke `parseSideChatSSEBuffer`).
  ```
- **Verification Approach:**
  - Inner: Vitest in `secondary-chat-route.test.ts` covering the UIMessage envelope, tool-call surfacing, edit-impact join, and the 4 error invariants.
  - Middle: `app.test.ts` round-trip oracle: POST → GET bundle → asserted persisted turn shape matches pre-refit baseline.
  - Outer: deferred to C24d.
- **Out of scope:** client refit (C24c); deleting `secondary-chat-stream.ts` (C24c); popover side-chat route (unchanged — keeps `parseSideChatSSEBuffer`).

#### C24c — Client refit: `useChat<BrunchUIMessage>` per secondary chat + patch-list translation

- **Status:** **next** (after C24b)
- **Weight:** full scope card
- **Target Behavior:** `<SecondaryChatHost>` mounts `useChat<BrunchUIMessage>` per chat (transport pointed at the C24b route), and `propose_*` tool parts in `messages` are translated into chat-scoped `patchList.stage(...)` calls via the existing C5c partition seam — preserving every observable behavior of today's `useSecondaryChatStream`.
- **Boundary Crossings:**
  ```
  → <SecondaryChatHost> mounts useChat<BrunchUIMessage>({ id: chatId, transport: DefaultChatTransport({ api: '/api/specifications/:specId/secondary-chats/:chatId/messages' }), messages: hydrateFromSecondaryChat(secondaryChat), dataPartSchemas: brunchDataPartSchemas, onData: handleEditImpactDataPart, onFinish: invalidateSpecificationBundle })
  → effect that walks `messages`, locates new `tool-propose_*` parts (keyed by toolCallId, deduped by a consumed-set), calls `patchList.stage({ kind, producerChatId: chatId, anchor, ... })`
  → pickup of `data-edit-impact` via `onData`, joined back to staged patches by toolCallId
  → streaming-assistant text derived from the in-flight assistant message's `text` parts (no local `assistantText` state)
  ```
- **Risks and Assumptions:**
  - RISK: today's `useSecondaryChatStream` owns local `assistantText` for the `<SecondaryChatStreamingAssistant>` (C22) live-state; `useChat` exposes `messages` instead. → MITIGATION: derive `streamingAssistantText` from `messages.at(-1)`'s text parts when `status === 'streaming'`.
  - RISK: tool-part translation runs every render; staging the same patch twice corrupts the list. → MITIGATION: track a `Set<string>` of consumed `toolCallId`s inside the host; covering test sends two text deltas after a single tool call and asserts one stage event.
  - RISK: C5c partition seam (`producerChatId`) must survive — two parallel `useChat` instances must not cross-talk patch IDs. → MITIGATION: keep `usePatchListForChat(chatId)` exactly as-is; only the *source* of staged events changes.
  - ASSUMPTION: `DefaultChatTransport` supports a per-chat `api` URL via function callback or interpolation → VALIDATE by reading the interview controller's transport (`-interview-controller.ts` ~L110-120); fork a thin transport if not.
  - RISK: `secondary-chat-host.test.tsx` (290 LOC) mocks `streamSecondaryChatMessage` end-to-end. → MITIGATION: copy the `useChat` mock pattern from `InterviewView.test.tsx` lines ~339–397; expect a 30–50 LOC test bump.
- **Acceptance Criteria:**
  ```
  ✓ <SecondaryChatHost> no longer imports `streamSecondaryChatMessage`; `useChat<BrunchUIMessage>` mounted with chat-scoped id/transport.
  ✓ Live-state regression: streaming text renders inside the C22 `<Reasoning>` surface during stream, resolves into a persisted `<Message>` turn on completion.
  ✓ Patch staging regression: `propose_edit` during stream calls `patchList.stage({ kind: 'edit', producerChatId: chatId, ... })` exactly once; `data-edit-impact` join fills `impact`.
  ✓ Partition-seam regression (C5c): two parallel `<SecondaryChatHost>` instances stage edits independently; no cross-talk.
  ✓ `secondary-chat-host.test.tsx` rewritten against the `useChat` mock pattern; mode-toggle / Shift+Tab / mention popup / suggestions tests (C21–C25) still pass.
  ✓ `src/client/lib/secondary-chat-stream.ts` deleted; `parseSideChatSSEBuffer` unused outside `side-chat-stream.test.ts` (popover unchanged).
  ```
- **Verification Approach:**
  - Inner: Vitest with the `useChat` mock pattern from `InterviewView.test.tsx`; per-test seeded `messages` array drives the host's tool-walk and live-text derivation.
  - Middle: existing round-trip integration (`app.test.ts`) already covers the server side via C24b; no new middle-tier work.
  - Outer: deferred to C24d.
- **Out of scope:** persisting tool-call parts on secondary chats; ai-elements tool-rendering surfaces for staged patches; popover refit.

#### C24d — Outer-loop walkthrough + bespoke envelope retirement + PR description rewrite

- **Status:** queued (after C24c; promote if C24b/C24c findings invalidate the persistence-shape deferral)
- **Weight:** light scope card
- **Objective:** Confirm the refit holds end-to-end against a real spec, retire any remaining bespoke-envelope code paths reachable from secondary chats, and refresh the FE-716 PR draft (in CARDS.md C10 §PR description) to reflect C24's UIMessage-protocol substrate.
- **Acceptance Criteria:**
  ```
  ✓ Manual walkthrough (V3.1 capability matrix + parallel-chat partition seam): typing in two secondary chats simultaneously stages edits independently, undo per-chat works, persisted turns reload identically to today.
  ✓ `rg "parseSideChatSSEBuffer|streamSecondaryChatMessage|patch-proposal" src/server src/client/components/secondary*` is empty (popover keeps the helper; secondary doesn't).
  ✓ `npm run verify` green.
  ✓ PR description (CARDS.md C10) updated to name the UIMessage substrate and the typed `tool-propose_*` + `data-edit-impact` parts; "What" + "Substrate" sections rewritten to drop the bespoke-envelope description.
  ```
- **Verification Approach:**
  - Inner: `npm run verify`.
  - Outer: manual walkthrough on a real spec (capture into the FE-716 walkthrough log).
- **Promotion checklist:**
  - [ ] Changes a requirement? — no, parity-only
  - [ ] Creates/retires/invalidates an assumption? — retires "bespoke SSE envelope is the secondary-chat protocol"; document in SPEC.md A94 evidence band during `ln-sync`
  - [ ] Makes/reverses a non-trivial design decision? — no (carries C24a–C24c decisions)
  - [ ] Establishes a new seam-level invariant? — no
  - [ ] Crosses more than two major seams? — no (cleanup only)
  - [ ] First touch in unfamiliar seam from fresh thread? — no
  - **Promote if:** C24b/C24c surface a persistence-shape decision (assistant turn persisted as `parts: BrunchAssistantPart[]` vs. `string`). That's a durable substrate change and routes through `ln-spec`/`ln-plan`.

##### Order discipline

C24a (types) → C24b (server route) → C24c (client refit) → C24d (walkthrough + cleanup). Sequential by necessity: types feed server feeds client. C24a and C24b interfaces are stable against the orientation findings; C24c's *target behavior* + *acceptance criteria* are implementation-independent of C24a/C24b findings (only the tool-walk implementation may shift). C24d is gated by C24c's completion and the absence of a persistence-shape pivot.

### C25 — `#` mention autocomplete chip UI on the composer

- **Status:** **done** (2026-05-18, landed out of order ahead of C24) — `npm run verify` green: 1292 tests pass; build clean.
  - **Client:** new [`secondary-chat-mention-popup.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/secondary-chat-mention-popup.tsx) exports `<SecondaryChatMentionPopup>`, `computeMentionQuery(value, cursor)`, `insertMention(value, cursor, refCode)`, and `handleMentionPopupKey(...)`. Popup built on cmdk (`Command` / `CommandList` / `CommandEmpty` / `CommandGroup` / `CommandItem` from `@/client/components/ui/command`) — no new dep. Position: absolute below the textarea via the composer's `relative` wrapper. `SecondaryChatComposer` in `secondary-chat-collapsible.tsx` tracks an active `mentionQuery` from textarea value + cursor on every change; renders the popup when non-null and `mentionableItems` has entries; Esc dismisses; Enter inserts `#REF-CODE ` and closes; outside-click dismisses.
  - **Anchor rules (V1):** `#` must be at start-of-string or after whitespace (so markdown headings on a new line still trigger but `abc#R1` doesn't); whitespace inside the query closes the popup. Server-side `#REF-CODE` resolution (C6) is unchanged — the popup is a UI affordance, not a new substrate.
  - **Host:** new exported helper `flattenEntitiesToMentionItems(entities)` in `secondary-chat-host.tsx` flattens `useSpecificationEntities()`'s 8 buckets into a `MentionItem[]` (drops items without a `referenceCode`); host threads the result into the collapsible as `mentionableItems`. Test harnesses (`secondary-chat-host.test.tsx`, `chat-shell-presence.test.tsx`, `unified-chat-shell.test.tsx`) seed an empty entities query so the suspense resolves.
  - **Tests:** 5 new tests in `secondary-chat-collapsible.test.tsx`: (a) `#` opens popup with all items + `data-query=""`, (b) `#R` filters to refcodes starting with `R`, (c) Esc dismisses without inserting, (d) Enter inserts `#R1 ` + closes, (e) no popup when no `#` active.
  - **Out of scope (explicitly deferred):** chip-style decorations (a real contentEditable surface) and per-kind tints — V1 stays text-based since the server resolves `#REF-CODE` strings the same either way; `$` (secondary chats) and `!` (annotations) symbols remain parked in Track 5.
- **What:** Wire the Radix `Combobox` / `cmdk` (existing dep) popup on `#` keypress inside the `<PromptInput>` composer. Reads the spec's intent graph (refcode + kind + display label); inserts a chip with `kindAccentHex` tint matching the kind. Server-side `#REF-CODE` resolution (C6) already exists — C25 only adds the UI affordance. `$` (secondary chats) and `!` (annotations) stay parked; they need substrate work owned by Track 5.
- **Boundary crossings:** composer input → key handler intercepts `#` → `cmdk` popup → searches `specificationState.knowledgeItems` (already on the bundle) → inserts a chip token in the draft → submit serializes chips as `#REF-CODE` strings (server resolution unchanged).
- **Risks / assumptions:**
  - RISK: chips inside a plain text input require a contentEditable-style composer; ai-elements `<PromptInput>` may not support inline chips natively → MITIGATION: read the ai-elements source; if not supported, render chips as overlay decorations until submit-time and serialize back to `#REF-CODE` strings. If a real chip-token surface is needed, fall back to building a thin `<MentionInput>` shell wrapping `<PromptInput>`.
  - RISK: refcode collisions with non-mention `#` use (e.g. markdown headings in user-typed plans) → MITIGATION: popup only appears mid-word at cursor; dismiss on Esc; do not auto-replace.
- **Tests:** new tests: `#` opens popup, arrow keys navigate, Enter inserts, Esc dismisses, chip renders with kind tint, submit serializes to `#REF-CODE` and the server round-trip resolves the item (re-use C6 server-resolution tests as the boundary).
- **Out of scope:** `$` (secondary chats) and `!` (annotations) — parked in Track 5; new substrate (`thread_context_item` snapshots) — parked in Track 5; mention popover for graph-view / structured-list — separate surface.
- **Verification:** `npm run verify` green; manual walkthrough confirms typing `#GOAL` filters to goal items, Enter inserts a chip, the assistant response uses the resolved item context.

### C26 — Revert C18 single-scratch + add chat switcher UI

- **Status:** **done** (2026-05-18) — `npm run verify` green: 108 test files / 1279 tests pass; build clean.
  - **Server:** `appendAnchorToScratchChat` replaced by `getOrCreateItemSecondaryChat(db, specId, input)`. Lookup by `(specification_id, parent_chat_id, pinned_item_id, pinned_reconciliation_need_id IS NULL)` → reuse existing chat (kickoffTurnId=null) or create new + kickoff. `anchored_item_ids` set to `[itemId]` on create so C19 can read it. Reconciliation path unchanged.
  - **Route:** repointed; response `{ chatId, kickoffTurnId }` (drops `anchoredItemIds`).
  - **Client:** new `<ChatSwitcher>` component (`chat-switcher.tsx`) built on `dropdown-menu.tsx` — renders the active chat's kind icon + truncated item excerpt (parsed from the kickoff turn's `'…'` token) + chevron; menu lists each item-anchored chat with kind icon + excerpt, active row highlighted. Click → `presence.focusChat(id)`.
  - **Shell:** active chat = `secondaryChats.find(c => c.id === presence.focusedChatId) ?? mostRecentItemChat`. Renders only that one host. Switcher mounts in the header next to the spec name when 2+ item-anchored chats exist.
  - **Tests:** updated the "renders only the per-spec scratch chat" test → splits into "single chat: no switcher" and "2+ chats: switcher mounts, most-recent rendered as active." Server tests pass unchanged (dedupe still satisfies `invoked_in_turn_id` + mode-aware kickoff invariants since the first POST always creates).
- **What:** User direction (2026-05-18): revert C18's "one scratch chat per spec" behavior; each item-click gets its own chat (with dedupe by `(parent_chat_id, pinned_item_id, pinned_reconciliation_need_id IS NULL)` so clicking the same item twice re-opens rather than duplicates). The shell still shows **one chat at a time** but a dropdown switcher in the header lets the user navigate between all secondary chats for this spec. Reconciliation chats stay hidden from the switcher until Track 3 defines their UX.
- **Server:**
  - Replace `appendAnchorToScratchChat` with `getOrCreateItemSecondaryChat(db, specId, input)` — finds existing chat by parent+item or creates a new one; returns `{ chat, kickoffTurnId: number | null }` (null on dedupe re-open). `anchored_item_ids` is set to `[itemId]` on create for forward-compat with C19 selection styling.
  - Route response shape becomes `{ chatId, kickoffTurnId }`; drops `anchoredItemIds` (the bundle still projects it per chat).
  - Reconciliation path (when `reconciliationNeedId` is set) unchanged — keeps creating dedicated chats.
- **Client / presence:** active chat = `presence.focusedChatId` (existing C14 field). Shell selects `chats.find(c => c.id === focusedChatId) ?? mostRecentNonReconciliation` and renders only that one. Trigger create auto-focuses the new chat (existing C14 behavior already does this).
- **Shell switcher:** new `<ChatSwitcher>` component in the shell header, rendered iff there are 2+ item-anchored chats. Built on `dropdown-menu.tsx` (already vendored). Each entry: kind chip (lucide icon + `kindAccentHex` tint) + ref code + truncated item excerpt. Click → `presence.focusChat(id)`.
- **Tests:**
  - Server: clicking the same item twice returns the same `chatId`; clicking different items returns different `chatId`s.
  - Shell: bundle with three item-anchored chats + `focusedChatId === second` → only the second host renders; switcher lists all three.
  - Switcher: clicking a non-active entry calls `presence.focusChat(id)`; the rendered chat flips on next render.
- **Out of scope:** localStorage persistence of active chat (defer; on reload, fall back to most-recent); reconciliation chats in switcher (Track 3); `$` mention chips (Track 5).
- **Verification:** `npm run verify` green; manual walkthrough: click item A → chat opens; click item B → chat opens, switcher shows both; flip via switcher; reload → falls back to most-recent.

### C27 — UI polish: selective kind-accent tinting + modern shell vocabulary

- **Status:** **done** (2026-05-18) — selective `kindAccentHex` tinting landed on `<ChatSwitcher>` (3px left-border on trigger + active row), `<SecondaryChatCollapsible>` body (2px left strip + focus ring at ~30% opacity), and the structured-list view (2px left-border on rows matching the active chat's `pinned_item_id` / `anchored_item_ids`). Modern shell vocabulary: outer `<UnifiedChatShell>` header lost the uppercase `Chat` prefix and was trimmed to `h-8`; inner cards bumped to `rounded-lg` (collapsible body, reconciliation panel, staging strip); composer textarea now `rounded-full` with a dark `bg-ink text-background rounded-full` Send button. Tests: new [`chat-switcher.test.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/__tests__/chat-switcher.test.tsx) covers trigger + active-row accent borders; `structured-list-view.test.tsx` mock extended to stub the new `useSpecificationBundleData` call. `npm run verify` green at 1302 tests / build clean.
- **What:** Targeted modernization pass on the unified chat shell + a foundation for kind-accent selection styling. **Inspiration only** from `figma.com/design/nTw9n0blCJm1j9t22Jo72d/HASH-SgAI?node-id=969-386` (HASH SgAI mock — soft warm wash on the chat panel, pill compose with dark round Send, segmented chat tabs, agent-run progress narration with timing). No full redesign and no background gradient wash in V1 — just selective `kindAccentHex` application on selected/anchored/active states and a vocabulary refresh on the chat surface chrome.
- **Selective kind-accent tinting** (accents only — never full backgrounds):
  - `<ChatSwitcher>` active row: a ~3px left-border in `kindAccentHex[chat.pinnedItemKind]` replaces the flat `bg-tint/60`. Trigger button picks up the same accent on its leading edge.
  - `<SecondaryChatHost>` / `<SecondaryChatCollapsible>` body: subtle top or left accent strip in the chat's `kindAccentHex` (~2px). Background stays neutral.
  - Focus ring on the collapsible trigger: `kindAccentHex` at ~30% opacity instead of the generic `ring-foreground/30`.
  - `StructuredListView` rows: when an item id matches the active chat's `pinned_item_id` (or any id in `anchored_item_ids`), render the row with a 2px left-border in `kindAccentHex`. Lays the foundation that C19's full selection-styling pass can build on.
- **Modern shell vocabulary** (chat surface only — don't touch workspace center for V1):
  - Bump card corner radius across the shell: `rounded-md` → `rounded-xl` on the compact dock; `rounded-lg` on inner cards (collapsible body, staging strip, reconciliation panel).
  - Compose pill: round the composer input to `rounded-full`; dark Send button (`bg-ink text-background`) also `rounded-full`. Matches the figma compose.
  - Header strip: trim the row height (~32 px), drop the spec-name uppercase "Chat" prefix in favor of just the truncated name, align switcher trigger + layout buttons + close X on a single baseline.
  - Replace the hover/active outline on layout buttons with a refined `data-active=true` style (subtle inset + accent dot or border-bottom marker).
- **Out of scope** (parking lot — defer):
  - Soft gradient wash on the chat panel background (the figma's most distinctive flourish). Defer until brand/palette work decides whether the gradient is canonical or scene-specific.
  - "1 Queued" indicator + queued-message UX.
  - Agent-run progress narration ("Reviewing the prompt", "Building the plan", "Generating clarifying questions") with timing — owned by `UNIFIED_CHAT_UX.md` §6 agent-run track.
  - Tab-based chat switcher (the figma's "New chat | Old chat" tabs). Current dropdown scales better at higher counts; revisit after walkthrough.
  - "+ New chat" explicit-create affordance (without anchoring to an item) — different mental model from the per-item dedupe shipped in C26.
  - Mention chip styling (`#REF-CODE` autocomplete chips) — owned by C25.
  - Knowledge-card / sidebar / structured-list deeper visual polish — workspace center stays untouched in V1.
- **Tests:**
  - `chat-switcher.test.tsx`: active row carries the `kindAccentHex` border (data attribute or inline-style assertion).
  - `unified-chat-shell.test.tsx`: shell container picks up `rounded-xl`; compose Send button is `rounded-full`.
  - No regression on existing layout / collapse / close / switcher tests.
- **Verification:** `npm run verify` green; manual walkthrough — open chats anchored to a goal (`#2563eb`), a constraint (`#ec4899`), and a decision (`#9333ea`); confirm each chat's switcher row + header accent + (if C19 is done) workspace row reflects its kind color without overwhelming the surface.

### C28 — Sticky composer + autoscroll on new content

- **Status:** **next**
- **What:** Pin the composer at the bottom of the chat surface; messages scroll above it. Auto-scroll to the latest message as new content (persisted turns + streaming text) arrives.
- **Implementation:**
  - In [`secondary-chat-collapsible.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/secondary-chat-collapsible.tsx), wrap the composer in a sticky-positioned container (`sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-rule/40`), spanning the full collapsible width via the negative-margin trick (`-mx-3 px-3`).
  - Add a `bottomAnchorRef` just above the sticky composer; `useEffect` on `turns.length` and `streamingAssistantText?.length ?? 0` calls `scrollIntoView({ block: 'end' })` on the anchor.
  - Scroll ancestor stays the shell body (`unified-chat-shell-body` — already `overflow-y-auto`); no restructure of the shell or motion wrappers needed.
- **Pause-on-scroll-up (deferred to V2):** when the user scrolls up away from the bottom, pause autoscroll and show a "Jump to latest" button. Skipped in V1 to keep the slice small; revisit if walkthrough surfaces friction.
- **Tests:** assert the composer wrapper carries `sticky` + `bottom-0`; assert `scrollIntoView` is invoked when `turns.length` or `streamingAssistantText` increases (spy on `HTMLElement.prototype.scrollIntoView`).
- **Out of scope:** pause-on-scroll-up, "Jump to latest" button, scroll restoration across chat switches.
- **Verification:** `npm run verify` green; manual: open a chat anchored to an item, type/stream messages until they exceed the visible area, confirm the composer is pinned at the bottom and the view follows the latest message.

### C29 — Consolidate patches inside the chat shell (quick win)

- **Status:** **proposed**
- **What:** Replace the workspace-wide `<PatchListOverlay>` surface with a single shell-level patch panel mounted inside `<UnifiedChatShell>`. The conversational loop and the changes it produces collapse onto one surface; bulk affordances replace per-row clicking. Independent of C20–C25; can land in parallel or before.
- **Why now / big win:**
  - **One look, one decision.** Today: assistant proposes → user glances up at top-bar overlay → back to chat. New: assistant proposes → user sees patches appear inline in the shell → one click.
  - **Bulk operations become natural.** "Apply all" at the chat level matches the mental unit ("this conversation's batch of changes"). Promotes Apply to header-level; demotes per-row to Discard-only — most flows drop from N clicks to 1.
  - **Prepares Track 3.** Reconciliation chats will want changes inline; co-locating patches in chat is the natural pattern.
  - **No code thrown away.** `<PatchListOverlay>` mount is commented out, not deleted; component + bridge + tests stay in tree. One-line revert restores it.
- **Hide, don't remove:**
  - Comment out `<PatchListOverlay />` at [`src/client/routes/specification/$id/route.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/routes/specification/$id/route.tsx) line 67 with a `// FE-716 C29: overlay hidden in favor of shell-internal patch panel; restore here to revert.` comment.
  - Leave [`patch-list-overlay.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/patch-list-overlay.tsx), [`patch-list-overlay-bridge.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/patch-list-overlay-bridge.tsx), and `patch-list-overlay.test.tsx` untouched. Tests continue to pass as unit-tests of the (now unmounted) component.
- **New `<ChatShellPatchPanel>`:**
  - File: `src/client/components/chat-shell-patch-panel.tsx`.
  - Subscribes to **`usePatchList()`** (global, un-partitioned hook from [`patch-list-host.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/patch-list-host.tsx)) — sees the union across all chats in the spec.
  - Mount inside `<UnifiedChatShell>` body, **above** the `<ChatSwitcher>` row when there are 1+ staged patches; renders `null` otherwise so empty-state collapses cleanly.
  - **ai-elements composition** (compose, don't fork — matches the brief §Constraints "Compose above `ai-elements/*`"):
    - Outer container: ai-elements [`<Task>`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/ai-elements/task.tsx) — already a Collapsible with `isRunning` semantics; set `isRunning={isStreaming}` so the panel auto-opens while the assistant is mid-stream and auto-closes ~AUTO_CLOSE_DELAY after settle. Matches `question-cards.tsx`'s existing usage pattern.
    - Header: `<TaskTrigger title="N pending change[s]" />` — built-in chevron + collapse affordance. Bulk-action buttons (`Apply all`, `Undo`) render as siblings inside the same header row (outside `<TaskTrigger>` to avoid nested-button warning; same pattern as the `SecondaryChatCollapsible` mode toggle in C4).
    - Body: `<TaskContent>` wraps the list.
    - Per-row: `<TaskItem>` for the summary line; `<TaskItemFile>` for the kind chip (it's purpose-built for inline metadata pills — reuse instead of a new chip primitive). `<ImpactChip>` (existing brunch component) stays for impact display.
    - **`<ContentDiff>` stays** — it's purpose-built for line-level graph-item edits; ai-elements `<CodeBlock>` is too generic for the diff highlighting we need. Wrap the diff inside a `<TaskItemFile>`-styled container for visual cohesion.
    - **Streaming pulse:** when a new patch arrives mid-stream, wrap the row's first paint in ai-elements [`<Shimmer>`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/ai-elements/shimmer.tsx) for one beat; the existing C15 `usePrefersReducedMotion` short-circuits it. Avoids a bespoke motion config.
  - **Header band:** `N pending change[s]` (inside `<TaskTrigger>`) · **`Apply all`** (bulk-applies the entire staged slice in one batch) · `Undo` (reverses the most recent applied batch — same semantics as the overlay's existing Undo).
  - **Per-row:** kind label via `<TaskItemFile>`, summary text via `<TaskItem>`, inline `<ContentDiff>` for `edit` patches when the before/after pair is available, `<ImpactChip>` when impact is known. Per-row action is **`Discard` only** — apply is bulk-only at the header.
- **Retire `<SecondaryChatStagingStrip>` UI:**
  - Remove the strip's render from `<SecondaryChatHost>` / `<SecondaryChatCollapsible>` body — the shell panel above absorbs its job.
  - **Keep the `producerChatId` partition seam in [`patch-list-reducer.ts`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/patch-list-reducer.ts) and `usePatchListForChat()` in [`patch-list-host.tsx`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/patch-list-host.tsx).** Drop `secondary-chat-staging-strip.tsx` from the component tree only — the field, reducer, and per-chat selector stay because they encode useful semantic data ("which chat produced this patch") that the shell panel can decorate rows with later, and Track 3 reconciliation chats may want a per-chat slice again.
  - Decoration option in scope: render a small kind chip on each row showing the producing chat's `pinnedItemKind` (subtle leading accent). Defer if it adds churn.
- **Risks:**
  - **Minimize / close hides patches** — when the shell is in `appearance='minimized'` (pill) or `appearance='closed'`, the panel is invisible. **Explicitly accepted V1 regression.** Hybrid Shape B (overlay → top-bar pill when shell collapsed) stays a follow-up; flagged in parking lot.
  - **`useStablePatchListEnv` toast dedup** — the "Change saved" toast survives remounts via `useStablePatchListEnv` (see [`patch-list-host.tsx:222`](file:///Users/kostandin/Projects/hashdev/brunch/src/client/components/patch-list-host.tsx)) keyed at the spec-route level. Provider mount stays at the spec route; only the *renderer* moves into the shell. Verify during build that toasts still dedupe across shell remounts (layout-mode flips, presence toggles).
  - **Two callers, one global hook** — both the (mounted but invisible) overlay test harness and the new shell panel consume `usePatchList()`. The provider already supports multiple consumers; no churn expected.
- **Tests:**
  - New `src/client/components/__tests__/chat-shell-patch-panel.test.tsx`:
    - Empty staged slice → renders `null`.
    - One staged patch → `<TaskTrigger>` title reads "1 pending change", `<TaskItem>` row renders with kind chip + summary + `Discard`.
    - Multiple staged patches → "N pending changes", `Apply all` fires bulk apply, `Undo` reverses the last batch.
    - `Discard` removes the row but leaves siblings.
    - `<ContentDiff>` renders for `edit` patches when before/after available.
    - `isRunning=true` (streaming) auto-opens the `<Task>` panel; `isRunning=false` auto-closes after the configured delay (test via timer advance).
  - Mock surface: `@/client/components/ai-elements/task` and `@/client/components/ai-elements/shimmer` per the existing pattern in `InterviewView.test.tsx` if isolating render is needed.
  - Update `unified-chat-shell.test.tsx`: panel mounts above the switcher when staged patches exist; absent when empty.
  - Update `secondary-chat-host.test.tsx` / `secondary-chat-collapsible.test.tsx`: the per-chat staging-strip render assertions retire; the partition-seam reducer tests in `patch-list-reducer.test.ts` stay green.
  - `patch-list-overlay.test.tsx` continues to pass unchanged (unit-tests the component, not the mount).
- **Out of scope:**
  - Hybrid pill / minimize-state visibility (Shape B follow-up).
  - Auto-apply heuristics, per-impact gating, classifier-state UX (Track 3).
  - Deleting `<PatchListOverlay>`, `patch-list-overlay-bridge.tsx`, or their tests.
  - Removing the `producerChatId` partition seam or `usePatchListForChat()` hook.
  - Workspace-center patch surfacing (knowledge-card pending-edit chip etc.) — separate concern.
- **Verification:** `npm run verify` green; manual walkthrough:
  - Stage edits in two anchored chats (use `<ChatSwitcher>` to flip between them); the shell panel shows the union; `Apply all` bulk-applies both; `Undo` reverses both; per-row `Discard` removes one without touching siblings.
  - Confirm `<PatchListOverlay>` is no longer mounted (no top-bar `N Edits` summary).
  - Minimize the shell; confirm staged patches are hidden (accepted regression). Expand → panel returns.

## Deferred — explicitly NOT in V1 (parking lot)

These belong to follow-up frontiers and should not be slipped into FE-716:

- `$` secondary-chat mention symbol → future `chat-context-provision` slice
- `!` annotation / artifact mention symbol → `chat-context-provision` (Track 5)
- Per-kind prompt context builders (snapshot composition rules per item kind) → `chat-context-provision` (Track 5)
- Snapshot builder family (`buildIntentItemContextSnapshot`, neighborhood, economic-graph, historical) → `chat-context-provision` (Track 5)
- Item-version-gated handle refresh → `chat-context-provision` (Track 5; needs `changeset-ledger`)
- Full reconciliation runtime UX (target-grouped, async classifier states, "Reconcile Now") → `reconciliation-runtime` (Track 3)
- `PendingReviewSection` retirement → `reconciliation-runtime` (Track 3)
- QA composer refinements → follow-up frontier
- Strategy secondary-chat UI → follow-up frontier (substrate may already represent it)
- LLM-generated context-aware suggestions (V1 ships static-per-mode in C23) → follow-up frontier
- Per-kind kickoff copy variations (§6) → follow-up frontier (V1 ships one kickoff template; per-kind copy is a separate visual pass)
- Item-anchored badge in structured-list / graph view (§7 dec 6) → follow-up frontier
- Typed data parts (`thread.kickoff`, `thread.suggestions`, `thread.mention_resolved`, `thread.reconciliation_summary`, `thread.agent_progress` per §11) → follow-up frontier (substrate enabled by C24's `useChat<BrunchUIMessage>` refit; schemas land alongside the consumer that needs them)
- Ladle prototype (§13) → **skipped** — C20–C25 adopt ai-elements directly against the unified shell; revisit only if visual iteration on isolated scenes proves necessary
- Patch surface hybrid pill (Shape B) → follow-up — when the chat shell is minimized to the "Ask Brunch" pill or closed, surface `N pending · Apply · Undo` as a top-bar pill that opens the (still-mounted-but-hidden) `<PatchListOverlay>`. Restores the workspace-wide visibility that C29 accepts as a regression.

## Open coordination items

- **Lexicon reconciliation:** "secondary chat" stays as the *internal* substrate/code vocabulary (column names, types, helpers, hooks) per PR #139. After C11 it is no longer a user-facing label — the UI uses the kind chip (Edit / Ask) and the unified shell branding only.
- **PR #139 dependency:** stack submits only after #139 merges (or per Lu's signal). Restack on `main` once #139 lands.
