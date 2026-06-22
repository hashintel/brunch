# Bugfix: TUI exchange answers routed to the keyboard, not steering

Frontier: n/a (bugfix; regression from web-driver-streaming / FE-873)
Status:   manual-verification-needed
Mode:     single
Created:  2026-06-22

## Orientation

- **Seam:** structured-exchange answer-source seam — `request_answer` (`src/.pi/extensions/exchanges/request-answer.ts`) and its wiring through `exchanges/index.ts` + `brunch-tui.ts`. The `LiveExchangeBroker` (`src/session/live-exchange-broker.ts`) is web-driver-streaming's artifact.
- **Regression (diagnosed 2026-06-22, /ln-diagnose):** FE-873 (`8c3748f6`, PR #225) wired `liveExchange.awaiter` into the TUI extension context and switched `exchanges/index.ts` to `deps.liveExchange ? createRequestAnswerTool(deps.liveExchange) : requestAnswerTool`. Because `runBrunchTui` **always** sets `liveExchange`, every TUI `request_answer` now `await answerBroker.awaitAnswer(...)` and never reaches the `ctx.ui.editor` keyboard path. The broker resolves only via `answerer.submitAnswer(...)` (callers: `session.answerExchange` RPC + the web sidecar — no TUI keyboard bridge). So the tool blocks, the turn stays running, and the user's typed answer is delivered as a Pi **steer** into the open turn.
- **Surfaced by:** the FE-811 ship-gate live runbook (Card 2) — the harness-as-false-proof gap is real: FE-873's claim-5 broker leg was proven only on the tier-2 faux substrate via the RPC; no test exercised TUI keyboard → answer.
- **Open risk / decision:** editor-vs-broker **precedence** when both could answer. Under current posture (TUI is the driver; web is a read-only observer; web-as-driver is Horizon) the TUI editor should win. A full race (editor *or* broker, whichever first) is the richer behavior but needs a broker-cancel path the `LiveExchangeAwaiter` API lacks — defer it to web-driver-streaming.
- **Tracker/branch:** recommend landing on the current lower-line lane (`ln/fe-811-poc-live-ship-tie-off`) to unblock the runbook, as a standalone bugfix (no new Linear issue unless the user wants one). The durable invariant is recorded in SPEC regardless of branch.
- **Posture:** proving (the runbook is proving FE-811; this restores a load-bearing path the runbook depends on).

## Target Behavior

In an interactive TUI session, the assistant's `request_answer` exchange is resolved by the user's next typed message via the TUI editor, not queued as a steering prompt.

## Full-card cold-start reads

```
- memory/SPEC.md   — D5-L (public method names), D72-L/D84-L (web-driver transport), I-refs on
                     elicitation/exchange answering; add the new TUI-answer invariant here
- memory/PLAN.md    — frontier: web-driver-streaming (broker origin); poc-live-ship-gate (surfaced by)
- src/.pi/extensions/exchanges/request-answer.ts — the answer-source precedence (the fix site)
- src/.pi/extensions/exchanges/index.ts — broker-variant selection (deps.liveExchange ? ...)
- src/app/brunch-tui.ts — runBrunchTui always sets liveExchange; line ~406 context wiring
- src/session/live-exchange-broker.ts — awaitAnswer / submitAnswer; no cancel on the awaiter
- src/dev/__tests__/web-driver-streaming.exchange-convergence.test.ts — the headless broker leg that must stay green
```

## Boundary Crossings

```
→ assistant turn calls present_question then request_answer (executionMode: sequential)
→ request_answer.execute: choose answer source
   → interactive UI present (ctx.hasUI + ctx.ui.editor)  → await ctx.ui.editor(prompt)   [TUI head]
   → else broker present                                 → await answerBroker.awaitAnswer  [headless / web-driver]
→ resolved answer → projectRequestAnswer(answered) → tool result → turn continues
```

## Risks and Assumptions

```
- RISK: flipping precedence breaks the headless web-driver broker leg
    → MITIGATION: gate the editor branch on ctx.hasUI && typeof ctx.ui.editor === 'function'.
      The tier-2 path uses createAgentSessionRuntime (no interactive editor) → ctx.hasUI false →
      still falls to the broker. The exchange-convergence test (answers via session.answerExchange,
      no editor) must stay green as the proof.
- ASSUMPTION: under current posture the TUI editor should always win when present (web is read-only observer)
    → IMPACT IF FALSE: a future web-as-driver session with a live TUI head could not answer from the web
    → VALIDATE: confirm against web-driver-streaming posture ("one driver, many observers"; web-as-driver is Horizon).
      The race variant (editor OR broker + awaiter cancel) is the deferred richer fix, owned by web-driver-streaming.
    → [→ memory/SPEC.md §Assumptions — record the TUI-answer invariant + the deferred race]
- ASSUMPTION: the editor path does not need to register the exchange with the broker for observers
    → IMPACT IF FALSE: a web observer cannot see "a question is pending" while the TUI editor is open
    → VALIDATE: present_question already renders the question into the transcript the observer sees;
      pending-visibility for observers is a web-driver-streaming concern, not this bugfix
```

## Posture check (proving)

Scores on **invariants** (locates and stabilizes the exchange answer-source seam with a new regression oracle) and **proof of life** (restores the TUI elicitation-answer path the FE-811 runbook composes). A tracer that breaks loudly if a TUI session can no longer answer its own exchange — build it.

## Acceptance Criteria

```
✓ request-answer-prefers-tui-editor — createRequestAnswerTool(broker) invoked with a ctx where
  hasUI is true and ui.editor is a stub resolves the exchange from the editor's return value; the
  broker.awaitAnswer is not what resolves it
✓ request-answer-falls-back-to-broker — same tool with a ctx where hasUI is false resolves via
  answerBroker.awaitAnswer (the headless / web-driver path)
✓ web-driver-streaming.exchange-convergence.test.ts stays green (headless broker leg unbroken)
✓ manual: in the seeded ship-gate-runbook TUI session, typing an answer to the assistant's
  request_answer resolves the exchange (no steering queue) and the turn continues
```

## Verification Approach

```
- Inner: unit oracle on createRequestAnswerTool — editor-preferred when hasUI, broker-fallback when not
  ✓ 2026-06-22: src/.pi/__tests__/structured-exchange-present-request.test.ts
- Inner: existing web-driver-streaming.exchange-convergence test (regression guard for the broker leg)
  ✓ 2026-06-22: src/dev/__tests__/web-driver-streaming.exchange-convergence.test.ts
- Outer: manual — resume the FE-811 ship-gate-runbook walkthrough; the answer step now composes
  ◐ still needed before deleting this card
```

## Cross-cutting obligations

```
- Do not break the headless / web-driver broker answer path (web-driver-streaming claim 5)
- Keep request_answer's "present_question first" contract and the projectRequestAnswer outcomes intact
- Record the durable invariant in SPEC (TUI-driven sessions answer exchanges from the TUI head);
  name the deferred race variant as owned by web-driver-streaming
- This is a focused bugfix — do not widen into a general exchange-routing refactor
```

## Expected touched paths (tentative)

```
src/.pi/extensions/exchanges/
├── request-answer.ts              ~   (flip precedence: editor when hasUI, else broker)
└── __tests__/
    └── request-answer.test.ts     +   (regression oracle: editor-preferred / broker-fallback)
memory/SPEC.md                     ~   (record the TUI-answer invariant + deferred race)
memory/PLAN.md                     ~   (note the FE-873 regression under web-driver-streaming)
```
