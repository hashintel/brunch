## Problem Statement

The client’s route topology is currently owned by one manual route tree plus a separate collection of route-facing UI modules. That works technically, but it splits the maintainer’s overview across two organizational schemes: URL structure lives in one place, while the actual screens and loaders live elsewhere. For a developer who thinks in filesystem shape, the current setup makes the app feel less legible than it needs to be.

The mismatch is small today, but it will become more annoying as route-specific behavior grows. The current setup also leaves route generation, route ownership, and route-level code splitting as manual concerns when the router already has a filesystem-native path for those concerns.

## Solution

Adopt TanStack Router file-based routing as the source of truth for the client route tree while preserving the current URL structure, loader behavior, pending states, and screen-level UI. The route directory should mirror the URL structure directly, and route files should stay thin: they own route definitions and delegate heavier screen logic to nearby non-route modules.

The migration should be staged so the codebase remains working after every commit. Preparatory work comes first: characterization coverage, route/view separation where helpful, and build-tool setup. The final behavioral state should still be the same four routes and the same user-visible navigation flow, but with filesystem-owned route topology and generated route-tree bootstrapping.

## Commits

1. Done — add characterization coverage for router bootstrapping, URL-to-screen mapping, and route-linked navigation so the current routing behavior is locked before rewiring it.
2. Next — separate route-definition ownership from heavy screen implementation where needed, so route files can become thin wrappers without changing current behavior.
3. Add file-based routing build infrastructure and generated-artifact handling while keeping the existing manual router active.
4. Introduce the file-based root route and dashboard route as thin wrappers around the existing behavior, with no URL or loader changes.
5. Introduce the file-based interview workspace route wrapper, preserving the current loader and pending-state behavior.
6. Introduce the file-based knowledge and export route wrappers, preserving the current loader behavior and navigation flow.
7. Cut router bootstrapping over to the generated route tree and remove the manual route tree once all active routes are owned by file routes.
8. Clean up transitional wiring, update architecture/docs language, and keep a lightweight build oracle that confirms the intended route-generation and code-splitting behavior survives the refactor.

Progress note: step 1 landed via `main.test.tsx`, `router.test.tsx`, and route-component link assertions in the existing dashboard/workspace/export tests.

## Decisions

- File-based routing becomes the authoritative description of client route topology.
- The current URL structure stays unchanged.
- Route files stay thin and own only route-definition concerns; larger screen logic remains in non-route modules so the route tree stays readable.
- Shared loader logic remains reusable rather than being duplicated into route files.
- The generated route tree is treated as a managed artifact, not hand-maintained source.
- The migration does not change API contracts, data models, or server behavior.
- Route-level code splitting is a desired side effect of the migration, but not a reason to widen the scope into broader performance work.

## Testing Decisions

- Good tests here protect behavior at the routing seam: the same URLs render the same screens, the same loaders feed those screens, the same pending states appear, and the same navigation actions target the same destinations.
- The first new safety step should be characterization coverage for router ownership and bootstrapping, because the current screen-level tests are strong but do not fully lock the route-registration mechanism itself.
- Existing screen-level tests remain the primary regression net for dashboard, interview, knowledge, and export behavior.
- Workspace controller and route-adjacent integration tests remain the right place to protect route-bound data access semantics.
- A lightweight build-level oracle is appropriate for confirming that generated routing stays active and that route-level chunking does not accidentally collapse back into one fully eager route bundle.
- Avoid testing generated implementation details directly; test observable routing behavior and build outcomes instead.

## Out of Scope

- Adding new routes or changing existing URLs.
- Reworking loader logic into a different data-fetching architecture.
- Converting the app to a different framework or runtime model.
- Introducing auth guards, search-param redesign, or route-level state-management changes.
- Reorganizing unrelated client modules just because the route migration touches nearby files.
- Broad performance work beyond what falls out naturally from file-based route ownership.
