---
name: agent-as-user-comparison
description: Drive one round-one comparison target through its live rendered interface using the frozen mission, reveal, budget, validity, and cleanup policy.
---

# Agent-as-User Comparison

Use this recipe for exactly one target lane. Start a **fresh harness-level Pi session per lane** so one target cannot coach another. This is a supervised manual recipe, not a scripted state machine or generic runner.

## Inputs

Before launching, load:

1. the public mission packet;
2. the controller-only reveal key from outside the target cwd;
3. the predeclared target adapter and target cwd;
4. the matched question, turn, elapsed-time, and mechanical-intervention budgets; and
5. the run id, artifact paths, validity rules, and immutable actor-recipe version.

Never copy the private key or its path into the target cwd, opening prompt, visible log, or promoted bundle.

Create a target-visible interaction and budget ledger with one row per event:

```text
time | target turn | visible question/action | qualification decision | visible actor response | reveal fact id | question/turn/time/intervention debit | takeover/fallback note
```

Record the launch configuration and final process/session status as well.

## Frozen conduct

- Give the target only the public mission and named ready-document path/shape.
- Read bounded rendered viewports. Treat what is visibly rendered—not target internals—as the interaction contract.
- For structured selection use `inputKeys` with named keys such as `down`, `space`, and `enter`. Use `inputPaste` for multiline text. Do not embed terminal escape sequences.
- Answer only from public material or a fact whose predeclared reveal condition has just been satisfied by a qualifying target-visible question.
- A qualifying question seeks consequential mission information absent from the public packet. Record the decision before revealing. Do not volunteer nearby facts, infer private answers, improve a non-answer, or invent facts.
- Debit every target question, target turn, elapsed-time interval, and mechanical intervention according to the packet. Do not alter budgets or conversational policy for a target.
- Stop when the target has authored the named settled specification Markdown document, or immediately when any budget expires. On expiry, retain the best target-authored artifact and mark the lane budget-exhausted. The actor may transport the artifact but must not reconstruct or improve it.

## Push-driven overlay cadence

Environment prerequisites (verify before launching a lane):

- `.pi/interactive-shell.json` sets `minQueryIntervalSeconds` 5, `handsFreeQuietThreshold` 3000, `handsFreeUpdateMaxChars` 8000;
- extensions `.pi/extensions/interactive-shell-push.ts` (forwards quiet-period output into context as turn-triggering `interactive-shell-quiet-update` messages) and `.pi/extensions/interactive-shell-prune.ts` (collapses superseded shell reads before each LLM call) are loaded.

Start `interactive_shell` in hands-free mode with these settings:

```text
quietThreshold 3000
updateInterval 30000
autoExitOnQuiet false
```

Actor loop — push first, pull as fallback:

1. launch and allow startup; do not interpret an early empty render as target failure;
2. when an answer/action is determined, send it (`inputKeys`/`inputPaste` with `submit`) and **end the turn without querying**;
3. act when woken by a pushed `interactive-shell-quiet-update` (new output ~3s after the target goes quiet) or a lifecycle message (exit/kill/takeover);
4. the pushed tail is an incremental output stream, not a rendered viewport — when a TUI redraw makes it ambiguous, confirm with one bounded status query (`outputLines`/`outputMaxChars`, live tail only, never page scrollback); and
5. query as fallback only when no push has arrived well past the expected response time; queries are floored at the 5s rate limit — never rapid-poll.

Cadence gate: the v1 pull cadence (input delivery ~10s; readback floored by a then-60s query rate limit; 60–70s per observe-act cycle) was witnessed in campaign `lockers-r1-20260716`. This push-driven loop is **not yet witnessed** — treat the first observe-act cycle of the next lane as its cadence witness and record the observed timings in the lane ledger before relying on them.

Copy only target-visible interaction into the normalized comparison record.

## Target adapters

Adapters change launch and artifact acquisition only. They do not change reveal, budget, intervention, validity, or stopping policy.

### Brunch

- Target cwd: the predeclared isolated workspace.
- Launch the real TUI through `interactive_shell` with:

  ```sh
  npm run dev-cli -- --workspace <dir>
  ```

- Navigate rendered structured choices with named keys.
- Acquire the ready document only from settled Brunch graph state:

  ```sh
  npm run dev-cli -- document-export --workspace <dir> --spec-id <id> --out <file.md>
  ```

- JSONL, `.brunch/debug/`, and trajectory material may be retained as Brunch-only diagnostics, but never enters outcome or process judgment and never compensates for missing target-visible evidence.

### Claude Code

Launch through the supported structured overlay seam:

```text
spawn: { agent: "claude" }
```

Instruct the target to author the named Markdown path in its target cwd.

### Cursor

Launch through the supported structured overlay seam:

```text
spawn: { agent: "cursor" }
```

Instruct the target to author the named Markdown path. Record a CLI/GUI or availability mismatch as the lane result; do not rewrite the actor around it.

## Intervention and validity

Human takeover is declared **mechanical-only**: restoring focus, resizing, returning control, resending unchanged input, or performing equivalent navigation without supplying substantive content. Record and debit it.

A takeover that supplies or changes an answer, requirement, recommendation, reasoning step, or document content is substantive. It invalidates the lane, but the complete attempt and reason remain retained. Also invalidate and retain a lane when private material is accessed before a qualifying reveal or the frozen policy is otherwise breached.

If overlays cannot bind, `npm run tui-driver` is fallback only. Record the fallback and its capability loss: no human takeover/return, runtime resize, or bracketed/multiline paste. Mark the lane non-equivalent when that loss affects conduct; never add a new PTY surface.

## Completion and cleanup

For every success, failure, exhaustion, or invalid attempt:

1. retain the normalized target-visible interaction ledger, budget/intervention ledger, final target-authored artifact if any, validity note, fallback/capability-loss note if any, and actor-recipe version;
2. record the target process's final status;
3. query the overlay session to a final status, kill any process still running, dismiss completed background records, and verify no session/process from this lane remains; and
4. keep scratch evidence under `.fixtures/scratch/comparisons/<campaign-id>/<target-run-id>/` until review and deliberate immutable promotion.

Never discard an invalid or failed attempt and never promote the controller-only key.
