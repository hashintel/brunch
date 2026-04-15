<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

## Active

1. **Review-set implementation across requirements + criteria** — replace repeated micro-interview review turns with synthesized per-item approve / reject / comment lists plus list-level confirmation.
   - Why now / unlocks: the product model for grounding/design is becoming turn-card based while review remains list-based; landing review sets keeps that separation clean.

2. **Specification-first creation and workspace terminology adoption** — root creation asks only for the specification name, and touched product surfaces start distinguishing workspace vs specification while internal `project` identifiers remain unchanged.
   - Why now / unlocks: this establishes D82, D96, and D97 at the entry seam so grounding strategy can move into the workspace honestly instead of mutating a premature root-modal choice.

## Next

1. **Grounding strategy selection inside the workspace** — the first grounding move chooses elicitation-first vs analysis-first in the workspace-owned turn flow instead of in the root modal.
   - Why now / unlocks: once creation is specification-first, the actual grounding phase can own its opening move and converge both strategies inside one interaction family.

2. **Grounding-card transcript primitive** — add visible provisional grounding cards with optional comment + continue semantics, keeping card content non-durable while allowing user reactions to feed later knowledge capture.
   - Why now / unlocks: this is the core interaction seam required for brownfield grounding briefs and later interviewer-invoked context gathering.

3. **Brownfield workspace-analysis grounding brief** — use read-only workspace analysis to produce the first visible grounding card, then hand off into the first substantive grounding question.
   - Why now / unlocks: this lands analysis-first grounding on top of the new card/provenance model without yet solving the full reusable context-gathering loop.

4. **Router/query ownership refinement for interview surfaces** — replace coarse route-wide invalidation with deliberate loader/query ownership.
   - Why now / unlocks: keep it narrow until the new layout and grounding-card flow settle and refresh pain can be judged against the revised interaction family.

5. **Rich replay treatment for collapsed reasoning, observer progress, and grounding-card detail** — once the turn lifecycle and grounding-card primitives stabilize, make replay components visually match their live counterparts more closely.
   - Why now / unlocks: transcript trust requires carrying provisional grounding artifacts legibly too.

## Horizon

