<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

## Active

This wave now treats Brunch as a **structured interview workspace**, not a generic chat interface. The first shell-honesty pass is in the app: dashboard links are real, future phases are gated, review phases are visibly distinct, and replay now groups prior answers into compact turn cards. The remaining frontier is no longer "make anything less chat-shaped" in the abstract. It is now three sharper seams: where the phase column should terminate, how a turn progresses through active/in-flight/completed states, and how the observer's actual capture work attaches back to the turn that produced it.

1. **Turn lifecycle state machine for interviewer and observer** — structural `[status: scoped]`
   - Objective: stage each elicitation turn as a turn-owned lifecycle (`active` → `submitted / interviewer-processing` → `collapsed / interviewer-complete`) with observer status attached to that turn instead of emitted as free-floating transcript rows.
   - Why now / unlocks: compact answered-turn replay improved transcript readability, but the live current-turn choreography is still under-modeled. The product now needs an explicit turn-state machine so submission, waiting, collapse, and next-turn reveal happen legibly and predictably.
   - Acceptance: active turns expose an explicit submit action; after submission, the same card locks and shows interviewer processing beneath it; interviewer completion is sufficient to collapse the answered card and reveal the next turn; observer status can continue in a bounded live region on the collapsed card without blocking the next turn; control/closure events no longer impersonate ordinary interview turns.
   - Verification: inner — controller/view tests for turn-state projection and event ordering. Middle — seeded route-level checks for answered-turn collapse plus next-turn reveal. Outer — manual dramaturgical walkthrough focused on turn causality and waiting clarity.
   - Verification approach: inner — targeted transcript/turn-state tests; middle — replay assertions on design-active fixtures; outer — browser review of turn submission, collapse timing, and trailing observer status; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirements 4, 5, 6, 17, 18; Assumptions A20, A53, A55; Decisions D24, D30, D57, D92, D93, D95; Invariants I24, I44, I54.

2. **Turn-linked capture projection and derived reference codes** — structural `[status: not-started]`
   - Objective: surface the actual knowledge items linked to each answered turn, projecting server-owned per-kind reference codes (`DEC-1`, `ASM-2`, `CON-1`, etc.) from durable project-wide creation order so the observer's work is legible in replay before any UID or persisted-sequence migration.
   - Why now / unlocks: the DB already links captured items to turns, but the client only shows a coarse "workspace knowledge updated" line. That blocks trust exactly where the new turn cards are supposed to help: users still cannot see what the observer actually captured from a given answer, and the reference-code affordance needs proving before we widen into public UID / slug work.
   - Acceptance: answered-turn cards list the actual linked captured items for that turn; each projected knowledge item carries a collision-free kind prefix plus per-spec kind-local ordinal derived from stable project-wide ordering rather than active-path filtering; closure/control turns do not show misleading capture summaries; the captured section can later host trailing observer updates without changing its semantic shape.
   - Verification: inner — DB/API/client projection tests for turn → captured-item mapping and per-kind ordinal stability across mixed kinds. Middle — replay assertions on seeded turns plus active-path/project-wide comparisons proving branch filtering does not renumber reference codes. Outer — browser walkthrough confirming captured sections and sidebar inventory show matching refs for the same items.
   - Verification approach: inner — focused persistence/projection tests around `turn_knowledge_item` plus derived-ref projection; middle — transcript replay checks against seeded scenarios and branch-shaped fixtures; outer — manual comparison of answered cards vs entity inventory; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirements 4, 6, 7; Assumptions A40, A53, A55; Decisions D49, D50, D57, D95; Invariants I48, I54.

## Next

1. **Story-first interaction pattern refinement** — now that terminal artifacts and turn lifecycle rules are clearer, refine the stable interaction family in `src/client/stories/` instead of discovering it inside routed code.
   - Why now / unlocks: once the open-phase bottom state, collapsed-turn shape, and handoff/completion rules stabilize, stories can consolidate them into reusable patterns without inventing around missing behavior.

