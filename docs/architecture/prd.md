# Brunch POC Architecture PRD

This document extracts the final architectural position from [the source transcript](../../archive/docs/architecture/artifacts/transcript-of-pi-architecture-review.md) (archived). The transcript used the placeholder product name `foobar`; this document maps that proposal onto `brunch` and prefers later corrections over earlier statements when they conflict.

This is a POC PRD, not a declaration of shipped product truth. Its job is to state the architecture clearly enough that Brunch can prove or falsify the core bets in a deliberate order.

## Corrected Source Reading

The transcript changed its mind in several important places. This PRD adopts the corrected positions.

1. `pi-web-ui` and `pi-coding-agent` should be treated as peer consumers of `pi-agent-core`, not as one runtime sitting underneath the other.
2. `createAgentSessionServices` is a manual service bundle and composition root, not a DI container in the framework sense.
3. The right primary dependency for a Brunch-like product is `@earendil-works/pi-coding-agent`, not `pi-agent-core`, unless the harness proves too opinionated.
4. The product should converge on one primary command surface over JSON-RPC with subscriptions, rather than splitting core product behavior between RPC and REST.
5. Structured graph mutations should flow through typed commands and shared mutation handlers, not through generic CRUD as the semantic surface.
6. Cross-session continuity should be handled at the turn boundary through graph-revision detection, session interest sets, and injected world updates, not through ambient mid-turn mutation.
7. The browser stack should be a native Brunch React app built around TanStack Router and TanStack Query, not an adoption of `pi-web-ui`.
8. Transcript shorthand like `records.*` should not become product vocabulary; the durable product model is graph-native for specification truth and session-/turn-native for chat truth.

## Product Thesis

Brunch should be able to run as an opinionated local product layered on top of pi's coding-agent harness. A user runs `brunch` from a project directory. Brunch creates and owns a local `.brunch/` workspace containing:

- a graph-native spec workspace store, eventually spanning intent, oracle, design, and plan graph planes
- transcript persistence, starting with pi JSONL sessions if they can faithfully hold the required raw payloads and custom turn-side data
- local auth and settings state scoped to the product

The user and the agent co-author a specification workspace through graph-native nodes and edges. The intent graph remains the canonical source of specification meaning. Oracle, design, and plan graphs are durable downstream work-product planes accountable to that intent graph. The graph layer must remain structurally legal at write time and semantically inspectable as a first-class coherence state. The same local Brunch host must expose that system through TUI, web, RPC, and print modes without inventing separate data planes or mutation authorities for each mode.

## Delivery Posture

This POC should be treated as a likely architectural re-foundation rather than an incremental extension of the current trunk. If adopted, it should probably live on a separate long-running branch or alternate trunk such as `next`.

The reason is not just implementation volume. This architecture changes too many foundations at once to pretend it is a routine feature branch:

- local host and mode topology
- graph storage and mutation authority
- session continuity rules
- browser data plane
- web chat/UI composition model

The POC should therefore optimize for coherence within the new line rather than backward-compatible staging against the current trunk at every step.

## Durable Domains

### Spec Workspace Graphs

Brunch should not harden around generic "structured records" language. The long-term durable product model should follow the graph-plane direction in the archived `SPEC_WORKSPACE_GRAPHS.md` design doc (from the pre-`-omega` `brunch-next` repo; not present in this tree):

- `intent` graph as canonical specification meaning
- `oracle` graph as verification strategy and checks accountable to intent
- `design` graph as modules, interfaces, seams, and adapters accountable to intent
- `plan` graph as milestone/frontier/slice delivery claims accountable to intent, oracle, and design

The POC may start intent-first, but storage, transport, and naming should not lock Brunch into a fake generic `records.*` worldview.

### Session / Turn Transcript Substrate

The transcript store should be treated as a first-class architectural decision, not as an accidental side effect of whichever pi default happens to be present.

The session export in [archive/docs/architecture/artifacts/session-re-extending-sessions.jsonl](../../archive/docs/architecture/artifacts/session-re-extending-sessions.jsonl) (archived) sharpens the near-term posture:

