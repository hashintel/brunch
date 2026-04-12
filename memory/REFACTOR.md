## Problem Statement

The current reviewed-export and knowledge-route seams are doing two different jobs at once: they expose product behavior and they carry transitional infrastructure choices. Export currently behaves like a review ledger instead of a reviewed spec, closure caveats are incomplete, and route data loading is inconsistent across adjacent workflow pages. The tests prove the current implementation is stable, but not that it matches the intended product contract.

Coverage is not yet sufficient for a safe refactor of this area without first tightening the oracle surface. The export endpoint has API coverage, but part of that coverage locks in behavior we now believe is wrong. The knowledge workspace has component coverage, but not route-level coverage for loader wiring and navigation. The first commit must therefore be characterization and contract tests.

## Solution

Separate this area into clearer seams:

- a reviewed-export projection that decides what belongs in the final artifact and which caveats must appear
- route-specific data loaders that fetch only the data each page needs
- routed page tests that protect loader wiring, navigation, and user-visible loading behavior

The target state is that export represents the approved, active-path spec rather than the full review transcript; low-readiness and forced-close caveats are both visible in the artifact; and the knowledge and export pages follow one loader-first routing shape instead of mixing overfetch and post-render fetches.

## Commits

1. Done: add route-level characterization tests for knowledge and export, replace the misleading export assertions with reviewed-spec contract tests, and ship the minimum export correction needed to satisfy that contract.
2. Done: extract a dedicated reviewed-export projection seam so artifact selection and caveat generation can be tested independently from HTTP handlers and page rendering.
3. Done: introduce route-specific loader helpers for workflow detail pages while keeping the current UI output unchanged.
4. Done: move the export page to router-provided data so the page no longer performs its first fetch after render.
5. Narrow the knowledge page to a knowledge-only loader and add route-level coverage for loader wiring and back-navigation.
6. Do a verification and fixture-backed manual pass on closed projects with different closure states to confirm the routed pages and export artifact still read coherently.

## Decisions

- Keep the existing server API surface stable unless a test proves the current contract is actively harmful.
- Treat reviewed export as a projection problem, not a page problem.
- Keep knowledge review and export loading symmetrical at the router boundary, but allow each page to fetch a different minimal data shape.
- Preserve auditability through caveats and future appendices rather than by mixing rejected review items into the main exported spec body.
- Defer lexicon renames until after the route and export seams are stable.

## Testing Decisions

- Good tests here should assert user-visible behavior and projection contracts, not implementation details such as hook choice or intermediate local state.
- The highest-value tests are projection tests for reviewed export, API tests for export readiness and caveats, and route-level tests for knowledge and export page loading/navigation.
- Reuse the existing prior art around workflow/export API tests, workspace controller hydration tests, and seeded fixture scenarios for closed projects with mixed review states.
- Manual verification should use seeded projects that differ by review coverage, forced closure, and readiness band so the artifact can be judged as a product surface, not just a string renderer.

## Out of Scope

- Lexicon-alignment renames from `entity` to `knowledge`
- Sidebar redesign or consolidation with the knowledge workspace
- New review actions such as edit, merge, stale, or add-missing flows
- Generalized revisit and invalidation work beyond what existing export/readiness logic already projects
- Broader client performance work outside the route-loading seams involved in knowledge and export
