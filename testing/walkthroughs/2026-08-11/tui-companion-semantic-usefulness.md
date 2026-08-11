# TUI-companion semantic usefulness

Date: 2026-08-11
Frontier: FE-1348 `post-hardening-alpha-validation`
Row: `TUI-companion semantic usefulness`
Disposition: `built`

## Boundary and method

A colleague observed the production normal-TUI composition and its companion React session route while the deterministic production PTY tracer supplied bounded faux-provider replies. The run used the real `runBrunchTui` → `launchPiInteractive` → Pi `InteractiveMode` path, production WebSocket RPC, the production React app, and one canonical Pi JSONL. No production code, fixture, JSONL, database state, or provider output was edited to manufacture the result.

Environment: commit `167262b`, branch `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`, Brunch `v1.0.0-alpha.13`, Pi `v0.83.0`, Darwin `25.6.0 arm64`.

The TUI sidecar initially advertised the graph-only route `/spec/1`, which correctly showed `No knowledge captured yet`. The target-addressed companion route `/session/1/019ff0a9-417d-7037-a3e4-fc6d9b58d891` then showed the active transcript.

## Walkthrough evidence

| Beat | Observation |
| --- | --- |
| Ordinary TUI turn | The TUI showed the opening assistant turn, accepted `Confirm the production PTY tracer turn.`, and rendered the scripted acknowledgment. The companion immediately showed the same three-message transcript. |
| Ordinary browser turn | A message entered through the companion received the bounded assistant response; TUI and companion updated immediately and converged on the same transcript. |
| Structured ask announcement | The TUI prompt `Open a structured question for the production PTY tracer.` opened `Which shape should the production PTY tracer prove?` in both presentations. |
| Browser answer refusal | Submitting through the companion failed honestly with `answer could not be submitted` and `ask closed`; the TUI-owned ask remained open. |
| TUI answer authority | The TUI accepted `The observe-only announcement shape.`, produced `Recorded the production PTY tracer answer.`, and the companion settled to the same transcript. |
| Canonical JSONL | The retained file records the ordinary messages, the structured `ask` tool call, exactly one successful tool result carrying `The observe-only announcement shape.`, and the settled assistant response. A fresh `projectSessionPresentationFile` read returned `ready` at cursor `22:ce59e517` with the same ten visible entries and the ask terminal `answered`. |
| Normal shutdown | Exiting the TUI removed the target writer lock. |

## Colleague judgment

- Everything worked in both directions; messages entered in either presentation received the bounded assistant response and both interfaces updated immediately.
- The companion was useful, although its effectively unstyled presentation felt less clear and organized than the TUI.
- There was no particular visual indicator that the TUI was primary.
- The failed companion submission and `ask closed` result were understandable.

The walkthrough therefore supports observation-without-answering as sufficient current companion value. The absent primary-interface indicator and unstyled presentation are qualitative polish observations, not present failures or requirements. They do not justify widening `OpenAsk`, introducing dual-answer authority, or changing the settled runtime contract.

## Finding disposition

| Finding | Outcome | Rationale |
| --- | --- | --- |
| SA1 — read-only ownership marker | retired | The colleague found the honest refusal understandable; the proposed marker has no demonstrated current reader worth its cross-contract cost. |
| SA2 — dual-answer authority | retired | The colleague found the observe-only ask useful; dual-answer authority is not a current product requirement. |

## Leaf disposition

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| Ordinary turn is useful in TUI and companion | met | Immediate transcript agreement plus colleague judgment. |
| Structured ask is useful in both presentations | met | Ask visible in both; TUI answer settled into both; colleague judged the flow understandable. |
| Fresh JSONL projection matches settled React | met | Fresh production projection returned the same ten ordinary/ask entries observed in settled companion React. |
| Browser cannot steal TUI answer authority | met | Companion answer refused; TUI ask stayed open and accepted the sole successful answer. |
| SA1/SA2 receive evidence-backed dispositions | met | Both retired above without production changes. |
| Row-owned runtime releases authority | met | Normal exit left no writer-lock file. |

Skipped-test-count delta versus parent: `0` (no test or test policy changed).
