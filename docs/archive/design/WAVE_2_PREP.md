# Wave 2 Prep

Purpose: capture the live design/research/manual-testing ground truth for the next refinement wave before `ln-scope` cards are written.

Status: **post-walkthrough design grounding**. The frontier is clear enough to scope, but the key mental-model shift must stay explicit: Brunch is now treated as a **structured interview workspace**, not a generic chat interface.

## Read this with

- `memory/SPEC.md`
- `memory/PLAN.md`
- `docs/praxis/manual-testing.md`
- `docs/design/DESIGN_SCRATCH.md`
- `docs/research/tanstack-loaders-vs-queries.md`
- `docs/research/async-server-state-to-ui-sync-for-chat-observer-agents.md` as older background only

## Current frontier

The active frontier is now:

1. **Workspace semantic shell scaffolding**
2. **Story-first interaction pattern refinement**
3. **Router/query ownership refinement for interview surfaces**

The ordering logic is:

1. make the live app structurally honest in low fidelity
2. refine those truthful semantics into reusable patterns in stories
3. tighten route/query ownership without absorbing transcript or interaction redesign work

## Why the semantic-shell slice comes first now

### Workspace semantic shell lane

The first build step is not final design polish. It is a low-fidelity but truthful remapping of the live app so that:

- the right information appears in the right places
- the right affordances are present
- the user sees real entry / active / handoff / completion states
- the shell no longer implies a generic bottom-composer chat model
- rough placeholders can stand in for not-yet-refined transcript and metadata elements

### Story-first lane

Once that shell is truthful, stories can refine the interaction patterns without inventing around missing behavior.

### Router/query lane

The current grounding has changed. The most relevant current research is:

- `docs/research/tanstack-loaders-vs-queries.md`

That note reframes the seam as:

- **Router loaders coordinate route readiness**
- **TanStack Query owns freshness, subscription, and targeted invalidation**

So the slice should not be framed as generic "React Query integration". It should be framed as an ownership correction:

- reserve loaders for route-critical readiness
- move ongoing freshness to query-owned subscriptions
- avoid broad `router.invalidate()` as the routine response to mutations and streamed observer updates

## Shared prep workflow

### 1. Manual walkthrough round

Use `docs/praxis/manual-testing.md` and seed these scenarios first:

- `issue-tracker-kickoff-ready`
- `issue-tracker-design-active`
- `issue-tracker-criteria-ready`
- `issue-tracker-all-phases-closed`

Primary observation buckets:

| Bucket | What to look for |
| --- | --- |
| Brownfield grounding | Does kickoff feel grounded enough for feature-area elicitation, or still brittle? |
| Transcript legibility | Which assistant artifacts are visible, missing, collapsed, or confusing after reload? |
| Waiting states | Which in-flight states are actually visible? Where does the app feel locked, blank, or under-explained? |
| Phase differentiation | Which phases need stronger layout, navigation, or staging differences? |
| Review/export readiness | Do criteria-ready and all-phases-closed states feel materially different and legible? |
| Dashboard/stats | What summary/result views are missing from the current seeded flows? |

Suggested capture table:

| Scenario | Surface | Observation | Likely seam | Candidate follow-up |
| --- | --- | --- | --- | --- |
| `issue-tracker-design-active` | main chat | question generation has no visible waiting state | transcript/in-flight patterns | story pattern + later app adoption |

### 2. Design and research intake

After the walkthrough pass, consolidate input from:

- `docs/design/DESIGN_SCRATCH.md`
- the seeded walkthrough notes
- the older screenshots in `docs/design/assets/`
- `docs/research/tanstack-loaders-vs-queries.md`

Goal: produce stable enough hypotheses to scope the two slices cleanly.

## Story-first lane

### Rule of engagement

Discover patterns in Ladle first. Do **not** start by changing the routed app. Port patterns back only after they are coherent enough to adopt.

### Current story layout

```text
src/client/stories
├── kickoff.stories.ts
├── kickoff.story.tsx
├── question-options.stories.ts
└── question-options.story.tsx
```

### Target story layout

```text
src/client/stories/
├── patterns/
│   └── {pattern}.story.tsx
├── patterns.stories.ts
├── primitives/
│   └── {primitive}.story.tsx
└── primitives.stories.ts
```

### Working interpretation of that split

#### `primitives/`

Small reusable UI units and state affordances, likely including:

