<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The interaction model is mature: four-phase interview, interviewer-autonomous question format, phase-agnostic preface cards with workspace exploration, structured review with per-item commenting, and observer knowledge extraction all ship as working product. FE-531 distribution hardening is now closed through a real publishable package/release path for `npx brunch`, so the live frontier centers on **infrastructure** — workflow ownership extraction and continuous workspace — which enables the next wave of user-facing capabilities (revisit/cascade, trigger-popover composer, web tools, and the new post-launch interview-model expansion themes). Manual proving of recently landed interaction-model changes (preface cards in non-grounding phases, format autonomy quality, observer coherence) continues alongside these seams.

## Active

### Track B — Infrastructure

1. **Workflow ownership extraction** — extract the workflow projector/read path and transition/orchestration write path behind explicit runtime-owned seams.
   - Why now / unlocks: the runtime proving slice landed deferred observer backlog without a second durable workflow model. This cleanup separates transport, durable snapshot assembly, workflow projection, and workflow transition logic so the continuous workspace can adopt one chat runtime cleanly.
   - Traceability: D110, D112, D113, D123; A57; I24, I72, I104, I105.

## Next

2. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with phase section navigation, one chat runtime per specification, scroll-spy phase focus.
   - Why now / unlocks: depends on workflow ownership extraction. Once read/write workflow ownership is explicit, a continuous workspace can adopt one chat runtime and section-addressable focus without adding new lifecycle ambiguity.
   - Traceability: A58; D86, D87, D110, D113, D114; I24, I102.
   - Design doc: `docs/design/CONTINUOUS_WORKSPACE_HYBRID.md`

## Horizon

### User-facing capabilities (need design work before scoping)

- **Revisit / edit mode + cascade preview** — edit knowledge items, see downstream effects, resolve through secondary thread. Has a design doc (`docs/design/REVISIT_MODULE.md`) but needs design refinement before scoping.
  - Traceability: Requirement 10; D50, D80; A48, A49.

- **Trigger-popover composer** — persistent workspace composer with `/` commands, `@` knowledge mentions, `#` phase refs. Depends on continuous workspace establishing a persistent composer as the canonical input seam.
  - Depends on: continuous workspace.
  - Traceability: A51, D89.

- **Web research as a context-gathering capability** — web search and page-fetch tools as interviewer-invoked context gathering, surfaced as preface cards. The preface lifecycle is ready; this adds new context-gathering tool implementations.
  - Traceability: Requirements 20, 21; D112.

- **Dashboard result summaries and completeness metrics** — progress visibility across specifications.

- **Two-axis interview framing** — adapt interviewer setup and questioning to the full `greenfield <> brownfield` by `end-to-end build <> incremental feature` matrix instead of treating partial-scope work as a special case.
  - Traceability: Requirement 29; A65; D124.

- **Relation-first observer capture** — expand observer relationship extraction so graph edges are captured across the ontology when reasonably traceable, not only for decisions and assumptions.
  - Traceability: Requirements 30, 33; A66; D125.

- **Candidate-spec completion assist** — replace skip-only remainder handling with a `fill in the rest for me` path that generates candidate specs, implications, and tradeoffs for reaction-based refinement.
  - Recommended shape: a turn-owned candidate-spec set artifact plus a structured reaction loop (`accept-direction`, `refine`, `regenerate`); accepting a candidate steers the next move but does not itself close the phase.
  - Traceability: Requirement 31; A67; D126.

- **Progressive detail / recursive deflation** — support broad-pass interviewing with explicit next-level-of-detail actions rather than one uniform depth-first drill-down.
  - Traceability: Requirement 32; A67, A68; D127.

- **Actionable graph workspace** — turn graph view into a spatial knowledge workspace with visible DAG edges and node-launched refinement side-chats.
  - Recommended shape: a projection-first graph workspace seam that transforms `EntitiesData` into a spatial scene, owns only ephemeral graph-local UI state (`viewport`, `selection`, `focus`, `path highlighting`), and emits node action intents into the existing workspace lifecycle instead of creating a second workflow or edit store. First cut should optimize for `select node -> inspect -> launch refinement`, with revisit/edit overlays layered on later.
  - Depends on: continuous workspace; revisit / edit mode.
  - Traceability: Requirement 33; A69; D128.

### Infrastructure / tooling

- Headless interview driver for scripted end-to-end probes.
- MCP server adapter for core operations.
- Git-friendly file-based persistence representation for diffable specs.
- Typed fixture-builder convergence for happy-path tests.

## Recently Completed

- [2026-04-27] Runtime JSON payload hardening — Express API parsing now accepts chat-sized request bodies above the default parser ceiling and returns a JSON 413 response instead of Express HTML when a payload exceeds the app limit. Verified: `npm run verify`. Watch: if real chat requests still exceed the 5 MB limit, investigate client history / tool-result pruning rather than only raising the ceiling.
- [2026-04-24] `release-it` publish wiring for the packaged artifact — `npm run release` now drives release-it at repo root, release hooks rebuild and `npm pack --dry-run --json` the packaged CLI/runtime artifact before `npm publish`, dry-run coverage proves the release flow stays pinned to the packaged boundary, and README release docs now make the npm-auth prerequisite explicit. Verified: `npm run verify`. Watch: CI trusted publishing is still intentionally out of scope for this seam.
- [2026-04-24] Publishable pack artifact boundary for distribution hardening — `package.json` now declares the Node 22+ engine floor, explicit shipped files, and public scoped publish config; `npm pack` smoke coverage proves the tarball excludes repo-only source/docs state and an extracted install can still launch `brunch` against the built client artifact. Verified: `npm run verify`.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK B — Infrastructure
workflow-ownership-extraction  (active)
  └──→ continuous-workspace  (next)
        └──→ trigger-popover-composer  (horizon)

UNBLOCKED HORIZON
revisit / edit-mode  (needs design)
web-research tools  (gate ready, needs tool impl)
dashboard metrics
two-axis interview framing
relation-first observer capture
candidate-spec completion assist
progressive detail / recursive deflation
actionable graph workspace
```
