<!-- SPEC.md — live architecture register.
     Created by ln-spec · Read by all skills · Refreshed by ln-sync.
     Keep only active requirements, live assumptions, current decisions,
     critical invariants, and the verification stance. -->

# Brunch v2 — Spec Elicitation Tool

## Concept & Goal

Brunch is an AI-guided spec elicitation tool that turns natural-language goals into structured specifications through a four-phase interview:

- **grounding** — goals, terms, context, constraints
- **design** — commitments and tradeoffs
- **requirements** — capability review and gap-finding
- **criteria** — verification coverage

An interviewer agent conducts the conversation. A separate observer agent extracts typed knowledge items from each answered turn and links them into a knowledge graph. The interviewer may also invoke context-gathering capabilities when it lacks enough orientation for the next move; their visible outputs appear in the stream as preface cards. The workspace stream is turn-centered rather than message-shaped: durable conversational turns provide the branch-bearing lineage spine, while projected control cards, phase markers, and activity cards frame them. An open phase should always bottom out in one visible next action — a projected kickoff card, actionable frontier turn, visible generation state, projected recovery card, or closed-phase handoff / completion control.

Brunch is strongest while certainty is still being formed: when the real work is clarifying the target, surfacing commitments, and making unresolvedness legible before downstream implementation decomposition takes over. Its output is a calibrated handoff, not fake closure — a truthful starting point for implementation that makes visible what is known, chosen, constrained, required, and still open. Export is therefore built from the active path's accepted review outputs plus reviewed knowledge, not from laundering unresolved uncertainty into a prematurely final document.

Brunch operates inside a **workspace**: the cwd-backed software context whose local `.brunch/` directory stores one or more specifications. Grounding supports two strategies: **elicitation-first** for greenfield work and **analysis-first** for brownfield work. Brownfield grounding begins with read-only workspace analysis that produces a visible preface card (grounding brief), and the interviewer may gather more context via preface cards in any phase when it needs orientation.

Post-launch, Brunch should support specification work across two axes rather than one: `greenfield <> brownfield` and `end-to-end build <> incremental feature`. That means the interview cannot assume one long whole-product drill-down. It should be able to start broad, deepen recursively where needed, synthesize candidate spec directions when the user wants help filling in the gaps, and let the knowledge graph itself become a working surface for refinement instead of only a sidebar summary.

## Constraints & Non-goals

- Anthropic direct is the current runtime implementation; near-term provider work may add OpenRouter or provider-neutral routing, but Brunch remains user-supplied-key / no hosted inference account for now.
- No collaborative editing.
- No explicit document-ingestion UX in V1.
- No hard turn-tree branching UX in V1; revisit operates through knowledge-graph edit mode + secondary threads instead.
- No automatic cascade deletion; downstream effects are surfaced and re-resolved explicitly.
- No task-planning surface; Brunch elicits specs, it does not plan implementation work for the user.
- No downstream execution-management workflow in V1; Brunch ends at the handoff boundary rather than owning implementation after export.
- No general-purpose inline document editor in review phases; requirements and criteria review stay recommendation-led with lightweight user comments for revision.
- No offline-first or multi-tab sync layer; the current system stays server-authoritative and local-first.

## Requirements

1. `npx brunch` in a project directory with configured supported LLM provider credentials opens a working app in the browser with state in local `.brunch/`.
2. Starting a new specification asks only for the specification name before entering the workspace; greenfield / brownfield grounding strategy is then chosen through grounding entry states inside the specification workspace.
3. Brownfield grounding can use read-only workspace analysis to ground the opening flow and the first substantive question.
4. Structured responses support turn-appropriate option selections or explicit action submissions, an explicit `none of the above` path where relevant, and one attached response note. The interviewer autonomously chooses whether to include options on each question based on conversational trajectory; grounding requires free-text on every submission (options, when present, are optional enrichment), while design preserves the current selection-required gate with a structural "none of the above" path. A single turn may carry multiple assistant-part artifacts (e.g. a preface card followed by a question card, or a revision card followed by a review set) rendered as stacked cards with one unified response submission.
5. Users can see thinking, tool usage, and streaming progress in real time; if live-only artifacts are shown, replay keeps concise durable activity metadata (at minimum elapsed thinking time plus a coarse tool-use summary / placeholder seam) instead of dropping them completely.
6. The observer extracts typed knowledge items and graph edges from answered turns.
7. The accumulated knowledge layer and readiness state stay visible during the interview.
8. Each workflow mode has deterministic closeability plus a separate readiness signal.
9. Phase close records summary text and closure basis.
10. Users can revisit knowledge through edit mode, cascade preview, and a secondary thread.
11. Requirements review synthesizes a candidate requirement set from the knowledge layer, presents stable item reference codes, supports per-item commenting through an inline comment toggle on each item, and resolves through explicit `accept review` / `request changes` submission with per-item comments plus one optional global review note.
12. Criteria review synthesizes a candidate verification set from accepted requirements plus the knowledge layer, presents stable item reference codes, and supports the same per-item commenting and full-set review seam.
13. Export is available only when workflow closure, accepted review outputs, and staleness rules are satisfied.
14. Closing and reopening the browser resumes the specification from persisted state.
15. The dashboard shows multiple specifications / elicitation runs within one `.brunch/` directory.
16. Partial-scope elicitation works for a feature or bounded sub-area, not just whole-workspace greenfield specs.
17. Each phase exposes an explicit kickoff, frontier, recovery, handoff, or completion affordance; the UI must not strand the user with a bare generic composer as the only visible action.
18. Open interview phases default to a projected kickoff card, the current frontier turn, a visible generation state, or a projected recovery affordance when the frontier is missing, and closed phases terminate in a projected handoff or completion artifact at the bottom of the workspace stream.
19. The first phase is grounding in both product language and canonical workflow identifiers.
20. The interviewer may invoke context-gathering capabilities such as workspace analysis in any phase when the workspace directory is available; their outputs appear as visible preface cards paired with question cards within the same turn.
21. Preface cards are provisional context rendered as turn-internal artifacts paired with a question card within the same turn, so the observer captures from the whole validated unit (preface context + question + user response) rather than from unvalidated provisional content alone.
22. Grounding and elicitation persist only the durable exploration ontology (`goal`, `term`, `context`, `constraint`, `decision`, `assumption`); `non-goal` is represented as a `constraint` subtype, and requirements / criteria become durable only through accepted review outputs.
23. The knowledge ontology is defined once and projected consistently through schema, shared registries, observer prompts, API types, fixtures, and UI copy so kind semantics do not drift across layers.
24. Each phase section in the workspace stream opens with a phase section header that states the phase purpose and what kinds of knowledge are captured there, projected from workflow state rather than persisted as a turn.
25. When a user requests changes on a review set, the interviewer regenerates the full set as a successor review turn; revisions stack in the turn lineage but visually only the current revision renders live with a version badge, while prior revisions collapse to compact answered-turn summaries. A revision card (changelog + version badge) renders above the review set card within the same successor turn.
26. The homepage surfaces workspace (CWD) binding so the user understands that listed specifications and the "new specification" affordance are scoped to the current project directory.
27. The grounding interviewer prompt uses a hint-guided priority-ordered topic list (concept, users/audience, existing constraints, scope boundaries) with example question shapes rather than generating questions from scratch, keeping thinking budget low and generation lightweight.
28. Observer capture treats the full turn — including any turn-internal preface card or revision card plus the question or review set plus the user response — as one atomic validated unit for knowledge extraction.
29. Grounding captures both workspace novelty (`greenfield` / `brownfield`) and delivery posture (`end-to-end build` / `incremental feature`), and interviewer behavior adapts to any point in that matrix rather than assuming a whole-product greenfield interview.
30. Observer extraction treats typed relationships as first-class across the ontology and records them whenever they can be reasonably traced from a turn or accepted review state, while abstaining when support is weak. Relationship extraction must stay prompt-budgeted: existing entities should be presented as compact identity anchors, not full Markdown inventories or graph dumps.
31. Users can request a turn-owned candidate-spec set during grounding or design instead of only skipping the remainder of a phase; each candidate spec includes implications and tradeoffs, and the user can accept a direction, request refinement, or regenerate candidates. Accepting a candidate direction may steer the next interview move, but does not itself close the phase.
32. Interview detail can proceed as a progressive broad-pass-to-detail flow with explicit `next level of detail` actions, rather than only as one monolithic linear drill-down.
33. Graph view is a first-class alternative to chat view, accessed as a peer route, and projects the knowledge graph as a navigable workspace with visible relationship topology and supports launching refinement side-chats from graph selections. The first ship is a structured-list layout; a spatial canvas layout follows as a layout switch inside graph mode.
34. First-run setup detects missing expected LLM provider credentials before the user starts a specification, makes the missing-key state visible on the dashboard, and offers a guided setup path rather than requiring README / shell-env debugging.
35. If Brunch accepts an API key through the UI, it stores credentials outside the project workspace in XDG-compliant user auth/config state; project `.env` files and `.brunch/` never become the default secret-storage target.
36. LLM provider configuration is owned by a shared AI runtime provider seam, so interviewer and observer model creation do not encode direct provider imports or environment-variable reads as product truth. That seam must preserve provider-specific capabilities such as Anthropic thinking / reasoning options or degrade them explicitly.
37. Workspace hygiene detects whether the local `.brunch/` directory is git-ignored and, with explicit user confirmation, can add an idempotent `.gitignore` entry, creating `.gitignore` when absent.
38. The side-chat is a popover-to-panel chat surface anchored to spec items in the structured spec view, with two entry modes (per-row `chat-with` button and text-selection floating menu) and three user-facing intents (Explore · Edit · Annotate). Proposed changes stage in a patch list visible in the persistent app top-bar; the user reviews and applies in batch. The side-chat is the unified user-driven mutation surface — it subsumes the prior trigger-popover composer concept and the modal revisit-thread flow defined in `docs/design/REVISIT_MODULE.md`.

