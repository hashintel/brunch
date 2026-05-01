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

**Status:** `done` — landed on `ka/fe-656-side-chat` (uncommitted). Tests: 10 unit tests in `src/server/side-chat-prompt.test.ts`. `npm run verify` green.
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

**Status:** `done` — landed on `ka/fe-656-side-chat` (uncommitted). 11 supertest cases in `src/server/side-chat-route.test.ts` covering all ACs (404 spec/item, 400 validation, 200 SSE streaming, zero-turn delta, zero observer invocations). `npm run verify` green. **D113 invariant promotion not needed** — the route never enters the chat / observer paths, so zero-turns is a structural consequence rather than a new seam-level invariant on top of D113.
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

**Status:** `done` — landed on `ka/fe-656-side-chat` (uncommitted). 13 component tests in `src/client/components/__tests__/side-chat-popover.test.tsx` covering pinned-item header, empty message log, send-button disabled state, X / Esc / click-outside dismiss, focus-on-mount, and forward / backward Tab focus trap. `npm run verify` green.
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

**Status:** `done` — landed on `ka/fe-656-side-chat` (uncommitted). 6 unit tests on the SSE parser, 4 fetch+stream helper tests, 9 extended popover prop tests, and 6 router-integrated tests in `structured-list-view.test.tsx` (active button, popover mount, single-popover swap, fetch args, streaming render, finalize-and-resume). `npm run verify` green (687 tests). Build-boundary test timeout bumped from 30s → 60s — under suite load, two back-to-back real Vite builds were exceeding 30s with the new files.
**Weight:** light

### Objective

Activate the disabled `chat-with` button in `-structured-list-view.tsx:399` so a user can click it on any item row, send a message in the side-chat popover, and watch the streaming response materialize in the popover's message log.

### Acceptance Criteria

- ✓ Clicking the `chat-with` button on an item row enables the previously-disabled placeholder and mounts `SideChatPopover` with that row's `referenceCode`, `content`, and `(itemKind, itemId)` pinned as context.
- ✓ Submitting a message (Enter or send-button click) posts `{ itemKind, itemId, message }` to `POST /api/specifications/:id/side-chat` exactly once.
- ✓ The SSE chunks stream into the popover's message log incrementally, materializing as one assistant message; the user's submitted message also appears in the log above it.
- ✓ While streaming is in-flight, the send button is disabled and a new submission cannot start until the previous one completes.
- ✓ At most one popover is open at a time; clicking `chat-with` on a different row while a popover is open swaps the pinned item to the new row.
- ✓ Dismissing the popover (X / Esc / click-outside) returns the action rail to its idle state. The next mount on the same row starts with an empty message log (V1 per-mount; persistence is Card E).

### Verification Approach

- **Inner**: F1 component tests on `SideChatPopover` extended with `messages: { role, text }[]` + `pendingAssistantText: string | null` + `onSubmit(message)` props. Plus a unit test on the SSE-line parser helper.
- **Middle**: F2 router-integrated test that mounts `StructuredListView`, mocks `fetch` with a stub `Response` whose `body` is a `ReadableStream` of side-chat SSE chunks, clicks `chat-with`, types a message, submits, and asserts the chunks render incrementally and exactly one POST to `/api/specifications/:id/side-chat` was issued.
- **Outer**: deferred — manual smoke via the dev server suffices for D alone; F7 dramaturgical walkthrough joins after E.

### Files (likely)

- `src/client/components/side-chat-popover.tsx` — extend skeleton to render `messages` + `pendingAssistantText` and call `onSubmit` on Enter / send click.
- `src/client/components/__tests__/side-chat-popover.test.tsx` — extend with prop coverage.
- `src/client/lib/side-chat-stream.ts` (new) — SSE chunk parser plus a `streamSideChatResponse({ specificationId, itemKind, itemId, message, signal }, onChunk)` async helper using `fetch` + `ReadableStream`.
- `src/client/lib/__tests__/side-chat-stream.test.ts` (new) — unit tests on parser + helper.
- `src/client/routes/specification/$id/-structured-list-view.tsx` — replace the disabled placeholder with an active button. Mount `SideChatPopover` for the active row using local state inside `StructuredListView`.
- `src/client/routes/specification/$id/__tests__/structured-list-view.test.tsx` — replace the "disabled chat-with placeholder" expectation with active-button + mounted-popover + streaming-response coverage.

### Promotion checklist

- [ ] Changes a requirement? — No
- [ ] Creates / retires an assumption? — No
- [ ] Reverses a design decision? — No (D130, D131 cover; this implements)
- [ ] New seam-level invariant? — No (D113 zero-turns/zero-observer is preserved by Card B's route shape and is unaffected by client wiring)
- [ ] Crosses > 2 major seams? — No (UI + existing transport seam)
- [ ] First touch in unfamiliar seam? — No (extends A/B/C)

### Open implementation note

V1 panel state is per-mount: the message log resets when the popover closes. Persistence across navigation (Card E) and re-anchoring on scroll are deferred.

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

- A, B, C are done. D is now scoped and ready to build.
- E remains `tentative` — re-run `/ln-scope` on it after D lands; its persistence-layer choice and error-rendering UX still depend on D's realized event flow.
- If D promotes (e.g., the proposed seam-level invariant about server-canonical item identity firms up under implementation), stop and update `memory/SPEC.md` before continuing.
- Delete `memory/CARDS.md` when V1.1 is fully shipped.
