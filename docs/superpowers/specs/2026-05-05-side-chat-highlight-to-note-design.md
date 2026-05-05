# Side-Chat — Highlight-to-Note (V1.2-E)

> Brainstorm output 2026-05-05. Implements the floating selection menu sub-slice named in `memory/PLAN.md` Active 1 (V1.2-E) and `docs/design/SIDE_CHAT.md` §2.
>
> Status: **proposed** — pending user review before transitioning to implementation plan.

## 1. Concept

Today, an annotation is created by opening the side-chat on an item, clicking `Annotate`, and typing both a summary and a body into a form. The user wants a faster path: select text inside a knowledge item, click one button, the selection becomes a durable note **and** is immediately visible to the chat.

This design unifies three artifacts behind a single user action:

- An `annotation` row (durable, in DB).
- A **chat-thread card** (interleaved with user/assistant messages, visually shows what was highlighted).
- An **active context binding** (the snippet is included in the LLM's prompt on the next turn).

One row, three views. The card is a *binding*, not a copy — its presence in `activeCardIds` decides whether the underlying annotation feeds the prompt.

This implements V1.2-E exactly as scoped in `docs/design/SIDE_CHAT.md` §2 (`💬 Chat` / `📝 Annotate` floating menu) and adds the chat-context coupling that lets a saved note participate in the conversation.

## 2. User flow

```
┌─ Knowledge item (graph view) ──────────────────────┐
│  Selection inside data-annotatable text            │
│         │                                          │
│         ▼                                          │
│  <SelectionMenu>  💬 Chat  📝 Annotate             │
│         │              │                           │
└─────────┼──────────────┼───────────────────────────┘
          │              │
   open side-chat   stage AnnotatePatch
   (span = hint    (summary=snapshot, body='',
    on next turn   selectionRange={start,end})
    only, no row)         │
                          ▼
                   auto-applier persists →
                   annotation row + activeCardIds.push(id)
                          │
                          ▼
   ┌─ Side-chat panel ─────────────────────────────┐
   │  pinned item header                           │
   │  user: "..."                                  │
   │  assistant: "..."                             │
   │  📝 [C1] «household income should…»  [×]     │  ← active card
   │  user: "..."                                  │
   │  assistant: "..."                             │
   │  notes drawer: "Notes (3)"                    │
   │  composer + send                              │
   └───────────────────────────────────────────────┘
                          │
                          ▼
            next /side-chat request payload:
            { ..., activeAnnotations: [
                { referenceCode:"C1", snapshot:"...", body:null }
              ] }
```

Two paths from the menu, sharing one surface:

- **`📝 Annotate`** — instant durable artifact. Stages an `AnnotatePatch` with `summary = snapshotText`, `body = ''`, `selectionRange = {start, end}`. Auto-applier persists. Annotation id is pushed to `activeCardIds`. Side-chat panel opens (or focuses, if already open) for the parent item; the card animates in chronologically.
- **`💬 Chat`** — transient, no row written. Calls existing `openFor(item)` and stashes a one-shot `pendingSpanHint = snapshotText` on `SideChatHost`. The next user message's request prepends `"About the highlighted phrase «...»: "` in the prompt. Hint clears after one turn. No card, no DB write.

The two existing entry points still work unchanged:

- Action-rail `chat-with` button → `openFor(item)`. No span, no card. (Today's behavior.)
- Side-chat `Annotate` button → opens the typed form for body+summary. Stages an `AnnotatePatch` *without* `selectionRange`. **Also pushes onto `activeCardIds`** so form-created notes show as cards in the thread (consistent rule: "annotations born in this session are active by default"). Older notes from prior sessions stay inert in the drawer (a `+` promote action is a deferred follow-up; see §8).

## 3. Lifecycle of an active card

**Created** in two ways:
- Highlight + `📝` (born active).
- Existing typed-form `Annotate` (also born active in the current session).

A follow-up card not in scope for V1: a `+` action on each notes-drawer entry that promotes a previously-inert annotation into `activeCardIds`. This is a one-line state mutation; deferred only because nothing in V1.2-E requires it.

**Removed** by clicking `[×]` on the card. The annotation row is untouched in the DB; the card is unbound from the chat session and the next prompt omits it.

**Persistence:** session-scoped only. `activeCardIds` lives in `SideChatHost`'s React state; reload clears it. Persistence across reload waits on A71 (patch / event-stream data model). The user's existing notes still surface durably in the drawer; only the *active context binding* is volatile.

**Cap:** all cards render in the thread; only the **8 most-recent** are sent to the server in `activeAnnotations`. Cards beyond the cap show a muted "not in context" tag. The cap is a guard against prompt bloat and is the easiest knob to tune post-ship.

## 4. Data model

### 4.1 Schema (no migration)

The `annotation` table already has `selection_start: integer | null` and `selection_end: integer | null` columns from D133. Today they're written by `db.createAnnotation` but **dropped on the floor** by the REST schema and the client applier. This design plumbs them through end-to-end. No schema change.

### 4.2 Patch shape (no reducer change)

`AnnotatePatch` already extends `PatchBase` which carries an optional `selectionRange: { start, end }`. The reducer treats it as opaque and the applier hasn't been passing it. This design is the first caller that does. No new event types, no reducer changes.

### 4.3 Side-chat thread items (new union)

The popover currently renders `messages: SideChatMessage[]` as a flat `<ul>`. This becomes a derived `threadItems` union sorted by `timestamp`:

```ts
type ThreadItem =
  | { kind: 'message'; message: SideChatMessage; timestamp: number }
  | { kind: 'card'; annotationId: number; summary: string; ref: string;
      itemKind: KnowledgeKind; timestamp: number };
```

Cards get `data-thread-item="card"` for testing. Existing message rendering, typewriter animation, error states all unchanged.

### 4.4 Stream-request payload extension

`streamSideChatResponse` payload gains two optional fields:

```ts
activeAnnotations?: { referenceCode: string; snapshot: string; body: string | null }[];
spanHint?: string;   // one-shot, consumed by next turn
```

Server-side `side-chat-prompt.ts` appends `activeAnnotations` under `User-pinned snippets:` (numbered list) and prepends `spanHint` to the latest user message if present.

## 5. Components & files

### New

| Path | Purpose | LOC est. |
|---|---|---|
| `src/client/components/selection-menu.tsx` | Floating popover anchored to selection rect; two buttons | ~80 |
| `src/client/lib/use-text-selection.ts` | Hook that captures snapshot + offsets + anchor item from `[data-annotatable]` | ~60 |
| `src/client/components/active-card.tsx` | Interleaved quote-card render | ~50 |

### Modified

| Path | What changes |
|---|---|
| `src/client/components/side-chat-host.tsx` | Add `activeCardIds: number[]` and `pendingSpanHint: string \| null` session state. Expose `dismissCard(id)`, `openWithSpanHint(item, hint)`. Wire the annotate-applier `onCreated` callback to push ids. |
| `src/client/components/side-chat-popover.tsx` | Replace `messages` rendering with `threadItems` union. Add `<ActiveCard>` branch. |
| `src/client/components/patch-list-host.tsx` | Extend `ApplyPatchFn` return shape from `{ undo }` → `{ undo, applied?: unknown }`. Plumbing only — reducer remains pure. |
| `src/client/lib/annotation-api.ts` | Plumb `selection_start/end` through `createAnnotationRequest`. Accept optional `onCreated(id, patch)` in `makeAnnotateApplier` and return `{ undo, applied: { id } }`. |
| `src/server/annotation-route.ts` | Extend Zod schema with optional `selectionStart`/`selectionEnd`; pass to `db.createAnnotation`. |
| `src/client/lib/side-chat-stream.ts` | Extend payload with `activeAnnotations?` and `spanHint?`. |
| `src/server/side-chat-route.ts` + `src/server/side-chat-prompt.ts` | Accept new fields; build `User-pinned snippets:` block; prepend span hint to latest user message. |
| `src/client/components/knowledge-card.tsx` and/or `src/client/routes/specification/$id/-structured-list-view.tsx` | Wrap content + rationale text spans with `data-annotatable data-item-kind data-item-id data-item-ref`. Mount `<SelectionMenu>` once at the structured-list-view root. |

### Untouched

- `src/client/components/patch-list-reducer.ts` (events, types, derivation).
- `annotation` schema (`selection_start/end` already exist).
- Notes drawer in `side-chat-popover.tsx` (still reads from the same `annotations` query).
- Action-rail `chat-with` button in `-structured-list-view.tsx` (works as today).

## 6. Range computation strategy

The hook uses `range.toString()` to capture the snapshot and `element.textContent.indexOf(snapshot)` for offsets. This is sufficient for V1 because:

- Range may span multiple text nodes (bold, italic, links inside content); `range.toString()` flattens correctly.
- `textContent` is the canonical reference for `selection_start/end` (matches what `db.createAnnotation` already expects).
- Repeated phrases in the same item are rare in spec content; the first match is "good enough" and matches the user's intuition (selection starts where they began dragging).

Accepted V1 limitations:

- Whitespace normalization differences between `textContent` and what the user actually selected can cause `indexOf` to miss. **Fallback:** stage the patch *without* `selectionRange` — degrades to item-level annotation. Snapshot is still saved as `summary`. The user sees their note land in the drawer; they just don't get inline tint when that lands later.
- Repeated-phrase wrong-instance match. Same fallback (silent degrade) is theoretically possible if the wrong instance is later edited but the right one isn't; treated as accepted V1 cost.

Robust range capture (TreeWalker accumulation, version pinning, fuzzy reattach) is deferred with A72 (knowledge-item versioning).

## 7. Error handling & edge cases

| Case | Behavior |
|---|---|
| Selection collapses to zero / whitespace-only | Menu doesn't show. |
| Selection straddles two `data-annotatable` regions | Menu doesn't show. (Hook returns null when start/end aren't in the same element.) |
| Snapshot text not found in `textContent` | Stage without `selectionRange` — degrades to item-level. |
| Repeated phrase, `indexOf` matches the wrong instance | Accepted V1 cost. |
| Side-chat open for item X, user highlights inside item Y | `openFor(Y)` replaces the active session — same as today's `chat-with`. |
| User clicks `📝` while assistant is streaming | Stage proceeds; auto-applier already fires independent of stream state. Card lands mid-stream at its own timestamp. |
| Card count exceeds 8 | UI shows all; only 8 most-recent are sent. Older cards visibly muted with "not in context" tag. |
| Annotation deleted from drawer while card is in thread | `activeCardIds` filtered against live `annotations` list before render. Stale ids drop silently. |
| Same annotation promoted twice from drawer (when promote-from-drawer ships) | Deduped on push (Set semantics). |
| Server POST fails | Existing patch-list `APPLY_FAILURE` path triggers. No new error path needed; the existing "(retry?)" pending-patch UI surfaces. |
| Mount/unmount race on `onCreated` | Guard with `mountedRef`; drop the push if unmounted. |
| Touch / mobile selection | Out of scope V1 (desktop only). |

## 8. Out of scope (deferred follow-ups)

- **Inline content tint** on the parent text where a span-anchored annotation lives (design doc §6.4 surfacing rule). Visual polish only; doesn't block the create-and-use loop.
- **Click-to-expand on the chat card** for inline body editing. V1 card is display-only; body editing stays in the notes drawer.
- **Card persistence across reload.** Pairs with A71.
- **Promote-from-drawer `+` action.** One-line addition; left out only because nothing in V1.2-E requires it.
- **Fuzzy reattach / drift handling.** Pairs with A72.
- **Touch / mobile selection.** Desktop only V1.
- **`snapshotText` as a separate column.** Currently `summary` carries this role for span-anchored notes. A future column could distinguish "snapshot of source" from "user-authored summary"; not required for the loop to work.

## 9. Verification stance

| Loop | Coverage |
|---|---|
| **F1** | `useTextSelection` (snapshot capture, multi-node range, scope filter); `<SelectionMenu>` (positioning, dismissal, button callbacks); `<ActiveCard>` (render variants, `[×]`); `<SideChatPopover>` (`threadItems` interleaving order). |
| **F2** | Highlight → `📝` → POST with `selection_start/end` → card in thread → next message includes `activeAnnotations`. Highlight → `💬` → next message includes `spanHint` (one-shot). Card `[×]` → next message omits that annotation. Form-created note → also lands as card without `selectionRange`. |
| **F3** | Selection menu keyboard reachability; card `[×]` reachable via tab; focus return on menu dismiss. |
| **F5** | One `📝` click → exactly one POST `/annotations`. Card dismiss → zero API calls. Drawer-promote (when added) → zero API calls. |
| **F7** | Manual: "highlight, save, ask, see it answer." "Three highlights, one question." |

**Inner loop:** `npm run fix` after each meaningful edit.
**Gate:** `npm run verify` before commit (check + test + build).

## 10. Risk register

| Risk | Mitigation |
|---|---|
| `indexOf` fragility on repeated phrases | Accepted V1 cost; silent degrade to item-level. |
| Active-cards persistence-on-reload missing | Documented as deferred to A71. Card UI is session-only by design. |
| Inline tint on the parent text not shipped | Documented as deferred. Notes drawer still surfaces the snippet. |
| Selection events on touch devices | Documented as out-of-scope. |
| Prompt cap of 8 may be wrong | Easy to tune. Logged as open question. |
| `onCreated` applier callback couples applier to side-chat session state | Callback is optional, defaults to no-op. Patch-list itself stays pure. |

## 11. Open questions

- **Cap of 8** — right number? Tune post-ship after observing real usage.
- **Card display order in prompt** — chronological (oldest first) vs reverse (newest first)? V1: chronological, matching the thread order. Revisit if model behavior suggests otherwise.
- **Body PATCH endpoint** — when the click-to-expand follow-up ships, do we add a new `PATCH /api/annotations/:id` route, or piggyback on a future patch-kind extension? Defer; not required by V1.2-E.

## 12. Traceability

- **Implements:** `memory/PLAN.md` Active 1 — Side-chat V1.2-E (floating selection menu).
- **Parent design:** `docs/design/SIDE_CHAT.md` §2 (Two entry modes), §6.4 (Class 4 — Annotate).
- **Reuses:** D132 (`PatchListProvider` events-as-internal-state), D133 (`annotation` table — `selection_start/end` already there).
- **Adds (relative to SIDE_CHAT.md):** the chat-context coupling — annotations as **active context cards** that participate in subsequent chat turns. SIDE_CHAT.md treats span context as a "prompting hint" only on the `💬 Chat` path; this design extends the model so the `📝` path produces a durable card that's also active context. Documented here as a small forward extension of §4 ("In-panel inline surfacing"), not a contradiction.
- **Defers to:** A71 (card persistence), A72 (fuzzy reattach + version pinning).
- **Bounded by:** D80 (no turn-tree branching), D89 (card-owned input), D113 (no second durable workflow model).