## Assumptions

<!-- Pruned 2026-04-23: removed assumptions that are now embedded in the shipped system. Kept only assumptions that still carry active uncertainty or constrain forward work. -->

| #   | Assumption | Confidence | Status | Depends on | Validation approach |
| --- | ---------- | ---------- | ------ | ---------- | ------------------- |
| A15 | The LLM can offer useful coarse readiness and closure recommendations, but closure authority must remain explainable and user-legible rather than model-owned. | medium | open | D65, D66 | Manual comparison of model recommendations vs user judgment across varied projects. |
| A20 | Users experience observer capture as responsive when every eligible answered turn enters one turn-owned background capture backlog instead of blocking chat stream completion, while replay still attaches capture status and results to the originating turn. | medium | open | D22, D96, D113, D123 | Measure stream completion timing, backlog draining, and replay clarity across grounding, design, requirements, and criteria turns. |
| A48 | Knowledge-graph edges are sufficient to drive accurate cascade preview for revisit work. | medium | open | D50, D80 | Structural cascade tests plus manual judgment about scope. |
| A49 | A modal secondary thread can resolve revisit implications without forcing a full interview restart. | medium | open | D80 | Manual revisit walkthrough once the thread lifecycle lands. |
| A51 | Grounding plus design remain legible if the primary input surface is the workspace-owned card family — durable turn cards for substantive elicitation plus projected control cards for structural affordances — rather than a persistent global composer. | medium | open | D89, D93, D94, D110 | Manual walkthroughs on grounding, design, and resumed states plus story review of entry / handoff patterns. |
| A53 | Concise durable activity summaries are sufficient to preserve transcript trust for live thinking/tool artifacts without persisting hidden reasoning or raw tool results. | medium | open | D93, D112 | Manual replay/reload walkthroughs on streamed turns once transcript activity summaries land. |
| A54 | An open phase can reliably project a kickoff control card, current frontier turn, visible generation state, or projected recovery card on first render without requiring the user to bootstrap the phase by typing into a generic composer. | medium | open | D89, D94, D95, D110 | Manual walkthroughs on kickoff-ready, design-active, review-active, and recovery states. |
| A55 | Trailing observer capture remains trustworthy if waiting/applying state stays attached to the answered turn and deferred completion writes back through that turn's identity rather than the current frontier. | medium | open | D96, D113, D123 | Manual timing walkthroughs plus reload/resume tests on seeded turns with known deferred observer work. |
| A57 | A specification-scoped lifecycle seam — whether implemented as a lightweight runtime supervisor, router-integrated service, or chart-backed helper — can own duplicate-safe automatic phase entry / continue, late-event suppression, and route-independent in-flight operation identity without introducing a second durable workflow model or a general runtime-operations ledger. | medium | open | D113 | Prototype the lifecycle seam on auto-present / recovery / force-close edges; if duplicate-submit or restart truth remains ambiguous, revisit whether the seam needs stronger runtime machinery or more durable coordination. |
| A58 | A cumulative workspace can preserve phase legibility and workflow honesty if realized sections stay visible as historical record, future sections do not render until reachable, and section focus remains navigation-only state rather than redefining durable workflow truth, reachability, or the single actionable frontier. | medium | open | D86, D110, D113, D114 | Prototype the cumulative workspace against future-phase deep-link redirects, scroll/focus transitions, close-to-next-phase motion, and resume/reload walkthroughs; if unrealized-phase routing or single-frontier clarity drifts, keep the current per-phase rendering boundary. |
| A59 | Interviewer-autonomous question format — where the model chooses whether to include options based on conversational trajectory rather than rigid phase rules — produces better grounding conversations than mandating free-text-only, because the interviewer naturally starts open-ended and adds suggestive options as the user's thinking narrows. The observer can interpret option selections phase-appropriately (resonance in grounding, commitment in design) without schema changes. | medium | open | D89, D110, Requirement 4 | Manual walkthroughs across greenfield and brownfield grounding comparing interviewer-chosen format vs phase-mandated format; check whether observer captures stay coherent when the same selection structure carries different semantic weight by phase. |
| A60 | A concise phase section header (purpose + captured knowledge kinds) is sufficient to orient the user at phase entry without requiring a longer onboarding flow or tutorial card. | medium | open | D116 | Manual walkthroughs on fresh specifications; check whether users understand what the phase expects of them. |
| A63 | Hint-guided grounding prompts produce meaningfully adapted questions rather than degenerating into rote template output across different projects. | medium | open | Requirement 27 | Manual greenfield walkthroughs across varied project types; compare question quality against the current unconstrained prompt. |
| A64 | Replacing coarse `router.invalidate()` with query-owned invalidation boundaries eliminates the scroll-jank cascade without introducing coordination complexity or stale-data bugs; the near-term boundary may be one specification bundle domain plus a separate entities domain rather than a fake finer split. | medium | open | D121 | Prototype the staged bundle + entities decomposition and measure scroll stability plus data freshness during observer updates. |
| A65 | The interviewer can adapt usefully to the full `greenfield <> brownfield` by `end-to-end build <> incremental feature` matrix without making kickoff feel bureaucratic or over-parameterized. | medium | open | D124 | Manual walkthroughs across all four corners of the matrix, including partial brownfield feature work. |
| A66 | Relation-first observer capture will improve revisit, export grounding, and graph-view utility without flooding the graph with speculative or low-value edges. | medium | open | D50, D125 | Run post-FE-639 observer corpus probes plus manual graph/export review focused on edge precision, coverage, and visible usefulness. |
| A67 | Users who are tired, rushed, or under-informed will converge faster by reacting to synthesized candidate specs than by continuing a long direct interview or force-closing early. | medium | open | D126, D127 | Manual user-flow comparison between direct questioning, skip-close, and candidate-spec reaction flows. |
| A68 | Broad-pass interviewing followed by explicit deepen-detail actions will preserve coherence better than a single depth-first drill-down while still producing export-worthy specifications. | medium | open | D127 | Prototype broad-pass-first flows and compare resulting knowledge completeness and user comprehension. |
| A69 | A graph-centric refinement surface can launch side-chats without splitting durable specification truth, so chat view and graph view stay two projections over one evolving graph. | medium | open | D128, D114 | Prototype graph-launched refinement with reload/resume checks to ensure side-chat state and graph state stay coherent. |
| A70 | The structured-list graph-view layout provides standalone enumeration value beyond relationship density: users benefit from seeing all knowledge items grouped by kind even when most have no edges yet, and graceful degradation (collapse the relations footer when zero edges) keeps the view honest while relation-first observer capture matures. | medium | open | A66, D128, D129 | Manual walkthroughs at low and high edge density once the structured list ships; check whether the layout still feels valuable when most items have empty relations footers, and whether observer-density growth visibly improves the view over time. |
| A71 | OpenRouter will reduce first-run friction for Brunch's likely users compared with requiring direct Anthropic keys, but model capability parity and AI SDK support need proof before making it the default provider path. | medium | open | D130, D131 | Spike provider configuration against interviewer/observer calls, especially model naming, structured output, tool use, and reasoning/thinking support. |
| A72 | XDG-compliant user-scoped auth/config storage is acceptable for UI-entered API keys and safer than writing secrets to the project workspace, while environment variables remain useful for automation and CI. | medium | open | D130, D132 | Prototype key save/load/delete precedence and inspect OS/XDG paths; manual first-run walkthrough verifies users understand where the key is stored. |
| A73 | Users will accept Brunch editing `.gitignore` when the action is explicit, previewable, and idempotent; doing so should reduce accidental commits of `.brunch/` without feeling like surprising repo mutation. | high | open | D133 | Unit-test ignore detection / append behavior and manual dashboard walkthrough with absent, present, and already-covering `.gitignore` states. |
| A74 | A unified `spec → chat → turns` data model with diff-shaped patches as the persistence primitive will simplify the side-chat's patch-list, item versioning, and the architect loop without sacrificing the durable workflow guarantees of the current store-of-stores. | low | future | D113, D125, D134, D135 | Prototype the patch / event-stream model on a side branch and compare apply-step latency, audit-log clarity, and refactor surface area against the current per-store mutation fan-out. |
| A75 | Knowledge-graph items can carry version history without breaking the active-path durable-truth contract: each version is the result of an applied patch, prior versions are queryable for diff/comparison/audit, and the active-path projection always reflects the latest version for each item. | low | future | A74, D80, D134 | Prototype item versioning behind A74's patch model; verify that revisit cascades, span-anchored annotations, and soft-edit audit trails behave correctly across versions. |
| A76 | An autonomous architect / generator agent can produce useful patch proposals against the knowledge graph and surface them through the same patch list the side-chat uses, so HITL review is a unified surface regardless of patch origin. | low | future | A74, D134, D135 | Run the architect in shadow mode against seeded specs once V4 ships; compare proposed patches against subsequent user-driven edits to gauge precision/recall. |

## Decisions

<!-- Pruned 2026-04-23: removed decisions that are now embedded product facts in the shipped system. Kept only decisions that still guard active seams, shape forward infrastructure work, or constrain unbuilt capabilities. -->

22. **Observer-result sync is turn-owned and background by default** — eligible answered turns enter one turn-owned observer capture backlog after durable turn finalization, and chat stream completion must not wait on extraction. Capture may still surface results through the existing turn-owned `data-observer-result` artifact once available, but the runtime path should be normalized around the `/api/specifications/:id/turns/:turnId/observer-capture` seam rather than split between inline stream-blocking capture and deferred capture. This preserves one durable workflow model: durable truth remains the answered turn plus any persisted observer result part, not a separate workflow store or ledger.