- pi JSONL sessions are richer than a flat append log
- they already support tree structure, branch summaries, compaction entries, labels, model/thinking changes, `custom` entries, and `custom_message` entries
- they can be redirected to a project-local directory through `SessionManager.create(cwd, customDir)` or equivalent configuration
- they do not expose a supported storage-adapter seam behind `SessionManager`; persistence and session modeling are still coupled

The intended near-term strategy is therefore JSONL-first, not JSONL-dismissive. Brunch should begin by proving whether pi sessions can hold:

- raw assistant payloads
- raw user payloads
- structured turn artifacts and custom per-turn data on both sides
- continuity metadata such as `lastSeenLsn`, interest sets, and compaction anchors

If they can, JSONL remains the transcript authority for the POC. If they cannot, Brunch should introduce a richer session / turn substrate or a projection layer with explicit justification.

## Goals

1. Ship Brunch as a single installable local product rather than a fork of pi.
2. Reuse pi's agent harness, session machinery, and mode adapters where that saves work.
3. Introduce a first-class graph-native spec workspace owned by Brunch rather than treating the filesystem as the only structured state.
4. Make the browser a remote head over the same local host, not a separate application with a divergent backend contract.
5. Preserve agent continuity when other sessions or direct user edits change the graph between turns.
6. Make coherence visible to both the user and the agent as shared product state.
7. Prove whether pi JSONL sessions can serve as the durable transcript basis for the POC; if not, introduce a justified richer session / turn substrate.

## Non-goals

1. Exposing pi's extension, skill, prompt-template, or theme APIs directly to Brunch users in the POC.
2. Making REST the primary product API.
3. Supporting cloud-hosted, multi-machine, or organization-wide deployment in the POC.
4. Solving mid-turn distributed consistency beyond a clean turn-boundary policy.
5. Reusing `pi-web-ui` for the browser product surface in the POC.

## Product Shape

### User-facing modes

Brunch is one local product driven by a single `--mode` flag. It exposes four presentation modes:

1. `brunch` (default; `--mode tui`) - TUI over the local agent host. While the TUI runs it also starts a browser **sidecar** over the same host; the sidecar is not a separate mode.
2. `brunch --mode web` - standalone combined host (shipped FE-1200): serves the native React client and drives explicitly targeted hosted sessions directly, without constructing `InteractiveMode`. See [`docs/design/WEB_UI_ARCHITECTURE.md`](../design/WEB_UI_ARCHITECTURE.md).
3. `brunch --mode rpc` - exposes the local host over stdio JSON-RPC for other programs.
4. `brunch --mode print` - runs one-shot, headless prompts for scripting and pipelines.

The original POC framing below treated standalone web as a future feature; it has since become a primary presentation mode (D132-L/D133-L). The current-state authority is `memory/SPEC.md` plus the co-located `src/**/TOPOLOGY.md` homes.

These modes are not different products. They are ways of driving one Brunch host.

### Human-interactive versus headless behavior

Brunch should explicitly separate capabilities that can run unattended from capabilities that require a live human.

- Reads, queries, subscriptions, and safe agent-owned writes should work across all modes.
- Confirmation-gated or human-only actions should be native in the TUI (and the planned web surface), routable in RPC, and rejected or auto-policy-gated in print mode.
- `needs_human` should be a first-class structured outcome rather than an exceptional failure path.

### Mode Capability Matrix

Not every capability is symmetric across modes. The asymmetry follows from the medium, not from a split architecture. The Web column now describes the shipped standalone web surface as well as the TUI sidecar.

| Capability                                  | TUI     | Web           | Print          | RPC                        |
| ------------------------------------------- | ------- | ------------- | -------------- | -------------------------- |
| Read graph state / queries                  | yes     | yes           | yes            | yes                        |
| Write agent-owned graph fields              | yes     | yes           | yes            | yes                        |
| Subscribe to live updates                   | yes     | yes           | n/a            | yes                        |
| Confirmation-gated writes                   | yes     | yes           | policy only    | driver-mediated            |
| Human-only writes                           | yes     | yes           | cannot service | only if driver provides UI |
| Direct user graph editing without the agent | awkward | natural       | n/a            | n/a                        |
| Tool execution attribution                  | yes     | yes           | yes            | yes                        |