2. **Review-set implementation across requirements + criteria** — replace repeated micro-interview review turns with synthesized per-item approve / reject / comment lists plus list-level confirmation.
   - Why now / unlocks: the product model for scope/design is becoming turn-based and the product model for review is becoming list-based; landing review sets after the turn-state work preserves that separation cleanly.

3. **Router/query ownership refinement for interview surfaces** — replace coarse route-wide invalidation with deliberate loader/query ownership.
   - Why now / unlocks: still important, but the current visible pain is more about transcript/turn staging than refresh boundaries. Keep this narrow once the transcript column has a stable semantic shape.

4. **Kickoff and workspace entry adoption** — move greenfield/brownfield kickoff and early scoping entry into the same workspace-owned interaction family as the rest of the interview.
   - Why now / unlocks: this should follow once open phases already know how to bottom out in a real unresolved turn or generation state instead of an explicit start prompt.

5. **Brownfield kickoff typed grounding transport** — conditional follow-on if the current transcript-visible grounding handoff remains too brittle after kickoff adoption.
   - Why now / unlocks: keep conditional until manual brownfield walkthroughs prove the current transport is insufficient.

## Horizon

- **Rich replay treatment for collapsed reasoning and observer progress** — once the turn lifecycle state machine is stable, make replay components visually match their live counterparts more closely.
- **Dashboard/result summaries and completeness metrics** — once workflow entry, review, and transcript trust are no longer masking basic usability.
- **Edit mode + cascade preview** — revisit affordance after the current interview-surface refinement wave settles.
- **Cascade execution + secondary thread lifecycle** — structural follow-on after preview-only revisit is stable.
- **Drizzle Kit audit remediation** — independent hardening lane.
- **Git-friendly file-based persistence representation for diffable specs**.
- **Headless interview driver for scripted end-to-end probes**.
- **MCP server adapter for core operations**.

## Recently Completed

- 2026-04-14 — **Phase terminal staging and auto-present current turn** — Done: open phases now auto-initiate the current turn instead of bottoming out in `Begin/Continue`, answered-turn replay filters control and closure artifacts, and closed phases end with their handoff/completion card at the bottom of the transcript column. Verified: `npm run verify`. Watch: manual browser confirmation is still needed on `issue-tracker-kickoff-ready`, `issue-tracker-design-active`, `issue-tracker-scope-closed`, and `issue-tracker-all-phases-closed`.
- 2026-04-14 — **Workspace shell first honesty pass** — Done: dashboard links became real, root/dashboard scrolling was fixed, future phases became visible-but-disabled, review phases gained distinct shell framing, and transcript replay shifted from user bubbles toward compact answered-turn cards plus control markers. Verified: `npm run verify`. Watch: bottom-of-column terminal staging, turn-state choreography, and actual captured-item projection remain unfinished.
- 2026-04-14 — **Fixture-backed walkthrough workspace** — Done: walkthrough-ready seed scenarios now front-load the public seed catalog, prove resume after re-open, and cover export-ready/manual-inspection states. Verified: `npm run verify`. Watch: story adoption and transcript-state inspection still need the next UI-facing lanes.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
turn-lifecycle-state-machine-for-interviewer-and-observer
  ├──→ turn-linked-capture-projection-and-compact-identifiers
  ├──→ story-first-interaction-pattern-refinement
  ├──→ review-set-implementation-across-requirements-and-criteria
  └──→ kickoff-and-workspace-entry-adoption

turn-linked-capture-projection-and-compact-identifiers
  └──→ rich-replay-treatment-for-collapsed-reasoning-and-observer-progress

router-query-ownership-refinement-for-interview-surfaces ──→ rich replay / trailing observer polish if runtime churn remains visible

kickoff-and-workspace-entry-adoption ──→ brownfield-kickoff-typed-grounding-transport (conditional)
```
