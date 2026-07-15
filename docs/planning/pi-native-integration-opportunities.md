# Pi-native integration opportunities

Status: working synthesis for frontier re-qualification
Date: 2026-07-13
Pi baseline: `@earendil-works/pi-*` `0.80.6`

> This document is an input to the separate `memory/PLAN.md` frontier re-qualification pass. It is not a second plan or a durable product contract. Once its recommendations are accepted, merge them into `memory/PLAN.md` / `memory/SPEC.md`, create or revise the relevant frontier definitions, and retire this synthesis.

## Purpose

The Pi `0.80.3` → `0.80.6` upgrade exposed integration points that were not available, or were not understood clearly enough, when several current Brunch frontiers were sequenced. This document collects those opportunities without treating existing PLAN placement or SPEC wording as a veto. The evaluation criterion is instead:

> Does adopting Pi's current native seam simplify Brunch, improve correctness or product legibility, and keep Brunch on coding-agent's supported path?

The document separates:

1. work already landed with the dependency upgrade;
2. small native-alignment work that can land independently;
3. product or structural work that should become or reshape frontier packages;
4. lower-level capabilities that should remain monitored rather than adopted without a reader.

It is intentionally organized as proposed work packages so another planning thread can merge, split, rename, sequence, or reject them without reconstructing the upgrade analysis.

## Executive summary

The upgrade produced one completed integration and five credible follow-on packages.

| Package | Value | Shape | Recommended planning disposition |
| --- | --- | --- | --- |
| P0. Settlement semantics | Correct whole-run lifecycle boundary | Landed; small transport closure remains conditional | Treat as completed substrate; fold any relay assertion into `web-driver-streaming` rather than creating a frontier |
| P1. Named inline extension identity | Native Pi type and useful source provenance | Small independent hardening | Direct housekeeping or a tiny tooling frontier |
| P2. Transcript-native ledger rendering | Durable user choices remain visible without entering model context | Small product tracer | Add a bounded orientation/chrome member during re-qualification; do not make it a generic renderer program |
| P3. Native compaction continuity | Prevent Brunch continuity facts from disappearing behind Pi compaction | Structural, high-value frontier | Reframe and promote `compaction-and-conflict-widening`; design first, then vertical implementation |
| P4. Native provider/model/thinking | Delete local policy where Pi owns the behavior | Structural simplification | Fold into FE-1187's D113-L–D115-L reversal |
| P5. Provider/cache observability | Better diagnosis of provider latency, cache behavior, and whole-run spans | Spike-led instrumentation | Fold into `agent-tracing`; coordinate vocabulary with `mechanism-trace` |

The most important new conclusion is P3: Brunch enables Pi auto-compaction today, has an externalized anchor-preservation contract, but does not yet register the `session_before_compact` hook that materializes that contract. Pi `0.80.6` provides a better supported basis for closing this gap: corrected token accounting and split-turn summaries, plus public compaction preparation and summary-generation APIs.

## Current integration baseline

### Landed in the upgrade

The upgrade and settlement cards landed the following:

- `@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, and `@earendil-works/pi-tui` now resolve together at `0.80.6`.
- The settings-surface audit acknowledges `getShowCacheMissNotices` without enabling ambient transcript notices.
- J4 abort orientation records the latest low-level `agent_end` outcome and opens only at `agent_settled` when the abort remains terminal.
- A later retry or queued continuation clears an earlier abort candidate.
- J5's product-owned abort suppression remains one-shot and prevents a competing J4 dialog.
- Kick-scoped working-message cleanup moved from `turn_end` to `agent_settled`; footer telemetry still refreshes per turn.
- The structured-exchange mechanism note distinguishes the installed `0.80.6` baseline from its last full internal-mechanism audit at `0.80.3`.

Relevant code:

- [`src/.pi/extensions/session-orientation/registrar.ts`](../../src/.pi/extensions/session-orientation/registrar.ts)
- [`src/.pi/extensions/chrome/index.ts`](../../src/.pi/extensions/chrome/index.ts)
- [`src/app/pi-settings.ts`](../../src/app/pi-settings.ts)
- [`src/rpc/session-event-relay.ts`](../../src/rpc/session-event-relay.ts)

### Lifecycle vocabulary now established

```text
turn_end
  one LLM turn completed; tools/retries/continuations may follow

