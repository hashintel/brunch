<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The interaction model is mature: four-phase interview, interviewer-autonomous question format, phase-agnostic preface cards with workspace exploration, structured review with per-item commenting, and observer knowledge extraction all ship as working product. FE-531 distribution hardening is closed through a real publishable package/release path for `npx brunch`. Workflow ownership extraction landed FE-616 (2026-04-29). Graph view's first ship as a peer route with the structured-list layout landed FE-643 (2026-04-30) and activated the `chat-with` action-rail seam; the side-chat V1.1 vertical slice (Explore class) just landed on `ka/fe-656-side-chat` (2026-05-01) using that seam end-to-end. The live frontier is now a single user-facing track: finish side-chat V1 (V1.2 Annotate) on top of V1.1, then progress through V2 / V3. Continuous workspace is the next infrastructure step, unblocked by workflow ownership extraction.

## Active

1. **Side-chat V1 — finish Annotate + multi-pin + top-bar patch summary** — V1.1 (Class 1 Explore vertical slice from graph view) shipped on `ka/fe-656-side-chat` (PR #81, pending merge). V1.2 work is in progress on `ka/fe-656-side-chat-v1-2` (stacked on V1.1). The current vertical-slice queue (`memory/CARDS.md`) covers Card A (annotation server seam — new durable entity per D133), Card B (PatchListProvider client module per D132), and Card C (end-to-end annotate wiring with in-panel inline list). Re-scoped after Card C lands: top-bar patch summary scaffold (D131 canonical surface), the floating selection menu (`💬 Chat` / `📝 Annotate`) for span-anchored entry, and multi-item pinning across the panel. Card E polish remnants for V1.1 (cross-spec persistence, popover row anchoring) also remain tentative; E1 (lift host to spec route) and E3 (visible error states) shipped with V1.1.
   - Why now / unlocks: V1.1 vertically proved the end-to-end seam (graph view → SideChatHost provider → /side-chat SSE → streaming render). V1.2 establishes the durable mutation surface — the annotation entity (D133) is the first durable side-chat output, and the patch-list module (D132) is the seam V2's Edit / Drill-down / Propose-edge extend without reshaping. The earlier "comment-store extension" framing was incorrect: there is no prior comment store; V1.2's annotation table is a new entity (D133 supersedes that framing).
   - Traceability: Requirement 34; D128, D130, D131, D132, D133. Subsumes trigger-popover composer (A51, D89).
   - Design doc: `docs/design/SIDE_CHAT.md` (§§1–4, §6.1, §6.4, §11)
   - Branches: `ka/fe-656-side-chat` (V1.1, PR #81); `ka/fe-656-side-chat-v1-2` (V1.2, stacked). Linear: FE-656.

## Next

2. **Continuous workspace / phase-addressable interview surface** — cumulative center pane with phase section navigation, one chat runtime per specification, scroll-spy phase focus.
   - Why now / unlocks: workflow ownership extraction (Recently Completed 2026-04-29) made this unblocked. Continuous workspace can now adopt one chat runtime and section-addressable focus without adding new lifecycle ambiguity.
   - Traceability: A58; D86, D87, D110, D113, D114; I24, I102.
   - Design doc: `docs/design/CONTINUOUS_WORKSPACE_HYBRID.md`

3. **Side-chat V2 — Edit / Drill-down / Propose-edge** — extend the V1 patch list to carry `edit`, `edge`, and `drill-down` patch kinds. Edit becomes a router: open-phase anchors take the Refine path (successor turn with revision card); closed-phase anchors with `none`/`soft` impact apply directly via soft-recompute. `edit` patches with `hard` impact defer to a placeholder "feature coming" surface until V3.
   - Why now / unlocks: depends on V1's patch-list seam shipping (Active 1, V1.2). Activates the cross-surface intent emission to the existing turn machinery (Refine via successor turn, Drill-down via D127's detail-focus seam) and the typed-relation policy validator for Propose-edge (D125).
   - Traceability: Requirement 34; D125, D127, D130. Subsumes the last user-facing piece of revisit / edit mode (Requirement 10) for the soft-impact case.
   - Design doc: `docs/design/SIDE_CHAT.md` (§5.1–5.2, §6.2, §6.3 soft tier)

## Horizon

### User-facing capabilities (need design work before scoping)

- **First-run provider setup** — make missing LLM credentials visible on the dashboard, add a shared AI runtime provider seam for interviewer / observer model construction, support UI-entered keys through XDG-compliant user auth state, and evaluate whether OpenRouter should become the preferred onboarding provider while preserving Anthropic-specific capabilities or explicit degradation.
  - Linear: FE-633 covers the OpenRouter/default-provider part; dashboard credential UX + XDG key storage may need a sibling issue if split from provider proving.
  - Recommended shape: prove the provider resolver first with current Anthropic behavior, then spike OpenRouter against tool use, structured output, and reasoning/thinking options before making it the default. The dashboard should expose credential status without leaking secret values and offer setup before the user starts a specification.
  - Traceability: Requirements 35, 36, 37; A74, A75; D134, D135, D136; I106.

- **Workspace hygiene / `.brunch/` gitignore assist** — detect whether generated local state is already ignored and, with explicit confirmation, add an idempotent `.gitignore` entry or create `.gitignore` when absent.
  - Linear: FE-648.
  - Recommended shape: keep this as a deterministic local mutation with preview/confirmation semantics; it can ship independently, but the dashboard is the natural surface because it already explains workspace binding and first-run setup.
  - Traceability: Requirement 38; A76; D137; I107.

- **Side-chat V3 — Hard edit absorbs REVISIT_MODULE** — extend V2's Edit router to handle the `hard` impact tier: cascade preview rendered inline in the side-chat panel, batch-resolution secondary-thread mode that walks affected items in groups (auto-confirm review-only, auto-edit mechanical replacements, walk substantives one-by-one). Replaces the current modal secondary-thread design from `docs/design/REVISIT_MODULE.md`.
  - Why now / unlocks: depends on side-chat V2 (Next 3) shipping the Edit router and on REVISIT_MODULE's existing cascade lifecycle (`previewCascade`, `beginRevisit`, `openRevisitThread`, `resolveRevisitItem`, `completeRevisit`) being wired to the side-chat panel as host. Closes out the revisit / edit mode horizon item entirely.
  - Traceability: Requirement 34; D50, D80, D130; A48, A49 retired.
  - Design doc: `docs/design/SIDE_CHAT.md` (§5.3, §6.3 hard tier); existing `docs/design/REVISIT_MODULE.md` lifecycle stays valid as the underlying machinery.

- **Architect / generator loop** — autonomous agent that iterates over the knowledge graph and proposes patches for HITL review through the same patch list as the side-chat. Symmetric to the side-chat in *what* it does (mutates the spec), inverse in *who* drives (system, not user).
  - Why now / unlocks: depends on the side-chat shipping the patch-list surface (V1+) and on the patch / event-stream data model (A71) so generated patches can be batched and applied without re-deriving state per patch.
  - Traceability: A73; depends on side-chat V1+ and A71.

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
  - Depends on: graph view structured-list ship (Recently Completed). Richer node actions may benefit from revisit / edit mode.
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

- [2026-05-01] Side-chat V1.1 — Explore vertical slice. End-to-end: prompt builder (A) → POST /side-chat SSE endpoint (B, D113 invariant preserved structurally) → SideChatPopover skeleton (C) → graph-view wiring + SSE consumer + active-button activation (D). Followed by a review-driven refactor: collapsed `pendingAssistantText` into a single `messages` list with per-message `pending` flag, then extracted a `SideChatHost` provider so activation is a tree-mount fact rather than a derived prop. Six commits on `ka/fe-656-side-chat` (uncommitted to main); 687 tests pass. Watch: V1.2 (Annotate + multi-pin + top-bar patch summary) and Card E polish (persistence + scroll-anchoring + error UX) still owed before the V1 frontier item closes.
- [2026-04-30] Graph view: peer route + structured-list layout (FE-643) — promoted graph view from the `_view` placeholder to a peer route at `/specification/$id/graph` with kind-grouped item rows, relations footers (Outgoing / Incoming subsections of relation chips), hover-card previews, soft-truncate at 6, action rail with the `chat-with` placeholder, empty-state card, and `Back to chat` affordance. Last open piece (chat-with activation) closed by side-chat V1.1. Verified: `npm run verify`. Watch: spatial canvas layout deferred; active-path filter / scope toggle still horizon (server data-layer change required).
- [2026-04-29] Workflow ownership extraction (FE-616) — workflow projector extraction, turn-response transition extraction, chat-route transition/application extraction, and phase-close / force-close write-path ownership now live behind runtime-owned seams. Verified: `npm run verify`. Unblocks continuous workspace.
- [2026-04-30] FE-639 relation-first observer capture first cut — eligible answered turns now enter one background observer-capture backlog, observer prompts use compact existing-knowledge anchors, observer output persists validated graph-delta relationship candidates, and accepted review grounding refs reuse the same conservative relation policy. Verified: `npm run verify`. Watch: A66 remains open until corpus/manual graph-review proves edge precision and density are useful.
- [2026-04-27] Runtime JSON payload hardening — Express API parsing now accepts chat-sized request bodies above the default parser ceiling and returns a JSON 413 response instead of Express HTML when a payload exceeds the app limit. Verified: `npm run verify`. Watch: if real chat requests still exceed the 5 MB limit, investigate client history / tool-result pruning rather than only raising the ceiling.
- [2026-04-24] Distribution hardening release path — `package.json` now declares the Node 22+ engine floor, explicit shipped files, and public scoped publish config; `npm run release` drives release-it at repo root, rebuilds and dry-runs the packaged artifact, and documents npm auth prerequisites. Verified: `npm run verify`. Watch: CI trusted publishing is still intentionally out of scope.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — User-facing
side-chat-V1  (active; V1.1 done, V1.2 + Card E remaining)
  └──→ side-chat-V2  (next; Edit + Drill-down + Propose-edge, soft tier)
        └──→ side-chat-V3  (horizon; Hard edit absorbs REVISIT_MODULE)
              └──→ architect-loop  (horizon, depends on patch-event-stream)

TRACK B — Infrastructure
continuous-workspace  (next; unblocked by workflow ownership extraction)

UNBLOCKED HORIZON
first-run provider setup  (needs provider spike / scope)
workspace hygiene gitignore assist  (bounded, dashboard-surface candidate)
architect-loop  (depends on side-chat + patch-event-stream)
spatial-canvas-layout  (graph-view)
active-path-filter-and-scope-toggle  (graph-view; blocked on server data-layer)
web-research tools  (gate ready, needs tool impl)
dashboard metrics
two-axis interview framing
observer graph enrichment proving
candidate-spec completion assist
progressive detail / recursive deflation
```
