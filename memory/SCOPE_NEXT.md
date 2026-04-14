# Scope: Turn-Based Transcript Staging

> Status: retired as a standalone scope card on 2026-04-14.

This card captured the first replay/readability pass after the shell-honesty work. That pass has effectively landed; the remaining work has been re-sliced more narrowly.

## Why It Is Retired

- The core goals here are already present in the routed interview surface: answered-turn cards, control markers instead of ordinary user bubbles, and a coarse captured-status slot all exist in the current UI/tests.
- The still-open work is no longer “make replay turn-shaped” in the broad sense. The live frontier is now narrower: `memory/SCOPE_PHASE_TERMINAL.md` first, then the deeper lifecycle/capture seams from `memory/PLAN.md`.
- Leaving this as an active scope card would duplicate already-landed behavior and blur the boundary between completed replay work and the remaining lifecycle work.

## Use Instead

- Current first build card: `memory/SCOPE_PHASE_TERMINAL.md`
- Next lifecycle frontier: `memory/PLAN.md` Active #2
- Future capture-projection frontier: `memory/PLAN.md` Active #3
