# Agent tracing — design note

Status: captured design, not scheduled. Horizon item: `agent-tracing` in `memory/PLAN.md`. Companion note: [RLM_INVESTIGATION_PATTERN.md](RLM_INVESTIGATION_PATTERN.md) (its trace discipline feeds this design). Sources: Pi 0.80.3 docs review + four-repo Pi-OTel extension evaluation, 2026-07-06.

## Purpose

Two consumers, one instrumentation seam:

1. **Debugging** — reconstruct what the agent saw, decided, invoked, and spent, per turn, including sealed subagent children.
2. **Evaluation** — measure consistency and quality of agentic decisions (skill routing, tool invocations, exchange conduct) across runs, deterministically where possible and by judged passes where not.

## Ground rules

- **Traces are dev/eval artifacts** in the `.fixtures/scratch/`-class — promotable to `.fixtures/runs/` as evidence, never product truth. SPEC's non-goal stands: no canonical cross-store event spine through the back door.
- **Sealed profile means bundle-only.** There is no "external extension" adoption path in Brunch (D39-L): anything traces Brunch sessions only by entering the code-owned registrar list in `src/app/pi-extensions.ts` (`createBrunchPiExtensions`). Every third-party candidate is therefore a vendor-or-port decision, not a configuration decision.
- **Passive only, registered last** — the discipline the dev-mode introspection extension already established (`src/.pi/extensions/dev-mode/introspection/`): handlers return `undefined`, never replace payloads/prompts/results, and register after mutating extensions so taps see post-mutation state.
- **No global OTel provider registration** inside the product process. Scoped providers only.

## Pi integration points (v0.80.3)

Pi has no built-in tracing, but the extension event surface is a complete instrumentation API:

| Layer | Hook | Yields |
| --- | --- | --- |
| Run | `agent_start` / `agent_end` | root span per user prompt |
| Turn | `turn_start` / `turn_end` | span per LLM response + tool calls; message + tool results |
| Tool | `tool_execution_start/update/end`, `tool_call`, `tool_result` | invocation lifecycle keyed by `toolCallId` |
| Context | `context` | exact message array sent per LLM call |
| Wire | `before_provider_request` / `after_provider_response` | final provider payload; HTTP status/headers |
| Cost | `message_end` | per-assistant-message `usage` incl. cost |
| Continuity | `session_compact`, `session_start/shutdown`, `model_select`, `thinking_level_select` | why behavior changed mid-session |
| Durable | JSONL session + `pi.appendEntry` | canonical transcript; Brunch custom entries already land here |
| Children | SDK `session.subscribe(event)` | same stream for sealed subagent sessions, which bypass the extension bundle |

Known gap: no event for skill/prompt-resource activation. Mitigated in Brunch because skill routing is code-owned (first-level manifest) — attribution is logged at the Brunch layer, not inferred from Pi.

## Architecture — three layers

**Layer 1 — mechanical trace emitter (debugging).** A Brunch-owned passive extension emitting one NDJSON line per lifecycle event to `.brunch/traces/<session-id>.ndjson`: turn boundaries, tool invocations (args; results hashed/truncated), context size per LLM call, usage/cost, compaction/model-change events. Correlation comes free from session file + turn index + `toolCallId`.

**Layer 2 — subagent span joining.** `runSubagent` attaches `session.subscribe()` to each sealed child and emits into the same trace with a parent-span field set to the spawning `toolCallId`, producing the investigation tree no bundled extension can see. Also serves the subagent extension's deferred progress-UI item.

**Layer 3 — evaluation.** A converter joins mechanical NDJSON with semantic JSONL entries (orientation selections, exchange offers/terminals, `formatMutateGraphResult` receipts, sweep watermarks) by entry id/timestamp. On top:

- *Deterministic conduct checks* — sweep-after-terminal, menu→skill routing fidelity, retry/abort rates, cost per capability. Property-checkable; promoted traces become regression fixtures (A5-L, D48/D49 discipline).
- *Judged quality passes* — LLM-as-judge over trace slices; multi-run consistency over identical seeds (generative-testing territory).

## Third-party OTel extension evaluation (2026-07-06)

Four community Pi-OTel extensions were evaluated (external thread, corrected against Brunch):

| Repo | Verdict |
| --- | --- |
| `nikiforovall/pi-otel` | **Spike candidate.** Matching `@earendil-works` peer scope, richest surface (span tree, GenAI semconv, metrics/logs, content-capture privacy modes). Disqualifying for durable adoption: global `NodeSDK`, 2.2k LOC, zero tests. |
| `JoshMock/the-agency` (`packages/observability`) | **Port base.** Small (~500 LOC), tested, GenAI semconv, scoped `BasicTracerProvider` (no global registration), JSONL sink aligning with the NDJSON-first discipline. Its Pi-skill capture is dead weight in Brunch — the sealed profile disables Pi's skill mechanism; replace with Brunch-owned attribution. |
| `devkade/pi-opentelemetry` | Reference only: redaction subsystem + Grafana dashboards if traces ever leave the machine. One event rename needed (`session_switch` → `session_before_switch`). |
| `mprokopov/pi-otel-telemetry` | Not aligned (no semconv, no tests). |

Corrections that reframed the external analysis: (a) sealed profile collapses "configure externally vs port" into "vendor vs port" — both are bundle imports; (b) joshmock's skill awareness targets a channel Brunch turned off; (c) none can see subagents (Layer 2 is Brunch work regardless); (d) a global NodeSDK inside the product process is a stronger contraindication than in a standalone Pi install.

## Adoption sequence

1. **Spike (`ln-spike`-shaped, throwaway):** one dev-gated bundle import of nikiforov's pi-otel (rides an options gate like `introspection`'s), answering one question: *do rendered span trees in Tempo/Grafana materially beat `.brunch/debug/` + JSONL projections for debugging agentic decisions?* If no, stop — Layer 1 NDJSON alone may suffice.
2. **If yes, port joshmock as the Layer-1 base:** scoped provider, semconv attributes, JSONL sink; strip Pi-skill logic; add Brunch attribution (junctures, code-owned skill routing, exchange terminals, graph receipts); borrow nikiforov's `Map<toolCallId>` pattern for parallel-safe nested tool spans. Register last, passive-only.
3. **Layers 2–3 are Brunch-built** in follow-on slices regardless of the spike outcome.

## Open questions

- Trace-file lifecycle: per-session vs per-run files, rotation, and what promotion to `.fixtures/runs/` means for a trace (pairing with the session JSONL it joins against).
- Whether Layer 3's converter output wants the RLM note's "live, re-executable" property (notebook-style) or a static joined report is enough for the first evaluation passes.
- OTel export as an adapter over the NDJSON stream vs emitting OTel natively in the emitter (the spike informs this; NDJSON-first is the default posture).
