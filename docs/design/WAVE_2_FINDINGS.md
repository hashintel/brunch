# Wave 2 Findings

Purpose: capture concrete observations from the seeded manual walkthrough round so the next refinement slices can be scoped from evidence instead of memory.

Status: **in progress**. These findings are a first pass, not a full walkthrough completion.

## Context

Grounding docs:

- `docs/design/WAVE_2_PREP.md`
- `docs/praxis/manual-testing.md`
- `docs/design/DESIGN_SCRATCH.md`
- `docs/research/tanstack-loaders-vs-queries.md`

Current seeded DB default:

- `.brunch/brunch.db`

## Scenarios checked so far

- project index / dashboard root
- `issue-tracker-kickoff-ready`
- `issue-tracker-design-active`
- `issue-tracker-criteria-ready`
- `issue-tracker-all-phases-closed`
- new project flow: greenfield
- new project flow: brownfield
- `issue-tracker-scope-closed`

## Raw findings

| Scenario | Surface | Observation | Type | Likely seam | Candidate action |
| --- | --- | --- | --- | --- | --- |
| project index | main layout | Main element appears to use `overflow: hidden`, so the project list cannot scroll far enough to reach lower items. | structurally wrong | app bug / layout | investigate manually |
| project index | dashboard | Project items do not behave like real links; cannot command-click to open in a new tab. Likely direct router state manipulation instead of link semantics. | structurally wrong | app bug / navigation | investigate manually |
| `issue-tracker-kickoff-ready` | kickoff shell | Entering the framing phase shows an empty middle view with only a chat field and no kickoff affordance. | missing | stories / pattern | prototype in Ladle |
| new project flow | kickoff shell | New project creation happens through modals on the root route instead of within the routed workspace. | structurally wrong | kickoff flow / routing | investigate manually |
| new project flow (greenfield) | kickoff shell | After naming the project and choosing greenfield, the user lands in an empty phase view with only a chat field and no visible next action. | missing | stories / pattern | prototype in Ladle |
| new project flow (brownfield) | kickoff shell | After naming the project and choosing brownfield, the user lands in the same kind of empty phase view with no visible kickoff affordance. | missing | brownfield kickoff | defer to brownfield follow-up |
| `issue-tracker-design-active` | transcript artifact | Prior questions are not visible; only user responses are shown. | missing | transcript fidelity | defer to transcript slice |
| `issue-tracker-design-active` | transcript artifact | Prior thinking/tool-use/assistant-side artifacts are not visible. | missing | transcript fidelity | defer to transcript slice |
| `issue-tracker-design-active` | main chat | The current question is visible only as an already-answered state and appears unmodifiable, with no clear next action. | confusing | stories / pattern | prototype in Ladle |
| `issue-tracker-design-active` | phase transition | Clicking Force Design Closure advances to Requirements Review, but that next phase again appears as an empty interface. | missing | stories / pattern | prototype in Ladle |
| `issue-tracker-criteria-ready` | review area | The interface suggests criteria work is effectively complete, but no visible next action is offered. | missing | stories / pattern | prototype in Ladle |
| `issue-tracker-criteria-ready` | transcript artifact | Only the last question/turn state is visible; prior context is absent. | missing | transcript fidelity | defer to transcript slice |
| `issue-tracker-criteria-ready` | export/completion | No visible CTA or affordance explains how to proceed toward export/finalization. | missing | stories / pattern | prototype in Ladle |
| `issue-tracker-all-phases-closed` | left sidebar | Phase navigation shows all phases complete and does successfully filter visible conversation content by phase. | good / keep | stories / pattern | keep and refine |
| `issue-tracker-all-phases-closed` | transcript artifact | Phase filtering works, but only the user side of the conversation is visible; assistant questions/artifacts remain absent. | missing | transcript fidelity | defer to transcript slice |
| `issue-tracker-all-phases-closed` | right sidebar | The top tab strip for knowledge kinds overflows, is awkward, and makes some content unreachable. | structurally wrong | stories / pattern | prototype alternatives in Ladle |
| `issue-tracker-all-phases-closed` | export/completion | Even at the end of the workflow there is no visible affordance for what to do next or how to close/complete the process. | missing | stories / pattern | prototype completion / next-action pattern |
| `issue-tracker-scope-closed` | left sidebar | Current and future phase indicators are difficult to interpret; readiness/status semantics are unclear. | confusing | stories / primitive | prototype in Ladle |
| `issue-tracker-scope-closed` | left sidebar | Unopened later phases are still navigable, which likely should not be allowed before they begin. | structurally wrong | app bug / workflow gating | investigate manually |
| `issue-tracker-scope-closed` | left sidebar | Unstarted phases display `Low`, which is misleading; they likely need no badge or an explicit `Unstarted` state. | structurally wrong | stories / primitive | prototype state-label logic |
| `issue-tracker-scope-closed` | phase transition | Once scope is closed there is almost no affordance saying the phase is complete and the user should move to the next one. | missing | stories / pattern | prototype handoff / next-phase CTA |

## Strong themes

### 1. Missing next-action staging is the dominant visible problem

This now appears in multiple places:

- kickoff-ready workspace
- new project flow (greenfield)
- new project flow (brownfield)
- design-active after force-close
- criteria-ready
- all-phases-closed
- scope-closed handoff

The recurring failure mode is:

- the user lands in a phase or completion state
- the phase appears inert or empty
- there is no clear next action, handoff, or completion affordance

This strongly suggests a story-first pattern family around:

- phase entry / empty state
- phase closed / handoff state
- review-ready state
- workflow complete / export-ready state

### 2. Transcript fidelity is clearly broken as a separate concern

Observed repeatedly:

