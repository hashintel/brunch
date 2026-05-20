# Agent tracing for self-improvement feedback

Reference notes on wiring OpenTelemetry (OTel) tracing into a TypeScript agent stack so that (a) humans can read traces and (b) the agent itself can use its past trajectories as feedback for self-improvement.

Compiled from `last30days` research (window: 2026-03-20 → 2026-04-19) plus design synthesis. Where a claim came from research, it is attributed; where it's a design recommendation, that's stated.

---

## Landscape findings (from research)

### OTel is the substrate everyone is converging on

The industry signal in the last 30 days is unambiguous: **custom SDK wrappers are being deprecated in favor of standard OTel auto-instrumentation.**

- **PostHog** merged three PRs in a two-week span explicitly moving off their own `@posthog/ai/*` wrappers toward OTel auto-instrumentation:
  - `posthog-js #3349` (Apr-7) — migrate AI examples to OTel
  - `posthog #53668` (Apr-8) — migrate onboarding docs to OTel auto-instrumentation
  - `posthog-js #3415` (Apr-17) — migrate Gemini example to OTel
- Explicit reasoning in those PRs: *"more portable, follows industry conventions, wrappers kept as last resort."*
- **Jaeger** has an active LFX project (`jaegertracing/jaeger#8401`, Apr-17) adding GenAI-specialized trace visualization — `invoke_agent` spans, OTel-based.

**Implication:** don't invest in provider-specific tracing wrappers. Emit OTel spans; swap backends behind OTLP.

### Vercel AI SDK — OTel is built in

From Pydantic's Apr-14 article *"OpenTelemetry LLM Tracing with Vercel AI SDK and Pydantic Logfire"* (https://pydantic.dev/articles/vercel-ai-sdk-logfire-otel):

> The AI SDK's `experimental_telemetry` option works identically since it uses the global OTel tracer, regardless of how it was initialized. Three independent teams built the pieces that make this possible: Vercel added OpenTelemetry instrumentation to the AI SDK, emitting spans with `ai.*` and `gen_ai.*` attributes on every LLM call.

Spans are emitted on every `generateText`, `streamText`, `generateObject`, `streamObject` call when `experimental_telemetry.isEnabled` is true. They carry `ai.*` (Vercel-specific) and `gen_ai.*` (OTel GenAI SIG convention) attributes.

**Known bug (PostHog-specific, not OTel-general):** `PostHog/posthog#52442` (Mar-26, still open) — PostHog's OTel ingestion drops custom metadata (`posthog_distinct_id`, `functionId`, custom properties) from Vercel AI SDK spans. Does not affect Langfuse / Logfire / other OTLP backends.

### OpenCode — partial OTel, known gap

Very recent issue `marcusquinn/aidevops#19660` (Apr-18): **OpenCode v1.4.11 `run` mode does not emit per-tool-call `Tool.execute` / `Bash` spans.** Top-level spans work, but you are blind to individual tool calls in non-interactive runs. Check the current version against this thread before relying on OpenCode tracing.

### Claude Agent SDK — no evidence in window

The Claude Agent SDK was not mentioned in any of 62 evidence items across Reddit, GitHub, Web, TikTok. Either (a) its tracing story isn't a topic of community discussion yet, or (b) the query didn't surface it. Check Anthropic's own docs for current state.

### Convenience layer: Traceloop (OpenLLMetry)

Traceloop ships `@traceloop/instrumentation-*` per-provider packages. Referenced explicitly in `PostHog/posthog-js#3415`:

> Traceloop shipped `@traceloop/instrumentation-google-generativeai`, so we can now instrument the official Google Gen AI SDK directly.

TypeScript-native, monkey-patches the provider SDK, emits OTel spans automatically. Covers OpenAI, Anthropic, Google, Cohere, Bedrock, LangChain, LlamaIndex. Use this for SDK calls the Vercel AI SDK doesn't route through (e.g. direct Anthropic calls inside a Claude Agent SDK setup).

### Self-improvement patterns (from research)

Two practical references surfaced:

1. **ChatbotKit "Self-rating Reflection Agent"** (Apr-7, https://chatbotkit.com/examples/self-rating-reflection-agent) — concrete pattern:
   > A rating-aware agent should not spam the system with feedback records after every trivial exchange, and it should never fabricate evidence that is not in the rating log. Instead it should record ratings after meaningful outcomes, use clear reasons, and consult recent ratings before claiming that it has improved.

2. **arXiv "Experiential Reflective Learning for Self-Improving LLM..."** (Mar-24, arxiv.org/pdf/2603.24639) — formal framing:
   > As the agent executes tasks, it accumulates experiences consisting of the task description, the execution trajectory (reasoning steps, tool calls, and outputs), and the outcome signal. After each task, the agent reflects on this...

Together these argue for a **rating-disciplined trajectory log**, not a firehose of every span.

### TypeScript eval layer (DeepEval replacement)

DeepEval is Python-only and not suitable inside a TypeScript codebase without crossing runtimes. TS-native alternatives in the same slot:

- **Evalite** — lightweight, pytest-shaped
- **Autoevals** (Braintrust) — scoring library, framework-agnostic
- **Vercel AI SDK Evals** — first-party, integrates with the SDK

---

## Architecture: two views, one capture

The core design idea is that **humans and agents need different views of the same data**. Do not try to serve both from one UI.

```
                    ┌─────────────────────┐
                    │  Vercel AI SDK      │
                    │  experimental_      │
                    │  telemetry = true   │
                    └──────────┬──────────┘
                               │ OTLP spans
                               ▼
                    ┌─────────────────────┐
                    │  OTel SDK           │
                    │  (global tracer)    │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴─────────────┐
                 ▼                           ▼
     ┌─────────────────────┐    ┌─────────────────────┐
     │  Langfuse / Logfire │    │  Reflection store   │
     │  (human UI)         │    │  (agent tool API)   │
     │  — read traces      │    │  — query past turns │
     │  — run evals        │    │  — get ratings      │
     │  — curate datasets  │    │  — list failures    │
     └─────────────────────┘    └─────────────────────┘
```

If you pick Langfuse, its `observations` / `scores` / `datasets` APIs collapse both views into one backend — the agent queries the same store the human browses. That is the cheapest path.

---

## Backend selection

### Recommended: **Langfuse** (self-hosted)

- Open source, Docker-compose install
- UI purpose-built for LLM traces: nested tree of prompts, completions, tool calls
- Has sessions, user IDs, evals, datasets, scores — all keyed to traces
- HTTP API is agent-friendly JSON (the same shape used by the UI)
- OTLP-native

**Pick this** if you want one tool that covers tracing + eval + dataset curation, and if you want the agent to use the same store as its reflection memory.

### Alternative: **Pydantic Logfire**

- Cleaner general-purpose OTel UI
- Excellent Vercel AI SDK documentation (Apr-14 article is effectively a Logfire tutorial)
- Generous free tier, SaaS
- Less LLM-specific than Langfuse; no built-in dataset/eval management

**Pick this** if you prioritize UI polish and are comfortable building the eval/reflection layer yourself.

### Not recommended for this use case

- **LangSmith** — heaviest hitter in research but tightly coupled to LangChain; skip unless already in that ecosystem.
- **Datadog / Honeycomb** — great general observability, not shaped for LLM content.
- **Jaeger (stock)** — not LLM-aware. Wait for the LFX GenAI work (`#8401`) if you want it.

---

## Minimal implementation path

### 1. Install the OTel SDK

```ts
// src/telemetry/otel.ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: {
      Authorization: `Bearer ${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`,
    },
  }),
})

sdk.start()
```

Import this once at process boot, before any Vercel AI SDK calls.

### 2. Enable telemetry on every AI SDK call

```ts
const result = await generateText({
  model: anthropic('claude-sonnet-4-6'),
  messages,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'review-accept',          // names the span group
    metadata: {
      sessionId,
      taskId,
      userId,
    },
  },
})
```

The `functionId` + `metadata.*` fields become queryable facets in Langfuse.

### 3. Run Langfuse locally

```bash
git clone https://github.com/langfuse/langfuse
cd langfuse && docker compose up -d
# UI at http://localhost:3000, OTLP at http://localhost:3000/api/public/otel
```

Point `OTEL_EXPORTER_OTLP_ENDPOINT` at the Langfuse OTLP endpoint.

### 4. Instrument non-Vercel SDK calls with Traceloop

For any provider call that doesn't go through the Vercel AI SDK (e.g. direct Anthropic Messages API inside a Claude Agent SDK loop):

```ts
import * as traceloop from '@traceloop/node-server-sdk'
import Anthropic from '@anthropic-ai/sdk'

traceloop.initialize({ disableBatch: true })  // uses the global OTel tracer
```

The Anthropic SDK is auto-instrumented; spans land in the same pipeline.

### 5. Expose a reflection tool surface to the agent

Give the agent three tools, backed by Langfuse's API:

```ts
// Pseudocode shape — exact Langfuse query params depend on their API version.
const tools = {
  get_recent_trajectories: async ({ functionId, limit }) => {
    // Returns: [{ taskId, outcome, durationMs, toolCalls: [...], rating?, reason? }]
  },
  get_failure_cases: async ({ since, minSeverity }) => {
    // Returns low-rated trajectories with their reason field.
  },
  get_rating: async ({ taskId }) => {
    // Single trajectory's rating + reason, or null.
  },
}
```

**Critical design constraints for this surface:**

- Return **flattened summaries**, not raw spans. One trajectory should fit in ~200 tokens.
- Include the `reason` field every time. A rating without a reason is worse than no rating.
- Cap the default `limit` low (e.g. 5). The agent should explicitly ask for more.

### 6. Apply rating discipline

From the ChatbotKit pattern:

- **Rate only meaningful outcomes.** Don't rate every LLM call. Rate at task boundaries where a user-visible outcome exists.
- **Every rating has a reason.** Free-text, one sentence, written by the agent or the human.
- **Consult ratings before claiming improvement.** If the agent is going to say "I've learned X," it should be required to cite rating evidence from the tool surface.

In Langfuse, ratings live in the `scores` API. Write to it at task boundaries only.

### 7. Layer evals

Pick one:

- **Evalite** for pytest-shaped eval suites run in CI.
- **Autoevals** (Braintrust) if you want a scoring library without a full framework.
- **Vercel AI SDK Evals** if you want first-party integration.

Write scores back to Langfuse (via its `scores` API) so rating data and trace data live in one store.

---

## Gotchas

- **PostHog-as-backend** currently drops AI SDK custom metadata (`#52442`). Use Langfuse or Logfire if you need `functionId` / session IDs to survive.
- **OpenCode `run` mode** misses per-tool-call spans (`aidevops#19660`). Check current version before committing.
- **Claude Agent SDK** tracing story is not publicly discussed in the last 30 days. Verify against Anthropic's docs when you get there.
- **DeepEval is Python-only.** Don't let its marketing pull you across runtimes.
- **Do not let the agent read the Langfuse UI JSON directly.** The UI payload is optimized for humans and will blow the context window. Always project into the flat summary shape described in §5.

---

## References

### Primary (dated within research window)

- Pydantic, *"OpenTelemetry LLM Tracing with Vercel AI SDK and Pydantic Logfire"*, 2026-04-14 — https://pydantic.dev/articles/vercel-ai-sdk-logfire-otel
- ChatbotKit, *"Self-rating Reflection Agent"*, 2026-04-07 — https://chatbotkit.com/examples/self-rating-reflection-agent
- Confident AI, *"Top 7 LLM Observability Tools in 2026"*, 2026-04-07 — https://www.confident-ai.com/knowledge-base/top-7-llm-observability-tools
- LangChain, *"AI Agent Observability: Tracing, Testing, and Improving Agents"*, 2026-04-02 — https://www.langchain.com/articles/agent-observability
- arXiv, *"Experiential Reflective Learning for Self-Improving LLM..."*, 2026-03-24 — https://arxiv.org/pdf/2603.24639
- `PostHog/posthog-js#3349` — migrate AI examples to OTel, 2026-04-07
- `PostHog/posthog#53668` — migrate onboarding docs to OTel, 2026-04-08
- `PostHog/posthog-js#3415` — migrate Gemini example to OTel, 2026-04-17
- `PostHog/posthog#52442` — OTel ingestion drops Vercel AI SDK metadata (open), 2026-03-26
- `jaegertracing/jaeger#8401` — GenAI trace visualization proposal, 2026-04-17
- `marcusquinn/aidevops#19660` — OpenCode `run` mode tool-call span gap, 2026-04-18
- `pydantic/pydantic-ai-harness#120` — agent eval/benchmarking framework, 2026-03-26

### Secondary (product docs)

- Vercel AI SDK telemetry: `experimental_telemetry` option
- Langfuse: https://langfuse.com (self-hosted via `docker compose`)
- Traceloop / OpenLLMetry: `@traceloop/node-server-sdk`
- OTel GenAI semantic conventions: https://opentelemetry.io/docs/specs/semconv/gen-ai/

### Research caveats

- X/Twitter source was unavailable during research (Safari cookie permissions); OTel-GenAI SIG discussion lives there and is not represented.
- YouTube returned zero results across three query variants.
- Research window is 30 days; older foundational material (e.g. original OpenLLMetry release) is outside scope.
