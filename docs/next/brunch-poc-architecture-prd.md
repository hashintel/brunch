# Brunch POC Architecture PRD

This document extracts the final architectural position from [the source transcript](./transcript-of-pi-architecture-review.md). The transcript used the placeholder product name `foobar`; this document maps that proposal onto `brunch` and prefers later corrections over earlier statements when they conflict.

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

## Product Thesis

Brunch should be able to run as an opinionated local product layered on top of pi's coding-agent harness. A user runs `brunch` from a project directory. Brunch creates and owns a local `.brunch/` workspace containing:

- an SQLite intent-graph store
- raw session history, likely still JSONL
- local auth and settings state scoped to the product

The user and the agent co-author a project specification as an intent graph. The graph must remain structurally legal at write time and semantically inspectable as a first-class coherence state. The same local Brunch host must expose that system through TUI, web, RPC, and print modes without inventing separate data planes or mutation authorities for each mode.

## Delivery Posture

This POC should be treated as a likely architectural re-foundation rather than an incremental extension of the current trunk. If adopted, it should probably live on a separate long-running branch or alternate trunk such as `next`.

The reason is not just implementation volume. This architecture changes too many foundations at once to pretend it is a routine feature branch:

- local host and mode topology
- graph storage and mutation authority
- session continuity rules
- browser data plane
- web chat/UI composition model

The POC should therefore optimize for coherence within the new line rather than backward-compatible staging against the current trunk at every step.

## Goals

1. Ship Brunch as a single installable local product rather than a fork of pi.
2. Reuse pi's agent harness, session machinery, and mode adapters where that saves work.
3. Introduce a first-class intent-graph store owned by Brunch rather than treating the filesystem as the only structured state.
4. Make the browser a remote head over the same local host, not a separate application with a divergent backend contract.
5. Preserve agent continuity when other sessions or direct user edits change the graph between turns.
6. Make coherence visible to both the user and the agent as shared product state.

## Non-goals

1. Exposing pi's extension, skill, prompt-template, or theme APIs directly to Brunch users in the POC.
2. Making REST the primary product API.
3. Supporting cloud-hosted, multi-machine, or organization-wide deployment in the POC.
4. Solving mid-turn distributed consistency beyond a clean turn-boundary policy.
5. Reusing `pi-web-ui` for the browser product surface in the POC.

## Product Shape

### User-facing modes

Brunch should expose one local product with four presentation modes:

1. `brunch` - default TUI over the local agent host.
2. `brunch --mode web` - launches a local HTTP server and browser UI over the same host.
3. `brunch --mode rpc` - exposes the local host over stdio JSON-RPC for other programs.
4. `brunch --mode print` - runs one-shot, headless prompts for scripting and pipelines.

These modes are not four different products. They are four ways of driving one Brunch host.

### Human-interactive versus headless behavior

Brunch should explicitly separate capabilities that can run unattended from capabilities that require a live human.

- Reads, queries, subscriptions, and safe agent-owned writes should work across all modes.
- Confirmation-gated or human-only actions should be native in TUI and web, routable in RPC, and rejected or auto-policy-gated in print mode.
- `needs_human` should be a first-class structured outcome rather than an exceptional failure path.

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
    | TUI mode   |               | web mode    |               | rpc/print |
    | pi-driven  |               | local HTTP  |               | adapters  |
    | surface    |               | + WS shell  |               |           |
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
    +----------------------------+                      +-----------------------+
    | SQLite intent graph        |                      | Session/log storage   |
    | - records                  |                      | - raw transcript      |
    | - edges                    |                      | - lastSeenLsn         |
    | - change log               |                      | - interest set        |
    | - coherence state          |                      | - compaction state    |
    +----------------------------+                      +-----------------------+
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

### 3. One shared mutation surface owns graph truth

Every semantic graph mutation should go through Brunch-owned typed command handlers. The agent, the web UI, TUI slash commands, RPC clients, and any future webhook shims should all call the same command layer.

This layer should own:

- input validation
- structural legality checks
- optimistic concurrency checks
- event emission
- audit attribution
- coherence-dirtying or coherence refresh triggering

Agents and adapters must not mutate durable Brunch state by touching the ORM or SQLite connection directly.

### 4. Use JSON-RPC as the primary product protocol

The same product command surface should be available:

