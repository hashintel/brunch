# Pi UI Extension Patterns — Offer-First Custom UI Working Plan

This file is a trimmed working inventory for the remaining FE-744 gap. It is not canonical product contract; durable conclusions belong in `memory/SPEC.md`, `memory/PLAN.md`, and `docs/architecture/pi-ui-extension-patterns.md`.

## Why this is still live

Command containment, Brunch chrome, startup no-resume, and `/brunch-workspace` are proven enough for now. The unresolved POC seam is different:

> Brunch sessions must work offer-first: a system/assistant-originated structured offer should act like the assistant turn, render as custom UI in place of the default input surface, and persist the user's structured response before the next agent turn.

This is not generic UI polish. It is the mechanism behind elicitation-first sessions, typed responses, review-cycle decisions, and fixture-controllable prompt/response exchanges.

## Pi evidence already relevant

- `docs/usage.md`: the editor can be replaced temporarily by built-in UI or custom extension UI.
- `docs/tui.md`: `ctx.ui.custom<T>()` can replace the editor area with a custom component and return typed data; overlays are optional, not required.
- `docs/tui.md` Pattern 7: `ctx.ui.setEditorComponent()` can replace the main input editor with a custom editor implementation.
- `examples/extensions/question.ts`: single-choice options plus a "Type something" escape hatch using `ctx.ui.custom()` and `Editor`.
- `examples/extensions/questionnaire.ts`: multi-question/tabbed choice UI with optional custom text answers.
- `examples/extensions/message-renderer.ts`: `registerMessageRenderer()` displays custom messages, but display rendering alone does not collect a response.
- `docs/rpc.md` / extension docs: `ctx.ui.custom()` is TUI-only/degraded in RPC, so semantic pending-offer state must have an RPC/web response path independent of the TUI component.

## Target seam to prove

### Offer-first custom interaction loop

1. Brunch appends or sends a structured custom message/entry representing an unresolved offer, for example `brunch.offer` / `brunch.establishment_offer` / `brunch.review_set_proposal`.
2. The custom entry is visible in the transcript through a message renderer or transcript row.
3. While that offer is unresolved, Brunch replaces the default input surface with an offer-response UI.
4. The response UI supports the POC interaction kernel:
   - single-choice selection,
   - multi-choice selection,
   - optional freeform additional input,
   - cancel/skip where allowed.
5. The user's response is persisted as a structured custom entry, not just returned from ephemeral UI.
6. The response either triggers the next agent turn or is available to `prepareNextTurn` / the next prompt path as the user's response to the offer.
7. RPC/web answer the same semantic pending offer through product methods or supported dialog fallbacks; they do not depend on TUI-only `ctx.ui.custom()`.

## Active slice candidate

**Name:** Offer-first custom UI loop

**Goal:** Prove that a transcript-native unresolved offer can replace ambient free input with a typed custom response surface and persist the response as session truth.

**Likely implementation shape:**

- Define a minimal offer payload type with `id`, `lens`, prompt text, response mode (`single | multiple | freeform-plus-choice`), options, and response policy.
- Add a Brunch-owned TUI helper, e.g. `requestOfferResponse(ctx, offer)`, modeled on Pi's `question.ts` / `questionnaire.ts` examples.
- Add a renderer for the offer custom entry so the assistant/system offer appears as the current prompt in transcript history.
- Add response persistence as a Brunch custom entry, e.g. `brunch.offer_response`, tied to the offer id.
- For RPC/fixture paths, expose a product method or supported built-in dialog fallback that submits the same response payload.

**Acceptance:**

- A fixture/demo session can start with no ambient user prompt and present an assistant/system offer first.
- The default freeform editor is replaced while the offer is pending.
- The user can choose one option, choose multiple options, or choose/type optional additional text depending on offer mode.
- The response persists in Pi JSONL as a structured Brunch custom entry linked to the offer id.
- Elicitation exchange projection treats the offer entry as the prompt side and the response entry as the response side.
- RPC/fixture driver can answer the offer through a semantic path even if rich TUI custom UI is unavailable.
- No graph mutation or review acceptance bypasses `CommandExecutor`; this slice proves interaction capture, not graph writes.

## Residual catalog still carried forward

| Need | Status after current evidence | Carry-forward |
| --- | --- | --- |
| Single-choice offer UI | Pi example-proven; Brunch offer loop not yet proven | Active slice |
| Multi-choice offer UI | Pi example can be adapted; Brunch semantics not yet proven | Active slice or immediate follow-up |
| Freeform-plus-choice | Pi `question.ts` proves the pattern | Active slice |
| Structured offer custom entries | Transcript/persistence model exists; offer-response loop not yet wired | Active slice |
| Message rendering for offers | Pi `message-renderer.ts` proves display; response collection is separate | Active slice |
| Review-set approve/request/reject | Depends on offer-response loop | M5 follow-up when `acceptReviewSet` exists |
| Establishment-offer orientation expansion | Depends on offer-response loop; must remain user-invoked, not default exhaustive menu | M5/M7 follow-up |
| RPC controllability | `ctx.ui.custom()` gap is known | Active slice must provide semantic response path |
| Mouse-clickable action buttons | Unproven and not required for POC if keyboard navigation works | Defer |
| Strict built-in command suppression | Requires Pi command/keybinding policy | Separate follow-up, not this slice |

## Open questions

- Should the first offer UI use transient `ctx.ui.custom()` only, or should Brunch replace the editor component while a pending offer exists and restore it after response?
- Which custom entry name is canonical for generic responses: `brunch.offer_response`, `brunch.elicitation_response`, or a more specific family?
- Does submitting an offer response call `pi.sendUserMessage()` with a textual summary, append a context-participating custom message, or both?
- How much of the offer is visible to the LLM as structured context versus displayed only to the user?
- What is the thinnest RPC method family for pending-offer discovery and response submission?

## Retirement rule

Retire this file only after the offer-first custom UI loop is either implemented and reconciled into `docs/architecture/pi-ui-extension-patterns.md` / SPEC / PLAN, or intentionally moved into a named M5 frontier slice. Do not delete it merely because command containment or chrome work is complete.