- **Output route and markdown export** — conditional route available when all phases closed, providing specification summary and markdown export (D100). Depends on: layout architecture landing.
- **Close Phase confirmation modal** — modal UX for the Close Phase button with readiness/turn-count context and closeability gating (D103). Depends on: center pane header landing.
- **Workflow projector extraction** — refactor `getCurrentWorkflowState()` into a pure projector over a `WorkflowSnapshot` struct. Independent lane.
- **Remove `cwd` from spec record, make workspace implicit** — Depends on: specification-first-creation (Active #6).
- **Legacy knowledge facade cleanup** — drop dead schema tables, collapse legacy types into kind-discriminated `KnowledgeItem`.
- **Project → specification physical DB rename** — Depends on: legacy-knowledge-facade-cleanup, specification-first-creation.
- **Reusable interviewer-invoked context gathering beyond opening grounding** — defer until opening brownfield brief proves the card/provenance model.
- **Dashboard/result summaries and completeness metrics** — post-interview surface.
- **Edit mode + cascade preview** — revisit affordance after interview-surface refinement settles.
- **Cascade execution + secondary thread lifecycle** — structural follow-on.
- **Drizzle Kit audit remediation** — independent hardening lane.
- **Git-friendly file-based persistence representation for diffable specs**.
- **Headless interview driver for scripted end-to-end probes**.
- **MCP server adapter for core operations**.

## Recently Completed

- 2026-04-15 — **Center pane sticky header and ChatScroll integration** — Done: `InterviewView` now renders the center-pane sticky header with phase position, status, turn count, readiness, and state-gated actions: no action for unstarted or non-closeable in-progress phases, Close Phase only when closeable, advance CTA for closed intermediate phases, and export CTA for the closed final phase. `ChatScroll` remains the route-owned transcript scroll container, now protected by source-level route-wiring coverage and explicit header-state tests in `src/client/routes/project/$id/_view/InterviewView.test.tsx` and `src/client/file-route-interview.test.ts`. Watch: the broader phase-lifecycle rework remains deferred; auto-present and the generic composer stay intentionally disabled.
- 2026-04-15 — **Knowledge sidebar grouping registry** — Done: `EntitySidebar` now renders the hard-coded visible knowledge groups with compact `DrawerCard` items, keeps `term` hidden, preserves server-owned `referenceCode` labels when present, and shows directionally honest outgoing edge previews as `Links to` summaries. Coverage now includes group visibility, hidden-term behavior, visible-item totals, mixed-kind grouping, review badges, and edge-preview rendering in `src/client/components/EntitySidebar.test.tsx`. Watch: this view currently summarizes outgoing links only; richer relation semantics or bidirectional presentation remain future refinement.
- 2026-04-15 — **Phase stepper sidebar** — Done: `PhaseNavigationSidebar` now renders a sticky back-link/specification header and a vertical timeline stepper with canonical phase labels from the shared display registry, per-phase status/readiness/turn-count metadata, preserved sequential reachability gating, and a conditional Output row when all workflow phases are closed. Components: seam-local sidebar at `src/client/routes/project/$id/-phase-navigation-sidebar.tsx`, story at `src/client/stories/phase-navigation-sidebar.stories.tsx`, integration in `project/$id/route.tsx`. Watch: center-pane and knowledge-sidebar sticky-header slices still need to land to complete the three-pane layout.
- 2026-04-15 — **Top bar and phase label canonicalization** — Done: RouteRoot now renders the h-10 top bar with placeholder Brunch branding, build-time version injection from `package.json`, tagline, and truncated cwd; the project list no longer duplicates the tagline; canonical phase labels now flow from one shared display registry across the dashboard, sidebar, transcript copy, closure commands, and dependent fixtures/tests. Watch: the top-bar mark is still a temporary placeholder until the real Brunch logo/wordmark arrives.
- 2026-04-15 — **Story-first turn-card refinement** — Done: DrawerCard primitive extracted, question cards (active + answered), knowledge detail cards with expand/collapse, chat transcript story with ChatScroll (ScrollArea + useStickToBottom), typography scale + design token canonicalization. Components: `drawer-card.tsx`, stories at `stories/question-detail.stories.tsx`, `stories/knowledge-detail.stories.tsx`, `stories/chat-transcript.stories.tsx`. Watch: patterns are story-proven; route integration is the next wave.
- 2026-04-14 — **Turn-owned captured-item projection and trailing observer attachment** — Done: answered turns list captured knowledge with stable reference codes; late observer completion stays turn-attached.
- 2026-04-14 — **Turn-owned submit/interviewer-processing choreography** — Done: active turns stay mounted through submit, lock inline during processing, collapse when next step is ready.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
top-bar-and-phase-label-canonicalization
  └──→ phase-stepper-sidebar (needs canonical labels)

phase-stepper-sidebar
  └──→ center-pane-sticky-header-and-chatscroll-integration (needs sidebar context for phase position)

center-pane-sticky-header-and-chatscroll-integration
  └──→ knowledge-sidebar-grouping-registry (can proceed in parallel, but full layout complete after both)

specification-first-creation-and-workspace-terminology-adoption
  ├──→ grounding-strategy-selection-inside-the-workspace
  ├──→ remove-cwd-from-spec-record-make-workspace-implicit
  └──→ project-to-specification-physical-db-rename

grounding-strategy-selection-inside-the-workspace
  └──→ brownfield-workspace-analysis-grounding-brief

grounding-card-transcript-primitive
  ├──→ brownfield-workspace-analysis-grounding-brief
  ├──→ reusable-interviewer-invoked-context-gathering-beyond-opening-grounding
  └──→ rich-replay-treatment

legacy-knowledge-facade-cleanup
  └──→ project-to-specification-physical-db-rename
```