## Architecture Summary

Brunch should be structured as a local host with shared storage, shared mutation handlers, and multiple adapters.

```diagram
                         user runs `brunch [--mode ...]`
                                      |
                                      v
                           +-----------------------+
                           | Brunch CLI dispatcher |
                           +-----------+-----------+
                                       |
          +----------------------------+----------------------------+
          |                            |                            |
          v                            v                            v
    +-----------+               +-------------+               +-----------+
    | TUI mode   |               |  web mode   |               | rpc/print |
    | pi-driven  |               | sidecar +   |               | adapters  |
    | surface    |               | standalone  |               |           |
    +-----+------+               +------+------+               +-----+-----+
          |                             |                            |
          +-----------------------------+----------------------------+
                                        |
                                        v
                         +--------------------------------+
                         | Brunch local host              |
                         | - pi-coding-agent session      |
                         | - Brunch prompt + tool curation|
                         | - JSON-RPC dispatcher          |
                         | - shared command handlers      |
                         | - event stream                 |
                         +----------------+---------------+
                                          |
                +-------------------------+--------------------------+
                |                                                    |
                v                                                    v
    +--------------------------------------+            +----------------------------------+
    | Spec workspace graph store           |            | Transcript persistence           |
    | - intent/oracle/design/plan nodes    |            | - pi JSONL sessions first        |
    | - semantic edges                     |            | - raw assistant/user payloads    |
    | - graph clock + change log           |            | - custom/custom_message entries  |
    | - coherence state                    |            | - branch / compaction / labels   |
    +--------------------------------------+            | - richer substrate only if needed|
                                                        +----------------------------------+
```

## Core Architectural Decisions

### 1. Depend on `pi-coding-agent`, not only `pi-agent-core`

The POC should start from `@earendil-works/pi-coding-agent` and reuse:

- `createAgentSessionServices`
- `createAgentSessionFromServices` or equivalent session builders
- TUI and print mode adapters
- RPC mode machinery
- session logging and compaction seams
- tool registration and custom message plumbing

Dropping down to `pi-agent-core` should be a fallback only if Brunch proves too different from the coding-agent harness.

### 2. Brunch is an opinionated product, not a pi platform shell

Brunch may consume pi's extension and tool plumbing internally, but the POC should not expose pi's generic extension surface to end users. Brunch should instead:

- hardcode its own toolset
- hardcode its own system prompt and policy doctrine
- scope all product state to `.brunch/`
- hide pi's generic extension discovery and user-facing customization model

The important claim to prove is that pi can be used as an internal harness without forcing Brunch to become a pi distribution.

### 3. Product data is graph-native and session-native, not generic `records`

The transcript's `records.*` language was shorthand, not a naming decision. Brunch should not expose a fake-generic record model as if the domain were arbitrary rows.

The durable product model should be:

- graph-native for specification truth
- session-/turn-native for transcript truth

The public command surface should therefore converge on graph-native vocabulary such as `graph.*` or graph-plane-specific namespaces like `intent.*`, `oracle.*`, `design.*`, and `plan.*`, while keeping `session.*` for transcript/session operations.

### 4. One shared mutation surface owns graph truth

Every semantic graph mutation should go through Brunch-owned typed command handlers. The agent, the web UI, TUI slash commands, RPC clients, and any future webhook shims should all call the same command layer.

This layer should own:

- input validation
- structural legality checks
- optimistic concurrency checks
- event emission
- audit attribution
- coherence-dirtying or coherence refresh triggering

Agents and adapters must not mutate durable Brunch state by touching the ORM or SQLite connection directly.

### 5. Use JSON-RPC as the primary product protocol

The same product command surface should be available:

- over stdio for `--mode rpc`
- over WebSocket for the browser
- in-process for local agent tools and TUI actions

Core method families should include:

- `session.*` for agent/session control, transcript branching, and prompt submission
- `graph.*` for graph reads, mutations, subscriptions, and coherence
- graph-plane-specific families such as `intent.*`, `oracle.*`, `design.*`, and `plan.*` where sharper semantic boundaries are useful

