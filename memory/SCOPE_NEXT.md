# Scope: Turn-Based Transcript Staging

**Slice**: follow-on to `memory/SCOPE.md` / Active #1
**Weight**: Full scope card
**Status**: scoped

## Orientation

- **Containing seam**: interview controller + transcript rendering inside `src/client/routes/project/$id/_view/`.
- **Frontier relationship**: this is the next thin follow-on inside **Workspace semantic shell scaffolding** before deeper story refinement.
- **Volatile state**: the shell now exposes missing semantics, but transcript playback still reads too much like message-by-message chat instead of turn-by-turn interview state.
- **Main open risk**: overshooting into full live-state choreography; keep this slice centered on turn-based staging for completed/current turns, not full observer/runtime orchestration.

## Target Behavior

Completed elicitation turns render as compact answered-turn records while the current turn remains the primary interactive card, so the workspace reads as a turn-based interview instead of user/assistant chat bubbles plus mechanical stream markers.

## Boundary Crossings

```text
→ persisted phase turns + chat stream artifacts
→ interview controller/view-model projection
→ transcript rendering in `-interview-view.tsx`
→ browser-visible turn history / current-turn staging
```

## Risks and Assumptions

```text
- RISK: historical turn cards duplicate the current active card or phase summary state.
  → MITIGATION: only completed turns collapse; the active unanswered turn stays expanded.

- RISK: control actions like “Begin/Continue” still appear as ordinary user bubbles.
  → MITIGATION: project known control text as dedicated control markers instead of chat bubbles.

- RISK: observer semantics are still too coarse without a per-turn captured-entity projection.
  → MITIGATION: this slice may use a coarse captured-status line on the answered card; richer capture detail can follow.

- ASSUMPTION: a compact answered-turn card showing question + chosen response + context is enough to make replay materially clearer even before live turn-state choreography is complete.
  → VALIDATE: manual review on seeded design-active and criteria-ready scenarios.
```

## Acceptance Criteria

```text
✓ completed-turn-card — persisted answered turns render as compact answered cards rather than separate assistant-question and user-answer bubbles
✓ current-turn-primary — the current unanswered turn remains the expanded interactive card
✓ control-marker-not-bubble — begin/continue control actions no longer render as ordinary user chat bubbles
✓ no-step-marker-replay — assistant step markers do not render in replay transcript
✓ answered-card-summary — completed cards surface question title, chosen option summary, and response context in compact form
✓ captured-status-slot — completed cards expose a captured-status area, even if initially coarse
✓ verify-gate — `npm run verify` passes
```

## Verification Approach

```text
- Inner: controller/view tests for turn projection, control-marker rendering, and answered-card summaries.
- Middle: route-level transcript rendering checks for design-active fixtures with prior answered turns plus a current active turn.
- Outer: manual browser walkthrough confirming the transcript now reads as completed turn cards + one active turn, not chat bubbles and stream markers.
```

## Explicit Exclusions

- full per-turn live state machine choreography (submitted → interviewer-complete → observer-trailing)
- rich captured-entity detail on answered cards
- full collapsed replay of reasoning in its final visual treatment
- review-set implementation
- router/query redesign