agent_end
  one low-level agent loop completed; Pi may still retry, compact, or consume a queued continuation

agent_settled
  Pi will not continue automatically; whole-run effects are safe

waitForIdle()
  imperative form of the same whole-run settlement requirement
```

This distinction should be preserved rather than normalized away. Streaming and ordering probes may intentionally observe `agent_end`; status cleanup, session mutation, span closure, and post-run UI actions generally want settlement.

## Evaluation principles

### Prefer Pi's high-level supported seam

"Stay close to Pi" means using coding-agent's public extension, session, resource-loader, compaction, model, and UI contracts before introducing Brunch-owned substitutes. It does not mean adopting every lower-level agent-core primitive.

### Add capability only with a reader

A native API is valuable when a Brunch product surface, diagnostic loop, or correctness invariant consumes it. A header hook without a trace consumer or a lower-level storage backend without a coding-agent gap still creates present complexity for speculative benefit.

### Let new evidence revise prior sequencing

A prior Horizon placement is not evidence that a capability should remain late. Conversely, a newly available API is not by itself evidence that a frontier should be promoted. Promotion should follow the current product risk and leverage.

### Keep native adapters narrow

Use Pi's extension points to project Brunch-owned facts; do not duplicate Pi's engine. In particular:

- keep Pi's compaction cut-point and summary machinery;
- keep Pi's model/auth registry where possible;
- keep raw session-event transport generic;
- render selected Brunch entries rather than inventing a parallel transcript system.

## P0 — Settlement semantics

### Status

Core product adoption is complete.

### Value delivered

Before `0.80.6`, Brunch compensated for the absence of a reliable whole-run event with `agent_end` interpretation and debounce behavior. `agent_settled` now expresses the actual contract directly:

- terminal abort orientation cannot race an automatic retry;
- kick-scoped UI state survives multi-turn tool runs;
- future status and tracing integrations have an unambiguous close boundary.

### Remaining concern: transport visibility

`brunch.sessionEvent` carries `AgentSessionEvent` payloads verbatim, so `agent_settled` already crosses the relay mechanically. A focused assertion could pin this additive variant, but it would not exercise a distinct implementation branch.

### Recommendation

Do not create a standalone frontier or migration sweep.

- Keep existing `agent_end` consumers when their oracle is one low-level run.
- Use `agent_settled` for newly introduced whole-run effects.
- If a web consumer begins enabling actions based on full idleness, add the production relay witness as part of that `web-driver-streaming` slice.
- If `agent-tracing` lands, close top-level spans at settlement rather than `agent_end`.

### Closure oracle

The existing orientation and chrome tests establish the product distinction. A later web consumer should add one real-host assertion that `agent_end` precedes `agent_settled` and that the consumer remains busy until the latter.

## P1 — Named inline extension identity

### Problem

Brunch currently types and supplies its programmatic extension bundle as `ExtensionFactory[]`. Pi `0.80.6` accepts `InlineExtension[]`, where a factory may be wrapped with a descriptive name. Anonymous factories appear as `<inline:1>`, weakening startup diagnostics, extension error attribution, and source metadata returned by Pi's tool/command introspection.

### Target outcome

Brunch enters Pi through one explicitly named inline extension while retaining its existing registrar composition.

```ts
const brunchExtension: InlineExtension = {
  name: 'brunch-product',
  factory: createBrunchPiExtensions(options),
};
```

### Proposed scope

1. Change Brunch's resource-loader and settings option types from `ExtensionFactory[]` to `InlineExtension[]`.
2. Wrap the production Brunch bundle with one stable name.
3. Verify the named source appears in Pi's loaded-extension/source metadata.
4. Preserve bare factory support in test helpers only where tests intentionally provide minimal extensions.

### Non-goals

- Do not split every Brunch registrar into its own extension.
- Do not change tool activation, event ordering, or the sealed resource-loader policy.
- Do not turn startup diagnostics back on solely to display the name.

### Why one name, not many

The existing `createBrunchPiExtensions()` bundle is one product adapter with internal registrars. Naming that bundle improves provenance at almost no conceptual cost. Splitting it would be justified only when Pi source metadata must distinguish families or one family's startup failure must be isolated from the rest.

### Verification

- Type-level: Brunch uses Pi's canonical `InlineExtension` type.
- Unit: resource-loader options preserve the named inline value.
- Integration: extension/tool source metadata reports `<inline:brunch-product>` or Pi's equivalent stable source identity.
- Gate: `npm run verify`.

### Likely paths

```text
src/app/pi-settings.ts
src/app/brunch-tui.ts
src/app/pi-extensions.ts        (only if naming is owned at bundle creation)
src/app/__tests__/brunch-tui.test.ts
src/.pi/extensions/__tests__/registry.test.ts
```

### Planning disposition

Independent housekeeping. It need not become a plan-level product frontier unless the re-qualification process batches several Pi-native adapter hardenings into one tooling item.

## P2 — Transcript-native ledger rendering

### Problem

Brunch persists important provider-invisible product state as Pi custom entries, but currently registers no `EntryRenderer`. After a dialog closes or mode changes, the transcript does not show the durable choice even though the ledger contains it.

Pi's intended pattern is precisely:

```text
appendEntry(customType, data)
  + registerEntryRenderer(customType, renderer)
  = durable interactive transcript content excluded from LLM context
