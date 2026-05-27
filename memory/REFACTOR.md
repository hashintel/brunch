## Problem Statement

The structured-question implementation has good inner-loop coverage for schemas, result builders, fake TUI custom UI, and fake editor fallback, but it does not yet prove the two architectural claims that make the seam safe to depend on.

First, RPC sufficiency is not witnessed against a live Pi RPC process: current tests exercise Brunch helpers with fake `ctx.ui.editor`, not the documented `extension_ui_request` / `extension_ui_response` round trip. That leaves uncertainty about whether a real CLI JSON-RPC client can drive the fallback end to end.

Second, elicitation-exchange projection still treats all Pi tool results as prompt-side transcript entries. Brunch now has typed structured-question result details, but projection does not yet classify terminal structured-question tool results as response-side entries. Until that lands, `toolResult.details` is self-contained but not yet part of the observer extraction unit.

The current UX refinements for structured questions are intentionally not part of this refactor. They should become a separate plan/scope item after the proof seam is trustworthy.

## Solution

Make the existing seam easier to trust before changing the structured-question UX. Add a live RPC proof harness that runs a minimal Brunch/Pi structured-question path through actual RPC extension UI messages, then use that evidence to tighten the projection behavior so typed terminal structured-question tool results become response-side entries while ordinary tool results remain prompt-side.

The target state is:

- a repeatable proof command or test fixture can witness `editor` request emission and response handling over Pi RPC;
- the proof verifies the final result payload, not just that an editor request appeared;
- projection has a small typed predicate for structured-question terminal results;
- tests distinguish ordinary tool results from structured-question answers;
- SPEC/PLAN evidence language can honestly say RPC fallback is live-proven for the adapter layer and projection is covered for terminal structured-question results.

## Commits

1. [x] Add characterization coverage for the existing structured-question transcript boundary: ordinary tool results stay prompt-side, and typed structured-question result details are recognized by a pure predicate without changing exchange projection yet.
2. [x] Add a live RPC proof harness that launches a minimal structured-question scenario, observes the actual editor UI request, submits a documented RPC UI response, and captures the resulting terminal payload.
3. [x] Wire the proof harness into an executable runbook or targeted test path with stable assertions over the editor request shape and terminal structured-question result details.
4. [x] Change elicitation-exchange projection so terminal structured-question tool results are response-side entries, while ordinary tool results and non-terminal structured-question statuses retain the existing prompt/open behavior as appropriate.
5. [x] Add projection coverage for typed structured-question exchanges, including the contrastive case where an ordinary tool result remains prompt-side.
6. [x] Reconcile documentation and planning evidence: mark the RPC editor fallback as live-proven at the adapter level, mark elicitation-exchange projection for structured-question terminal results as covered, and keep broader Brunch product-surface relay semantics as the remaining gap.
7. [ ] Delete or quarantine any temporary proof-only scaffolding that should not survive as product code, keeping only the reusable runbook/test harness if it remains valuable.

## Decisions

- The proof targets the Pi RPC extension UI protocol directly, not a mocked Brunch helper and not a future public Brunch relay.
- The proof result must include the same self-contained structured-question details shape used by the TUI path.
- Projection classifies by typed structured-question result details, not by tool name alone; this prevents accidental response-side classification of unrelated tool results.
- The refactor preserves the current structured-question payload schema unless the live proof reveals a protocol mismatch.
- The public Brunch product relay for pending elicitation remains a follow-up seam, not part of this proof refactor.
- Structured-question UX refinements are intentionally deferred to a separate planning item so proof work does not become interaction-design churn.

## Testing Decisions

- Good tests here prove behavior at the same boundaries future callers rely on: RPC protocol messages, Pi JSONL/tool-result payloads, and elicitation-exchange projection output.
- Pure unit tests remain useful for schema and projection classification, but they are insufficient for RPC sufficiency.
- The live RPC proof should be small and deterministic: one structured question, one editor fallback answer, one terminal result assertion.
- The live proof should not depend on model behavior if avoidable; prefer a command/tool-driven harness or deterministic probe over asking an LLM to decide when to call the tool.
- Projection tests must include contrastive ordinary tool results so the new response-side rule cannot accidentally reclassify every `toolResult`.
- Existing targeted suites for structured-question helpers, extension adapter helpers, elicitation-exchange projection, and JSON-RPC handlers are the prior art to preserve.

## Out of Scope

- Redesigning the structured-question UX, including richer freeform-plus-choice flows, review-set action surfaces, or establishment-offer orientation views.
- Building the public Brunch pending-elicitation relay for web/CLI clients; this refactor proves the private Pi RPC adapter layer and leaves product-surface relay semantics as the next slice.
- Adding graph writes, observer jobs, review-set acceptance, or command-layer mutation behavior.
- Changing the structured-question schema for aesthetic reasons unless the live RPC proof exposes a real protocol mismatch.
- Making the live RPC proof a mandatory CI gate if host-sensitive process/PTY behavior makes it flaky; it may remain a runbook/probe with deterministic assertions.
- Touching unrelated dirty planning files or the auto-compaction anchor artifact except for deliberate reconciliation after proof results are known.
