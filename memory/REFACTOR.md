## Problem Statement

The interview flow is carrying convergence debt across four connected seams:

- durable project state is split across route loaders, local chat state, and query state
- the runtime model still advertises multi-phase interviewing while the live product is effectively scope-only
- the client/server boundary is "shared" through inferred server module types rather than explicit seam contracts
- the highest-risk client sync path still lacks a browser-level oracle

From the developer's perspective, the app mostly works because several mechanisms happen to line up, not because the ownership model is explicit. That makes the live streaming regression harder to diagnose and puts later phase work on top of unstable footing.

## Solution

Make the workspace state model explicit before adding more interview behavior.

Target state:

- TanStack Query owns durable server snapshots for project state and entities
- the chat stream owns only live in-flight UI message state
- hydration happens only at explicit boundaries, not on generic invalidation
- the current runtime is honest about being scope-first until phase transitions are implemented
- project and entity payloads are owned by explicit boundary contracts rather than inferred from server module layout
- a browser-level integration oracle protects observer reactivity and same-project hydration behavior

## Commits

1. Add characterization coverage for the current workspace seam: initial hydration, same-project refresh behavior, observer-result sidebar updates, and option-selection follow-through. This commit establishes the missing browser oracle before any structural changes.
2. Extract explicit project-state and entity boundary contracts, plus shared fetch/query helpers, without changing runtime behavior. This makes the client/server seam stable before state ownership moves.
3. Introduce a workspace state adapter that centralizes chat hydration and message rehydration rules behind one interface. Keep behavior the same while making the current ownership model visible and testable.
4. Move durable project state onto TanStack Query and change route loaders into query-seeding entry points rather than parallel data authorities. Leave the chat stream behavior unchanged in this step.
5. Move entity synchronization fully behind the same query model and replace ad hoc invalidation wiring with typed stream-driven query updates. Keep the observer payload semantics unchanged.
6. Restrict chat hydration to explicit boundaries only: initial workspace load and project navigation. Remove same-project loader invalidation as an implicit chat reset mechanism.
7. Convert option selection and other workspace-side writes into typed mutations integrated with the shared state adapter, so the turn tree, chat stream, and query cache advance through one coordinated path.
8. Make the runtime phase model honest: either freeze the current public flow as scope-only or thread explicit phase provenance through the web path without implying that later phases are already operational. This is the last step because it changes surface semantics, not just structure.

## Decisions

- This refactor is centered on state ownership and seam integrity, not on adding new interview behavior.
- The durable web-path state model will be query-first, with the chat stream treated as ephemeral UI state layered on top.
- Boundary contracts are first-class modules, not incidental return-type aliases from server internals.
- The current multi-phase domain model stays in the schema, but the web runtime must stop implying behavior that has not been implemented yet.
- The live streaming regression is treated as a downstream symptom of unclear ownership; the refactor establishes the footing needed to fix it safely.
- The README update is considered already handled and is not part of this refactor.

## Testing Decisions

- Good tests here prove user-visible behavior at the seam: chat resumes correctly, sidebar data updates after observer output, and same-project refreshes do not silently clobber or stale the workspace.
- The first new oracle should run at the browser or client-integration layer, because the current risk is specifically in the runtime interplay between chat hooks, query cache, and route invalidation.
- Contract tests should protect project-state and entity payloads independently from server module structure.
- Query-state tests should assert cache ownership and synchronization behavior, not implementation details such as which hook calls invalidate first.
- Prior art already exists in the backend-focused app, parts, context, and DB tests; this refactor adds the missing client-facing oracle rather than replacing those tests.

## Out of Scope

- Implementing phase transitions, resolution tools, or the later design, requirements, and criteria phases
- Expanding tool composition beyond what the current scope interview needs
- Reworking the observer's extraction logic or entity model
- Export, revisit/branch UX, CLI, or MCP adapters
- Additional documentation cleanup beyond the README work that already landed