- phase nav item / phase status cluster
- readiness and closeability indicators
- transcript artifact rows
- waiting-state indicators
- compact question-option controls
- knowledge item rows / chips / filters
- review list items

#### `patterns/`

Composed arrangements and view-level explorations, likely including:

- kickoff shell
- interview shell with left/right sidebars
- active structured-question state
- in-flight question-generation state
- transcript artifact state variants
- requirements/criteria review-list layouts
- export-ready / project-overview layout

### Design goals currently in play

From `docs/design/DESIGN_SCRATCH.md` and current discussion:

- left sidebar should likely own phase navigation and status
- right sidebar should likely own knowledge inventory presentation
- main chat needs explicit waiting-state vocabulary
- the active turn card, not a generic bottom composer, likely owns primary elicitation input
- the canonical user response is likely: selected option(s) plus one response note
- the question-card pattern needs compaction and better handling of "why"
- requirements and criteria review likely need a distinct review-list UX rather than repeated structured interview turns
- the framing/scope model must better support partial-codebase / partial-timeline specs
- dashboard/stats/result views remain a must-have gap

### Relevant legacy visual references

Keep these as references, not contracts:

- `docs/design/assets/kickoff-screen.png`
- `docs/design/assets/first-question.png`
- `docs/design/assets/main-interview.png`
- `docs/design/assets/reqs-minimal.png`
- `docs/design/assets/spec-overview.png`

Known caveat: those older designs assume an outdated question model in some places, especially around exclusive options and lack of free-text.

## Router/query lane

### Current structural evidence in code

These are the key current coarse invalidation points to revisit:

- `src/client/mutations/interview-mutations.ts`
- `src/client/routes/project/$id/_view/-interview-controller.ts`

The current broad pattern is `router.invalidate()` after mutations or stream events, which is likely too coarse for the interview surface.

### Ownership hypothesis to test

Use the newer research note as the baseline mental model:

- loader-owned: route entry and route-critical readiness
- query-owned: ongoing freshness, cache updates, and component subscriptions
- mutation-owned: targeted query invalidation or cache updates
- transcript rendering: separate concern; do not widen this slice into transcript UI redesign

### Scope boundary this slice should probably preserve

The router/query slice should aim to fix ownership boundaries without also trying to solve:

- waiting-state UI
- transcript artifact rendering completeness
- active-turn vs bottom-composer interaction design
- story/pattern exploration
- review-list UX design
- brownfield kickoff prompt redesign

Those are neighboring concerns, not proof that this slice should absorb them.

## Follow-on sequencing

If the next two slices land cleanly, the follow-on should still be:

- **Transcript fidelity and in-flight status surfaces**

Reason:

- story work should clarify what states and artifacts ought to be legible
- router/query work should clarify what data can remain stable through refresh
- transcript fidelity sits at the intersection and should avoid rework from premature implementation

## Conditional follow-on

Keep this conditional until manual evidence says otherwise:

- **Brownfield kickoff typed grounding transport**

Current stance:

- the shipped `Grounding:` handoff is good enough for now
- only promote typed grounding transport if manual brownfield walkthroughs still show brittle kickoff grounding

## Parallelism stance

No new worktree-agent allocation brief should be treated as current until prep is complete.

After prep, the likely low-conflict split is still:

1. **Story-first patterns** — primarily `src/client/stories/**`
2. **Router/query ownership** — primarily routed data-loading / invalidation seams

But that is provisional until the walkthrough and design synthesis are done.

## Decision gates before `ln-scope`

Do not scope the next two slices until we can answer:

1. Which waiting states are real enough to design for, rather than imagined from memory?
2. Which phase/layout distinctions are strongest enough to justify story exploration?
3. Is the active turn card, not the bottom composer, the right primary input model for elicitation?
4. Do requirements and criteria need a distinct review-list UX rather than repeated structured interview turns?
5. Which surfaces are route-critical enough to stay loader-owned?
6. Which updates should move to query-owned invalidation/subscription instead of route invalidation?
7. Does brownfield kickoff still feel brittle in real walkthroughs?
8. Is the new story folder structure sufficient for the next wave, or does it need one more organizing layer?

## Immediate next action

Use `memory/PLAN.md`, this prep note, and `docs/design/WAVE_2_FINDINGS.md` as the grounding set for scoping **Workspace semantic shell scaffolding**.