50. **Knowledge relationships live behind one typed graph seam** — persisted graph edges are first-class and drive dependency, derivation, and revisit behavior.
65. **Phase outcomes are explicit durable records** — workflow status, closeability, readiness, and closure provenance project from durable phase outcomes on the active path.
66. **Interviewer-recommended and user-forced closes share one transcript-friendly seam** — one phase-close transport handles both paths, with explicit closure basis.
80. **Knowledge-graph revisit replaces hard turn-tree branching for V1** — revisit starts from edit mode on knowledge items, traces cascade through graph edges, and resolves through a secondary thread. **Updated 2026-04-30 (D134):** the modal secondary thread originally specified in `docs/design/REVISIT_MODULE.md` is replaced by the side-chat panel's secondary-thread mode; the revisit lifecycle and cascade preview are unchanged. **Chat-level branching note:** the no-turn-tree-branching invariant remains in force at the *turn* level, but multiple chats per spec (main interview chat plus the side-chat panel; later, multiple persistent side-chat threads in V4) are explicitly allowed at the *chat* level. Branching at the chat level is not user-surfaced as a `branch this thread` affordance in V1; it manifests only as the coexistence of the main interview chat and the side-chat panel.
86. **The client is organized by phase-addressable routing and three concentric layout shells** — AppLayout, SpecificationWorkspaceLayout, and ViewLayout own the user-facing route structure. Interview phases remain router-addressable for deep links, gating, and sibling route composition even if the center pane later renders them inside one continuous workspace surface.
87. **Layout-level data ownership partitions invalidation** — the specification bundle and entity collections subscribe through separately owned query domains / route surfaces instead of one monolithic refresh boundary, so entity refreshes do not remount or tear down the transcript-owning surface.
89. **Primary grounding/design input is workspace-owned and card-owned** — substantive elicitation in grounding and design proceeds through durable turn cards inside the workspace stream, while structural phase-entry, recovery, and handoff affordances project as control cards in that same stream; the global bottom composer is not the canonical input seam. Preface cards accept optional comment + continue, while question cards collect substantive answers. Depends on: A51. Supersedes: —.
93. **Replay for elicitation phases is turn-centered, not message-shaped** — completed interview turns collapse into answered-turn records that summarize the offer, the structured user response, and the capture status, while phase markers, projected control cards, and activity cards render as stream elements around those turns rather than as ordinary chat bubbles. Depends on: A51, A53, D110. Supersedes: —.
94. **Phase progression is frontier-anchored** — every open phase bottoms out in exactly one visible next action: a projected kickoff card, actionable frontier turn, visible generation state, or projected recovery card. Accepting a frontier turn durably creates its successor turn, successor generation avoids closed-without-frontier gaps, and recovery is a structural fallback that appears whenever an open phase lacks a valid frontier rather than another generative turn that must itself be created. Closure proposals remain durable proposal-shaped turns on the active path; accepting one confirms phase closure and opens the next phase into its projected entry state, while rejecting one keeps the phase open and requires a same-phase successor frontier. If a phase is closed, the stream bottoms out in a handoff or completion control. Depends on: A51, A54. Supersedes: —.
95. **Structural control affordances project from workflow state rather than masquerading as ordinary turns** — kickoff, recovery, and end-of-phase affordances derive from workflow state, phase outcomes, and neighboring turn anchors instead of from incidental copy or mandatory durable turn rows. Any durable implementation seam used to help project them must be treated as transitional and must not redefine their product meaning as authored conversational turns. Depends on: D65, D94, D110. Supersedes: `why`-based kickoff/recovery sentinels and the earlier persisted-turn-kind framing.
96. **Observer capture trails interviewer progression through one turn-owned backlog** — interviewer completion may unlock the next turn before observer capture finishes, and that should be the default lifecycle for all eligible phases rather than a grounding/design exception. Any trailing observer state remains attached to the just-answered turn card instead of surfacing as a free-floating transcript row; observer-result transport carries the originating turn identity so late capture can hydrate back into that same card. Depends on: A20, A53, A55. Supersedes: inline stream-blocking observer capture as a normal completion path.

110. **The workspace stream is a merged read model, not identical to the turn tree** — active-path durable conversational turns remain the only branch-bearing lineage spine; durable non-turn workflow facts such as phase outcomes anchor themselves to turn ids for provenance, ordering, and invalidation; projected control cards, phase markers, and activity cards derive from workflow state plus nearby anchors instead of requiring their own turn rows. Depends on: D65, D89, D93, D94, D96. Supersedes: the implicit equivalence between rendered cards and persisted turns.

111. **The app is seed-first and migration-light until the data model settles** — prioritize one truthful read-model contract plus up-to-date seeded scenarios over compatibility for legacy local rows. Durable authority comes from active-path substantive turns, `phaseOutcome`, workflow state, and the current canonical record/phase identifiers; projected kickoff / recovery / handoff affordances must be derived from those facts rather than preserved as canonical control-turn rows. Transitional seams may survive briefly as internal submit plumbing, but new server reads, client renders, fixtures, and happy-path tests must not depend on legacy aliases or adaptation layers as product truth. When a naming or persistence cutover lands — including `project` → `specification` and `scope` → `grounding` — destructive reseed is preferred over spending time on migration logic for unstable local data. Depends on: D95, D110. Supersedes: the implicit bias toward preserving legacy control-row compatibility during the cutover.

112. **Turn-artifact persistence is server-owned and interviewer-shaped** — durable review-set, preface-card, activity-summary, and phase-summary artifacts materialize from interviewer output through one server helper, so the chat-runtime finalize path acts as orchestration glue instead of reconstructing artifact semantics ad hoc. Replay, accepted-review materialization, and seeded walkthroughs therefore consume the same persisted artifact contract the interviewer produced. Depends on: D93, D96, D110. Supersedes: the ownership split where runtime finalization re-derived grounding/review artifacts outside one authoritative persistence seam.

113. **Phase lifecycle side effects are specification-scoped, not route-scoped** — durable workflow truth, landing reconciliation, and routed read-model projection remain authoritative; they do **not** move into a second client-side workflow store. The router continues to own navigation, loader/query subscription, and rendering of the derived read model. A separate specification-scoped lifecycle seam owns only the ephemeral process concerns that routes are poor at holding correctly: one-shot automatic phase entry / continue, in-flight operation identity, duplicate-submit suppression, cancellation, stale-event rejection, and capture-backlog reseeding after hydration. That seam may be implemented as a lightweight runtime supervisor, router-integrated service, or chart-backed helper, but its implementation is intentionally left open; what is decided here is the ownership boundary, not a mandatory framework. Constraints: (1) no second durable workflow model or general runtime-operations ledger by default, (2) no independent client authority over phase status, landing truth, or handoff/completion semantics, (3) no route-local `useEffect` or remount-tied behavior as the trusted owner of lifecycle effects like auto-present, and (4) any lifecycle helper must consume durable truth and emit idempotent, ignorable side effects rather than redefine product state. Depends on: D87, D94, D95, D96, D110, D112. Supersedes: route-local auto-present / continue effects as a trusted lifecycle seam.

116. **Each phase section opens with a projected phase section header** — a non-turn, non-durable stream artifact that states the phase purpose and what kinds of knowledge are captured there. The header is projected from workflow state and phase metadata (similar to phase markers) and re-projects on hydration. Content is phase-specific: grounding explains goals/terms/context/constraints, elicitation explains design decisions, requirements explains review, criteria explains verification. Depends on: A60, D110. Supersedes: —.

121. **Client data ownership migrates from coarse loader invalidation to query-owned domains** — the near-term authoritative boundary is one specification bundle seam for workflow state, landing state, and turns, plus a separately invalidable entities domain scoped to the specification. Mutations and SSE events invalidate only the owned query key. The router loader becomes a thin shell that primes or guards those domains instead of owning the read model, and finer core/turn split work waits for a real server ownership boundary rather than a fake cache-key split over one payload. Depends on: A64, D87. Supersedes: monolithic `router.invalidate()` after every mutation.