```

### Highest-value entries

#### `brunch.session_orientation`

The entry records:

- the resolved choice;
- the juncture trigger;
- an inert dismissal as a real user outcome.

The settlement work makes abort-triggered entries especially trustworthy: an orientation entry is created only after the abort remains terminal.

Suggested compact rendering:

```text
Orientation · Work from examples
```

Suggested expanded rendering:

```text
Orientation
Choice: Work from examples
Triggered by: interrupted turn
```

The renderer should use canonical menu labels rather than expose storage ids such as `elicit_examples`.

#### `brunch.agent_runtime_state`

Render only meaningful switches, not initialization snapshots:

```text
Mode changed · Specify → Execute
```

Expanded rendering may include `source`. Invalid or initialization-only data can return `undefined`.

### Entries that should remain hidden

- `brunch.capture_sweep_watermark`
- `brunch.context_seed`
- `brunch.graph_overview_snapshot`
- `brunch.own_mutation`
- `worldUpdate` continuity carriers
- unresolved-delivery bookkeeping

These entries exist for reconstruction and conduct, not transcript narration. Their diagnostic reader belongs in post-hoc mechanism tracing or explicit dev inspection.

### Proposed tracer package

1. Register a renderer for `brunch.session_orientation` beside the orientation extension.
2. Render valid choices in compact and expanded forms using current theme primitives.
3. Add one component-preview fixture or literal renderer test for both Brunch themes.
4. Evaluate runtime-switch rendering only after the orientation tracer is readable; add it as a second slice rather than widening the first renderer.

### TUI/web relationship

Entry renderers are TUI adapters, not canonical data. Web should continue reading typed Brunch projections rather than raw JSONL entries. If web later needs orientation history, expose a named `session.*` projection and render the same semantic labels there; do not send renderer components or generic custom-entry records over RPC.

### Non-goals

- No generic custom-entry renderer registry owned by Brunch.
- No expectation that every custom entry is visible.
- No live mechanism trace or watermark debug feed.
- No provider-visible synthetic message for a UI-only fact.

### Verification

- Parser boundary: malformed or future-version entry data renders nothing safely.
- Component/literal: canonical choice labels and trigger details render in compact/expanded modes.
- Behavioral: the renderer is registered for exactly the selected custom type.
- Visual/manual: readable in Brunch light and dark themes at normal terminal width.

### Likely paths

```text
src/session/session-orientation.ts
src/.pi/extensions/session-orientation/
src/.pi/components/                 (only if a reusable component earns a home)
src/.pi/extensions/__tests__/
src/.pi/components/__tests__/
```

### Planning disposition

Proposed bounded member of the active `deterministic-orientation` arc during frontier re-qualification. It should not be folded into `exchange-visual-design`: orientation is product chrome and not an exchange terminal. If the planner requires a flat frontier item, use a narrow concern such as `orientation-ledger-rendering` rather than reopening the completed implementation frontier wholesale.

## P3 — Native compaction continuity

### Problem

Brunch settings enable Pi auto-compaction:

```ts
compaction: {
  enabled: true,
  reserveTokens: 16384,
  keepRecentTokens: 20000,
}
```

**Disposition (2026-07-14): shipped and closed by FE-1196.** Brunch now registers one production `session_before_compact` hook through `registerBrunchCompaction`. The adapter prefixes a deterministic versioned continuity block to Pi's native `compact(...)` narrative, preserves Pi file-operation details, keeps ledger anchors in append-only JSONL, and cancels visibly on owned failure. Current state is canonical in [`src/.pi/extensions/TOPOLOGY.md`](../../src/.pi/extensions/TOPOLOGY.md) and SPEC D43-L/I28-L.

The sections below retain the accepted package shape as evaluation history; they are not open implementation instructions.

Pi `0.80.6` improves the basis for implementing the intended seam:

- retained-token accounting includes custom messages correctly;
- pre-compaction token budgeting is rebuilt correctly;
- split-turn summaries serialize rather than preserve raw message objects;
- `session_before_compact` exposes `preparation`, `branchEntries`, `reason`, `willRetry`, and `signal`;
- public `generateSummary()` lets an extension retain Pi's normal summary machinery.

### Target outcome

Every successful Pi compaction produces a normal Pi narrative summary prefixed by a deterministic Brunch continuity block selected from the canonical anchor contract. Reloading the compacted branch reconstructs the same required Brunch facts.

### Recommended architecture

```text
Pi session_before_compact
  │
  ├─ preparation/messages/split-turn state       (Pi-owned)
  ├─ branchEntries                               (Pi-owned branch view)
  │
  ▼
