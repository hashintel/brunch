<!-- CARDS.md — derivative execution queue for the active frontier item.
     Created by /ln-scope · Consumed by /ln-build · Reconciled by /ln-build.
     Delete when the queue is exhausted or any pending card needs re-scoping. -->

# Cards — Side-chat V1.1 execution queue

**Frontier item:** Side-chat V1 (`memory/PLAN.md` Next 4) — panel surface + Explore + Annotate.
**Linear:** FE-656.
**Branch:** `ka/fe-656-side-chat`.
**Scope card:** V1.1 (panel + button entry + Class 1 Explore) per the `/ln-scope` pass on 2026-04-30.

The single V1.1 scope card decomposes inside-out into the queue below. Cards A, B, C are pre-scopable independently; cards D and E are listed as tentative anchors and will be re-scoped after A–C land because their realized shape depends on those.

---

## A — Side-chat prompt builder (functional core)

**Status:** `next`
**Weight:** light

### Objective

A pure function `buildSideChatPrompt(item, message, specContext)` returns the Anthropic-API-shaped messages payload that biases the model to discuss the pinned item against the spec's grounding context, without injecting interviewer phase-specific tone.

### Acceptance Criteria

- ✓ Returns a system message naming the side-chat role plus a user message containing the item's `referenceCode` and content.
- ✓ Includes item rationale when present; omits it when null.
- ✓ Includes spec name + grounding summary as background context, not as primary focus.
- ✓ Does not include interviewer phase-stage instructions ("you're conducting grounding", etc.).

### Verification Approach

- Inner: unit tests under `src/server/__tests__/` (mirror the existing test framework convention).

### Files (likely)

- `src/server/side-chat-prompt.ts`
- `src/server/__tests__/side-chat-prompt.test.ts`

### Promotion checklist

- [ ] Changes a requirement? — No
- [ ] Creates / retires an assumption? — No
- [ ] Reverses a design decision? — No
- [ ] New seam-level invariant? — No
- [ ] Crosses > 2 major seams? — No
- [ ] First touch in unfamiliar seam? — Yes (first side-chat code; reference the main interview's prompt-builder before starting)
- [ ] Cannot name containing seam from live docs? — No (covered in `docs/design/SIDE_CHAT.md` §6.1, §11)

---

## B — Side-chat backend endpoint (thin I/O shell)

**Status:** `next` — depends on A
**Weight:** light

### Objective

`POST /api/specifications/:id/side-chat` accepts `{ itemKind, itemId, message }`, builds the prompt via card A, streams an Anthropic completion as SSE, and adds **zero** rows to `specification_turns` and triggers **zero** observer captures.

### Acceptance Criteria

- ✓ 404 when specification not found.
- ✓ 404 when `(itemKind, itemId)` doesn't resolve to an item in the spec.
- ✓ 200 with `text/event-stream` for a valid request; chunks stream incrementally.
- ✓ Turn-count delta on `specification_turns` is 0 across a complete request lifecycle (D113 invariant).
- ✓ Observer invocation count is 0 across a complete request lifecycle.

### Verification Approach

- Inner: integration tests against a seeded test DB; assert turn-count delta and observer invocation count.

### Files (likely)

- `src/server/routes/side-chat.ts` (or wired into existing route registration)
- `src/server/__tests__/side-chat-route.test.ts`

### Promotion checklist

- [ ] Changes a requirement? — No
- [ ] Creates / retires an assumption? — No
- [ ] Reverses a design decision? — No (D130, D131 cover; this implements)
- [ ] New seam-level invariant? — **Maybe** — "side-chat exchanges write zero turns and trigger zero observer captures" is a new seam-level invariant if the test passes. **If the assertion is non-trivial to enforce or surfaces hidden coupling, promote and document the invariant in SPEC.md before merging.**
- [ ] Crosses > 2 major seams? — No (route + LLM + DB-read)
- [ ] First touch in unfamiliar seam? — Yes (first SSE on a non-interview path)

---

## C — SideChatPopover component (frontend skeleton)

**Status:** `next` — independent of A and B; can run in parallel
**Weight:** light

### Objective

A new `SideChatPopover` React component renders an empty popover anchored to a row, with a pinned-context header, message input, send button (no-op), and dismiss controls (X, Esc, click-outside).

### Acceptance Criteria

- ✓ Renders with a `pinnedItem` prop showing `referenceCode` and content.
- ✓ Renders an empty message list area.
- ✓ Send button disabled when input is empty.
- ✓ X click, Esc key, and click-outside each fire `onDismiss`.
- ✓ Keyboard focus trap while open; first focusable element is the message input.

### Verification Approach

- Inner: component tests under `src/client/components/__tests__/`.
- Outer: F3 a11y review on rendered popover (focus trap, ARIA labels).

### Files (likely)

- `src/client/components/side-chat-popover.tsx`
- `src/client/components/__tests__/side-chat-popover.test.tsx`

### Promotion checklist

All `no` except first-touch in unfamiliar seam (which is fine — new component, follows existing patterns).

---

## D — End-to-end wiring (graph view → popover → endpoint → response)

**Status:** `tentative` — scope after A, B, C land
**Weight:** light

### Tentative objective

Activate the disabled `chat-with` button in `-structured-list-view.tsx:417`. On click, mount `SideChatPopover` anchored to the row, post the user's message to `/api/specifications/:id/side-chat`, and render the streaming response in the popover message list.

### Why tentative

Final shape depends on:
- The streaming render surface produced by card C (whether the popover ingests SSE chunks via a hook, prop, or context).
- The exact item-context shape passed into the endpoint (driven by card A's prompt structure).

Re-scope after A–C land.

---

## E — Persistence + anchoring + error states (polish)

**Status:** `tentative` — scope after D lands
**Weight:** light

### Tentative objective

- Panel persists across navigation within `/specification/$id/*`.
- Popover re-anchors when the user scrolls the structured list (existing `data-graph-row-ref` attribute is the anchor key).
- Error states (network failure, validation 4xx, model error) render in the popover without crashing.

### Why tentative

Persistence layer choice (route-level state vs app-shell state) and error-rendering UX depend on D's realized event flow.

---

## Queue discipline

- A, B, C are independent. Build in any order; parallelize if dispatching multiple agents.
- D and E are not yet pre-scopable — re-run `/ln-scope` on each before building.
- If any card promotes (especially B's D113-isolation invariant), stop the serial loop and update `memory/SPEC.md` before continuing.
- Delete `memory/CARDS.md` when V1.1 is fully shipped, or when D/E need re-scoping triggers a refresh.
