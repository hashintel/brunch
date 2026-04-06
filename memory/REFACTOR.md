## Problem Statement

The client currently has three connected forms of debt that make it slower, harder to reason about, and more failure-prone than it needs to be.

First, the default interview path carries too much optional rendering machinery on the critical path. Rich markdown, code-highlighting, diagram support, and the development debug surface are wired in as if they were always needed. That inflates the initial bundle and makes the main workspace pay for capabilities that are either rare, deferred, or developer-only.

Second, workspace state ownership is split across multiple authorities. Durable project snapshots, durable entity snapshots, and live in-flight chat messages are refreshed through different mechanisms with different timing. The result is a route-level data waterfall, duplicated invalidation logic, and a hydration policy that is implicit rather than declared. Same-project refreshes currently avoid clobbering local chat state, but they do so by accident of dependency selection rather than by an explicit rule.

Third, several client primitives are structurally weak. Some components kick off async work during render, some update derived bookkeeping only when counts change rather than when content changes, and several user actions fail silently. None of these are catastrophic on their own, but together they create the kind of low-grade flakiness that makes later feature work expensive.

From the developer's perspective, the client works today because optional concerns, durable state, and transient stream state are all interleaved in one runtime. That makes performance regressions, hydration drift, and "button did nothing" failures harder to diagnose than they should be.

## Solution

Refactor the client around explicit boundaries: a lean default interview path, a single durable workspace data model, and pure render primitives.

Target state:

- The default interview path is optimized for the common case: text-first conversation, question cards, and sidebar state. Heavy developer and rich-rendering capabilities load only when the user or route actually needs them.
- Durable workspace state has one owner. Project snapshots and entity snapshots are fetched and refreshed through one coherent query model, while the chat stream owns only transient in-flight message state.
- Chat hydration happens only at declared boundaries: initial project entry and explicit project navigation. Same-project refreshes update durable snapshots without implicitly resetting or rehydrating the visible transcript.
- Client writes use shared mutation patterns with visible error handling, so network and browser failures become diagnosable UI states instead of silent no-ops.
- Render primitives remain pure under React's retry and Strict Mode behavior: no render-time state resets, no async work started as an incidental side effect of rendering, and no stale derived bookkeeping based only on child counts.
- Development-only and advanced-rendering capabilities remain available, but they are layered on top of the core experience rather than embedded into it.

## Commits

1. [done] Add characterization coverage for the risky client seams before moving structure: preserve current workspace hydration behavior, observer-driven sidebar refresh, option-selection follow-through, progressive code-render fallback behavior, branch-selector replacement behavior, and a build-level oracle for what the default interview entrypoint is allowed to ship.
2. [done] Extract explicit client capability boundaries for streamed markdown rendering, reasoning rendering, code highlighting, and developer-only debug surfaces, without changing runtime behavior. This commit turns concrete heavy dependencies into named interfaces the rest of the client can depend on.
3. [done] Move the development debug surface behind a lazy route boundary so the normal interview startup path no longer eagerly imports developer-only code and its rendering dependencies.
4. Split advanced code-highlighting and diagram-capable rendering from the text-first message path, keeping immediate plain rendering available and loading richer enhancement only when the content or user action actually needs it.
5. Introduce a workspace data adapter that clearly separates durable project state, durable entity state, and ephemeral chat state, while preserving the current user-visible behavior. The goal of this commit is clarity of ownership, not changed semantics.
6. Change workspace loading so project and entity snapshots start together from a single project-scoped data entrypoint, eliminating the current route-to-sidebar waterfall while preserving the same visible data.
7. Tighten chat hydration policy so persisted turns seed the transcript only on initial project entry or explicit project navigation. Same-project refreshes should update durable snapshots and derived UI affordances without implicitly rewriting the in-flight transcript.
8. Convert workspace-side writes into typed shared mutations with explicit success and failure handling. Selection, project creation, and similar actions should all report failure states consistently and stop relying on silent early returns.
9. Refactor render-sensitive primitives so they stay pure under React retries: async highlighting starts from declared effects or loaders, derived branch state tracks content changes rather than only list length, and temporary UI timers or subscriptions remain cleanup-safe.
10. Add intent-based preloading and final performance guardrails for advanced rendering features so the client stays lean on first paint while still feeling fast once the user signals intent to use those features.

## Decisions

- This refactor is a client-architecture pass, not a feature-expansion pass. It is intended to make upcoming interview and phase work cheaper and safer.
- The default interview experience is text-first. Rich markdown, syntax highlighting, diagrams, and developer tooling are treated as progressive enhancement rather than baseline cost.
- Durable state is query-owned. Live streamed chat state is ephemeral and layered over the durable workspace snapshot rather than competing with it.
- Hydration is an explicit policy decision, not an incidental consequence of effect dependencies. The client must say when it is allowed to replace visible chat state from persistence.
- Mutations must have a shared error model. Browser capability failures, fetch failures, and non-success server responses should all be visible and diagnosable.
- Render-phase purity is a non-negotiable constraint for reusable primitives. Async work and state resets belong in explicit lifecycle boundaries, not in render.
- The development debug surface remains part of the codebase, but it is not part of the default production-critical path.
- This refactor intentionally treats the current streaming/rendering regressions and bundle bloat as symptoms of unclear boundaries rather than isolated one-line bugs.

## Testing Decisions

- Coverage is now sufficient to begin structural movement, but not to relax oracle discipline. The workspace oracle is now joined by characterization coverage for progressive code rendering, branch replacement stability, and build-level client-boundary inspection.
- Good tests here assert observable behavior rather than hook choreography. Examples: the transcript shown to the user does or does not reset at the right boundary, the sidebar updates after observer data arrives, a failed mutation produces visible feedback, and a code block renders immediately before richer enhancement arrives.
- Build-level verification matters for this refactor. A passing unit suite is not enough if the default entry bundle still pulls in developer-only or advanced-rendering code. The refactor needs a repeatable artifact-level check for that boundary.
- Query and loader tests should assert ownership and concurrency semantics, not the exact implementation shape. The important thing is that durable project and entity data begin loading together and settle into one coherent cache model.
- Component tests for render primitives should explicitly protect React safety properties: no render-time state update loops, stable cleanup, correct behavior when props change rapidly, and correct replacement when equal-length child collections change content.
- Prior art exists in the existing client integration harness and the server-side invariants. This refactor extends those oracles rather than replacing them.
- Structural movement also needs a source-level oracle: `capability-boundaries.test.ts` now proves that heavy client dependencies are imported only through named capability and route boundary modules, so later lazy-loading work can swap implementations without another wide mechanical rewrite.
- The build-boundary oracle now checks a stronger performance boundary as well: the default client entry still knows the `/debug` path exists, but it no longer inlines the debug surface itself, which must ship in a separate lazy chunk.

## Out of Scope

- Implementing new interview phases, phase transitions, or changing the interviewer / observer product behavior
- Reworking the server-side extraction model, turn-tree persistence model, or domain schema
- Replacing the current markdown, highlighting, or router libraries with entirely different vendors
- Multi-tab, offline-first, or collaborative state models
- Branching UX, export UX, CLI, or MCP work
- Broad visual redesign unrelated to state clarity, feedback quality, or performance boundaries
- Any change whose only purpose is aesthetic cleanup without improving ownership, performance, or runtime safety