Brunch anchor selection
  ├─ first/latest generic selectors
  └─ active-leaves/all-unresolved owner selectors
  │
  ├─ deterministic validation + serialization
  ▼
Pi generateSummary(...)
  ├─ current model
  ├─ modelRegistry auth + headers
  ├─ Pi reserve/custom instructions/previous summary
  └─ abort signal
  │
  ▼
CompactionResult
  summary = Brunch anchor block + Pi narrative
  firstKeptEntryId = preparation.firstKeptEntryId
  tokensBefore = preparation.tokensBefore
  details = stable Brunch schema/version + Pi file operations as needed
```

This is a deep adapter: Brunch owns selection and deterministic continuity serialization; Pi continues to own when and where compaction occurs and how the narrative is generated.

### Design questions that belong inside the package

#### Selector ownership

`first` and `latest` can be generic. `active-leaves` and `all-unresolved` encode domain meaning and must delegate to the session projections that already understand supersession, terminal outcomes, delivery, and consumption. The compaction module should consume selector functions, not acquire exchange/side-task domain logic.

#### Repeated compaction

The implementation must avoid accumulating duplicate anchor blocks across summaries. The stable details schema should identify the prior Brunch block, or the renderer should replace a recognized previous block before passing narrative context forward.

#### Failure policy

A malformed optional entry may be ignored according to its canonical parser. Failure to render the required anchor set or generate a summary must fail compaction visibly rather than silently delegating to default compaction and losing Brunch continuity.

#### File-operation details

Pi's default summaries track read/modified files cumulatively. A custom result should preserve those details unless Brunch explicitly proves they are irrelevant. Prefer reusing Pi's preparation/file-operation data over reconstructing it.

#### Branch summarization

`session_before_tree` uses a related summary mechanism but is a separate boundary. Do not automatically widen the first compaction tracer to branch summaries. Reuse the anchor renderer later if branch navigation evidence shows the same continuity requirement.

### Proposed vertical sequence

#### Slice A — Deterministic anchor projection

- Validate the externalized contract shape.
- Implement generic `first` / `latest` selection.
- Supply owner-backed selectors for unresolved/active entries.
- Render one byte-stable, versioned continuity block.
- Prove order independence where the contract permits it and branch-order dependence where selection requires it.

#### Slice B — Native compaction tracer · shipped

- Registered `session_before_compact` in the production Brunch extension bundle.
- Uses Pi's public preparation and native `compact(...)` API.
- The faux-provider lifecycle battery covers representative carriers and physical reload through Pi's `SessionManager`.

#### Slice C — Repeated and split-turn hardening

- Compact a session twice without duplicating or regressing anchors.
- Exercise a split tool turn and custom messages under `0.80.6` accounting.
- Prove overflow retry still reaches `agent_settled` only after successful compaction/retry.

### Verification strategy

- Inner: parser/schema and deterministic anchor-selection/rendering tests.
- Middle: actual `SessionManager` compaction → JSONL reload → projection round trip.
- Property: generated branch histories preserve each contract selector's invariant under unrelated-entry insertion and repeated compaction.
- Contrastive rival: a default-summary-only implementation must fail the anchor reconstruction oracle.
- Outer: one long-enough real or faux-provider session that crosses the configured threshold and continues correctly afterward.

### Likely paths

```text
src/.pi/extensions/compaction/
├── index.ts
├── ... private selection/rendering modules
└── __tests__/
src/.pi/extensions/TOPOLOGY.md
src/app/pi-extensions.ts
src/session/ and src/projections/session/ owner selectors
src/session/__tests__/
src/dev/ or src/probes/ compaction witness
```

### Dependencies and sequencing

- FE-1187 may change model/auth policy. The compaction adapter should use only public `ctx.model`, `ctx.modelRegistry.getApiKeyAndHeaders()`, and Pi compaction APIs so it survives that simplification.
- P1 naming is independent.
- P2 rendering is independent.
- P5 tracing can observe compaction later but must not become required for correctness.

### Planning disposition

Closed by FE-1196 `compaction-and-conflict-widening` on 2026-07-14. The native custom-result path and lifecycle battery cover manual, repeated, split-turn, overflow-retry, reload, latest-carrier replacement, immediate retry/rebuilt context, and fail-closed cancellation. Re-enter only if the selector's code-local `ceiling:` fires.

## P4 — Native provider, model, and thinking policy

### Problem

Brunch currently wraps/mutates Pi's model registry to enforce a local allowlist, directs users through a Brunch-specific login path, pins thinking behavior, and carries local model-selection policy that Pi increasingly owns natively.

Pi `0.80.6` provides or improves:

- Pi-native `/login` and `/model` flows;
- public model resolution helpers;
- the `max` thinking level;
- current provider/model metadata and retry behavior;
- default-model settings suitable for a soft recommendation.

### Target outcome

Brunch supports Pi's full resolvable provider/model range while retaining only genuinely product-owned policy:

- a soft recommended default;
- a no-auth turn gate based on whether any model has resolvable credentials;
- Brunch theme/chrome adaptation for every Pi thinking level;
- documentation of recommendations rather than an enforced allowlist.

### Proposed scope

1. Reverse D113-L's hard model allowlist and delete the registry mutation wrapper where Pi's registry already owns availability.
2. Reverse the Brunch-owned login restriction in favor of Pi-native login/provider discovery.
3. Re-key the no-auth gate to live resolvable auth rather than allowlisted models.
4. Use Pi's model resolver only where Brunch still owns a CLI/config model selector; do not wrap it preemptively.
5. Restore native thinking-level selection, including `max`, and verify Brunch chrome/theme fallback.
6. Retire fixtures, settings, docs, and aliases that exist solely for the old restriction.

### Verification

- Faux registries covering API-key, OAuth, unavailable, and multiple-provider states.
- Pi-native login/model commands remain available through the sealed Brunch profile.
- Default model is preferred but not enforced.
- No-auth orientation appears only when no model is actually usable.
- Every Pi thinking level renders safely in both Brunch themes.
- Existing provider retry and settlement behavior remains intact.

### Planning disposition

Fold directly into `walkthrough-remediation-2` / FE-1187. The current PLAN re-qualification context already points in this direction; this package supplies the Pi-native integration rationale and deletion target.

## P5 — Provider and cache observability

### Capabilities

- `before_provider_headers`
- `before_provider_request`
- `showCacheMissNotices`
- `agent_settled`
- `AgentSession.subscribe()` for parent/child session spans

### Opportunity

Brunch already captures selected provider payload information in dev-mode introspection. The new hooks permit a cleaner observability lifecycle:

```text
agent_start
  → provider request/header correlation
  → retries/compaction/subagent spans
  → agent_settled closes the top-level run
