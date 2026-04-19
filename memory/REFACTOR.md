## Problem Statement

The merged-stream cutover is conceptually right but structurally split across too many seams. The system still models projected control affordances through turn-flavored types and transitional control-row knowledge, so the bottom-of-stream state is reconstructed from several booleans instead of one authoritative contract. That leaves invalid combinations representable, keeps legacy storage details visible to the client, and makes the main interview view responsible for projection policy instead of just rendering.

## Solution

Introduce one authoritative workspace-stream projection seam with a discriminated bottom-artifact contract and clearer artifact vocabulary. Durable conversational turns remain the branch-bearing spine, projected control artifacts become explicitly non-turn, and any lingering kickoff/recovery row compatibility is hidden behind one runtime adapter. The view then renders projected artifacts rather than recomputing stream semantics from loader state, ad hoc booleans, and transitional turn metadata.

## Commits

1. [done] Rename turn-flavored control terminology to artifact/control terminology so projected kickoff, recovery, and handoff states no longer read as durable turns.
2. [done] Introduce a single discriminated bottom-artifact model and route the controller/view bottom region through it so kickoff, recovery, proposal, generating, handoff, and completion states no longer depend on parallel booleans.
3. [done] Extract a workspace-stream projector that maps durable workflow state, conversational turns, and anchored closure facts into ordered render artifacts while preserving current behavior.
4. Move kickoff and recovery submission behind phase-entry and phase-continue intents so the client stops branching on whether a legacy control row exists.
5. Hide transitional kickoff and recovery row compatibility inside one server-side runtime adapter and stop exposing that implementation detail to controller logic.
6. Consolidate fixture seeding and capture rules around the same projected-control contract so manifest compilation, seeded scenarios, and round-trip capture all encode the same authority model.

## Decisions

- Keep active-path conversational turns as the only branch-bearing lineage seam.
- Treat kickoff, recovery, handoff, and completion as projected control artifacts rather than authored conversational turns.
- Make the bottom-of-stream state a first-class shared contract rather than a recomposed view concern.
- Preserve transitional storage compatibility only behind a server-owned adapter until the control-row plumbing can be deleted.
- Delay any broader naming migration outside this projector/control refactor.

## Testing Decisions

- The key tests should prove user-visible state projection, not internal helper choreography.
- Shared state-model tests should exhaustively cover bottom-artifact derivation and reject invalid state combinations.
- Controller and view integration tests should prove kickoff, recovery, review, closure, and closed-phase handoff behavior from projected state.
- Server tests should prove that phase-entry and phase-continue intents behave the same whether or not transitional control rows still exist internally.
- Fixture and walkthrough tests should prove that seeded durable authority round-trips back into the same projected landing and stream semantics.
- Existing coverage in the shared helper, controller, view, server app, and fixture test families is strong enough to support refactoring without a separate characterization phase.

## Out of Scope

- Full naming normalization from project to specification and scope to grounding.
- Broader workflow extraction unrelated to the merged-stream/control-artifact seam.
- New product behavior for review semantics, export semantics, or ontology changes.
- Manual-browser oracle expansion beyond what is needed to verify the refactor preserved kickoff and recovery reload behavior.
