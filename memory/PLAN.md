<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

## Active

1. **Top bar and phase label canonicalization** — update RouteRoot top bar to h-10 with logo + name + version + tagline + cwd (D101). Canonicalize phase labels to Grounding / Elicitation / Requirements / Acceptance Criteria (D99). Remove tagline from project list page.
   - Why now / unlocks: smallest layout change, touches two files, establishes the canonical labels that all subsequent layout slices reference.

2. **Phase stepper sidebar** — replace the current flat `PhaseNavigationSidebar` with a vertical timeline stepper showing connecting line, per-phase status/readiness/turn-count metadata, and an Output item gated by all-phases-closed (D99, D100, D102). Add sticky header with back link + project name. Story first in `src/client/stories/`, then integrate into `project/$id/route.tsx`.
   - Why now / unlocks: the sidebar is the primary navigation surface; landing it early lets other layout slices assume the stepper exists.

3. **Center pane sticky header and ChatScroll integration** — add sticky header to the center pane with "Phase N/M – Name" + status + turns + readiness + Close Phase button (D102, D103). Replace the current scroll container in InterviewView with ChatScroll (D106). Story exists already (`chat-transcript.stories.tsx`); integrate into `_view/route.tsx` and `-interview-view.tsx`.
   - Why now / unlocks: the center pane header is where the user manages phase state; ChatScroll is already proven in stories and ready to wire in.

4. **Knowledge sidebar grouping registry** — implement the hard-coded knowledge-group registry (D104) and refactor `EntitySidebar` to render groups with compact DrawerCards showing edge references as drawer-peek summaries. Story first in `src/client/stories/`, then integrate into the existing `EntitySidebar` component.
   - Why now / unlocks: the right sidebar currently renders a flat entity list; the grouping registry is the last pane to land before the three-pane layout is complete.

5. **Review-set implementation across requirements + criteria** — replace repeated micro-interview review turns with synthesized per-item approve / reject / comment lists plus list-level confirmation.
   - Why now / unlocks: the product model for grounding/design is becoming turn-card based while review remains list-based; landing review sets keeps that separation clean.

6. **Specification-first creation and workspace terminology adoption** — root creation asks only for the specification name, and touched product surfaces start distinguishing workspace vs specification while internal `project` identifiers remain unchanged.
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
