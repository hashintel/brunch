## Problem Statement

The workspace boundary is carrying too much hidden synchronization work.

Two user-visible flows still depend on post-render correction instead of clear ownership:

- chat state is replaced after render when project identity changes
- workspace entity data is mirrored from route-loaded state into cached query state after render

At the same time, the JSON transport boundary is too implicit:

- client-facing types are derived from server implementation return types instead of an explicit transport contract
- loaders and mutations trust JSON payloads by assertion rather than runtime proof
- several request and review payloads still encode meaningful states through optional fields

Together, this makes refactoring riskier than it needs to be. State ownership is harder to reason about, stale-frame behavior is harder to rule out, and server refactors can widen or reshape client contracts without that change becoming explicit.

## Solution

Refactor the workspace and transport seams around explicit contracts and single-owner state boundaries.

Target state:

- the REST/JSON boundary is defined by shared transport DTOs or schemas, not by server implementation inference
- client loaders and mutations parse validated transport payloads instead of casting JSON
- chat reset on project identity change happens through ownership/remount semantics rather than an effect that overwrites live state after render
- entity data has one authority per route transition, with loader/query coordination happening through an explicit boundary instead of effect-driven cache mirroring
- exported boundary functions touched by this work expose explicit signatures
- snapshot and view-model types touched by the refactor express immutability directly

This keeps the refactor focused on the highest-risk overlap between the React review and the TypeScript review: boundary drift plus effect-driven synchronization in the workspace flow.

## Commits

1. Add characterization coverage for the refactor seam: project navigation, same-project refresh, entity refresh after observer invalidation, and JSON-boundary success/failure cases.
2. Introduce explicit shared transport contracts for project state, entity payloads, export payloads, mutation errors, and turn-response request/response payloads without changing runtime behavior yet.
3. Move client loader and mutation helpers to parse transport payloads through those shared contracts and remove unchecked JSON casts from the workspace-facing routes and mutations.
4. Narrow the turn-response and review payload shapes so meaningful request modes are represented explicitly instead of through bags of optional fields.
5. Add explicit return types to the exported boundary functions touched by the transport pass so the module surfaces stay legible during later commits.
6. Put the live chat owner behind a project-identity reset boundary and delete the post-render chat hydration overwrite.
7. Collapse workspace entity hydration to one authority per route transition and remove the effect-based loader-to-cache mirroring step.
8. Mark touched snapshot and view-model contracts as readonly and normalize type-only imports in the refactored boundary modules.

## Decisions

- Recommended scope: one boundary-first refactor centered on workspace transport and state ownership, not a repo-wide hygiene sweep.
- Shared transport contracts become the authority for REST/JSON payload shape at the client/server seam.
- The live chat session owns only in-session state; route identity owns when seeded history resets.
- Entity state must have one clear owner per navigation event; cache refresh should be explicit, not mirrored after render.
- Optional-field cleanup is limited to payloads directly in this seam, not every optional-heavy type in the repo.
- Explicit return types and readonly modeling are included only for modules touched by this refactor, not as a global style pass.

## Testing Decisions

- Test behavior, not implementation: navigation should show the correct transcript without stale carryover; same-project refresh should preserve live chat while durable state updates; entity refresh should converge through one authority; malformed JSON should fail at the boundary with controlled errors.
- Use the existing workspace controller, workspace data, workspace loader, export loader, client mutation, and app-route tests as prior art.
- Prefer contract tests around transport parsing and route behavior over tests that assert internal hook/effect structure.
- Characterization tests are sufficient to begin; this area already has meaningful coverage, so the first commit can strengthen boundary-focused tests instead of blocking the refactor behind a separate testing-only project.

## Out of Scope

- Vendor-like UI source and AI-elements internals.
- A repo-wide explicit-return-type campaign.
- A repo-wide import-hygiene cleanup.
- Full replacement of every implementation-derived shared type in unrelated server/client areas.
- Drizzle assertion cleanup outside the touched transport seam.
- New workflow features or UX redesign beyond preserving current behavior while clarifying boundaries.