```

Potential readers:

- provider latency and retry diagnosis;
- cache-miss diagnosis during prompt/context work;
- parent/subagent span joining;
- transcript-native mechanism trace joined with event-plane timing.

### Recommended tracer

1. Compare existing `.brunch/debug/` + JSONL projections with one dev-gated event/span trace.
2. Enable cache-miss notices only in an explicit dev/eval configuration, or consume equivalent structured stats if Pi exposes them; do not add normal product transcript noise.
3. Use `before_provider_headers` only when a configured trace sink needs correlation. Prefer standard `traceparent` semantics over unconditional bespoke headers.
4. Close the run at `agent_settled`, not `agent_end`.
5. Join subagents through SDK subscriptions without making the event stream canonical product truth.

### Security constraints

- Never emit credentials or full provider headers.
- Redact or hash prompt/session identifiers before external transmission where appropriate.
- Do not transmit Brunch correlation headers to providers unless the configured tracing mode explicitly requires it and provider compatibility is known.
- Traces remain dev/eval artifacts; durable product state stays in transcript and graph stores.

### Verification

- Deterministic faux-provider span ordering across retry and queued continuation.
- Parent/subagent relationship survives concurrent child work.
- Header mutation is absent when tracing is disabled.
- Sensitive headers and prompt bodies are redacted by contract.
- Top-level span remains open after `agent_end` and closes at `agent_settled`.

### Planning disposition

Fold into `agent-tracing`, retaining its spike-first entry. Coordinate vocabulary with `mechanism-trace`, but preserve the distinction:

- mechanism trace: post-hoc transcript-native provenance;
- agent trace: event-plane timing and provider/subagent spans.

The two may join on identifiers and vocabulary without sharing authority.

## Monitored capabilities, not proposed packages

### Agent-core session storage and custom header metadata

Pi agent-core now exposes `InMemorySessionStorage`, `JsonlSessionStorage`, and custom JSONL header metadata. Brunch currently relies on coding-agent's `SessionManager`, which owns the interactive/session behavior Brunch needs. Replacing it would cross into a lower-level harness and duplicate services.

Revisit only if one of these becomes concrete:

- coding-agent cannot represent required session metadata;
- Brunch needs a non-file session backend;
- Brunch deliberately falls back from coding-agent to agent-core;
- session storage must be shared with another runtime independently of coding-agent.

### Ambient project-local Pi resources

Brunch's explicit `DefaultResourceLoader` seal is a valid embedded-product use of Pi's native API. Do not enable ambient project/global extensions, prompts, skills, themes, or append-system files merely for parity with standalone Pi.

Revisit only as a deliberate user-extension product capability with trust, discovery, diagnostics, and precedence defined together.

### Passive upgrade benefits

No Brunch integration package is required for:

- null transcript-content normalization;
- provider retry fixes;
- pricing/metadata corrections;
- TUI paste-marker cleanup;
- shell-path home expansion.

These remain covered by dependency verification unless a Brunch-specific regression appears.

## Dependency and overlap map

```text
P1 named inline identity
  └─ independent; safe early housekeeping

