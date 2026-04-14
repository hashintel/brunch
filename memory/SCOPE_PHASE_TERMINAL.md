# Scope: Phase Terminal Staging and Auto-Present Current Turn

> Status: live scoped card. This is the current first build target on the workspace transcript frontier.

**Slice**: `memory/PLAN.md` Active #1
**Weight**: Full scope card
**Status**: scoped

## Orientation

- **Containing seam**: routed phase workspace in `src/client/routes/project/$id/_view/`.
- **Frontier item**: `memory/PLAN.md` Active #1 "Phase terminal staging and auto-present current turn."
- **Volatile state**: the shell honesty pass landed, but manual walkthroughs now show that the transcript column still terminates in the wrong artifact: open phases fall back to synthetic `Begin/Continue` CTAs, and closed phases surface the handoff card at the top instead of at the bottom.
- **Main open risk**: mixing phase status chrome with transcript-terminal state. The top bar may carry summary status, but the transcript column itself still needs a bottom-most artifact that matches workflow truth.

## Target Behavior

Each phase view bottoms out in the correct terminal artifact — the current unresolved turn (or visible generation state) when open, and a handoff/completion card when closed.

## Boundary Crossings

```text
→ workflow phase state + active-path turns
→ interview controller shell-state projection
→ routed phase workspace / transcript column rendering
→ browser-visible bottom-of-column staging and scroll anchoring
```

## Risks and Assumptions

```text
- RISK: Open phases still need a synthetic control message to bootstrap the first turn.
  → MITIGATION: project a visible generation state if the unresolved turn is not yet available; do not make the user author the bootstrap action.

- RISK: The top-of-pane status card and the bottom-of-column terminal artifact duplicate one another awkwardly.
  → MITIGATION: let any sticky top summary stay compact and supplemental; the transcript-terminal card carries the actual phase-end/start affordance.

- RISK: Control/closure turns are still treated as ordinary answered turns and clutter the bottom of the column.
  → MITIGATION: exclude non-question control/closure turns from answered-turn replay and render them through dedicated phase-terminal artifacts.

- ASSUMPTION: An open phase can project a current unresolved turn or visible generation state on first render without requiring the user to click a synthetic start action.
  → VALIDATE: manual walkthrough on kickoff-ready, design-active, and resumed phase states.
  → `memory/SPEC.md` §Assumptions: A54.
```

## Acceptance Criteria

```text
✓ open-phase-terminal-turn — if a phase is open and unresolved, the bottom of the transcript column is the current unanswered turn
✓ open-phase-generating-state — if the unresolved turn is still being generated, the bottom of the transcript column shows a visible generation state rather than a start/continue CTA
✓ closed-phase-terminal-handoff — if a phase is closed, the bottom of the transcript column is a handoff/completion card rather than a top-only card
✓ default-bottom-scroll — phase views load anchored to the bottom so the terminal artifact is immediately visible
✓ no-control-bootstrap-primary — `Begin/Continue` control actions are no longer the primary way to enter an already-open phase
✓ no-control-turn-answer-card — phase close/confirm control turns do not render as ordinary answered-turn cards
✓ verify-gate — `npm run verify` passes
```

## Verification Approach

```text
- Inner: view/controller tests for terminal artifact selection, control-turn filtering, and bottom-state projection.
- Middle: fixture-backed route checks across kickoff-ready, design-active, scope-closed, and all-phases-closed scenarios.
- Outer: browser walkthrough confirming that open phases always end in an unresolved turn / generation state and closed phases end in a handoff/completion card.
```

## Explicit Exclusions

- full turn lifecycle choreography after submit
- per-turn captured-item projection details
- final sticky top-bar layout design
- kickoff relocation out of the root-route flow
- router/query ownership redesign
