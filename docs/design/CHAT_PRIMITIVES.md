# Chat Infrastructure — AI Primitives & Component Map

> Snapshot of the FE-716 chat surface as it sits on `ka/fe-716-chat-runtime-unified-secondary-chats`. Companion to `UNIFIED_CHAT_UX.md` (design ceiling) and `CONVERSATIONAL_WORKSPACE_RUNTIME.md` (substrate). This doc names *what is wired today*, not what is planned.

## Overview

The chat surface is a **unified shell** that hosts secondary chats over the existing `chat`/`turn` substrate. AI-SDK primitives drive streaming and message shape; ai-elements primitives drive the visual conversation surface; brunch-owned components wrap them with domain affordances (anchored items, mode toggle, patch staging, reconciliation panel, switcher, layout modes).

No `thread` table — secondary chats are projected from `chat.parent_chat_id IS NOT NULL`.

## AI primitives in use

### `@ai-sdk/react` — message + streaming substrate

| Primitive | Where | Why |
|---|---|---|
| `useChat<BrunchUIMessage>` | `secondary-chat-host.tsx` | Per-chat message state + SSE streaming + tool-call routing. Mirrors the interview spine's wiring. |
| `BrunchUIMessage` / `BrunchUIMessagePart` | `src/shared/ui-messages.ts` | Typed message envelope with brunch-specific data parts (`propose_edit`, `propose_edge`, etc.) |

### `ai-elements/*` — vendored visual primitives

| Primitive | Where | Role |
|---|---|---|
| `<Conversation>` + `<ConversationContent>` | `secondary-chat-collapsible.tsx` | Outer scroller for the message list |
| `<Message>` + `<MessageContent>` + `<MessageResponse>` | `secondary-chat-collapsible.tsx` | Per-turn rendering with streamdown markdown |
| `<PromptInput>` (and slot family) | `secondary-chat-collapsible.tsx` | Composer; mode chip lives in leading-edge tools slot |
| `<Reasoning>` + `<ReasoningTrigger>` + `<ReasoningContent>` | `secondary-chat-collapsible.tsx` | Streaming live-state (typing indicator + thinking) |
| `<Task>` + `<TaskTrigger>` + `<TaskContent>` + `<TaskItem>` | `chat-shell-patch-panel.tsx` (C29) | Collapsible patch list with `isRunning` auto-open/close |
| `<Shimmer>` | `secondary-chat-collapsible.tsx` (and patch panel for new-patch pulse) | Loading/streaming visual without bespoke motion |

### Other libraries

| Lib | Where |
|---|---|
| `motion` (Framer Motion v12) | `<UnifiedChatShell>`, `<SecondaryChatCollapsible>` — springs + AnimatePresence |
| `streamdown` | Markdown rendering inside `<MessageResponse>` |
| `cmdk` / Radix `Combobox` | `secondary-chat-mention-popup.tsx` — `#REF-CODE` autocomplete |
| `lucide-react` | Kind chips, layout buttons, switcher icons |
| `@ai-sdk/anthropic` | Server-side provider in `secondary-chat-route.ts` |

## Brunch-owned components

### Shell

| Component | Role |
|---|---|
| `<UnifiedChatShell>` | Top-level chat surface; peer of `<ContinuousWorkspaceView>` |
| `<ChatShellLayout>` | Dispatches Compact / Resizable / Full layout containers |
| `<ChatShellPresenceProvider>` | Owns `appearance: 'expanded' | 'minimized' | 'closed'` + `focusedChatId` + `jumpToAnchor` |
| `<ChatSwitcher>` | Dropdown in shell header when 2+ item-anchored chats exist |
| `<ChatShellPatchPanel>` (C29) | Workspace-wide pending-changes surface inside the shell |

### Per-chat surface

| Component | Role |
|---|---|
| `<SecondaryChatHost>` | Mounts `useChat`; owns per-chat mutation + streaming hooks; reads presence |
| `<SecondaryChatCollapsible>` | Kickoff card + kind chip + mode toggle + composer + streaming assistant + jump-to-anchor + reconciliation panel |
| `<SecondaryChatComposer>` | Wraps `<PromptInput>`; mode chip in leading-edge tools slot; `#` mention popup trigger |
| `<SecondaryChatMentionPopup>` | `#REF-CODE` autocomplete chip UI |
| `<SecondaryChatSuggestions>` | Turn-zero static prompts keyed by `(mode, reconciliation-kind)` |

