## Problem Statement

The client-side routing migration left a few places where TanStack Router and shared project contracts are no longer the clear type owners. Route support modules cast loader data that the router already infers, some helpers widen route params into mixed string-or-number interfaces, and a few screens widen precise shared shapes into `any` or arbitrary string-keyed maps. The result is type safety that still passes today but is less narrow, less router-owned, and easier to accidentally drift.

## Solution

Restore source-of-truth typing around the routing surface without adding unnecessary runtime validation. TanStack Router should remain the owner of route params, loader data, and future search params. Shared client/server contracts should remain the owner of transport and domain shapes. Local modules should only project or adapt those owners when they are introducing a real semantic boundary. The refactor keeps behavior and route structure unchanged while removing casts, widened unions, and lossy local restatements.

## Commits

1. Tighten the route-id boundary so route-owned code treats path params as router-owned strings, domain-owned code uses domain numeric ids, and mixed string-or-number helper interfaces disappear.
2. Remove redundant route-data assertions by switching route support modules to router-derived params and loader data access, preserving TanStack inference through the support layer.
3. Replace lossy knowledge-view projections with typed projections derived from the shared entity contract and registry metadata instead of rebuilding shapes from `any`.
4. Tighten finite UI lookup tables and similar local maps so they are keyed by upstream unions and fail fast when shared state spaces change.
5. Clean up affected tests and helper mocks to mirror the same ownership model, keeping the existing route behavior oracles while deleting now-redundant local type aliases and casts.

## Decisions

- Route params remain owned by TanStack Router unless a route explicitly takes responsibility for parsing them into another semantic type.
- Shared client/server contracts remain the source of truth for transport and domain payloads; this refactor does not add client-side schema parsing by default.
- Route support modules should derive from router-owned hooks or route APIs instead of re-declaring loader-data shapes locally.
- Local view helpers may project shared entities into display-oriented shapes, but only through typed projections that preserve the upstream state space.
- A future move to numeric route-param parsing is a separate architectural choice, not part of this narrowing pass.

## Testing Decisions

- Good tests here protect behavior at the route seam: URL-to-screen ownership, loader wiring, navigation destinations, and screen rendering for project, knowledge, and export flows.
- Existing client route, screen, and workspace tests appear sufficient for safe refactoring because they already characterize the routing surface and user-visible behavior.
- Type narrowing itself is protected primarily by the type-aware lint and compile checks; the refactor should lean on those oracles in addition to the existing behavior tests.
- Prior art lives in the current generated-route, route-screen, and workspace-controller test suites that already pin the migrated routing surface.

## Out of Scope

- Adding client-side runtime validation for every internal server response.
- Changing route structure, URLs, or code-splitting behavior.
- Introducing new search-param state or redesigning search-param validation.
- Reworking unrelated client typing issues outside the migrated routing surface.
- Converting path params to numeric semantics at the router layer.