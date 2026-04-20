## Problem Statement

The recent naming slices improved user-facing copy, but the code still carries two competing vocabularies and several shallow coordination seams. “Project” remains the dominant boundary term in shared types, server contracts, and client helpers even when the product concept is now “specification.” Phase metadata is split across separate helpers for labels, route segments, and order, so callers still rebuild navigation details themselves. The workspace stream also has one oversized rendering hub, which makes every new artifact type or CTA change converge on the same module.

From a developer perspective, this makes simple changes feel wide: terminology cleanup leaks across unrelated modules, phase navigation truth is easy to duplicate, and stream rendering changes have a high blast radius.

## Solution

Establish one specification-facing boundary and one phase-descriptor seam, then use those seams to shrink the workspace stream surface.

The target state is:
- product-facing app code speaks in terms of specification, workspace, grounding, and review without local translation churn
- phase metadata lives behind one canonical descriptor registry that owns label, order, route segment, and navigation helpers
- workspace stream rendering is split into smaller artifact-focused renderers that consume typed descriptors instead of rebuilding phase and CTA details inline
- persistence and transport behavior remain unchanged during the refactor; this is structural cleanup that makes later durable renames and workflow extraction cheaper

## Commits

1. [done — `207fa20` `test: characterize phase routing and handoff projections`] Add characterization coverage for specification-facing navigation and workspace-stream phase handoff behavior so the current routing and artifact CTAs are pinned before structural changes.
2. [done — `194f0ad` `refactor: introduce canonical phase descriptors`] Introduce a single phase descriptor module that owns canonical phase order, labels, route segments, and next-phase lookup, while preserving current runtime behavior.
3. [done — `152781d` `refactor: migrate phase-aware callers to descriptors`] Migrate phase-aware callers to the descriptor seam so navigation, labels, and route targets stop rebuilding phase knowledge locally.
4. [done — `30d4042` `refactor: add specification contract aliases`] Introduce a specification-facing app boundary that aliases the legacy project-shaped contracts behind clearer names, keeping transport and persistence unchanged.
5. [done — `7c64211` `refactor: adopt specification boundary at app edges`] Rename client and server orchestration surfaces to consume the specification boundary so feature code no longer performs ad hoc project-to-specification translation.
6. [done — `8d31402` `refactor: extract workspace artifact view primitives`] Extract shared workspace-artifact rendering primitives from the current transcript view so control cards, review cards, and handoff/completion artifacts stop depending on one monolithic render switch.
7. [done] Split the workspace transcript renderer into smaller artifact-focused units that consume the descriptor and specification seams, leaving behavior unchanged but lowering change surface for future slices.
8. [done] Remove compatibility cruft made unnecessary by the new seams and tighten tests around the surviving public terminology.

## Decisions

- Keep durable storage and wire contracts behaviorally stable during this refactor; the work introduces ownership seams first rather than forcing a physical record rename immediately.
- Treat “specification” as the canonical application term and “project” as a legacy persistence detail hidden behind boundary modules.
- Treat phase metadata as one concept, not separate label and route helper concerns.
- Treat workspace-stream artifacts as a family of renderable states with shared primitives, not as unrelated special cases inside one view.
- Do not change workflow semantics, landing reconciliation rules, or review acceptance behavior as part of this refactor.

## Testing Decisions

- Good tests here prove user-visible behavior survives: navigation lands on the right phase, closed phases advance correctly, export remains reachable at the right time, and workspace artifacts render the same controls and summaries.
- The main automated protection should stay at routed workspace and app-boundary level, with a smaller set of focused helper tests around phase descriptors and specification boundary adapters.
- Prior art already exists in the route ownership tests, project-list/specification-list coverage, phase navigation coverage, transcript view coverage, and server app behavior tests; extend those seams rather than introducing implementation-heavy unit tests.
- Prefer characterization tests over snapshots for transcript artifacts so refactors can move code without coupling tests to internal component structure.

## Out of Scope

- Physical database or API renaming of the legacy project record.
- Any persisted `scope` to `grounding` migration.
- Workflow behavior changes, new phase semantics, or lifecycle redesign.
- Visual redesign of cards, panes, or typography.
- Revisit/cascade work, export feature expansion, or observer logic changes unrelated to the structural seams above.
