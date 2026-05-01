<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The interaction model is mature: four-phase interview, interviewer-autonomous question format, phase-agnostic preface cards with workspace exploration, structured review with per-item commenting, and observer knowledge extraction all ship as working product. FE-531 distribution hardening is closed through a real publishable package/release path for `npx brunch`. The live frontier now has two parallel tracks: **infrastructure** (continuous workspace) and **user-facing** (graph view structured-list, then the staged side-chat V1→V2→V3 absorbing the prior trigger-popover composer and revisit/edit-mode horizon items). Graph view's structured-list layout (D128, D129) prepares the `chat-with` seam the side-chat activates. Manual proving of recently landed interaction-model changes (preface cards in non-grounding phases, format autonomy quality, observer coherence) continues alongside these seams.

## Active

### Track B — Infrastructure

1. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with phase section navigation, one chat runtime per specification, scroll-spy phase focus.
   - Why now / unlocks: depends on workflow ownership extraction. Once read/write workflow ownership is explicit, a continuous workspace can adopt one chat runtime and section-addressable focus without adding new lifecycle ambiguity.
   - Traceability: A58; D86, D87, D110, D113, D114; I24, I102.
   - Design doc: `docs/design/CONTINUOUS_WORKSPACE_HYBRID.md`

### Track A — User-facing

2. **Graph view: peer route + structured-list layout** — promote graph view from `_view` placeholder to a peer route at `/specification/$id/graph` rendering knowledge items as a structured list with relations footers (Outgoing / Incoming relation chips, hover-card preview, soft-truncate at 6, action rail with disabled `chat-with` placeholder, empty state, "Back to chat" affordance). First ship of D128's actionable graph view; spatial canvas layout deferred.
   - Why now / unlocks: independently shippable — uses today's `/entities?mode=project-wide` API, no shared state with the workspace shell, no dependency on workflow ownership extraction or continuous workspace. Parallels the infrastructure track without conflict. Surfaces relation-density gaps (A66) and prepares the projection seam for the spatial canvas and node-launched refinement flows.
   - Traceability: Requirement 33; A66, A69, A70; D114, D128, D129; I102.
   - Verification approach: F1 component tests + F3 a11y on the structured-list rendering; F2 router-integrated tests for chip click → URL → hash anchor → scroll chain and "Back to chat" affordance; F5 network-call counter for fetch-once + scope-toggle behavior; F6 graph-view fixture matrix (`emptySpec`, `singleItemNoEdges`, `crossPhaseDecisionLink`, `denseGoalAnchor`, `activePathDivergence`, `compareLowVsHighEdgeDensity`); F7 dramaturgical walkthrough on all six fixtures. See `memory/SPEC.md` §Verification Design.

## Next

3. **Side-chat V1 — panel surface + Explore + Annotate** — popover-to-panel chat anchored to spec items in the graph view, with two entry modes (per-row `chat-with` button and text-selection floating menu), multi-item pinning, and the persistent top-bar patch summary scaffolded. V1 ships Class 1 (Explore — volatile chat) and Class 4 (Annotate — durable per-item / per-span notes). Patch list holds at most one entry (annotation-only) until V2.
   - Why now / unlocks: depends on graph view structured-list (Active Track A 2) for the `chat-with` placeholder seam. Independent of workflow ownership extraction and continuous workspace, so it can ship in parallel with Track B. Establishes the side-chat surface, the patch-list staging seam, the comment-store extension for annotations, and the floating selection menu; subsequent versions extend the same shapes without re-doing them.
   - Traceability: Requirement 38; D128, D134, D135. Subsumes trigger-popover composer (A51, D89) — the panel surface replaces the persistent-composer concept; the `/`/`@`/`#` command syntax stays out of V1.
   - Design doc: `docs/design/SIDE_CHAT.md` (§§1–4, §6.1, §6.4, §11)

4. **Side-chat V2 — Edit / Drill-down / Propose-edge** — extend the V1 patch list to carry `edit`, `edge`, and `drill-down` patch kinds. Edit becomes a router: open-phase anchors take the Refine path (successor turn with revision card); closed-phase anchors with `none`/`soft` impact apply directly via soft-recompute. `edit` patches with `hard` impact defer to a placeholder "feature coming" surface until V3.
   - Why now / unlocks: depends on V1's patch-list seam. Activates the cross-surface intent emission to the existing turn machinery (Refine via successor turn, Drill-down via D127's detail-focus seam) and the typed-relation policy validator for Propose-edge (D125).
   - Traceability: Requirement 38; D125, D127, D134. Subsumes the last user-facing piece of revisit / edit mode (Requirement 10) for the soft-impact case.
   - Design doc: `docs/design/SIDE_CHAT.md` (§5.1–5.2, §6.2, §6.3 soft tier)

