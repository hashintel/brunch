<!-- CARDS.md — derivative execution queue for the active frontier item.
     Created by /ln-scope · Consumed by /ln-build · Reconciled by /ln-build.
     Delete when the queue is exhausted or any pending card needs re-scoping. -->

# Cards — Side-chat V1.1 polish (Card E split)

**Frontier item:** Side-chat V1 (`memory/PLAN.md` Active 1) — V1.1 vertical slice landed; this queue closes out the V1.1 polish that was originally tentatively grouped under "Card E" in the prior queue.
**Linear:** FE-656.
**Branch:** `ka/fe-656-side-chat`.
**Scope cards:** E1 (persistence), E2 (anchored positioning), E3 (error rendering). Each is independent — no card depends on the implementation findings of another.

---

## E1 — Lift `SideChatHost` to the spec-level route layout

**Status:** `done` — landed on `ka/fe-656-side-chat` (uncommitted). `<SideChatHost>` moved from `graph.tsx` to `route.tsx`, wrapping the `<Outlet />`. Existing structured-list-view tests (which wrap explicitly) and the wider 687-test suite all pass; verify clean.
**Weight:** light

### Objective

Move the `SideChatHost` mount from `graph.tsx` up to `src/client/routes/specification/$id/route.tsx` so an open side-chat session survives in-spec navigation (e.g. graph → grounding → graph round-trip).

### Acceptance Criteria

- ✓ The `<SideChatHost>` wrap moves from `graph.tsx` to the spec workspace layout (`route.tsx`), wrapping the `<Outlet />`. `graph.tsx` no longer mounts the host directly.
- ✓ Existing structured-list-view tests that rely on `<SideChatHost>` wrapping continue to pass unchanged (they wrap explicitly via the test helper).
- ✓ `npm run verify` green.
- ✓ Manual smoke: open the side-chat from a row in graph view, navigate to a phase route via the sidebar, navigate back to graph — the popover and message log are still mounted with the same pinned item.

### Verification Approach

- **Inner**: `npm run verify`. The existing structured-list-view tests already use `<SideChatHost>` wrapping at the test boundary; they keep passing.
- **Outer**: manual smoke (graph → grounding → graph round-trip preserves session). Defer F7 dramaturgical walkthrough until V1.2 lands.

### Files (likely)

- `src/client/routes/specification/$id/route.tsx` — wrap the `<Outlet />` in `<SideChatHost specificationId={specificationState.specification.id}>`.
- `src/client/routes/specification/$id/graph.tsx` — drop the `<SideChatHost>` wrap; render the structured list directly.

### Promotion checklist

- [ ] Changes a requirement? — No
- [ ] Creates / retires an assumption? — No
- [ ] Reverses a design decision? — No (matches design doc §2 "Persistence: the panel persists for the spec session")
- [ ] New seam-level invariant? — No
- [ ] Crosses > 2 major seams? — No (route layout placement only)
- [ ] First touch in unfamiliar seam? — No

---

## E2 — Anchor the popover as a fixed top-right corner panel per design doc §11.5

**Status:** `done` — landed on `ka/fe-656-side-chat` (uncommitted). `SideChatPopover` dialog now uses `fixed top-4 right-4 z-50 w-[360px]` corner-anchored positioning with `data-side-chat-anchor="top-right"`, plus shadcn-token visual treatment (border-rule, bg-background/95 + backdrop-blur, rounded-2xl, shadow-xl, ring-1 foreground/5). Message rows align user-right / assistant-left; close button absolutely positioned top-right inside the dialog. Row-anchoring deferred to V2/V3 per design doc §11.5. 62/62 popover + structured-list-view tests pass.
**Weight:** light

### Objective

Position the `SideChatPopover` as a fixed ~360px corner panel anchored to the top-right of the spec view (per `docs/design/SIDE_CHAT.md` §11.5), rather than rendering inline as a sibling of the structured list. Row-anchoring (popover follows the clicked row through scroll) is explicitly deferred — V1 ships the corner-panel form.

### Acceptance Criteria

- ✓ The popover renders as a fixed-position container in the top-right of the spec view, ~360px wide, with the design doc §11.5 visual treatment (rounded 16px outer, white-tint backdrop, brand-halo border) — to the extent CSS variables and brand tokens already in the project support it; new design tokens are out of scope.
- ✓ The popover does not move when the user scrolls the structured list.
- ✓ Existing popover tests continue to pass; no test asserts the popover is a row sibling.
- ✓ `npm run verify` green.