123. **Runtime proving uses a lightweight lifecycle seam with observer backlog, not a second workflow store** — every eligible answered turn should be able to unlock successor interactivity as soon as interviewer generation is durably ready, while observer capture for the answered turn runs afterward through a turn-owned `/api/specifications/:id/turns/:turnId/observer-capture` seam. The client lifecycle may keep only ephemeral capture state (`waiting`, `applying`, retry/backlog identity`) and reseed unfinished capture from durable turns after hydration/reload; durable authority remains the persisted turn plus its observer result part. Current constraint: server-side dedupe is process-local, so restart recovery depends on reseeding from turns that still need observer capture rather than on a durable runtime-operations ledger. Depends on: D22, D96, D113. Supersedes: the mixed inline/deferred observer finish boundary.

114. **Continuous workspace rendering and phase addressability are separate concerns** — the interview center pane may render one cumulative workspace stream whose realized grounding, design, requirements, and criteria sections remain visible as the workflow advances, while the router continues to preserve deep links, gating, and sibling-route composition. A workspace-level controller may own one chat session, cross-section projection, focus / scroll behavior, and close-to-next-phase motion without turning focus state into a second durable workflow model. Phase routes act as focus addresses into that shared surface rather than distinct transcript owners: navigating to a realized phase focuses and scrolls to its section, while direct navigation to an unrealized future phase redirects to the current reachable phase instead of rendering placeholder content. Constraints: (1) one chat runtime per specification, not one per rendered phase, (2) only realized sections render in the cumulative center pane, so future phases do not project empty shells before they become reachable, (3) exactly one actionable frontier remains at the bottom of the current reachable section while prior sections are replay-only record, (4) focused section state must not redefine durable workflow truth or landing truth, (5) graph view is a peer route to the cumulative workspace surface — phase-independent, accessed via direct navigation, but rendered inside the outer specification shell so phase-sidebar continuity and top-bar consistency remain, and (6) output remains a separate route because it is not part of the interview timeline. Depends on: A58, D86, D87, D110, D113. Supersedes: the assumption that each phase route must own a distinct rendered transcript surface.

124. **Interview framing is two-axis, not novelty-only** — the interviewer should orient itself with both workspace novelty (`greenfield` / `brownfield`) and delivery posture (`end-to-end build` / `incremental feature`). Partial-scope work is therefore a first-class interview shape rather than just a greenfield/brownfield footnote. Depends on: A65. Supersedes: the implicit single-axis framing around grounding strategy plus partial-scope support.

125. **Observer capture is a prompt-budgeted graph-delta seam** — `runObserver()` remains the public capture boundary, but its internal output includes a generic graph delta: per-kind item collections plus a compact top-level relationship-candidate set that can reference existing entities by `knowledge_item.id` and same-turn provisional items by `{ kind, index }`. Existing-entity identity is the database id; any kind metadata in prompts is only display/validation context, never part of the lookup key. The server owns provisional-reference resolution after persistence, validates candidate edges through one typed relation-policy registry, and writes only supported edges, preferring abstention over speculative edge inflation. Accepted review sets reuse the same relation policy when materializing requirements or criteria so review-authoritative entities can add edges without a second durable graph model. Observer prompts avoid full entity tables and existing graph topology by default; future enrichment should use compact anchor inventories, phase/relevance filtering, and corpus/manual graph review before adding more context. Depends on: A66, D50, D112, D123. Supersedes: the decision/assumption-only relationship extraction instruction in the current observer seam.

126. **Phase-shortening should synthesize proposals through a turn-owned candidate-spec assist, not only skip remainder** — grounding and design may project a user action like `fill in the rest for me`, which invokes interviewer-authored candidate-spec set artifacts on an ordinary durable turn rather than extending force-close semantics. Each set presents one or more candidate directions with implications and tradeoffs, and the user responds through one structured reaction seam (`accept-direction`, `refine`, or `regenerate`). Accepting a candidate direction may steer the next interview move or later closure proposal, but does not itself imply phase closure. This reuses the existing turn-artifact / workflow model instead of adding a second durable workflow machine. Depends on: A67, D66, D94, D112. Supersedes: skip-only close as the sole user-legible fallback for low-patience or low-information phases.

127. **Interview detail should flow through a turn-owned breadth skeleton and detail-focus reaction** — grounding and design may pair an ordinary question turn with an interviewer-authored breadth-skeleton artifact that makes the current broad-pass map visible, marks which areas are already sufficient for now, and offers explicit `next level of detail` affordances. The user reacts by choosing whether to deepen one named area now, continue the broad pass, or leave an area sufficient-for-now; that reaction steers the next same-phase frontier turn without creating a second durable workflow or topic-tree store. Recursive follow-up remains ordinary focused turns on the same active path, and any future chat or graph affordance should emit the same detail-focus intent against shared specification truth rather than inventing a parallel deepening model. Depends on: A67, A68, D94, D112, D113. Supersedes: the implicit assumption that every frontier turn advances by the same depth granularity.

128. **Graph view becomes an actionable workspace mode through a projection-first, intent-emitting seam** — graph mode should project shared entity truth into a relationship-aware scene with visible edge topology and own only ephemeral graph-local interaction state such as viewport, selection, focus, and path highlighting. It must not create a second durable workflow or edit-state model. Node-level actions emit intents into the existing workspace lifecycle so refinement side-chats, revisit, and future edit flows still materialize through turn-owned artifacts, projected control cards, and the same durable specification truth used by chat view. The common-case interaction should optimize for `select node -> inspect -> launch focused refinement`, with broader multi-select or edit overlays layered on later. The first ship layout is a **structured list**: kind-grouped item rows with a relations footer (Outgoing / Incoming subsections of relation chips), `referenceCode`-based hash anchors for cross-item navigation, hover-card previews on chips, soft-truncation at 6 chips per direction, and a per-row action rail reserving one disabled `chat-with` placeholder for future intent emission. A **spatial canvas** layout follows as a layout switch inside graph mode without changing the projection seam or action contract. The empty state is a minimal orientation card linking to the current reachable phase rather than empty kind sections; an explicit `Back to chat` affordance returns to the user's last phase route. Depends on: A69, A70, D50, D80, D113, D114. Supersedes: graph view as a placeholder grouped list surface, and graph view as a sibling layout mode under `_view`.

129. **Graph view's structured-list scope decouples data fetching from default render** — graph view always fetches the `whole-spec` entities so chip targets always resolve, but defaults the rendered row set to active-path items so toggling between chat view and graph view does not silently widen the user's working scope. A `Show all` toggle expands the rendered set to the full data already in memory; no second fetch and no scope-dependent loading. **Phased shipping:** the structured-list ship lands the whole-spec fetch portion of this contract first; the active-path render filter and `Show all` toggle ship in a follow-up frontier item (see `memory/PLAN.md` Horizon: *Graph view active-path filter + scope toggle*) once per-item active-path membership is exposed in the entities API or derived through a stable client-side seam. Until then the structured list renders all `whole-spec` items by default, so the toggle would be a no-op and is not surfaced. Depends on: A70, D87, D121, D128. Supersedes: render scope and fetch scope coupled through the existing `mode=active-path | project-wide` query parameter.

130. **First-run setup becomes a product surface, not README-only configuration** — the dashboard should expose provider credential status before specification creation and route users toward setup when no supported key is available. CLI logs and README env instructions can remain, but they are no longer the only supported onboarding path. Depends on: A71, A72. Supersedes: `ANTHROPIC_API_KEY` in project `.env` as the sole user-facing setup contract.
131. **Provider access moves behind one AI runtime provider seam** — interviewer and observer model construction should consume a shared provider/model resolver instead of importing Anthropic directly and reading model environment variables in each caller. The seam may keep Anthropic as the current implementation while testing OpenRouter as the preferred onboarding provider, but provider choice must be explicit and testable. Depends on: A71. Supersedes: direct Anthropic imports in interviewer/observer code as product truth.
132. **UI-entered credentials are user-scoped auth state, not workspace state** — if the app collects an API key, it writes to an XDG-compliant user auth/config location, never to `.brunch/` or the project `.env` by default. Existing environment-variable configuration remains supported as an override path for scripted use. Depends on: A72. Supersedes: project-local `.env` as the only persistent setup mechanism.
133. **`.brunch/` gitignore support is confirm-gated deterministic workspace mutation** — Brunch may inspect the workspace repository and offer to add `.brunch/` to `.gitignore`, but it must not mutate repository files without explicit confirmation. The mutation should be idempotent, preserve existing file content, and create `.gitignore` only when the user accepts. Depends on: A73. Supersedes: relying solely on user memory / docs to ignore the generated workspace directory.
134. **Side-chat is the unified user-driven mutation surface** — graph-launched chat anchored to spec items, with two entry modes (per-row `chat-with` button and text-selection floating menu), three user-facing intents (Explore · Edit · Annotate), and four internal patch kinds (`edit` · `edge` · `drill-down` · `annotate`) routed through one shared mutation pipeline. **Edit is a router**, not a single action: applied edit patches route by anchor-item phase status (open → Refine via successor turn; closed → impact tier `none` / `soft` / `hard`). Span-level pinned context is supported as a prompting hint, but patch granularity stays item-level in V1; only `annotate` patches carry an optional `selectionRange` field for span-anchored notes. The side-chat replaces the trigger-popover composer concept and absorbs the modal secondary thread defined in `docs/design/REVISIT_MODULE.md` into its panel; both prior horizon items are subsumed. Phasing: V1 ships Explore + Annotate; V2 adds Edit + Drill-down + Propose-edge; V3 absorbs REVISIT_MODULE's cascade preview and batch-resolution secondary-thread; V4 unlocks multi-thread + architect-loop integration once A74 lands. Depends on: A69, D50, D80, D89, D113, D125, D127, D128, Requirement 38. Supersedes: trigger-popover composer (A51, D89 framing) and revisit / edit mode + cascade preview (Requirement 10, D50, D80 secondary-thread modal). Design doc: `docs/design/SIDE_CHAT.md`.

135. **Patch list is the canonical staging surface in the persistent app top-bar** — proposed mutations from the side-chat (and, later, from the architect loop in A76) stage in a patch list whose **canonical** UI lives in the persistent top-bar (`N Edits · Undo · Apply`), visible regardless of whether the side-chat panel is open. Bulk-apply is the single canonical commit affordance: the user applies all staged patches in dependency order or discards what they don't want first; per-entry apply is intentionally not provided in V1. The side-chat panel surfaces patches inline as a secondary acknowledgment when staging happens from inside the chat, but the in-panel inline list is convenience UI, not source of truth. The same patch list serves the architect loop in V4 — there is no second review surface to invent for system-driven patches. Depends on: A74, D113, D134. Supersedes: per-action promote semantics where each chat exchange fires exactly one durable mutation.

## Interaction Stream Model

The center column is a **merged stream projection** over multiple artifact families. The turn tree remains the authority for conversational lineage and branching, but the rendered stream is intentionally richer than the tree itself.

| Artifact family | Durable | Branch-bearing | Current examples | Ordering / invalidation rule |
| --------------- | ------- | -------------- | ---------------- | ---------------------------- |
| Conversational turn cards | yes | yes | grounding question, design question, review proposal, closure proposal, answered-turn replay | Ordered by the active-path turn chain; branch membership comes from `parent_turn_id`. |
| Anchored workflow facts | yes | no | phase outcome | Stored outside the turn table but anchored to turn ids for provenance; if an anchor falls off the active path, the fact is superseded or hidden. |
| Projected control cards | no | no | kickoff, recovery, proceed / go-to-frontier affordances | Derived from workflow state plus nearby anchors; they re-project on hydration and may disappear / reappear without needing their own durable row. |
| Activity cards | mixed | no | visible generation state, persisted activity summary, trailing observer state | Derived from runtime state or replay summaries adjacent to a turn or control boundary; they do not become branch nodes. |
| Phase markers | no | no | phase start, phase closed | Projected from workflow position and anchored workflow facts such as phase outcomes; they annotate the stream without entering the turn tree. |
| Phase section headers | no | no | grounding purpose + knowledge kinds | Projected from workflow state and phase metadata at the top of each phase section; re-project on hydration. |

This model is deliberately asymmetric: only conversational turns participate in the linked-list lineage model, while the other artifact families either anchor to that lineage or project from it. A rendered card therefore does not imply a persisted turn row, and a persisted durable record does not need to masquerade as a turn to belong in the stream.

The ordering rule is: active-path turns provide the spine, anchored workflow facts attach to points on that spine, and projected control / activity / phase-marker elements are injected relative to workflow state and those anchors. The invalidation rule is: if a durable non-turn record is anchored to a turn that leaves the active path, the record must be superseded or hidden rather than left floating as if it still belonged to the trusted branch.

## Layout Architecture

### Top Bar

| Element | Content | Position |
| ------- | ------- | -------- |
| Logo | Placeholder (TBD) | left |
| App name + version | "Brunch v{version}" | left, after logo |
| Separator | Pipe character | left, after version |
| Tagline | "AI-guided spec elicitation" | left, after separator |
| Working directory | `cwd` in mono | right-aligned |

Height: `h-10` (40px). Version injected at build time from `package.json`.

### Three-Pane Layout

Below the top bar, three vertical panes fill the remaining viewport height. Each pane has a sticky-positioned header and a scrollable body using ScrollArea.

#### Left Pane — Specification Navigation Sidebar

**Sticky header:**
- "< Back to Workspace" navigation link
- Read-only specification name (set at creation, not editable)

**Body — Phase stepper / section navigator:**
A vertical timeline with connecting line (blue for completed segments, gray for future). It remains strictly sequential for workflow truth, but it may behave as a section-jump / scroll-spy surface inside one continuous workspace transcript. Each phase item shows:

| Phase | Internal key | Label |
| ----- | ------------ | ----- |
| 1 | `grounding` | Grounding |
| 2 | `design` | Elicitation |
| 3 | `requirements` | Requirements |
| 4 | `criteria` | Acceptance Criteria |
| 5 | *(route only)* | Output |

Per-phase metadata: status (colored: Closed / In-Progress / Unstarted), readiness band (when in-progress), turn count. Closed phases and the current reachable phase are selectable; future phases may remain visible but locked. Output appears conditionally when all phases are closed.

#### Center Pane — Chat Transcript

**Sticky header:**
- "Phase N/M – [Phase Name]" for the currently focused section or current reachable phase — positional progress label
- Status text (colored)
- Turn count
- Readiness band (when in-progress)
- Close Phase button (right-aligned, in-progress only, gated by closeability, triggers confirmation)
- Status badge replaces button when phase is closed

**Body (chat view):**
- One continuous workspace scroll surface that may be segmented into phase sections rather than remounted per phase
- Each phase section opens with a projected phase section header stating the phase purpose and captured knowledge kinds
- Closed phases replay their phase markers and answered / compacted turn cards as prior sections
- The current reachable phase owns the only actionable bottom artifact
- Activity cards and visible generation state stay attached to their section / turn anchors while the next generative turn is being created
- Active bottom artifact: projected kickoff control card, durable frontier turn card (grounding/question/review/closure proposal), or projected recovery card
- Artifact-specific controls

**Body (closed phase):**
- Answered question cards
- Phase-closure marker plus any activity cards
- "Proceed to [next phase]" or equivalent handoff control card at bottom

Scroll container: ChatScroll (ScrollArea + useStickToBottom).

#### Right Pane — Knowledge Graph Sidebar

**Sticky header:**
- "Knowledge Graph" title
- Item count + connection count

**Body — Grouped knowledge items:**

| Group label | Kinds | Visible |
| ----------- | ----- | ------- |
| Goals | goal, context, constraint (including `non-goal` subtype) | yes |
| Assumptions & Decisions | assumption, decision | yes |
| Requirements | requirement | yes |
| Acceptance Criteria | criterion | yes |
| *(hidden)* | term | no |

Items render as compact DrawerCard instances: code + content in header, edge/dependency reference codes as drawer-peek summary when edges exist, plain card otherwise.

### Design Tokens

**Typography scale** (11px–16px, no sizes outside this range):

| Token | Size | Usage |
| ----- | ---- | ----- |
| `text-xxs` | 11px | Impact badges, tag labels |
| `text-xs` | 12px | Secondary text, metadata |
| `text-xs-plus` | 13px | Secondary body, explanatory text |
| `text-sm` | 14px | Body text |
| `text-sm-plus` | 15px | Card headings, collapsed question text |
| `text-base` | 16px | Section headings |

Question card titles use arbitrary `text-[17px]` above the scale for emphasis.

**Font weights**: normal (400), medium (500), semibold (600). No bold (700+).

**Color tokens**:

| Token | Hex | Usage |
| ----- | --- | ----- |
| `ink` | #202020 | Primary text |
| `sub` | #5b5b5b | Subtitles, secondary text |
| `hint` | #a6a6a6 | Placeholders, inactive elements |
| `rule` | #e3e3e3 | Borders, dividers |
| `wash` | #f0f0f0 | Ghost fills, tracks |
| `tint` | #fafafa | Subtle background |

**Accent blue** (interactive elements, recommendations, progress):
- Primary: `#2070e6`
- Gradient top: `#3484fa`
- Ring/border: `#1060d6`

**Shadow tokens**: `--shadow-card`, `--shadow-ring`, `--shadow-card-ring`.

**Card structure pattern** (DrawerCard): outer `rounded-xl border border-rule bg-tint` shell, inner white header with `-m-px` border overlap trick and `shadow-card`, tinted drawer body below.

## Critical Invariants

<!-- Pruned 2026-04-14: kept only seam-level invariants that still protect active work. -->

| #    | Invariant | Protected by | Proves |
| ---- | --------- | ------------ | ------ |
| I4   | Vite proxy routing and the runtime backend-port seam stay aligned through one explicit configuration path. | `runtime-config.test.ts` | Requirement 1 |
| I17  | Data Part schema validation remains confined to true LLM / HTTP boundaries rather than mirrored internal seams. | `parts.test.ts` | Requirement 4 |
| I24  | Interview hydration, streaming projection, controller orchestration, mutation transport, phase-scoped rendering, and successor-frontier continuity remain stable through the routed interview surface, including concise durable activity summaries for replay, projected kickoff/recovery/handoff controls, preface-card replay and continue affordances, landing-only grounding-strategy kickoff submission, turn-owned submit/interviewer-processing, visible generation states, anchored phase-boundary projection, and trailing observer attachment. | `InterviewView.test.tsx`, `-workspace-stream-projector.test.ts`, `transcript-parity.test.tsx`, `-interview-data.test.ts`, `-interview-controller.test.tsx`, `app.test.ts`, `client-mutation.test.ts`, `task.test.tsx` | D86, D87, D93, D94, D95, D96, D110, D113 |
| I44  | Structured turn responses round-trip through persistence, hydration, projection, and UI affordance state without collapsing back to scalar semantics. | `turn-response.test.ts`, `context.test.ts`, `InterviewView.test.tsx` | Requirement 4 |
| I48  | Canonical knowledge kinds persist with provenance and project through typed entity collections, stable per-kind reference codes, turn-linked capture projection, and graph edges without ontology drift. | `db.test.ts`, `core.test.ts`, `knowledge.test.ts`, `EntitySidebar.test.tsx`, `InterviewView.test.tsx`, `GraphView.test.tsx` | D50, Requirements 22, 23 |
| I54  | Phase-aware capture preserves the committed ontology boundary: grounding / elicitation persist only durable exploration knowledge, accepted review outputs materialize durable requirements / criteria, and both seams survive persistence, turn-linked replay hydration, and UI refresh without breaking sync. | `observer.test.ts`, `context.test.ts`, `app.test.ts`, `InterviewView.test.tsx` | D95, D112, Requirements 22, 23 |
| I72  | Explicit phase outcomes project shared workflow status, closeability, readiness, closure basis, and closed-phase boundary markers through one durable seam. | `phase-close.test.ts`, `db.test.ts`, `app.test.ts` | D65, D66, D110 |
| I87  | Requirements and criteria review ground themselves in their respective inventories, persist interviewer-owned review metadata on the review turn itself, project stable review-set reference codes, submit lightweight full-set review replies by semantic action rather than assumed option order, and carry accepted review outputs into downstream workflow without leaving dead frontier states. | `interview.test.ts`, `db.test.ts`, `app.test.ts`, `InterviewView.test.tsx`, `project-state-turn.test.ts` | D94, D112 |
| I100 | `.brunch/` workspace resolution, compiled package-bin startup from the packed install artifact, built-client serving, actual bound URL reporting, same-workspace runtime ownership, chat-sized JSON request parsing, and JSON-shaped payload-too-large failures stay correct in local-first distribution. | `project.test.ts`, `launcher.test.ts`, `cli.test.ts`, `runtime-config.test.ts`, `app.test.ts` | Requirement 1 |
| I101 | Grounding strategy and workspace-backed context gathering persist through schema, API, interviewer configuration, and observer context; preface-card assistant metadata round-trips through persistence/projection, and preface cards stay provisional rather than directly mutating durable knowledge. | `db.test.ts`, `interview.test.ts`, `app.test.ts`, `context.test.ts`, `observer.test.ts`, `parts.test.ts`, `project-state-turn.test.ts`, `ProjectList.test.tsx` | D112, Requirements 3, 20, 21 |
| I102 | File-route generation, directory-based nesting, the three-shell route architecture, and phase addressability remain the runtime routing source of truth; graph view stays code-split. | `router.test.tsx`, `file-route-*.test.ts`, `build-boundary.test.ts`, `GraphView.test.tsx` | D86 |
| I103 | Trusted fixture state comes only from TypeScript builders or direct DB setup; walkthrough seeds stay builder-owned, observer probes seed directly without a second fixture format, and seeded scenarios remain resumable/exportable through that one surviving fixture model. | `corpus.test.ts`, `walkthrough.test.ts`, `seed.test.ts` | Requirements 13, 14, 15 |
| I104 | Interviewer-owned turn artifacts materialize through one persistence seam, so runtime review metadata, preface cards, activity summaries, phase summaries, and seeded brownfield replay all round-trip without route-specific reconstruction drift. | `turn-artifacts.test.ts`, `app.test.ts`, `walkthrough.test.ts` | D93, D96, D112 |
| I105 | Grounding/design structured-response turns can unlock the next frontier before observer capture finishes, while deferred capture stays keyed to the answered turn, reseeds from durable turns after reload, and avoids stale completion attachment. | `-interview-controller.test.tsx`, `app.test.ts` | D96, D113, D123 |
| I106 | Provider credential discovery, precedence, dashboard status, and model-provider resolution stay explicit without exposing raw secret values through `/api/config`, logs, persisted specification state, or client-visible payloads. | planned: `runtime-config.test.ts`, `app.test.ts`, `ProjectList.test.tsx` | Requirements 34, 35, 36; D130, D131, D132 |
| I107 | `.brunch/` gitignore hygiene is idempotent and confirmation-gated: existing ignore coverage is detected, missing entries are appended only after user confirmation, and absent `.gitignore` files are created only through that same accepted action. | planned: `project-gitignore.test.ts`, `app.test.ts`, `ProjectList.test.tsx` | Requirement 37; D133 |
| I108 | Observer capture no longer blocks chat stream completion for any eligible answered turn; capture backlog state is re-derived from durable turns, drains through the turn-owned observer-capture endpoint, and persists results back onto the originating turn. | planned: `app.test.ts`, `-interview-controller.test.tsx` | D22, D96, D123 |
| I109 | Observer prompts remain compact as relation extraction widens: existing knowledge is passed as id/kind/content-preview anchors with bounded length, graph-delta candidates resolve only through validated `knowledge_item.id` or same-turn provisional references, and accepted review grounding refs reuse the same relation policy. | `context.test.ts`, `observer.test.ts`, `db.test.ts`, `app.test.ts` | Requirement 30; D50, D125 |

## Lexicon

### Core terms

| Term | Definition |
| ---- | ---------- |
| **workspace** | The cwd-backed software context whose local `.brunch/` directory stores specifications and runtime state. |
| **AI runtime provider** | The shared server seam that resolves the configured LLM provider, model names, API-key source, and provider-specific options for interviewer and observer calls. |
| **provider credential status** | The app-visible setup state indicating whether a supported LLM key is available, which source supplied it, and what user action is needed, without exposing the secret value itself. |
| **XDG auth state** | User-scoped configuration / credential storage outside the project workspace, used for API keys entered through Brunch UI when implemented. |
| **workspace hygiene affordance** | A confirm-gated local repository action that helps keep generated Brunch state such as `.brunch/` out of version control without silently mutating the workspace. |
| **specification** | One elicitation run within a workspace. Browser routes, HTTP paths, shared transport contracts, and durable DB/storage should all use canonical `specification` terms. |
| **project** *(legacy term)* | A deprecated older name for a specification record. Remove it rather than preserving it as a long-term compatibility seam. |
| **workspace stream** | The merged center-column read model composed from active-path turns, anchored workflow facts, projected control cards, phase markers, and activity cards. |
| **specification runtime** | The live lifecycle owner for one specification: it reconciles durable truth into the current landing, owns in-flight interviewer / successor / capture orchestration, and rejects stale lifecycle outputs that routes must not treat as their own authority. |
| **turn** | One persisted authored conversational interaction on the active path, with typed offer/reply parts and parent linkage. Questions, review proposals, and closure proposals use this seam. |
| **turn kind** *(current internal seam)* | The current persisted implementation field on a turn (`question`, `kickoff`, `recovery`). It may help project control state today, but kickoff / recovery are product-level structural affordances rather than durable authored turn categories. |
| **turn card** | The user-facing rendering of a durable conversational turn inside the workspace stream. |
| **anchored workflow fact** | A durable non-turn record whose validity is anchored to one or more turns on the active path. `phaseOutcome` is the canonical current example. |
| **projected control card** | A workflow affordance derived from durable state rather than authored conversational content. Kickoff, recovery, and proceed / handoff controls live here. |
| **kickoff card** | A projected phase-entry control card that appears whenever an open phase is in entry-pending state and requires an explicit user action before substantive interviewer progression begins. |
| **frontier turn** | The single actionable durable conversational turn currently at the bottom of an open phase when the phase is in substantive elicitation rather than structural control. |
| **preface card** | A turn-internal artifact that presents provisional context from interviewer-invoked context gathering, rendered above a paired question card within the same turn. The observer captures from the whole turn (preface context + question + user response) as one validated unit rather than from the preface card alone. Available in any phase when the workspace directory is present. Implementation: `preface` / `PrefaceCard` / `present_preface` tool / `data-preface` part. Renders as a simple `bg-tint` rounded box with italic subdued text, not as a DrawerCard. |
| **question card** | A turn card that asks a structured interviewer question and expects a substantive user response. |
| **review turn** | A full-set requirements or criteria review interaction that offers a synthesized candidate list with stable reference codes, supports per-item commenting (inline comment toggle on each item) plus one optional global review note, and persists its own `reviewActions` / `reviewSet` metadata on the turn. On `request changes`, the successor review turn carries a revision card above the new review set. |
| **closure turn** | A durable proposal turn whose offer proposes closing a phase and whose reply explicitly accepts or rejects that proposal. Accepting it confirms the phase outcome on that same turn and advances the workflow into the next phase's projected entry state. |
| **recovery card** | A projected control card that appears whenever an open phase lacks a valid actionable frontier and offers the user a repair path without requiring a separately generated recovery turn. |
| **active turn** | The live frontier turn currently awaiting substantive user completion inside the workspace. Structural control cards such as kickoff and recovery are not active turns. |
| **answered-turn card** | The compact replay form of a completed elicitation turn, summarizing the offer, the structured response, and the turn-owned capture status. |
| **response note** | The single attached text field on a structured user response; it may explain selections, annotate a review, add missing context, or redirect the interviewer. |
| **grounding** | The first phase of a specification, aimed at establishing enough orientation to proceed into design. It is both the product term and the canonical workflow key. |
| **grounding strategy** | The method used to reach grounding sufficiency: elicitation-first (`greenfield`) or analysis-first (`brownfield`). |
| **delivery posture** | The second interview-orientation axis: `end-to-end build` for whole-system creation or reshaping, versus `incremental feature` for bounded change inside an existing or emerging system. |
| **grounding brief** | The concise visible summary surfaced on a preface card after context gathering during grounding. |
| **grounding sufficiency** | The threshold at which the interviewer has enough stable orientation to begin design. |
| **candidate spec** | An agent-synthesized possible specification direction offered when the user asks Brunch to fill in the rest or compare options. It includes rationale, implications, and tradeoffs and is meant for reaction and refinement rather than silent acceptance. |
| **candidate-spec set** | A turn-owned interviewer artifact in grounding or design that presents one or more candidate specs for reaction-driven refinement. It is analogous to a review set in being a persisted artifact on the turn, but it proposes possible directions rather than reviewing a synthesized inventory. |
| **candidate-spec reaction** | The structured user response to a candidate-spec set, choosing whether to accept a direction, request refinement of one candidate, or regenerate a fresh set. It steers the next interview move without directly closing the phase. |
| **breadth skeleton** | A turn-owned interviewer artifact used during a progressive detail pass that summarizes the current broad-pass map, highlights areas that remain shallow, and offers explicit deepening targets. |
| **detail focus** | The selected area or lens for the next recursive follow-up pass. It scopes the next same-phase frontier turn without becoming a separate workflow state or durable topic tree. |
| **detail reaction** | The structured user response to a breadth skeleton, choosing whether to deepen a specific area now, continue broad coverage, or leave an area sufficient for now. |
| **progressive detail pass** | An interview shape that establishes broad structure first, then offers explicit `next level of detail` actions to deepen selected areas recursively rather than drilling to maximum depth immediately. |
| **review set** | A synthesized candidate list used in requirements or criteria review, presented with stable reference codes, supporting per-item commenting, and resolved through `accept review` or `request changes` with per-item comments plus one optional global review note. |
| **review revision** | A successor review set generated after `request changes`, carrying a revision card (changelog + version badge) as a turn-internal artifact above the new review set card. Prior revisions collapse to compact answered-turn summaries. |
| **revision card** | A turn-internal artifact on a review revision turn that summarizes what changed from the prior version and displays a version badge (v2, v3, etc.), paralleling how preface cards sit above question cards. |
| **per-item comment** | An inline comment placed on a specific item in a review set via a comment toggle, forming part of the structured change-request payload alongside the optional global review note. |
| **accepted review set** | The terminal accepted review output for a review phase; this is the authoritative carry-forward set for later review and export seams, and any accepted requirement / criterion items derive their authority from membership in this set. |
| **phase entry state** | The workspace state shown when a projected kickoff card is the current bottom-of-phase affordance. |
| **landing reconciliation** | The pure derivation from durable specification snapshot into the one truthful visible bottom artifact for hydration/restart, plus any pending capture backlog the runtime must re-seed. |
| **observer capture backlog** | The ephemeral specification-scoped queue of answered turns that still need deferred observer capture. It is re-derived from durable turns with a persisted response but no turn-owned observer result, then drained by the runtime lifecycle once a successor frontier exists. |
| **phase handoff state** | The workspace state shown when a phase is complete and a projected handoff / completion control card is the current bottom-of-phase affordance. |
| **control marker** | A transcript-visible workspace event such as interview start, resume, or confirmation that is not rendered as a normal user chat bubble. |
| **phase marker** | A projected boundary annotation in the workspace stream, such as phase start or phase closed, derived from workflow position or anchored workflow facts. |
| **turn capture status** | The per-turn state describing what the observer has captured already, is still capturing, or failed to capture from that answered turn. |
| **active path** | The trusted chain from HEAD to root in the primary conversation. |
| **phase / mode** | One workflow stage: `grounding` *(label: Grounding)*, `design` *(label: Elicitation)*, `requirements` *(label: Requirements)*, or `criteria` *(label: Acceptance Criteria)*. |
| **phase outcome** | Durable closure artifact for a phase, including summary and closure basis. |
| **closure basis** | Whether a confirmed phase close came from interviewer recommendation or explicit user-forced closure. |
| **closeability** | Deterministic minimum bar for whether the user may close a phase now. |
| **readiness band** | Coarse descriptive signal (`low`, `medium`, `high`) separate from closeability. |
| **review action** | The explicit submit path on a review turn: `accept review` or `request changes`; the action gives any attached review note its meaning. |
| **exploration knowledge** | Durable knowledge captured during grounding or elicitation: `goal`, `term`, `context`, `constraint`, `decision`, and `assumption`. |
| **context** | Descriptive situational truth, actors, workflows, repo facts, or bounded area under discussion that would remain true even if the specification paused tomorrow. |
| **constraint** | A durable boundary on acceptable scope or solution space. |
| **non-goal** | A `constraint` subtype expressing an explicit exclusion from the current specification scope. |
| **decision** | A durable explicit commitment the user or specification has made about the approach. |
| **assumption** | A durable material belief supporting a direction or decision that could later prove false. |
| **knowledge item** | Typed semantic record in the durable ontology. Before review acceptance this means exploration knowledge; durable `requirement` / `criterion` items arise only from accepted review outputs. |
| **knowledge graph** | Typed relationships among knowledge items, including `depends_on`, `derived_from`, `constrains`, `verifies`, and `refines`. |
| **structured list** | The first-ship graph-view layout: kind-grouped item rows with a relations footer of Outgoing / Incoming relation chips. Item-first; relationships visible inline; render scope defaults to active-path items over `whole-spec` data. |
| **spatial canvas** | A deferred future graph-view layout where knowledge items render as nodes with visible edges in a 2D scene. Shares the projection seam and intent contract of D128 with the structured-list layout. |
| **relation chip** | A compact UI element representing one knowledge-graph edge endpoint inside a relations footer, carrying the target item's reference code and content snippet. Hover reveals a preview card; click navigates to the target item via hash anchor. |
| **relations footer** | The grouped Outgoing / Incoming subsections beneath an item row in the structured list, listing relation chips for that item's incoming and outgoing edges. Soft-truncates at 6 chips per direction with an inline `+N more` expander; collapses to nothing when an item has zero edges. |
| **action rail** | The per-row right-aligned slot in graph view's structured list reserved for node-level action affordances. Actions emit intents into the existing workspace lifecycle rather than owning their own state. The first ship reserves the slot with one disabled `chat-with` placeholder. |
| **secondary thread** | Modal revisit conversation anchored to a primary-path turn and used to resolve cascade implications. |
| **needs-revisit** | Flag meaning an item is affected by upstream invalidation and must be explicitly resolved before the specification is whole again. |
| **DrawerCard** | Shared card primitive with header/summary/children slots that supports static, summary-peeking, and toggleable (minimized ↔ maximized) render modes. A `locked` prop disables toggle for controlled-state cards. |
| **ChatScroll** | Composite scroll container that wires Radix ScrollArea (custom scrollbar) with `useStickToBottom` (auto-scroll-to-bottom + scroll-down indicator). Used for the center pane transcript. |
| **phase stepper** | The vertical timeline navigation in the left sidebar showing phases as sequential steps with connecting line, status, readiness, and turn count. |
| **phase addressability** | The ability to deep-link, gate, and focus interview phases through router state even when the center pane renders one continuous sectioned workspace. |
| **knowledge group** | A display-level grouping of knowledge kinds for the sidebar, defined by a hard-coded registry that maps kinds to group labels and visibility. |
| **output view** | The terminal route available when all phases are closed, providing specification summary and markdown export. Not a workflow phase. |
| **activity card** | A projected runtime or replay artifact adjacent to a turn or phase boundary, such as visible generation state, coarse interviewer activity summary, or trailing observer status. It is not a branch-bearing conversational turn. |
| **activity placeholder** | The compact replayable presentation of an activity card between turn cards, showing elapsed thinking time and a coarse tool-use summary for the interviewer without exposing hidden reasoning or raw tool payloads. |
| **phase section header** | A projected, non-durable artifact at the top of each phase section that states the phase purpose and what kinds of knowledge are captured there. Re-projects from workflow state on hydration. |
| **grounding question** | A free-text-first question format used during grounding that presents the question, a why explanation, and a response note field without requiring option selections. Distinct from the option-selection format used in elicitation. |
| **turn-internal artifact** | An assistant-part artifact rendered as its own visual card within a turn but sharing the turn's single response submission. Preface cards and revision cards are turn-internal artifacts that render above their paired question or review set card. |
| **query domain** | An independently invalidable TanStack Query scope within a specification. The current live ownership target is one specification bundle domain (`workflow`, `landing`, `turns`) plus a separate entities domain; finer splits should follow real server ownership boundaries rather than outrunning them. |

### Boundary terms

| Term | Definition |
| ---- | ---------- |
| **greenfield** | A grounding strategy for a new concept or under-specified area where the system grounds primarily through elicitation. |
| **brownfield** | A grounding strategy for work inside an existing codebase where the system grounds through analysis, then interrogation. |
| **end-to-end build** | A delivery posture where the specification is shaping a whole system, workflow, or major slice from entry to outcome. |
| **incremental feature** | A delivery posture where the specification is shaping a bounded change inside an existing or partially established system. |
| **context-gathering capability** | An interviewer-invoked capability such as workspace analysis or future web research that gathers provisional orientation for the next move. |
| **BrunchUIMessage** | Typed UI message contract spanning validation, persistence, SSE streaming, and hydration. |
| **Data Part** | Typed custom message part used for structured input and domain-specific assistant output. |
| **context builder** | Typed projection from specification state into inference context for interviewer, observer, or closure logic. |
| **walkthrough scenario** | Named trusted fixture scenario used to seed a resumable manual-inspection workspace. |

## Verification Design

### Verification Commands

| Step | Check | Command |
| ---- | ----- | ------- |
| 1 | Formatting | `npm run fmt:check` |
| 2 | Lint + type check | `npm run lint` |
| 3 | Unit tests | `npm run test` |
| 4 | Build | `npm run build` |
| all | Full gate | `npm run verify` |

### Verification Policy

Every meaningful code change should pass `npm run fix` in the inner loop and `npm run verify` before commit. Slices that touch the user-facing boundary should also stay manually walkthrough-able via the local app.

### Verification Stance

- Verification is first-class work; this wave stays **manual-heavy by deliberate choice**, not by accident.
- **Inner loop** proves structural validity, boundary safety, and non-destructive behavior.
- **Middle loop** proves replay, refresh-boundary ownership, and explicit state projection where cheap automated checks can remove bad degrees of freedom.
- **Outer loop** is the authority for brownfield grounding quality, transcript legibility, waiting-state clarity, and phase-layout differentiation.
- Outer-loop UI review uses a **dramaturgical see-and-inspect** posture: judge whether the product stages its state transitions legibly for a human, not just whether bytes round-trip.

### Diagnostic Assessment

| Dimension | Score | Notes | Change trigger |
| --------- | ----- | ----- | -------------- |
| Observability | partial | Persistence, DB state, TypeScript seed builders, and route seams are visible in text, but the most important failures in this wave still present as browser-visible transcript disappearance, waiting-state ambiguity, and layout legibility issues. | Promote instrumentation if manual browser inspection cannot explain refresh or lock behavior confidently. |
| Reproducibility | partial | TypeScript scenario builders and direct observer probes give a strong base, but brownfield kickoff quality still varies by repo shape and live refresh behavior is not yet represented by a canonical replay matrix. | Promote a stronger corpus or replay harness if ad hoc brownfield/manual checks stop being trustworthy. |
| Controllability | partial | The agent can iterate on fixtures, stories, and structural tests autonomously, but the core acceptance signals for this wave remain human judgment calls. | Raise controllability only if manual review becomes the bottleneck or repeated ambiguity blocks progress. |

### Oracle Strategy by Loop Tier

| Tier | Oracle families | What they prove | Main targets |
| ---- | --------------- | --------------- | ------------ |
| Inner | Schema validation, type-aware linting, focused unit/integration tests, negative-space regressions | Boundaries remain type-safe; persistence and transport seams do not silently collapse; obvious bad failures are caught cheaply. | I4, I17, I24, I44, I48, I54, I72, I87, I100, I101, I102, I103 |
| Middle | Round-trip / replay oracles for seeded projects, hydration, export, and resume | Seeded or persisted state can be loaded, projected, re-rendered, and exported without losing required semantic markers. | Requirements 13, 14, 15; I24, I44, I100, I103 |
| Middle | Route/query ownership integration oracles | Observer updates and response mutations refresh only their owned surfaces instead of tearing down unrelated transcript state. | Requirements 5, 7, 14; A20, A64; I24, I54, I102 |
| Middle | Explicit state-model oracles for in-flight UI states | Every major in-flight mode is named, projectable, and visibly representable instead of collapsing into one opaque loading bit. | Requirement 5; I24, I44 |
| Outer | Fixture-backed manual walkthroughs on seeded scenarios | Walkthrough fixtures are useful enough to inspect phase transitions, export output, resume behavior, and missing-view discovery. | Requirements 13, 14, 15; I100, I103 |
| Outer | Brownfield kickoff walkthroughs on real repos, evaluated qualitatively | Kickoff yields durable useful knowledge and a grounded first question for feature-area work, without needing a fully automated quality score. | Requirements 3, 16; A63; I101 |
| Outer | Dramaturgical story and transcript review | Phase differentiation, transcript artifact legibility, and waiting-state clarity are judged as staged user experience rather than just structural output. | Requirement 5; A15, A51, A53, A54 |

### Design Notes

- **Legible replay fidelity beats exact replay fidelity for now** — hydrated transcripts may use placeholders or summary markers to indicate that reasoning or tool activity happened at a point in the conversation, even if the full original content is not persisted.
- **Turn-first replay now beats message-first replay** — for grounding/design, the replay unit should trend toward completed turns plus one live unresolved turn, not alternating assistant/user chat bubbles and stream markers.
- **Brownfield kickoff has a deliberately modest proof bar** — this wave only needs durable useful knowledge plus a grounded first question, not a fully proven grounding bundle before design can proceed.
- **Waiting states should become an explicit vocabulary in code** — the user-facing contract is that each major in-flight mode is visibly represented; deep lock/wait introspection is diagnostic scaffolding, not yet a product requirement.
- **Manual verification is intentionally lightweight** — no heavyweight scripted walkthrough protocol yet; use seeded scenarios and see-and-inspect review rather than bureaucratic checklists.
- **Kickoff strategy comparison stays qualitative unless proven insufficient** — if the brownfield mode fork remains ambiguous after manual repo comparisons, promote that question to a spike with a stronger comparison harness.
- **Graph-view fixture matrix is project-shareable infrastructure** — named scenario builders (`emptySpec`, `singleItemNoEdges`, `crossPhaseDecisionLink`, `denseGoalAnchor`, `activePathDivergence`, plus an explicit `compareLowVsHighEdgeDensity` for A70) underwrite both inner-loop component tests and outer-loop manual walkthroughs. Reusable beyond graph view as similar visualization slices land.

### Acknowledged Blind Spots

| Blind spot | Reason | Current mitigation | Revisit trigger |
| ---------- | ------ | ------------------ | --------------- |
| Qualitative interviewer and kickoff quality across many repo shapes | Chosen manual-first; no broad brownfield corpus or score harness yet | Manual brownfield walkthroughs on representative repos | Brownfield regressions recur or kickoff strategy debates cannot be resolved qualitatively |
| Transcript trust and readability after hydration | Exact replay of all reasoning/tool detail is intentionally deferred | Legible placeholders/summary markers plus manual transcript review | Users still cannot understand what happened after replay despite visible markers |
| Actual lock/wait causality in the UI | Instrumentation is not yet the primary investment | Require explicit visible in-flight states and inspect browser behavior manually | Manual inspection cannot explain a repeated perceived lock or disappearance bug |
| Story quality and phase differentiation | Design quality is not executable in a trustworthy way yet | Story variants reviewed against seeded walkthrough findings | Story/app drift grows or design disagreement blocks implementation |
| Observer latency and layout refresh freshness | No explicit latency budget or perf gate yet | Runtime observation during manual sessions | A20 shows recurring latency or coarse refresh pain |
| Revisit UX and secondary-thread adequacy | That seam is still future work | Keep structural coverage on graph/persistence seams only | Revisit work moves from horizon into the active frontier |
| Real browser scroll behavior under JSDOM | `scrollIntoView` is shimmed in JSDOM — component tests cannot prove real scroll happens after chip click | Outer-loop manual walkthrough explicitly checks scroll-into-view + highlight on chip click | Reports of chip click "doing nothing" or scroll behaving inconsistently across browsers |
| Hover-card timing and popover positioning feel | Animation delay and placement perception are not text-observable | Outer-loop manual review with shadcn defaults (~300ms open, ~150ms close) | Users report flicker, misplaced popovers, or unintended dismissal |
| Mobile / touch / keyboard-only ergonomics for relation chips | HoverCard pattern is mouse-biased; long-press fallback is designed but has no automated test surface | Manual walkthrough on touch device once per slice family | Touch users report missing or undiscoverable preview |
| Performance under large knowledge graphs | No render or memory budget yet; relation-first observer expansion (A66) will increase edge density | Defer until specs with hundreds of items + dense edges become common | Render lag visible on representative manual walkthroughs |
| Cross-session "Back to chat" target persistence | sessionStorage clears on tab close so the deep-linked entry to graph view has no remembered chat origin | Falls back to current reachable phase via workflow state | Users report "Back to chat" landing in the wrong phase after a fresh tab |
| Visual regression infrastructure | Manual-heavy stance accepted across the project; no Chromatic/Playwright-screenshot seam yet | Outer-loop manual walkthrough on the named graph-view fixture scenarios | Three or more visual regressions caught only after merge |

### Current Coverage

| File | Protects |
| ---- | -------- |
| `db.test.ts` | I48, I72, I101 |
| `core.test.ts` | I48 |
| `app.test.ts` | I24, I54, I72, I87, I101, I104 |
| `context.test.ts` | I44, I54 |
| `observer.test.ts` | I48, I54 |
| `parts.test.ts` | I17, I101 |
| `project-state-turn.test.ts` | I24, I44, I87, I101 |
| `task.test.tsx` | I24 |
| `EntitySidebar.test.tsx` | I48 |
| `InterviewView.test.tsx` | I24, I44, I48, I54, I72 |
| `-interview-controller.test.tsx` | I24, I105 |
| `-workspace-stream-projector.test.ts` | I24 |
| `transcript-parity.test.tsx` | I24 |
| `interview.test.ts` | I87, I101 |
| `turn-artifacts.test.ts` | I104 |
| `phase-close.test.ts` | I72 |
| `router.test.tsx` | I102 |
| `GraphView.test.tsx` | I48, I102 |
| `project.test.ts` / `launcher.test.ts` / `runtime-config.test.ts` | I4, I100 |
| `corpus.test.ts` / `walkthrough.test.ts` / `seed.test.ts` | I103 |

## Acceptance Criteria

1. `npx brunch` can start from a workspace directory with local-first persistence in `.brunch/`.
2. Greenfield and brownfield grounding both work, with brownfield able to start from workspace analysis and converge into the same grounding phase purpose.
3. Structured turns support rich responses without losing semantic fidelity.
4. The knowledge layer stays visible, typed, and linked through graph relationships.
5. Phase closeability, readiness, and closure provenance stay legible to the user.
6. Requirements and criteria review remain explicit, lightweight, durable at the turn level, and export-relevant.
7. Revisit can invalidate knowledge, surface cascade, and re-resolve through a secondary thread.
8. The routed UI stays stable across dashboard, phase views, sidebar knowledge, and graph view.
9. Resume works from persisted state.
10. The verification gate passes.
11. Grounding/design use workspace-owned turn cards for substantive elicitation, requirements/criteria use full-set review turns, and structural kickoff / recovery / handoff / completion affordances project without a bare generic composer.
12. Hydrated transcripts preserve interviewer-side structure plus stable durable activity summaries for any live-only artifacts that were shown during streaming, including elapsed thinking time and a coarse tool-use summary / placeholder seam.
13. Open phases bottom-load a projected kickoff card, the current frontier turn, a visible generation state, or a projected recovery card; completed elicitation turns replay as answered-turn records, and closed phases bottom-load a projected handoff or completion artifact.
14. Preface cards render as turn-internal artifacts paired with question cards, so the observer captures from the whole validated turn rather than from unvalidated provisional content alone.
15. Grounding and elicitation persist only the durable exploration ontology, with `non-goal` represented as a `constraint` subtype rather than a separate top-level kind.
16. Observer prompt, shared kind registry, schema / API types, fixtures, and UI copy describe the same ontology and accepted-review semantics without per-layer language drift.
17. The interview can orient itself anywhere in the `greenfield <> brownfield` by `end-to-end build <> incremental feature` matrix without forcing whole-project assumptions.
18. Observer capture records graph relationships broadly enough that most durable knowledge items link to upstream or downstream context whenever that relation is reasonably traceable.
19. Users who cannot complete a long interview can request candidate specs with explained tradeoffs and refine by reacting to them.
20. The interview can stop at a broad pass and deepen selected areas incrementally through explicit next-detail actions.
21. Graph view renders the knowledge graph as a navigable workspace with visible edges and node-launched refinement flows, not just a grouped list.
22. First-run setup makes missing provider credentials visible and recoverable from the dashboard without requiring users to hand-edit project `.env` files.
23. Brunch can help users keep `.brunch/` out of version control through an explicit, idempotent `.gitignore` confirmation flow.