## Horizon

### User-facing capabilities (need design work before scoping)

- **First-run provider setup** — make missing LLM credentials visible on the dashboard, add a shared AI runtime provider seam for interviewer / observer model construction, support UI-entered keys through XDG-compliant user auth state, and evaluate whether OpenRouter should become the preferred onboarding provider while preserving Anthropic-specific capabilities or explicit degradation.
  - Linear: FE-633 covers the OpenRouter/default-provider part; dashboard credential UX + XDG key storage may need a sibling issue if split from provider proving.
  - Recommended shape: prove the provider resolver first with current Anthropic behavior, then spike OpenRouter against tool use, structured output, and reasoning/thinking options before making it the default. The dashboard should expose credential status without leaking secret values and offer setup before the user starts a specification.
  - Traceability: Requirements 34, 35, 36; A71, A72; D130, D131, D132; I106.

- **Workspace hygiene / `.brunch/` gitignore assist** — detect whether generated local state is already ignored and, with explicit confirmation, add an idempotent `.gitignore` entry or create `.gitignore` when absent.
  - Linear: FE-648.
  - Recommended shape: keep this as a deterministic local mutation with preview/confirmation semantics; it can ship independently, but the dashboard is the natural surface because it already explains workspace binding and first-run setup.
  - Traceability: Requirement 37; A73; D133; I107.

- **Side-chat V3 — Hard edit absorbs REVISIT_MODULE** — extend V2's Edit router to handle the `hard` impact tier: cascade preview rendered inline in the side-chat panel, batch-resolution secondary-thread mode that walks affected items in groups (auto-confirm review-only, auto-edit mechanical replacements, walk substantives one-by-one). Replaces the current modal secondary-thread design from `docs/design/REVISIT_MODULE.md`.
  - Why now / unlocks: depends on side-chat V2 (Next 4) shipping the Edit router and on REVISIT_MODULE's existing cascade lifecycle (`previewCascade`, `beginRevisit`, `openRevisitThread`, `resolveRevisitItem`, `completeRevisit`) being wired to the side-chat panel as host. Closes out the revisit / edit mode horizon item entirely.
  - Traceability: Requirement 38; D50, D80, D134; A48, A49 retired.
  - Design doc: `docs/design/SIDE_CHAT.md` (§5.3, §6.3 hard tier); existing `docs/design/REVISIT_MODULE.md` lifecycle stays valid as the underlying machinery.

- **Architect / generator loop** — autonomous agent that iterates over the knowledge graph and proposes patches for HITL review through the same patch list as the side-chat. Symmetric to the side-chat in *what* it does (mutates the spec), inverse in *who* drives (system, not user).
  - Why now / unlocks: depends on the side-chat shipping the patch-list surface (V1+) and on the patch / event-stream data model (A74) so generated patches can be batched and applied without re-deriving state per patch.
  - Traceability: A76; depends on side-chat V1+ and A74.

- **Web research as a context-gathering capability** — web search and page-fetch tools as interviewer-invoked context gathering, surfaced as preface cards. The tool gate and preface lifecycle are ready; this adds new tool implementations.
  - Linear: FE-649.
  - Traceability: Requirements 20, 21; D99, D112.

- **Dashboard result summaries and completeness metrics** — progress visibility across specifications.

- **Two-axis interview framing** — adapt interviewer setup and questioning to the full `greenfield <> brownfield` by `end-to-end build <> incremental feature` matrix instead of treating partial-scope work as a special case.
  - Linear: FE-638.
  - Traceability: Requirement 29; A65; D124.

- **Observer graph enrichment proving** — evaluate whether the FE-639 relation-first graph-delta seam produces useful edge density for graph view, export grounding, and future revisit/cascade work before expanding extraction rules.
  - Linear: create a new issue only after the proving pass identifies a bounded enrichment target; FE-639 covers the first-cut seam.
  - Recommended shape: run observer corpus probes and manual transcript review against representative greenfield/brownfield specs, inspect projected `EntitiesData.relationships` in graph/export surfaces, and decide whether the next increment should widen prompt context, add cross-turn enrichment, introduce confidence/review affordances, or leave the conservative policy unchanged.
  - Traceability: Requirement 33; A66; D50, D80, D125, D128; I109.

- **Candidate-spec completion assist** — replace skip-only remainder handling with a `fill in the rest for me` path that generates candidate specs, implications, and tradeoffs for reaction-based refinement.
  - Linear: FE-640.
  - Recommended shape: a turn-owned candidate-spec set artifact plus a structured reaction loop (`accept-direction`, `refine`, `regenerate`); accepting a candidate steers the next move but does not itself close the phase.
  - Traceability: Requirement 31; A67; D126.