HTTP may still exist, but only as a thin transport shim for things HTTP is uniquely good at:

- serving the static web bundle
- health checks
- uploads
- inbound webhooks

The browser should not depend on separate REST endpoints for ordinary Brunch state.

### 6. Store graph truth in graph-native persistence and use a JSONL-first transcript strategy

The POC should keep two kinds of durability in `.brunch/`:

1. SQLite-backed graph persistence for spec workspace state.
2. Transcript persistence, starting with pi SessionManager-backed JSONL in `.brunch/sessions/` if it proves sufficient.

Graph persistence should own:

- graph-plane nodes and semantic edges
- per-node / edge versions or equivalent entity-versioning metadata
- monotonic graph revision or log sequence numbers
- change log entries
- coherence verdicts and violations

Transcript persistence should own:

- raw user and assistant turn payloads
- structured turn artifacts and custom turn-side data
- session-scoped `lastSeenLsn`
- session interest sets
- compaction summaries and other transcript-local state

For the POC, the first attempt should be to encode these needs inside pi's existing session format using message entries, `custom` / `custom_message` entries, compaction and branch-summary details, labels, and session metadata where appropriate.

What pi does not currently offer is a supported storage-backend adapter. If JSONL proves insufficient, Brunch's fallback choices are:

- maintain a richer canonical substrate and project into pi-compatible JSONL when invoking pi
- mirror JSONL into richer local records while keeping JSONL authoritative for the POC
- modify pi itself to introduce a real session-store abstraction

## POC Component Boundaries

### Brunch host

The local host is the process-level authority. It should own:

- `.brunch/` path resolution from the current working directory
- lifecycle of the local agent session
- mode dispatch
- event fanout to TUI, browser, and RPC clients
- construction of the Brunch service bundle around pi

### Spec workspace graph subsystem

The graph subsystem should be a deep module with a small public surface:

- graph-plane commands for semantic writes
- graph-plane queries and projections
- subscriptions or event hooks for change streams
- structural and semantic validators
- graph clock and change-log services for cross-session detection

The subsystem should be forward-compatible with the spec workspace graph model in the archived `SPEC_WORKSPACE_GRAPHS.md` design doc (from the pre-`-omega` `brunch-next` repo; not present in this tree): intent as canonical meaning, with oracle, design, and plan as accountable downstream planes. The semantic API should prefer domain verbs and explicit transitions over raw table patches.

### Session transcript subsystem

The transcript subsystem should own Brunch's session and turn semantics even if the first implementation still rides on pi JSONL sessions.

Its responsibilities should include:

- session creation, branching, and identity
- durable turn storage for raw assistant and user payloads
- custom turn artifacts and sidecar data
- continuity metadata such as `lastSeenLsn`, interest sets, and compaction anchors
- JSONL encoding, import, export, or compatibility bridging as long as JSONL remains the underlying store

### pi adapter layer

The pi adapter layer should translate Brunch product concerns into concrete pi seams rather than treating pi as a black box.

The key seams are:

- the manual service bundle and two-stage construction path (`createAgentSessionServices` followed by session/runtime creation)
- the per-turn render pipeline (`transformContext`, `convertToLlm`, and `streamFn`)
- custom message-role declaration and projection
- `prepareNextTurn` for continuity injection
- the built-in extension API for tools, commands, hooks, and UI surfaces
- the existing JSON-RPC protocol as the basis for stdio and WebSocket transports

This layer should use pi's seams deliberately, but Brunch should remain the authority over policy and product behavior.

### Web client

The web client should be a native Brunch React app over a single WebSocket-backed RPC client. It should not invent a second mutation model, and it should not be built on `pi-web-ui`.

The browser stack direction for the POC should be:

- TanStack Router for route structure, loaders, and code-splitting
- TanStack Query for query, subscription cache, optimistic mutation, and invalidation ownership
- chat/message UI primitives built for Brunch on top of the Vercel AI SDK UI layer or TanStack AI-style primitives, rather than pi's browser package