- over stdio for `--mode rpc`
- over WebSocket for the browser
- in-process for local agent tools and TUI actions

Core method families should include:

- `session.*` for agent/session control
- `records.*` for graph reads and writes
- `graph.*` or `coherence.*` for graph status, validation, and diagnostics

HTTP may still exist, but only as a thin transport shim for things HTTP is uniquely good at:

- serving the static web bundle
- health checks
- uploads
- inbound webhooks

The browser should not depend on separate REST endpoints for ordinary Brunch state.

### 5. Store graph truth in SQLite and session truth beside it

The POC should keep two kinds of durability in `.brunch/`:

1. SQLite for the intent graph and graph-level operational state.
2. Raw transcript/session storage for the agent conversation, likely still JSONL while pi's existing session machinery is reused.

SQLite should own:

- graph records and edges
- per-record versions
- monotonic graph revision or log sequence numbers
- change log entries
- coherence verdicts and violations

Session storage should own:

- raw turn history
- session-scoped `lastSeenLsn`
- session interest sets
- compaction summaries and other transcript-local state

## POC Component Boundaries

### Brunch host

The local host is the process-level authority. It should own:

- `.brunch/` path resolution from the current working directory
- lifecycle of the local agent session
- mode dispatch
- event fanout to TUI, browser, and RPC clients
- construction of the Brunch service bundle around pi

### Intent graph subsystem

The graph subsystem should be a deep module with a small public surface:

- `commands` for semantic writes
- `queries` for reads and projections
- `subscriptions` or event hooks for change streams
- `validators` for structural and semantic checks
- `clock/change-log` for cross-session detection

The semantic API should prefer domain verbs and explicit transitions over raw table patches.

### pi adapter layer

The pi adapter layer should translate Brunch product concerns into pi harness hooks:

- curated tool registration
- Brunch system-prompt construction
- `prepareNextTurn` continuity checks
- custom message-role declaration and projection
- compaction policies that preserve graph-awareness

This layer should use pi's seams, but Brunch should remain the authority over policy and product behavior.

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

- intent-graph purpose and vocabulary
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

Later roles may include graph snapshot summaries, repair suggestions, or review artifacts, but `worldUpdate` is the essential proof point.

### Tool model

Brunch should curate a mixed toolset:

- selected filesystem/project-context tools from pi where still useful
- new graph-oriented tools such as query, get, create, update, and subscribe variants

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
2. Subscription - initial snapshot plus pushed updates for graph views and session state.
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

This is the core product-specific architectural challenge.

### Detection

Every durable graph mutation should advance a monotonic graph revision, such as an LSN, and append to a change log. Between turns, a session compares its `lastSeenLsn` with the current graph revision.

### Relevance

Each session should maintain an interest set representing the graph items it has recently read, written, or explicitly discussed. On turn boundaries, Brunch should filter the global change log against that interest set so the agent only receives relevant divergence.

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

Brunch should treat a turn as a snapshot-oriented reasoning unit. Mid-turn external changes should normally surface on the next turn, not mutate the current turn's world under the agent.

## Product Requirements

1. Brunch must be installable and runnable as a single local CLI product from any project directory.
2. Brunch must scope its durable state to `.brunch/` under the current working directory.
3. Brunch must reuse pi's coding-agent harness rather than fork pi for the POC.
4. Brunch must expose TUI, web, RPC, and print modes over the same local host authority.
5. Brunch must store intent-graph truth in SQLite.
6. Brunch must preserve raw conversation/session history separately from graph truth.
7. Brunch must route all graph mutations through one Brunch-owned command layer.
8. Brunch must use JSON-RPC as the primary browser and RPC transport.
9. Brunch must support subscriptions as a first-class transport primitive for both session and graph state.
10. Brunch must support structured `needs_human` outcomes.
11. Brunch must detect relevant cross-session graph changes between turns.
12. Brunch must surface coherence as shared product state to both user and agent.

## POC Proof Ladder

The POC should be sequenced as a ladder of architectural proofs. Each step should make one stronger claim than the previous one.

### Proof 1: Brunch can wrap pi without becoming pi

Build a minimal `brunch` CLI that launches a pi-backed session with Brunch-owned paths, prompt, and curated tools.

What this proves:

- Brunch can ship as an opinionated product over `pi-coding-agent`.
- `.brunch/` can cleanly replace pi's default local state paths.
- Brunch can hide pi's generic user-facing extension surface.

### Proof 2: Brunch can own structured graph state beside pi session logs

Add SQLite-backed intent-graph storage under `.brunch/data.db` while retaining transcript/session durability beside it.

What this proves:

- graph truth and session truth can coexist without being collapsed into one storage model
- Brunch can introduce durable structured state without forking the harness

### Proof 3: Agent graph tools and product UIs can share one mutation surface

Add Brunch-owned command/query handlers and wire agent graph tools through them.

What this proves:

- the agent does not need privileged DB access
- the same semantics can be reused by TUI, web, and RPC callers
- authority, attribution, and validation can live in one place

### Proof 4: Web mode can be a thin remote head over the same host

Add `--mode web` as a local HTTP server plus WebSocket RPC client, implemented as a native Brunch React app with TanStack Router and TanStack Query, without inventing a separate backend API.

What this proves:

- the browser can remain a view over the same Brunch host
- TUI and web can share one session and one graph authority
- Brunch does not need a second product architecture for the browser
- Brunch does not need `pi-web-ui` to get a credible web surface

### Proof 5: Subscription-first React data loading is enough

Add a React client with query, subscription, and mutation hooks over one WebSocket RPC connection.

What this proves:

- graph views do not need a primary REST GET layer
- live graph and session state can update without polling
- TanStack Query can own cache and mutation ergonomics over RPC

### Proof 6: Cross-session continuity can be preserved at the turn boundary

Add graph revision tracking, session `lastSeenLsn`, session interest sets, and `worldUpdate` injection before the next turn.

What this proves:

- the agent can remain aware of relevant changes made elsewhere
- continuity can be restored without ambient mid-turn mutation
- multi-session editing does not immediately destroy conversational coherence

### Proof 7: Structural legality and semantic coherence can be separated cleanly

Add synchronous structural validation and explicit coherence-state tracking with machine-readable violations.

What this proves:

- Brunch can reject structurally illegal writes immediately
- Brunch can represent semantic uncertainty and incoherence honestly
- the UI and agent can share the same view of graph health

### Proof 8: Human authority can remain legible across all modes

Add action-tier policies, structured confirmation paths, and version-conflict handling.

What this proves:

- Brunch can distinguish safe autonomous actions from human-gated actions
- headless modes can fail cleanly rather than silently overstepping authority
- the graph can remain trustworthy under concurrent human and agent editing

## Demo Scenarios The POC Should Support

1. A user starts `brunch` in a project directory, creates the first graph items with the agent, quits, and resumes later with all state preserved under `.brunch/`.
2. A user opens TUI and web mode against the same workspace, edits graph items in one surface, and sees the other surface update live through subscriptions.
3. A second session or direct edit changes an item relevant to the first session; the next agent turn receives a `worldUpdate` and reacts coherently.
4. A change introduces a semantic graph violation; the UI shows coherence as degraded and the agent is informed on the next turn.
5. The agent attempts a human-gated change in print or RPC mode and receives a structured `needs_human` or version-conflict response instead of silently mutating state.

## Success Criteria

The POC is successful if it demonstrates all of the following:

1. Brunch can be built as a local product over pi without a fork.
2. The intent graph, session transcript, and browser/TUI surfaces share one authority model.
3. The browser does not require a second primary data plane.
4. Cross-session graph changes are surfaced to the agent coherently at turn boundaries.
5. Coherence is explicit product state, not an implicit hope.
6. The `next`-line browser implementation is coherent with Brunch's TanStack React stack rather than anchored to `pi-web-ui` reuse.

## Open Questions Deferred Beyond The POC

1. Whether the chat UI should lean more heavily on Vercel AI SDK primitives, TanStack AI primitives, or a thin Brunch-owned abstraction spanning both ideas.
2. Whether the eventual graph command surface should remain generic `records.*` or evolve toward more domain-specific method families.
3. Whether transcript storage should remain JSONL long-term or eventually move into SQLite once the graph architecture stabilizes.
4. How much neighborhood expansion or dependency tracking is needed before interest-set filtering becomes trustworthy for larger graphs.
5. Whether semantic coherence validation should remain local and synchronous enough for the POC or graduate into a more incremental validator architecture.