- **Progressive detail / recursive deflation** — support broad-pass interviewing with explicit next-level-of-detail actions rather than one uniform depth-first drill-down.
  - Linear: FE-637.
  - Recommended shape: pair ordinary grounding/design question turns with a turn-owned breadth-skeleton artifact that makes current coverage visible and exposes a structured detail reaction (`deepen this area`, `continue broad pass`, `sufficient for now`). The chosen reaction should steer the next same-phase frontier turn instead of introducing a separate detail workflow.
  - First cut should optimize for `broad question -> choose one area to deepen next -> focused successor question -> refreshed breadth skeleton`, while keeping the same detail-focus intent reusable later from chat or graph surfaces.
  - Traceability: Requirement 32; A67, A68; D127.

- **Spatial canvas layout for graph view** — add the spatial DAG layout as a second layout choice inside graph mode, alongside the structured-list ship. Same projection seam, same intent contract; only the layout strategy changes (e.g. `?layout=spatial`).
  - Recommended shape: a layout switch inside the existing `/specification/$id/graph` route that transforms the same `EntitiesData` projection into a spatial scene with viewport / selection / focus / path-highlighting, leaving the action-rail intent contract unchanged. First cut should optimize for `select node -> inspect -> launch refinement`.
  - Depends on: graph view structured-list ship (Active 2). Richer node actions may benefit from revisit / edit mode.
  - Traceability: Requirement 33; A69; D128.

- **Graph view active-path render filter + scope toggle** — render only active-path items by default in graph view, with a `Show all` toggle in the header that flips to the full whole-spec set. Both subsets project from the same in-memory `mode=project-wide` data; no second fetch.
  - Recommended shape: server-side change to expose per-item active-path membership in the entities API response (e.g. `activePath: boolean` on each item, or a separate `activePathItemIds` collection); client-side filter inside `StructuredListView`'s projection plus a toggle UI in the graph view header.
  - Depends on: server data-layer change for active-path membership exposure. Pairs with relation-first observer capture (A66) — both shape the graph view's apparent density. Was originally part of FE-643's slice family but deferred at slice 1 when no client-side derivation existed.
  - Traceability: Requirement 33; D128, D129; I102.

### Infrastructure / tooling

- Headless interview driver for scripted end-to-end probes.
- MCP server adapter for core operations.
- Git-friendly file-based persistence representation for diffable specs.
- Typed fixture-builder convergence for happy-path tests.

## Recently Completed

- [2026-04-30] FE-639 relation-first observer capture first cut — eligible answered turns now enter one background observer-capture backlog, observer prompts use compact existing-knowledge anchors, observer output persists validated graph-delta relationship candidates, and accepted review grounding refs reuse the same conservative relation policy. Verified: `npm run verify`. Watch: A66 remains open until corpus/manual graph-review proves edge precision and density are useful.
- [2026-04-27] Runtime JSON payload hardening — Express API parsing now accepts chat-sized request bodies above the default parser ceiling and returns a JSON 413 response instead of Express HTML when a payload exceeds the app limit. Verified: `npm run verify`. Watch: if real chat requests still exceed the 5 MB limit, investigate client history / tool-result pruning rather than only raising the ceiling.
- [2026-04-24] Distribution hardening release path — `package.json` now declares the Node 22+ engine floor, explicit shipped files, and public scoped publish config; `npm run release` drives release-it at repo root, rebuilds and dry-runs the packaged artifact, and documents npm auth prerequisites. Verified: `npm run verify`. Watch: CI trusted publishing is still intentionally out of scope.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — User-facing
graph-view-structured-list  (active)
  ├──→ side-chat-V1  (next; panel + Explore + Annotate)
  │     └──→ side-chat-V2  (next; Edit + Drill-down + Propose-edge, soft tier)
  │           └──→ side-chat-V3  (horizon; Hard edit absorbs REVISIT_MODULE)
  │                 └──→ architect-loop  (horizon, depends on patch-event-stream)
  ├──→ active-path-filter-and-scope-toggle  (horizon, blocked on server data-layer)
  └──→ spatial-canvas-layout  (horizon)

TRACK B — Infrastructure
continuous-workspace  (active)

UNBLOCKED HORIZON
first-run provider setup  (needs provider spike / scope)
workspace hygiene gitignore assist  (bounded, dashboard-surface candidate)
architect-loop  (depends on side-chat + patch-event-stream)
web-research tools  (gate ready, needs tool impl)
dashboard metrics
two-axis interview framing
observer graph enrichment proving
candidate-spec completion assist
progressive detail / recursive deflation
```
