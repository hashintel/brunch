# Worktree Agent Allocation Brief

Branch: `ln/fe-582-e2e-manual-refine-2`
Date: 2026-04-14

This brief defines the **lowest-conflict first parallel wave** for worktree-isolated agents.

Source context:
- `memory/PLAN.md`
- `memory/SPEC.md`
- `docs/praxis/worktree-agents.md`

## Preflight

Before spawning agents:
1. Ensure the control worktree is clean.
2. Use `isolation: "worktree"`.
3. Verify isolation immediately with `git worktree list` and `git status` in the control worktree.
4. Give each agent the full task brief; agents do not inherit context from this thread.

## Recommended first wave

These are the three safest concurrent lanes right now:

1. **Fixture-backed walkthrough workspace**
2. **Brownfield kickoff rehabilitation**
3. **Story-first phase and transcript patterns**

This wave is preferred over using router/query ownership as a first parallel lane because the router/query seam is too close to transcript rendering and waiting-state work, creating higher merge-gap risk.

---

## Agent A — Fixture-backed walkthrough workspace

### Goal
Expand trusted seed scenarios into a walkthrough-ready workspace that can exercise kickoff, in-flight phase states, review-ready states, export-ready states, and resume behavior without ad hoc DB edits.

### Owns
- `src/server/fixtures/**`
- fixture/manifest/corpus/seed tests
- optional small doc updates related to fixture usage or manual seeding

### May touch
- `src/server/export.test.ts`
- `src/server/app.test.ts`
- `docs/praxis/manual-testing.md`

### Do not touch
- `src/server/interview.ts`
- `src/client/routes/project/**`
- `src/client/stories/**`
- `memory/SPEC.md`
- `memory/PLAN.md`

### Acceptance target
- Seedable scenarios exist for the main walkthrough states.
- Export/resume can be exercised from seeded projects.
- The fixture matrix is useful for manual inspection of missing or weak views.

### Verification target
- Inner: seed CLI / manifest / corpus / fixture tests.
- Middle: round-trip from seed → load → export → resume.
- Outer: manual seeded walkthroughs.

### Merge risks
- Moderate overlap with Agent B if both invent or edit the same brownfield-specific scenarios.
- Keep kickoff-specific fixture additions minimal and coordinated.

---

## Agent B — Brownfield kickoff rehabilitation

### Goal
Repair brownfield scope kickoff so it yields **durable useful knowledge** and a **grounded first question** for feature-area work inside an existing codebase.

### Owns
- `src/server/interview.ts`
- kickoff-related server/context glue
- kickoff-focused tests
- minimal kickoff copy changes if strictly required

### May touch
- `src/server/context.ts`
- `src/server/observer.ts`
- `src/server/app.test.ts`
- `src/server/interview.test.ts`
- `src/client/routes/-project-list.tsx` only if wording must change for partial-scope brownfield framing

### Do not touch
- `src/client/routes/project/$id/_view/**`
- `src/client/mutations/**`
- `src/client/stories/**`
- broad routed UI layout files
- `memory/SPEC.md`
- `memory/PLAN.md`

### Acceptance target
- Brownfield kickoff produces usable grounding for the first scope turn.
- Observer handoff is coherent with the chosen kickoff shape.
- Partial-codebase / partial-timeline framing reads correctly enough for feature-area elicitation.

### Verification target
- Inner: interviewer-context, observer-boundary, kickoff transport tests.
- Middle: persistence and kickoff round-trip checks.
- Outer: qualitative brownfield walkthroughs on real repos.

### Merge risks
- Moderate overlap with Agent A on brownfield fixture coverage.
- High overlap with any simultaneous kickoff-UI/story redesign; avoid that by keeping Agent C out of app kickoff wiring.

---

## Agent C — Story-first phase and transcript patterns

### Goal
Prototype phase-differentiated layouts and transcript-state patterns in story form so UI affordances can evolve in parallel with app wiring.

### Owns
- `src/client/stories/**`
- story-only supporting components created specifically for stories
- design notes adjacent to story usage if needed

### May touch
- story-local helper components under `src/client/stories/**`
- possibly dormant/pattern-only components that are not used by routed app code

### Do not touch
- `src/client/routes/project/**`
- `src/client/mutations/**`
- `src/server/**`
- app runtime transcript rendering
- `memory/SPEC.md`
- `memory/PLAN.md`

### Acceptance target
- Story variants cover kickoff states, waiting/question-formation states, transcript artifact states, and at least one differentiated layout direction across workflow phases.
- The stories are useful as design references for later app adoption.

### Verification target
- Inner: story build / typecheck.
- Outer: dramaturgical see-and-inspect review of state legibility and phase differentiation.

### Merge risks
- Low direct file conflict with Agents A/B.
- Main risk is conceptual drift if story patterns assume runtime data shapes that later change; document assumptions in story comments or a local README if needed.

---

## Deferred / not in first wave

### Router/query ownership refinement for interview surfaces
This is a strong next candidate, but **not** recommended in the first parallel wave unless it is isolated in its own later round.

Reason:
- It is too close to future work on transcript fidelity, placeholder hydration, and waiting-state presentation.
- It is likely to touch shared files such as:
  - `src/client/routes/project/$id/_view/-interview-controller.ts`
  - `src/client/routes/project/$id/_view/-interview-data.ts`
  - `src/client/routes/project/$id/_view/-interview-view.tsx`
  - `src/client/mutations/interview-mutations.ts`

If you promote it to a parallel lane later, give it a strict charter:
- own data loading and invalidation boundaries only
- do not change transcript rendering
- do not add waiting-state UI
- do not touch stories

---

## Shared constraints for all agents

- Do not modify `memory/SPEC.md` or `memory/PLAN.md` in these parallel branches unless explicitly instructed.
- Do not perform Graphite stack operations from isolated worktrees.
- Keep the slice narrow; if the work broadens, stop and report rather than widening into another agent’s lane.
- Prefer adding tests near owned seams over editing broad cross-cutting files.

## Merge review checklist

After agents return:
1. Review each branch independently.
2. Look for **merge gaps**, not just merge conflicts.
3. Pay special attention to:
   - shared test files (`app.test.ts`, broad integration tests)
   - any fixture overlap between Agent A and Agent B
   - accidental runtime-app edits in Agent C
4. Merge into the control worktree manually.
5. Run `npm run verify` after reintegration.