- prior assistant questions are not visible
- prior assistant artifacts are not visible
- only the user side of the conversation is visible
- phase filtering appears to work, but against an incomplete transcript projection

This confirms that transcript fidelity should remain its own follow-on slice rather than being absorbed into router/query work.

### 3. Sidebar semantics and layout need redesign, not just polish

#### Left sidebar

Problems observed:

- readiness and phase-state vocabulary are unclear
- unstarted phases should not read as `Low`
- future phases may be navigable too early
- closure / next-phase signaling is too weak

#### Right sidebar

Problems observed:

- top tab strip overflows
- some content becomes unreachable
- isolated-by-kind browsing is awkward and not very informative

This places both sidebar seams firmly in the story/pattern design lane.

### 4. Kickoff flow is under-shaped beyond the brownfield transport question

The present problem is not only whether brownfield grounding uses the right transport. It is also that:

- kickoff begins in root-route modals
- the routed workspace starts empty
- both greenfield and brownfield land in under-instructive shells

That means kickoff follow-up likely needs to separate:

1. kickoff flow / routing / affordance design
2. brownfield grounding transport decisions

### 5. The current interaction model still assumes a generic chat app, but the domain model no longer does

A central issue surfaced during the walkthrough review:

- the current bottom chat composer implies a freeform message-based chat model
- the actual elicitation workflow now expects the user to answer **inside the active question UI**
- the canonical user response is better understood as:
  - zero or more selected options, or an explicit `none of the above` option
  - one attached response note for the choice

That means the main product model is not really "chat with a composer" anymore. It is closer to:

- a structured interview workspace with transcript history
- an active turn card that owns the response UI
- phase entry / handoff / review states that may have no active question at all

This likely explains several observed failures:

- empty phase shells that still show a generic chat box
- kickoff states with no meaningful affordance
- answered-question states that feel inert and confusing
- review phases that inherit the wrong interaction shape

### 6. Requirements and criteria review should not reuse the main interview UX

Another structural finding from the walkthrough:

- requirements/criteria review currently appears to continue the same structured interview question loop
- this produces repeated micro-questions over individual items
- even with a small seeded requirement set, this already feels too laborious

Working conclusion:

- the structured question-turn procedure belongs primarily to the main elicitation interview
- requirements review should instead synthesize a candidate requirement list from prior knowledge and let the user mostly approve/reject/adjust it
- criteria review should similarly synthesize candidate criteria from the reviewed requirement set and let the user mostly approve/reject/adjust it
- the system should recommend the best current set first; the user should confirm or deny with minimal ceremony

This implies a distinct review UX, not just different copy over the same question-card interaction.

### 7. There are also a few direct app/runtime bugs

These seem narrower than the design work but should be captured explicitly:

- project index cannot scroll to lower items
- project entries are not real links
- future unopened phases appear navigable too early

## Provisional slice mapping

### Story-first candidates

Strong candidates for Ladle-first exploration:

- kickoff entry state
- empty phase state
- phase closed / handoff state
- workflow complete / export-ready state
- improved left sidebar status language
- improved right sidebar knowledge browsing pattern
- active structured question card as the primary input surface
- current-question / already-answered state presentation
- next-action CTA blocks
- review list / approve-reject pattern distinct from the main interview card

### Transcript-fidelity candidates

Keep for the later transcript slice:

- render previous questions
- render assistant artifacts
- render thinking/tool-use markers if they are persisted/available
- distinguish current turn state from historical turn state
- project structured user responses as selections plus one response note, rather than treating the bottom composer as canonical input

### Kickoff / brownfield candidates

Keep as adjacent but separate concerns:

- root-route modal kickoff staging
- routed kickoff workspace affordances
- brownfield-specific kickoff feel after project creation
- only later, if still needed: typed grounding transport
- whether kickoff uses the same active-turn-card model as the main interview rather than a generic chat composer

### Direct app bug candidates

Likely smaller, sharper fixes:

- dashboard/project-index scroll behavior
- project cards as proper links
- phase navigation gating for unopened phases

### Router/query candidates

Still active, but not the strongest visible pain from this first walkthrough pass:

- data ownership boundaries between route loaders and query subscriptions
- replacing broad `router.invalidate()` for routine updates
- preventing unnecessary surface teardown

The walkthrough so far suggests this slice should stay narrow and not absorb transcript or kickoff-affordance work.

## Provisional priority order from visible user pain

1. Story-first phase entry / next-action patterns
2. Transcript fidelity
3. Kickoff flow / staging
4. Sidebar information architecture
5. Smaller navigation/layout bugs
6. Router/query ownership refinement
7. Dashboard/results enrichment

## Questions to answer in the next walkthrough pass

- Does `issue-tracker-requirements-ready` show the same empty-next-action problem as criteria-ready?
- Does the completed project surface expose any hidden export action not yet discovered?
- Are unopened phases intentionally navigable, or is that a regression in gating?
- Which right-sidebar alternative looks most promising: sectioned list, grouped chips, or filter-toggle + grouped content?
- Which phase-entry states need unique copy/layout, versus sharing one pattern with different labels?

## Current working conclusion

We now have enough evidence to say:

- the story-first lane should emphasize **phase entry, handoff, completion, and active-turn patterns**
- the canonical user response is better modeled as **option selection(s) plus one response note**
- the main bottom chat composer is likely the wrong primary interaction model for elicitation
- requirements and criteria review need a **different UX from the main interview**, centered on synthesized lists and lightweight approval/rejection rather than repeated micro-interviews
- transcript fidelity is severe and distinct enough to remain its own later slice
- kickoff problems are currently more about **flow staging and affordance** than about transport purity alone
- router/query remains important, but it is not the only or even the clearest source of the user-facing pain observed so far
