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