This keeps the browser aligned with Brunch's existing React direction and avoids forcing a remote-agent compatibility layer around a package that assumes an in-process browser `Agent`.

## Prompt, Context, and Agent Integration

Brunch should use pi's existing turn-shaping seams deliberately.

### System prompt

Brunch should build one Brunch-specific system prompt at session start, likely reusing coding-agent machinery but replacing the coding-assistant orientation with:

- spec-workspace purpose and graph vocabulary
- graph command and authority rules
- workspace and `.brunch/` context
- coherence and repair behavior
- policy for asking versus acting

### Per-turn context shaping

Brunch should use pi's two existing message-rendering hooks:

- `transformContext` for compaction and transcript reshaping
- `convertToLlm` for projecting Brunch custom message roles into LLM-visible messages

This should remain the only sanctioned place where Brunch changes what the model sees from the underlying transcript.

### Custom message roles

The POC should plan for at least one Brunch-specific custom message role:

- `worldUpdate` - injected between turns when relevant graph state changed outside the current session

Later roles may include graph context summaries, repair suggestions, or review artifacts, but `worldUpdate` is the essential proof point.

### Tool model

Brunch should curate a mixed toolset:

- selected filesystem/project-context tools from pi where still useful
- new graph-oriented tools over spec-workspace nodes, edges, and coherence operations

The agent's graph tools should call Brunch's shared command/query layer, not SQLite directly.

## Authority Model

The POC should assume that the agent acts as a delegate inside a human-owned workspace.

### Required properties

1. Every graph mutation is attributable.
2. Writes are classified by authority level.
3. Concurrency conflicts are explicit rather than silent.
4. Human-only actions remain enforceable even when the agent requests them.

### Action tiers

Brunch should support three policy tiers that mirror the transcript's direction:

1. Autonomous - reads and safe agent-owned writes.
2. Requires confirmation - shared-field or higher-risk mutations.
3. Human-only - the agent can request, but not directly perform, the action.

Headless modes should either reject human-needed actions with a structured result or proceed only under an explicit auto-policy.

### Concurrency

Graph writes should include optimistic-concurrency information such as `ifVersion`. Version conflicts should produce structured outcomes that both the UI and the agent can handle.

## Frontend Architecture

The React client should treat the WebSocket RPC channel as the primary data plane.

### Client primitives

The web app needs three client primitives over one connection:

1. Query - one-shot request/response for metadata and occasional reads.
2. Subscription - initial state payload plus pushed updates for graph views and session state.
3. Mutation - writes that update shared caches and surface structured conflicts.

### Recommended stack

The transcript's recommendation should carry into the POC:

- TanStack Router for route modeling, preload, and code-splitting
- one singleton `RpcClient`
- one WebSocket connection
- React hooks layered over the RPC client
- TanStack Query for cache ownership, deduplication, optimistic updates, and re-render scheduling
- AI-SDK-oriented chat UI components or thin Brunch-owned wrappers over them for messages, streaming state, and input composition

Graph views should generally be subscription-first rather than GET-first. If an initial HTML seed is needed later, it should hydrate the same cache entries rather than define a second read path.

## Continuity, Divergence, and Coherence

This is the core product-specific architectural challenge. The problem decomposes into four orthogonal questions that Brunch should answer separately and then compose:

```diagram
╭─ "Has the world changed since this session last looked?" ─────╮
│  Q1: DETECTION   — did anything change at all?                │
│  Q2: RELEVANCE   — of what changed, what matters here?        │
│  Q3: COHERENCE   — is the graph still globally legal?         │
│  Q4: RECONCILE   — how does the agent learn about it?         │
╰───────────────────────────────────────────────────────────────╯
```

### Detection

Every durable graph mutation should advance a monotonic graph revision, such as an LSN, via a graph clock and append to a change log. Between turns, a session compares its `lastSeenLsn` with the current graph revision.

### Relevance

Each session should maintain an interest set representing the graph items it has recently read, written, or explicitly discussed. The fuller model should support:

- direct interest: items the session read, wrote, or subscribed to
- mentioned interest: graph items named in user or assistant turns
- neighborhood interest: nearby related items derived from the first two sets

