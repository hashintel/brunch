<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

## Active

1. **Story-first interaction pattern refinement** — now that terminal artifacts and turn lifecycle rules are clearer, refine the stable interaction family in `src/client/stories/` instead of discovering it inside routed code.
   - Why now / unlocks: once the open-phase bottom state, collapsed-turn shape, and handoff/completion rules stabilize, stories can consolidate them into reusable patterns without inventing around missing behavior.

2. **Review-set implementation across requirements + criteria** — replace repeated micro-interview review turns with synthesized per-item approve / reject / comment lists plus list-level confirmation.
   - Why now / unlocks: the product model for scope/design is becoming turn-based and the product model for review is becoming list-based; landing review sets after the turn-state work preserves that separation cleanly.

3. **Kickoff and workspace entry adoption** — move greenfield/brownfield kickoff and early scoping entry into the same workspace-owned interaction family as the rest of the interview.
   - Why now / unlocks: this should follow once open phases already know how to bottom out in a real unresolved turn or generation state instead of an explicit start prompt.

4. **Brownfield kickoff typed grounding transport** — conditional follow-on if the current transcript-visible grounding handoff remains too brittle after kickoff adoption.
   - Why now / unlocks: keeping it in the active queue lets brownfield grounding harden immediately after kickoff/workspace adoption if manual walkthroughs still show brittleness.

## Next

1. **Router/query ownership refinement for interview surfaces** — replace coarse route-wide invalidation with deliberate loader/query ownership.
   - Why now / unlocks: still important, but the current visible pain is more about transcript/turn staging than refresh boundaries. Keep this narrow once the transcript column has a stable semantic shape.

2. **Rich replay treatment for collapsed reasoning and observer progress** — once the turn lifecycle state machine is stable, make replay components visually match their live counterparts more closely.
   - Why now / unlocks: with turn-owned capture replay landed, this is the next fidelity pass on transcript trust once the active UI lanes settle.

3. **Dashboard/result summaries and completeness metrics** — once workflow entry, review, and transcript trust are no longer masking basic usability.
   - Why now / unlocks: promote this now so the post-interview surface can follow close behind the current interaction wave instead of getting stranded in the long tail.

## Horizon

- **Edit mode + cascade preview** — revisit affordance after the current interview-surface refinement wave settles.
- **Cascade execution + secondary thread lifecycle** — structural follow-on after preview-only revisit is stable.
- **Drizzle Kit audit remediation** — independent hardening lane.
- **Git-friendly file-based persistence representation for diffable specs**.
- **Headless interview driver for scripted end-to-end probes**.
- **MCP server adapter for core operations**.

## Recently Completed

- 2026-04-14 — **Turn-owned captured-item projection and trailing observer attachment** — Done: answered turns now list their actual captured knowledge with stable server-owned reference codes that match the sidebar, and late observer completion stays attached to the collapsed answered card until durable capture hydrates in place. Verified: `npm run verify`. Watch: story-first interaction refinement and browser-side dramaturgical review are still the next UX-facing follow-ons.
- 2026-04-14 — **Turn-owned submit/interviewer-processing choreography** — Done: active elicitation turns now stay mounted through submit, lock inline while the interviewer processes, and collapse only when the next step is ready to reveal; same-project refresh updates the submitted turn in place without rewriting earlier answered replay. Verified: `npm run verify`. Watch: manual browser review should still confirm the live pacing on seeded scenarios now that the capture seam is attached.
- 2026-04-14 — **Phase terminal staging and auto-present current turn** — Done: open phases now auto-initiate the current turn instead of bottoming out in `Begin/Continue`, answered-turn replay filters control and closure artifacts, and closed phases end with their handoff/completion card at the bottom of the transcript column. Verified: `npm run verify`. Watch: manual browser confirmation is still needed on `issue-tracker-kickoff-ready`, `issue-tracker-design-active`, `issue-tracker-scope-closed`, and `issue-tracker-all-phases-closed`.

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
