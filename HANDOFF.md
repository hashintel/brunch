# Handoff

Current planning/design truth for the next thread is:

- `memory/SPEC.md`
- `memory/PLAN.md`
- `docs/design/WAVE_2_PREP.md`
- `docs/design/WAVE_2_FINDINGS.md`

Read those first.

## Current state

- The frontier has been re-planned after the spec update.
- Brunch should now be treated as a **structured interview workspace**, not a generic chat interface.
- Scope/design use **active-turn cards**.
- Requirements/criteria use **review sets**.
- Phase entry, handoff, and completion states may have **no live turn at all**.
- The next scoped slice should be **Workspace semantic shell scaffolding**.

## Immediate next action

Run `ln-scope` for **Workspace semantic shell scaffolding** using:

- `memory/SPEC.md`
- `memory/PLAN.md`
- `docs/design/WAVE_2_PREP.md`
- `docs/design/WAVE_2_FINDINGS.md`

Focus the scope on making the live app structurally honest in low fidelity:

- the right information in the right places
- correct affordances and interactions
- explicit entry / active / handoff / completion states
- truthful transcript/meta placeholders
- no reliance on a bare generic bottom composer as the primary affordance

## Repo note

The workspace also contains related doc/tooling cleanup from this thread:

- local DB defaults now align on `.brunch/brunch.db`
- root-level historical DB files were moved under `.brunch/archive/`

## Historical note

Older handoff content and parallel-work notes were intentionally retired in favor of the docs above so the next thread starts from the current product model, not the earlier chat-shaped one.