### Triggers + cross-cutting

| Component | Role |
|---|---|
| `<SecondaryChatTriggerProvider>` + `useSecondaryChatTrigger()` | One `create({ kind, id, spanHint?, reconciliationNeedId? })` call for all sites |
| `<ContentDiff>` | Line-level diff highlighting for `edit` patches (kept brunch-specific) |
| `<ImpactChip>` | Downstream-impact display on patch rows |

### Retired (deleted)

`<SideChatPopover>`, `<SideChatHost>` — replaced by the unified shell.

## Hooks

| Hook | Returns | Notes |
|---|---|---|
| `useSecondaryChatTrigger()` | `create()` callback | Trigger sites: `StructuredListView`, `PendingReviewSection` |
| `useChatLayoutMode(specId)` | `[mode, setMode]` | localStorage per spec; Esc-decrement; clamps legacy `'full'` to `'maximize'` |
| `useChatShellPresence()` | `{ appearance, expand, minimize, close, focusChat, jumpToAnchor }` | Null outside the provider |
| `usePrefersReducedMotion()` | `boolean` | Short-circuits springs to `duration: 0` |
| `usePatchList()` | Global staged slice | Used by `<ChatShellPatchPanel>` |
| `usePatchListForChat(chatId)` | Per-chat staged slice via `producerChatId` partition seam | Reserved for Track 3 reconciliation chats |
| `useCreateSecondaryChatMutation(specId)` | POST + bundle invalidate | Per-item dedupe via server-side `getOrCreateItemSecondaryChat` |
| `useSetSecondaryChatModeMutation(specId, chatId)` | PATCH + bundle invalidate | |

## Server-side primitives

| Module | Role |
|---|---|
| `secondary-chat-route.ts` | `POST /secondary-chats`, `PATCH …/mode`, `POST …/messages` (streaming SSE with `getSideChatTools(mode)` edit-tool gating) |
| `intent-item-resolver.ts` | Server-owned `#REF-CODE` resolver scoped to a specification |
| `specification-store.ts` | `createSecondaryChat`, `getOrCreateItemSecondaryChat`, `appendSecondaryChatTurn`, `setSecondaryChatMode`, `listSecondaryChatsForSpecification` |

## Topology

```
SpecificationRoute
├── SecondaryChatTriggerProvider
├── ChatShellPresenceProvider
├── PatchListProvider                      ← global event log
│   ├── ChatShellLayout (Compact | Resizable | Full)
│   │   ├── WorkspaceCenter (transcript + composer for primary chat)
│   │   └── UnifiedChatShell
│   │       ├── ChatShellPatchPanel        ← usePatchList() (union)
│   │       ├── ChatSwitcher               ← when 2+ chats
│   │       └── SecondaryChatHost (active chat only)
│   │           ├── useChat<BrunchUIMessage>
│   │           └── SecondaryChatCollapsible
│   │               ├── Conversation > Message[]
│   │               ├── Reasoning (streaming)
│   │               ├── SecondaryChatSuggestions (turn-zero)
│   │               └── PromptInput (composer + mode chip + # mentions)
│   └── PatchListOverlay                   ← canonical workspace overlay (hidden by C29; code retained)
```

## Mental model

- **One shell per spec** mounts on both `_view/route.tsx` and `graph.tsx`.
- **One chat shown at a time** in the shell; switcher dropdown when multiple.
- **One `useChat` mount per active chat** — typed via `BrunchUIMessage`.
- **Patches are workspace-wide, not per-chat** — the in-chat panel reads the union via `usePatchList()`; `producerChatId` partition seam stays in the reducer for future Track 3 use.
- **Mode is a chat property, not a turn property** — Edit gates edit tools; Ask is read-only.
- **`#REF-CODE` is the only mention symbol wired today** — `$` (chats) and `!` (annotations) are deferred to Track 5 (`chat-context-provision`).
- **Anchored items dedupe** — clicking the same item twice re-opens the existing chat; clicking a different item creates a new one.

## What's deliberately not here yet

- `$` secondary-chat mentions + `!` annotation mentions
- Durable `thread_context_item` snapshot rows (Track 5)
- Changeset-backed patch provenance (FE-701)
- Reconciliation classifier states + target-grouped UX (Track 3)
- LLM-generated context-aware suggestions (V1 is static-per-mode)
- Hybrid pill for minimize/close states (C29 follow-up in the parking lot)

See `memory/PLAN.md` for sequencing of the above.
