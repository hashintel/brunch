# Worktree Agent Prompts

Use these with `isolation: "worktree"` after confirming the control worktree is clean.

Each prompt is designed to be self-contained. Paste one prompt per agent.

---

## Agent A — Fixture-backed walkthrough workspace

You are working in an isolated git worktree on branch `ln/fe-582-e2e-manual-refine-2` inside the `brunch` repo.

Read first:
- `AGENTS.md`
- `memory/SPEC.md`
- `memory/PLAN.md`
- `WORKTREE_AGENT_BRIEF.md`
- `docs/praxis/manual-testing.md`

## Task

Implement the **Fixture-backed walkthrough workspace** slice.

Goal:
Expand trusted seed scenarios into a walkthrough-ready workspace that can exercise kickoff, in-flight phase states, review-ready states, export-ready states, and resume behavior without ad hoc database edits.

## Scope boundaries

You own:
- `src/server/fixtures/**`
- fixture / manifest / corpus / seed tests
- optional small docs directly related to fixture usage or manual seeding

You may touch if necessary:
- `src/server/export.test.ts`
- `src/server/app.test.ts`
- `docs/praxis/manual-testing.md`

Do **not** touch:
- `src/server/interview.ts`
- `src/client/routes/project/**`
- `src/client/stories/**`
- `memory/SPEC.md`
- `memory/PLAN.md`
- Graphite / stack management files or commands

## Acceptance target

- Seedable scenarios exist for the main walkthrough states.
- Export and resume can be exercised from seeded projects.
- The fixture matrix is useful for manual inspection of missing or weak views.

## Verification target

- Inner: seed CLI / manifest / corpus / fixture tests.
- Middle: round-trip from seed → load → export → resume.
- Outer: manual seeded walkthroughs if needed, but prefer landing strong automated fixture coverage first.

## Constraints

- Keep the slice narrow.
- Do not redesign kickoff behavior.
- Avoid broad edits to generic app/runtime code.
- If you need brownfield-specific fixtures, keep them minimal to reduce overlap with the brownfield agent.

## Process

1. Explore the existing fixture/manifest/corpus seam.
2. Add or refine the smallest useful set of walkthrough-ready scenarios.
3. Add focused tests near the owned seam.
4. Run `npm run fix` during the inner loop.
5. Run `npm run verify` before finishing.

## Deliverable

When done, provide:
- a short summary of what changed
- files changed
- verification run results
- any merge-risk notes, especially overlap with brownfield scenarios

---

## Agent B — Brownfield kickoff rehabilitation

You are working in an isolated git worktree on branch `ln/fe-582-e2e-manual-refine-2` inside the `brunch` repo.

Read first:
- `AGENTS.md`
- `memory/SPEC.md`
- `memory/PLAN.md`
- `WORKTREE_AGENT_BRIEF.md`

Focus especially on brownfield-related material in `memory/SPEC.md` and the current kickoff implementation in the server.

## Task

Implement the **Brownfield kickoff rehabilitation** slice.

Goal:
Repair brownfield scope kickoff so it yields **durable useful knowledge** and a **grounded first question** for feature-area work inside an existing codebase.

## Scope boundaries

You own:
- `src/server/interview.ts`
- kickoff-related server/context glue
- kickoff-focused tests
- minimal kickoff copy changes only if strictly required

You may touch if necessary:
- `src/server/context.ts`
- `src/server/observer.ts`
- `src/server/app.test.ts`
- `src/server/interview.test.ts`
- `src/client/routes/-project-list.tsx` only if wording must change for partial-scope brownfield framing

Do **not** touch:
- `src/client/routes/project/$id/_view/**`
- `src/client/mutations/**`
- `src/client/stories/**`
- broad routed UI layout files
- `memory/SPEC.md`
- `memory/PLAN.md`
- Graphite / stack management files or commands

## Acceptance target

- Brownfield kickoff produces usable grounding for the first scope turn.
- Observer handoff is coherent with the chosen kickoff shape.
- Partial-codebase / partial-timeline framing reads correctly enough for feature-area elicitation.

## Oracle boundary

For this wave, you only need to prove:
- **durable useful knowledge**
- **a grounded first question**

Do **not** overreach into trying to fully solve long-horizon kickoff quality or perfect repo understanding.

## Verification target

- Inner: interviewer-context, observer-boundary, and kickoff transport tests.
- Middle: persistence and kickoff round-trip checks.
- Outer: qualitative brownfield walkthroughs on real repos if needed.

## Constraints

- Keep kickoff strategy changes modest and testable.
- Avoid broad UI redesign.
- Avoid expanding into story work.
- Be careful with fixture overlap; if you need fixture support, keep it minimal and note it clearly.

## Process

1. Read the current brownfield kickoff flow end-to-end.
2. Identify the smallest design adjustment that improves grounding + durable knowledge capture.
3. Implement with focused server/test changes.
4. Run `npm run fix` during the inner loop.
5. Run `npm run verify` before finishing.

## Deliverable

When done, provide:
- a short summary of what changed
- files changed
- verification run results
- any open design questions left unresolved
- any merge-risk notes, especially overlap with fixture scenarios or kickoff copy

---

## Agent C — Story-first phase and transcript patterns

You are working in an isolated git worktree on branch `ln/fe-582-e2e-manual-refine-2` inside the `brunch` repo.

Read first:
- `AGENTS.md`
- `memory/SPEC.md`
- `memory/PLAN.md`
- `WORKTREE_AGENT_BRIEF.md`

## Task

Implement the **Story-first phase and transcript patterns** slice.

Goal:
Prototype phase-differentiated layouts and transcript-state patterns in story form so UI affordances can evolve in parallel with app wiring.

## Scope boundaries

You own:
- `src/client/stories/**`
- story-only supporting components created specifically for stories
- optional story-local notes if useful

You may touch if necessary:
- story-local helper components under `src/client/stories/**`
- dormant/pattern-only components that are not used by routed app code

Do **not** touch:
- `src/client/routes/project/**`
- `src/client/mutations/**`
- `src/server/**`
- app runtime transcript rendering
- `memory/SPEC.md`
- `memory/PLAN.md`
- Graphite / stack management files or commands

## Acceptance target

- Story variants cover kickoff states, waiting/question-formation states, transcript artifact states, and at least one differentiated layout direction across workflow phases.
- The stories are useful as design references for later app adoption.

## Oracle boundary

Use a **dramaturgical see-and-inspect** posture:
- make state transitions legible
- make waiting states visibly distinct
- make phases feel differentiated

These are design references, not runtime rewrites.

## Verification target

- Inner: story build / typecheck.
- Outer: manual dramaturgical review of state legibility and phase differentiation.

## Constraints

- Keep work story-local.
- Do not assume you are defining the final runtime implementation.
- Avoid changing app data shapes unless absolutely unavoidable.
- If you need assumptions, document them locally in story comments or a small story README.

## Process

1. Review existing story assets and patterns.
2. Add the smallest set of story variants that make the planned UI states legible.
3. Keep story-only helper abstractions local to the story seam.
4. Run `npm run fix` during the inner loop.
5. Run `npm run verify` before finishing if your changes affect the normal repo verification surface; otherwise at minimum run the relevant checks and report clearly.

## Deliverable

When done, provide:
- a short summary of what changed
- files changed
- verification run results
- any assumptions the runtime app would need to adopt these patterns
- any merge-risk notes, especially if a story accidentally drifted toward runtime code