P4 native provider/model policy (FE-1187)
  ├─ may land before P3 to simplify auth/model access
  └─ supplies the long-term model selection used by compaction summaries

P3 native compaction continuity
  ├─ uses public Pi modelRegistry/context APIs so it can start independently
  ├─ should not depend on P5 tracing
  └─ should land before claiming long-session continuity

P2 ledger rendering
  ├─ independent of compaction implementation
  ├─ benefits from P3 because rendered history and model-facing continuity then agree across long sessions
  └─ belongs to deterministic orientation/chrome, not exchange rendering

P5 observability
  ├─ uses settlement semantics from P0
  ├─ can inspect P3 compaction spans after P3 lands
  └─ shares vocabulary, not authority, with mechanism-trace
```

## Suggested re-qualification outcome

### Admit or retain now

1. **FE-1187 provider/model reversal** — retain as active and explicitly frame it as deletion toward Pi-native provider/model behavior.
2. **Named inline extension identity** — admit as direct housekeeping or attach to the current Pi upgrade branch if branch ownership permits.
3. **Pi compaction continuity** — promote for design and frontier definition because compaction is already enabled and the continuity hook is not load-bearing.

### Candidate bounded additions

4. **Orientation ledger rendering** — admit as a small deterministic-orientation member if transcript legibility is part of the re-qualified arc; otherwise keep as a named opportunity with a concrete walkthrough trigger.
5. **Settlement relay consumption** — fold into the first web consumer that needs full-idle state; no standalone frontier.

### Keep spike-gated

6. **Agent/provider observability** — retain under `agent-tracing`, spike first, and compare against current debug/transcript evidence before adopting external tracing infrastructure.

### Continue monitoring

7. Agent-core storage/header metadata.
8. Ambient Pi resource discovery.

## Proposed canonical reconciliation after planning decisions

When the separate frontier-reorganization thread accepts or rejects these packages:

1. Update `memory/PLAN.md` sequencing and frontier definitions.
2. Record any changed product commitments in `memory/SPEC.md` as event decisions with pointers to the owning topology files.
3. Compaction reconciliation completed 2026-07-14: topology, SPEC D43-L/I28-L, and the `compaction/` implementation all describe the materialized native hook.
4. Update the relevant `src/**/TOPOLOGY.md` only when implementation changes current materialized state.
5. Convert admitted packages into `memory/cards/` scope files only after their plan-level tracker/branch boundaries are settled.
6. Delete this synthesis after its accepted content has canonical homes.

## Source references

- [Pi extension events and lifecycle](https://github.com/earendil-works/pi/blob/v0.80.6/packages/coding-agent/docs/extensions.md)
- [Pi SDK and named inline extensions](https://github.com/earendil-works/pi/blob/v0.80.6/packages/coding-agent/docs/sdk.md)
- [Pi compaction and custom summarization](https://github.com/earendil-works/pi/blob/v0.80.6/packages/coding-agent/docs/compaction.md)
- [Pi session format and custom entry rendering](https://github.com/earendil-works/pi/blob/v0.80.6/packages/coding-agent/docs/session-format.md)
- [`memory/PLAN.md`](../../memory/PLAN.md)
- [`memory/SPEC.md`](../../memory/SPEC.md)
- [`src/.pi/extensions/TOPOLOGY.md`](../../src/.pi/extensions/TOPOLOGY.md)
- [`src/rpc/TOPOLOGY.md`](../../src/rpc/TOPOLOGY.md)