### Verification Approach

- **Inner**: existing component tests on `SideChatPopover` and `StructuredListView` continue to pass.
- **Outer**: manual smoke — click chat-with on a row at the bottom of a long list, confirm the popover appears in the top-right corner regardless of scroll position. F7 walkthrough deferred to V1.2.

### Files (likely)

- `src/client/components/side-chat-popover.tsx` — apply the fixed-position styling on the dialog container.

### Promotion checklist

- [ ] Changes a requirement? — No
- [ ] Creates / retires an assumption? — No
- [ ] Reverses a design decision? — Borderline: the original tentative card said "popover anchored to the row + tracks scroll". The design doc says corner-panel. **This card explicitly chooses the design-doc reading and defers row-anchoring to V2/V3.** Document this resolution inline; SPEC.md does not need a new entry because design-doc §11.5 is already authoritative.
- [ ] New seam-level invariant? — No
- [ ] Crosses > 2 major seams? — No (CSS only)
- [ ] First touch in unfamiliar seam? — No

---

## E3 — Render side-chat errors in the message log

**Status:** `done` — landed on `ka/fe-656-side-chat` (uncommitted). `SideChatMessage` gained `error?: true`; popover renders error rows with red-50 background + red-900 text + red-200 ring + `data-message-error="true"`. `SideChatHost`'s catch block now replaces the pending row with an error-flagged assistant message ("Something went wrong — try again.") via a new `failPending` helper, clears the pending flag, and re-enables sending. 65/65 popover + structured-list-view tests pass; full verify clean (690 tests, +3 from E3).
**Weight:** light

### Objective

When `streamSideChatResponse` rejects (network failure, 4xx, or 5xx), `SideChatHost` surfaces a visible error message in the popover instead of silently dropping the partial response. The user can dismiss and retry on the next submission.

### Acceptance Criteria

- ✓ `SideChatMessage` gains an optional `error?: true` flag. The popover renders error-flagged messages with distinct visual treatment (e.g. muted-red background; a generic "Something went wrong — try again." text or a more specific message when available from the rejection error).
- ✓ When `streamSideChatResponse` rejects, `SideChatHost` finalizes the pending assistant row by replacing it with an error-flagged message (or appending one if no pending row exists), then clears the pending state.
- ✓ The send button re-enables after an error so the user can retry.
- ✓ Component tests cover: error message rendered when stream rejects; send button re-enables after the error; pending flag cleared.
- ✓ `npm run verify` green.

### Verification Approach

- **Inner**: extend `side-chat-popover.test.tsx` (renders error-flagged message). Extend `structured-list-view.test.tsx` (mock `streamSideChatResponse` to reject; assert the dialog shows an error and re-enables sending).

### Files (likely)

- `src/client/components/side-chat-popover.tsx` — extend `SideChatMessage` with `error?: true`; render error rows with a distinct treatment and `data-message-error="true"`.
- `src/client/components/__tests__/side-chat-popover.test.tsx` — add coverage for the error-flagged render path.
- `src/client/components/side-chat-host.tsx` — in the `catch` block, replace the pending row with an error-flagged message instead of silently dropping.
- `src/client/routes/specification/$id/__tests__/structured-list-view.test.tsx` — add a stream-rejection test that verifies the error renders and send re-enables.

### Promotion checklist

- [ ] Changes a requirement? — No
- [ ] Creates / retires an assumption? — No
- [ ] Reverses a design decision? — No (implements error handling that V1 should have had)
- [ ] New seam-level invariant? — No
- [ ] Crosses > 2 major seams? — No (popover view + host orchestration)
- [ ] First touch in unfamiliar seam? — No

---

## Queue discipline

- E1, E2, E3 are independent. Build in any order; the recommended order is the listed one (persistence → positioning → error UX) because each is progressively more visible-by-itself in manual smoke.
- If any card promotes (e.g. E2's row-anchoring defer needs to be reversed), stop the queue and route through `/ln-spec` or `/ln-plan` first.
- Delete `memory/CARDS.md` when the queue is exhausted (V1.1 polish complete) or when V1.2 (Annotate) opens a new queue.
- V1.2 (Annotate — Class 4 from the design doc) is **out of scope** for this queue and stays unscoped here; it needs `/ln-plan` to break it into its own card family.
