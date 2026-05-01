<!-- REFACTOR.md — temporary derivative aid for one in-flight refactor.
     Created by /ln-refactor · Consumed by /ln-build · Delete on completion. -->

# Refactor — Side-chat session boundary cleanup

**Source review:** ln-review pass on 2026-05-01 covering Cards A–D of FE-656.
**Branch:** `ka/fe-656-side-chat`.
**Scope:** Bundles findings #1, #2, #4 from the review. Behavior-preserving structural refactor — the 26 existing tests across stream / popover / structured-list-view must keep passing (with shape adjustments, not new behavior).

## Problem Statement

Three coupled symptoms make the V1.1 side-chat code harder than it needs to be to read, change, and grow into Card E:

- **`StructuredListView` is two modules glued together.** A 651-line file mixes graph projection, relations rendering, and side-chat session orchestration. The streaming-state machine, the imperative fetch driver, and the popover mount are unrelated to "render a structured list of knowledge items" but live in the same file and same component scope.
- **`SideChatPopover` allows type-system-meaningless states.** `messages: SideChatMessage[]` and `pendingAssistantText: string | null` are parallel sources of truth for "what assistant text is in the log right now". The current call site happens to keep them consistent, but the types don't enforce it; a future change could end up with both populated without the compiler flagging it.
- **`StructuredListView` has an "almost-active" mode.** `specificationId?: number` plus a derived `onChatWith?` lets a caller wire the prop without realizing rows still render disabled placeholders if any link in the derivation chain is missed. Activation is encoded as a mutable optional-prop graph instead of as a structural fact.

These three are entangled. Extracting the session orchestration out of `StructuredListView` (#1) is the natural place to enforce a single source of truth for messages (#2) and to move the activation gate into a tree-mount fact rather than a derived prop (#3). Splitting the work would create awkward intermediate states where the gate lives in two places at once.

## Solution

A new tree-level boundary owns the side-chat session; the structured list goes back to being just a list.

- **A `SideChatHost` component** wraps any subtree that should be able to launch the side-chat. The host accepts `specificationId` (required) plus `children`, owns the active-session state, performs the streaming side-effect, and renders the popover. It exposes an `openFor(item)` callback to descendants through React context.
- **A `useSideChat()` hook** lets descendant components read the context. Returns the open callback when wrapped in a host; returns `null` otherwise. The chat-with button on each row consults this hook: present and not-null → active; absent or null → disabled placeholder.
- **`SideChatPopover` carries one source of truth for the message log.** `SideChatMessage` gains an optional `pending?: true` flag. The host appends a pending assistant message on submit, mutates its text as deltas arrive, and clears the flag (or replaces the message) when the stream finishes. The `pendingAssistantText` prop disappears.
- **`StructuredListView` no longer takes `specificationId` or knows about the side-chat at all.** Its row buttons read `useSideChat()` and behave accordingly. Activation is whether a `SideChatHost` ancestor exists, full stop.
- **`graph.tsx` wraps `<StructuredListView>` in `<SideChatHost specificationId={…}>`.** This is the only call site that activates the side-chat in V1.1.

This shape leaves Card E (persistence, scroll-anchoring, error states) inside a single ~150-line module instead of further bloating `StructuredListView`.

## Commits

Each leaves the codebase working and `npm run verify` green.

1. **Collapse `pendingAssistantText` into the messages array via a `pending` flag on each message.** ✅ **Done (uncommitted).** `SideChatMessage` gained optional `pending?: true`; `SideChatPopover` dropped the `pendingAssistantText` prop and now derives `isStreaming` from `messages.some(m => m.pending)`. `StructuredListView`'s orchestration appends a pending assistant message on submit, mutates its text on each delta via a `replacePendingText` helper, and clears the pending flag (or drops empty pending messages) on stream completion via a `finalizePending` helper. 22/22 popover tests + 40/40 structured-list-view tests pass; full `npm run verify` clean (687 tests).

2. **Extract a side-chat host + descendant-context hook, drop side-chat ownership from `StructuredListView`, and wire the host at the graph route.** The host owns the session state, the streaming side-effect, and the popover render. The chat-with row button consults the descendant hook to decide whether it is active. `StructuredListView` loses its `specificationId` prop, its `ActiveSideChat` state, its `submitSideChatMessage` orchestration, and its inline popover render. `graph.tsx` wraps the view in the host. Existing tests that exercised the active-button behavior wrap render in the host; tests that asserted the placeholder render the bare view unwrapped.

## Decisions

- **Host as component, not just a hook.** A component with children + context is preferred over a callable hook because the activation signal is naturally a tree-mount question, not a state-ownership decision the caller has to remember to wire. Two callers (graph view today, continuous workspace later) both want "wherever you mount this subtree, side-chat is launchable" — that is what JSX context expresses cleanly.
- **Single-message-list state model with a `pending` flag.** Chosen over a discriminated union (`{kind: 'idle' | 'streaming'}`) because the popover's render is "list of messages, the last one may be pending" — a flag on the leaf is the smaller representation. The streaming-vs-idle distinction is internal to the host (it cares whether a stream is in flight to disable submit); the popover doesn't need to know.
- **Activation gate is "is there a host ancestor", not a prop.** This makes invalid states unrepresentable: rows are either inside a host (chat-with active) or outside (placeholder). No third path.
- **Host renders the popover.** Keeps the popover and the session machinery co-located. Card E can extend the host's render to add error banners or toasts without touching the list view.
- **No new SPEC.md durable change.** This is structural refactor inside the V1 surface. The lexicon term `side-chat` already covers the host/popover pair as one user-facing concept.

## Testing Decisions

- **Behavior-focused tests survive.** The 26 existing tests assert: button enabled/disabled, popover mounts on click, fetch called with the right body, deltas render incrementally, stream completion finalizes the message. None of these depend on state living in `StructuredListView` — they depend on the rendered DOM and the fetch mock. Tests adjust at the wrap-in-`<SideChatHost>` boundary, not in their assertions.
- **One new test family worth adding incidentally:** that `StructuredListView` rendered *without* a `SideChatHost` ancestor still produces the placeholder behavior (currently asserted as "no `specificationId` prop"). After the refactor the assertion becomes "no host ancestor" — same intent, cleaner expression.
- **Prior art:** `useSimpleStore` and `useStringStateMachine` in `src/client/hooks/` are the existing pattern for hook-shaped state owners. The host-component-with-context pattern matches how `Collapsible` (radix) and tanstack-query providers wrap subtrees in this codebase.
- **Coverage gates remain `npm run verify` (lint + typecheck + tests + build) at every commit boundary.** No new oracles are introduced; the refactor is below the inner-loop bar that would warrant any.

## Out of Scope

- Anchoring the popover to a specific row in the DOM (Card E).
- Persistence of the side-chat across in-spec navigation (Card E).
- Error rendering UX for failed requests (Card E).
- Bundle-size or build-boundary considerations (already absorbed in Card D's timeout bump).
- Any change to the server side-chat route, the prompt builder, or the SSE wire format.
- Splitting `SideChatMessage` further (e.g. a separate `pending` discriminator) — deferred until V2 introduces patch kinds that need richer message subtyping.
