# Pi UI Extension Patterns — Structured Elicitation Working Plan

This file is a trimmed working inventory for the remaining FE-744 gap. It is not canonical product contract; durable conclusions belong in `memory/SPEC.md`, `memory/PLAN.md`, and `docs/architecture/pi-ui-extension-patterns.md`.

## Why this is still live

Command containment, Brunch chrome, startup no-resume, and the `/brunch` menu/workspace switch flow are proven enough for now. The unresolved POC seam is different:

> Brunch sessions must work elicitation-first: a system/assistant-originated question, questionnaire, or offer should own the response surface, persist a terminal structured result in Pi JSONL, and be projectable as a prompt/response elicitation exchange before the next agent turn.

The latest planning decision narrows the first proof away from a Brunch-only `brunch.offer` envelope. Basic structured questions should use Pi's registered-tool transcript seam when it is thinner: assistant `toolCall` for causal/positional context, toolResult `content` for the model-readable answer summary, and toolResult `details` as Brunch's self-contained structured response payload. Brunch custom entries remain valid for establishment offers, review-set proposals, annotations, and shapes that are not naturally tool questions.

## Pi evidence already relevant

- `docs/usage.md`: the editor can be replaced temporarily by built-in UI or custom extension UI.
- `docs/tui.md`: `ctx.ui.custom<T>()` can replace the editor area with a custom component and return typed data; overlays are optional, not required.
- `docs/tui.md` Pattern 7: `ctx.ui.setEditorComponent()` can replace the main input editor with a custom editor implementation if a future persistent pending-interaction surface needs it.
- `examples/extensions/question.ts`: single-choice options plus a "Type something" escape hatch using `ctx.ui.custom()`, returning answer data in `toolResult.details`.
- `examples/extensions/questionnaire.ts`: multi-question/tabbed choice UI with optional custom text answers, returning a full questionnaire result in `toolResult.details`.
- `examples/extensions/rpc-demo.ts`: `ctx.ui.editor()` emits Pi RPC `extension_ui_request` / `extension_ui_response` traffic.
- `examples/rpc-extension-ui.ts`: a non-Pi client can translate Pi RPC extension UI requests into its own prompt/dialog components and respond through the documented protocol.
- `examples/extensions/message-renderer.ts`: custom transcript display is available, but display rendering alone does not collect a response.

## Target seam to prove

### Structured-question result + JSON-editor RPC fallback

1. A registered Pi tool asks a structured Brunch question or questionnaire.
2. The assistant tool call is preserved as prompt-side transcript context; it is not the only semantic source for projection.
3. In TUI mode, the tool replaces the default input surface with Brunch-owned custom UI supporting the POC interaction kernels:
   - single-choice selection,
   - multi-choice selection,
   - questionnaire / multiple questions,
   - optional freeform additional input,
   - cancel/skip/unavailable where allowed.
4. In raw Pi RPC mode, complex shapes degrade through `ctx.ui.editor()` with schema-tagged JSON prefill; simple shapes may use Pi-supported `select`, `confirm`, or `input` where sufficient.
5. A Brunch-aware public client can render the pending interaction as a product form and translate the answer back into Pi's documented `extension_ui_response`.
6. The tool returns one terminal result whose `content` is generated from the same details and whose `details` are self-contained: schema/version, status, mode, prompt/questions, options, answers, and transport metadata.
7. Elicitation-exchange projection classifies terminal structured-question toolResults as response-side entries, while ordinary toolResults remain prompt-side unless typed markers say otherwise.
8. No graph mutation or review acceptance bypasses `CommandExecutor`; this slice proves interaction capture, not graph writes.

## Active slice candidate

**Name:** Structured-question result + JSON-editor RPC fallback

**Goal:** Prove that a transcript-native structured question can replace ambient free input in TUI, stay controllable over Pi RPC, and persist a response payload that Brunch can project without rehydrating semantics solely from assistant tool-call arguments.

**Likely implementation shape:**

- Define a minimal structured-question result details payload with `schema`, `status`, `mode`, `prompt` or `questions`, `options`, `answers`, and `transport`.
- Add a Brunch-owned TUI helper modeled on Pi's `question.ts` / `questionnaire.ts` examples.
- Add JSON-prefill / validation helpers for RPC editor fallback.
- Add a Brunch Pi-RPC relay shim that maps Pi `extension_ui_request(editor)` to public Brunch pending-elicitation events/methods and maps the product answer back to `extension_ui_response`.
- Update elicitation-exchange projection to recognize typed terminal structured-question toolResults as response-side entries.

**Acceptance:**

- A fixture/demo session can ask a system/assistant-originated structured question with no ambient user prompt.
- The default freeform editor is replaced while the question is pending in TUI.
- The user can answer single-choice, multi-choice, questionnaire, and optional-freeform shapes.
- Raw Pi RPC can round-trip a complex response through schema-tagged JSON over `ctx.ui.editor()`.
- The terminal Pi JSONL toolResult includes self-contained structured details and model-readable content derived from those details.
- Elicitation exchange projection treats the prompt-side tool/custom entry and terminal structured result as one exchange.
- Public Brunch clients do not coordinate raw Pi RPC and Brunch RPC as two product APIs; raw Pi RPC remains behind an adapter.

## Residual catalog still carried forward

| Need | Status after current evidence | Carry-forward |
| --- | --- | --- |
| Single-choice question UI | Pi example-proven; Brunch loop not yet proven | Active slice |
| Multi-choice UI | Needs Brunch helper; Pi questionnaire patterns can be adapted | Active slice |
| Questionnaire | Pi example-proven; Brunch details schema/projection not yet proven | Active slice |
| Freeform-plus-choice | Pi `question.ts` proves the pattern | Active slice |
| JSON-editor fallback | Pi RPC editor evidence exists; Brunch schema/relay not yet proven | Active slice |
| Structured custom entries | Still valid for establishment offers, review sets, and product-native displays | Use only where thinner than toolResult details |
| Review-set approve/request/reject | Depends on terminal structured-response discipline and graph commands | M5 follow-up when `acceptReviewSet` exists |
| Establishment-offer orientation expansion | Must remain user-invoked, not a default exhaustive menu | M5/M7 follow-up |
| Mouse-clickable action buttons | Unproven and not required for POC if keyboard navigation works | Defer |
| Strict built-in command suppression | Requires Pi command/keybinding policy | Separate follow-up, not this slice |

## Open questions

- Which details schema name/version should become canonical for structured-question toolResults?
- Does every structured toolResult carry all options, or can simple cases store only selected options while richer projection references a prompt-side entry? Current SPEC posture says self-contained enough for projection, so default to carrying all prompt/question/option data until evidence says it is too heavy.
- Should unavailable/no-UI contexts return `status: "unavailable"` instead of an error-shaped content string?
- What is the thinnest Brunch method/event family for pending elicitation discovery and response submission: `elicitation.pending/respond`, `agent.ui.*`, or a private relay under `agent.*`?
- How much of the schema-tagged JSON editor prefill should be user-visible in raw Pi RPC versus hidden by Brunch-aware clients?

## Retirement rule

Retire this file only after the structured-question / RPC-relay loop is either implemented and reconciled into `docs/architecture/pi-ui-extension-patterns.md` / SPEC / PLAN, or intentionally moved into a named M5 frontier slice. Do not delete it merely because command containment or chrome work is complete.
