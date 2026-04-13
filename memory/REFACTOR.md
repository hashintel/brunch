## Problem Statement

The current entity-graph seam no longer preserves the same meaning across persistence, transport, and routed client reads.

Fixtures and manifest seeders can encode richer knowledge-graph relations and stage-specific project states, but the shared read model collapses those relations and the routed workspaces hydrate from a different trust boundary than export. As a result, seeded scenarios stop being faithful once they leave storage: the richer graph is partially dropped, and the same seeded project can mean different things in the interview workspace, knowledge workspace, and export preview.

From a developer perspective, this makes the system hard to reason about. The route refactor appears sound at the URL and screen level, but the underlying seeded-state oracle is no longer proving the intended model.

## Solution

Refactor the entity projection seam so it has one explicit, coherent policy.

The target state is:

- The persisted knowledge graph projects its full supported relation vocabulary through the shared transport.
- The active path is the canonical trusted read model for routed workspace and export state.
- Any project-global inspection view is treated as a separate, explicit read model rather than an accidental default.
- Manifest-backed seeded scenarios become the primary regression oracle for this seam, so fixture richness and routed behavior cannot drift apart silently.

## Commits

- [x] Add characterization tests that seed manifest scenarios and prove the current graph-relation loss and active-path/global-entity divergence at the API and routed-surface seams.
- [x] Extract the entity projection logic into explicit projection modes so project-wide and active-path reads are named and testable before behavior changes.
- [x] Widen the shared relationship transport to the full persisted edge-relation vocabulary and update read-model tests to treat the richer graph as first-class data.
- [x] Make knowledge-surface relation rendering consume the richer graph deliberately, while keeping any dependency-only summaries explicit instead of relying on projection loss.
- [x] Switch the canonical routed entity read path to active-path projection so interview, knowledge, and export all agree on the trusted project state.
- [x] Retire or rewrite stale seam tests so manifest-seeded transition scenarios protect the full route-to-read-model contract going forward.

## Decisions

- Treat the active path as the canonical trusted entity set for routed workspace and export behavior.
- Preserve the full supported knowledge-edge relation vocabulary through the shared entity transport.
- Separate “what is trusted now” from “everything ever captured in the project” at the read-model boundary instead of overloading one endpoint with both meanings.
- Keep the routing structure intact; this refactor is about read-model alignment, not route ownership or URL shape.
- Avoid schema changes unless implementation proves they are necessary; the current persistence model already stores the relation richness we need.

## Testing Decisions

- The first commit must be characterization coverage, because the current tests do not adequately protect the richer manifest graph or the canonical-entity-set policy.
- Good tests here should assert behavior at seam boundaries: seeded scenario in, projected graph and routed state out.
- Test the manifest seeder, entity projection, entities API, routed workspace loaders, and export projection together where possible, instead of only unit-testing individual helpers.
- Reuse existing prior art from the branch-filtering export oracle, the entities API contract tests, the route-loader tests, and the file-route characterization tests.
- Prefer manifest-backed scenarios over hand-built one-off fixtures whenever the behavior under test is “project at stage N” or “graph relation survives into the routed UI.”

## Out of Scope

- Changing route structure, file-route ownership, or code-splitting boundaries.
- Redesigning the knowledge workspace or sidebar beyond what is required to make relation semantics explicit.
- Introducing new edge kinds or revisiting observer extraction policy.
- Building revisit/edit-mode UX or secondary-thread behavior.
- Defining a long-term project-global graph explorer; if needed, that should be scoped separately after the canonical seam is repaired.