On turn boundaries, Brunch should filter the global change log against that interest set so the agent only receives relevant divergence.

The POC can start with a direct interest set only. Neighborhood expansion can wait.

### Structural versus semantic legality

Brunch should separate two kinds of graph validity:

1. Structural legality - local invariants enforced synchronously at write time.
2. Semantic coherence - global graph quality tracked as a first-class state that may lag the latest write briefly.

The graph should never commit structurally illegal state. Semantic coherence, however, should be represented explicitly as something like `clean`, `dirty`, `validating`, or `incoherent`, along with machine-readable violations.

### Turn-boundary reconciliation

Before each model call, Brunch should run a `prepareNextTurn`-style check that:

1. compares the session's `lastSeenLsn` with the current graph revision
2. fetches relevant external changes
3. reads the current coherence state
4. appends a `worldUpdate` custom message when the session needs to know about divergence

Brunch should treat a turn as a stable-context reasoning unit. Mid-turn external changes should normally surface on the next turn, not mutate the current turn's world under the agent.

### Within-turn consistency

A turn should reason over a stable context. If relevant external writes land during the turn, the default POC stance should be accept-and-flag at the boundary rather than live mid-turn interruption: surface the divergence on the next turn, and let coherence state reflect the disturbance.

### Compaction must carry the coherence anchor

When a session compacts, the compaction summary should preserve enough graph context to keep the session grounded: current interest anchors, major relevant graph items, and the most recent coherence verdict. Otherwise long conversations lose continuity exactly when they most need it.

## Product Requirements

1. Brunch must be installable and runnable as a single local CLI product from any project directory.
2. Brunch must scope its durable state to `.brunch/` under the current working directory.
3. Brunch must reuse pi's coding-agent harness rather than fork pi for the POC.
4. Brunch must expose TUI, web, RPC, and print modes over the same local host authority.
5. Brunch must store spec-workspace graph truth in SQLite-backed graph-native persistence.
6. Brunch must prove that transcript persistence is rich enough for raw assistant and user payloads plus custom turn data, whether by using pi JSONL sessions directly or by introducing a justified fallback substrate.
7. Brunch must route all graph mutations through one Brunch-owned command layer.
8. Brunch must use JSON-RPC as the primary browser and RPC transport.
9. Brunch must support subscriptions as a first-class transport primitive for both session and graph state.
10. Brunch must support structured `needs_human` outcomes.
11. Brunch must detect relevant cross-session graph changes between turns.
12. Brunch must surface coherence as shared product state to both user and agent.
13. Brunch must treat the intent graph as canonical specification meaning, with oracle, design, and plan graphs as accountable downstream planes.

## POC Milestone Ladder

The POC should be sequenced as a ladder of thin architectural proofs. Each milestone should establish one more durable claim than the previous one.

### M0 — Walking skeleton (Node binary + TUI)

Prove the wrapping model works at all.

- `brunch` binary exists and launches a pi-backed TUI session.
- `.brunch/` pathing replaces pi's default local state paths.
- Brunch owns the prompt and curated toolset.

### M1 — Mode shell (print + rpc delegated)

Prove the mode dispatcher.

- `--mode print` and `--mode rpc` run from the same Brunch-owned host setup.
- all three pi-backed modes share one coherent local authority model.
- the JSON-RPC stdio surface is exercised end-to-end by probe drivers that leave transcript artifacts; see [probes-and-transcripts.md](./probes-and-transcripts.md). Older curated-brief fixture captures have been retired in favor of current probe runs.

### M2 — JSONL session viability

Prove whether pi JSONL sessions are sufficient as the transcript authority for the POC.

- `.brunch/sessions/` is backed by pi `SessionManager` in a project-local directory
- raw assistant and user payloads survive reload
- required Brunch-specific turn data can be represented through existing entry shapes or well-scoped conventions around them
- if JSONL is insufficient, the missing capabilities are sharply documented and the fallback path is explicit

### M3 — Web shell over the same host

Prove the browser can be a thin remote head over the same Brunch host.

