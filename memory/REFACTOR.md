## Problem Statement

Phase-closing behavior currently crosses too many seams with too little explicit domain structure.

From a developer’s perspective, three things are making the area harder to extend safely than it should be:

1. Workflow projection recovers closure provenance by re-reading persisted chat parts instead of trusting the phase-outcome model itself.
2. The typed confirmation payload is really two different commands hiding inside one loose object shape, so application code must rediscover intent by inspecting optional fields.
3. Close-action policy is duplicated across UI, controller, request handling, and workflow projection instead of being projected once and consumed everywhere.

The result is a shallow cluster: transport details leak into domain logic, invalid states remain representable, and the server and UI can drift when new phase-close behavior lands.

## Solution

Refactor phase closing into one explicit domain seam.

The target state is:

- phase outcomes persist closure provenance directly as durable workflow truth
- close commands are modeled as explicit variants rather than one optional-field blob
- close-action availability is projected once from workflow state and consumed by both UI and server
- application code orchestrates close actions by delegating to the shared phase-close model instead of reconstructing rules inline

This keeps the chat seam transcript-friendly while making workflow truth, action policy, and command intent legible to both humans and future slices.

## Commits

1. [x] Extract a dedicated phase-close command vocabulary and parser from the current confirmation payloads without changing behavior.
2. [x] Introduce a shared phase-action projection that answers which close actions are currently allowed for a phase, then switch existing UI/server checks to read that projection.
3. [x] Persist closure basis directly on phase outcomes while keeping workflow projection behavior unchanged through a compatibility read path.
4. [x] Cut workflow projection over to durable phase-outcome closure basis and remove transcript-driven closure-basis recovery.
5. [ ] Replace the loose confirmation shape with an explicit discriminated close-command union and update the chat/controller/request seams to use it end to end.
6. [ ] Delete compatibility branches and helper duplication left behind by the transition so phase closing reads as one deep module rather than a cross-layer patchwork.

## Decisions

- Modules built or modified: shared chat command schema, phase-outcome persistence model, workflow-state projection, chat request orchestration, workspace controller command submission, workspace phase-action rendering
- Interface changes: phase-close commands become explicit variants rather than one optional-field confirmation object
- Architectural decisions: close-action availability is projected from workflow state once and reused; workflow truth lives in phase outcomes, not in transcript reconstruction
- Schema changes: phase outcomes gain durable closure provenance so workflow projection no longer needs to recover it from confirmation-turn payloads
- API contracts: the existing chat seam stays the entrypoint for both interviewer-recommended and user-forced close paths

## Testing Decisions

- Good tests prove behavior, not helper structure: command parsing, action availability, persisted closure provenance, workflow projection after reload, and next-phase handoff
- The strongest existing safety net is already present: parts/schema tests for typed payload validation, database lifecycle tests for phase outcomes, core tests for next-phase selection, app tests for submit → persist → reload round trips, and workspace tests for close affordances and carried-debt visibility
- Prior art in the codebase favors round-trip and projection tests over implementation-mirroring tests; the refactor should preserve that style
- Add only the minimum characterization needed when a commit changes representation before behavior; otherwise prefer updating existing round-trip or projection tests

## Out of Scope

- New workflow phases beyond the current design-force-close path
- Richer readiness heuristics or additional debt metadata beyond closure provenance
- Manual testing capture or oracle redesign
- Generalized revisit or invalidation semantics beyond today’s active-path behavior
- Broader knowledge-workspace refactors unrelated to phase closing