- the browser is served as a read-only **TUI sidecar** (standalone `--mode web` is deferred to a future milestone)
- the app uses TanStack Router and TanStack Query over one WebSocket RPC client
- no second backend API is invented

### M4 — Graph data plane (intent-first, workspace-graph-ready)

Prove the graph-native structured store.

- SQLite-backed graph persistence exists
- intent-plane nodes and edges are durable
- storage and transport remain forward-compatible with oracle, design, and plan planes
- graph clock, change log, and coherence state have named homes

### M5 — Agent ↔ graph integration

Prove that the agent can manipulate graph truth through Brunch-owned commands.

- Brunch installs graph tools through pi's extension seams
- agent graph operations route through the shared command layer rather than direct DB access
- web, TUI, and agent all observe the same changes

### M6 — Authority model and gated tools

Prove the action-tier policy end to end.

- autonomous, confirmation-gated, and human-only actions are distinguished clearly
- headless modes fail or delegate cleanly
- attribution and optimistic concurrency are shared across callers

### M7 — Detection, relevance, and turn-boundary reconciliation

Prove the continuity loop through the next-turn seam.

- graph revision tracking exists
- session interest sets exist
- `prepareNextTurn` can inject `worldUpdate` before the next model call

### M8 — Coherence as a first-class graph property

Prove that global graph legality is visible and queryable.

- structural legality is enforced synchronously
- semantic coherence is stored as explicit product state
- UI and agent both read the same coherence verdict

### M9 — Compaction-aware continuity and conflict widening

Prove that long-running sessions remain grounded.

- compaction preserves graph and coherence anchors
- interest sets can widen beyond direct reads if needed
- conflict signaling remains intelligible even as sessions grow long

## Demo Scenarios The POC Should Support

1. A user starts `brunch` in a project directory, creates the first graph items with the agent, quits, and resumes later with all state preserved under `.brunch/`.
2. Raw assistant and user turn payloads, plus Brunch-specific turn data, survive reload through pi JSONL sessions or a clearly justified fallback.
3. A user runs the TUI and opens the read-only web sidecar against the same workspace; edits made via the TUI/agent appear live in the sidecar through subscriptions. (Editing from the browser is a future web-mode capability.)
4. A second session or direct edit changes an item relevant to the first session; the next agent turn receives a `worldUpdate` and reacts coherently.
5. A change introduces a semantic graph violation; the UI shows coherence as degraded and the agent is informed on the next turn.
6. The agent attempts a human-gated change in print or RPC mode and receives a structured `needs_human` or version-conflict response instead of silently mutating state.

## Success Criteria

The POC is successful if it demonstrates all of the following:

1. Brunch can be built as a local product over pi without a fork.
2. The spec-workspace graphs, session transcript substrate, and browser/TUI surfaces share one authority model.
3. The browser does not require a second primary data plane.
4. Cross-session graph changes are surfaced to the agent coherently at turn boundaries.
5. Coherence is explicit product state, not an implicit hope.
6. The `next`-line browser implementation is coherent with Brunch's TanStack React stack rather than anchored to `pi-web-ui` reuse.
7. The transcript strategy is validated: pi JSONL sessions are sufficient for the POC, or their insufficiency is sharply bounded with a justified fallback.

## Open Questions Deferred Beyond The POC

1. Whether the chat UI should lean more heavily on Vercel AI SDK primitives, TanStack AI primitives, or a thin Brunch-owned abstraction spanning both ideas.
2. Whether public graph commands should remain under one `graph.*` umbrella or split earlier into `intent.*`, `oracle.*`, `design.*`, and `plan.*` namespaces.
3. Whether all required Brunch turn-side data fits cleanly inside pi's session entry types and extension entry mechanisms without warping their semantics.
4. How much neighborhood expansion or dependency tracking is needed before interest-set filtering becomes trustworthy for larger graphs.
5. Whether semantic coherence validation should remain local and synchronous enough for the POC or graduate into a more incremental validator architecture.
6. Whether later HTTP shims for uploads, webhooks, curl-friendly reads, or permalinks are worth adding after the core RPC-first architecture is proven.
