<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

Full-fidelity frontier. The interaction-model cleanup and handoff stabilization pass has now retired from active execution: the workspace stream bottoms out in explicit next actions again, closed phases project legible handoff/completion artifacts, and in-flight close/force-close actions no longer rely on the larger generic shell to imply what is happening. The next live burden is naming normalization — removing the remaining `project` / `scope` / `cwd` drift now that the underlying workflow and transcript model is stable enough that we can rename the truth instead of renaming moving targets.

## Active

### Active Code Alignment Map

The current active frontier is now a terminology-and-ownership realignment over seams that still expose the older product language.

- **Naming, routing, and grounding-language seam (`src/shared/phase-routes.ts`, `src/shared/phase-display.ts`, `src/client/routes/project/$id/index.tsx`, `src/server/interview.ts`, `src/server/tools/index.ts`, `src/shared/grounding-strategy.ts`)** — the codebase still mixes `scope`, kickoff-era brownfield ritual language, and route names that predate the grounding/card-owned model. This is now the primary frontier seam.
- **Workflow + persistence seam (`src/server/core.ts`, `src/server/app.ts`, `src/server/db.ts`, `src/server/schema.ts`, `src/shared/api-types.ts`, `src/shared/project-state-turn.ts`)** — workflow truth is now stable enough to rename around, but the durable record names and API contracts still expose `project` and related legacy identifiers. Naming work must change these without reintroducing control-row compatibility or a second workflow model.
- **Routed workspace/read-model seam (`src/client/routes/project/$id/_view/*`, `src/client/components/*`)** — the workspace stream, sidebar, and output affordances now speak the cleaned interaction model, but copy, route segments, and props still inherit the old naming split. This seam should consume naming normalization, not redefine semantics.
- **Fixtures, walkthrough seeds, and regression oracles (`src/server/fixtures/*`, `src/server/app.test.ts`, `src/client/routes/project/$id/_view/*test.tsx`)** — the remaining burden here is to keep seeded and regression state aligned while identifiers and route names change. Verification must keep naming migration from silently desynchronizing persisted state, routing, and replay.

1. **Naming normalization: project → specification, scope → grounding, cwd removal** — align internal identifiers, route keys, and schema columns with the product vocabulary settled in D97 / D98.
   - Why now / unlocks: the semantic and handoff frontier is now retired, so naming drift is the last pervasive legacy burden still shaping how fresh work gets described. Doing it now avoids teaching the next frontier item on top of mixed terminology, and it removes a large source of incidental ambiguity before transcript-fidelity and workflow-extraction follow-ons.
   - Traceability: D97, D98; Horizon `project → specification physical DB rename`, Horizon `cwd removal`.
   - Boundary with Next items: this item owns naming migration and the smallest compatibility measures needed to keep runtime, routing, fixtures, and export truthful while names change. It does **not** own transcript hydration quality work beyond what the rename touches, and it does **not** own the later router/query invalidation cleanup except where a tiny route fix is inseparable from the rename.
   - What this item must accomplish:
     - rename `project` record / table / API identifier to `specification` (or the agreed internal name) with an explicit migration path
     - migrate the internal phase key from `scope` to `grounding`, or explicitly retain `scope` as a documented permanent alias if migration proves too costly
     - remove `cwd` from the specification record and derive workspace path implicitly from runtime context
     - update routes, loaders, fixtures, tests, and stories to match
     - verify after each safe commit in the sequence so silent breakage does not hide behind broad rename churn
   - Current planning stance:
     - handoff and transition cleanup is no longer blocking this item
     - the naming pass should be planned as a sequence of safe commits, not one sweep
     - any compatibility alias kept temporarily must be explicit and documented, not left as accidental drift

## Next

1. **Transcript fidelity stabilization for seeded and resumed states** — make replayed interview history trustworthy enough that the workspace reads like one coherent thread instead of a partial hydration. Whatever remains after naming normalization lands here.
   - Traceability: D92, D93, D96; A53, A55.

2. **Interview workflow transition extraction from `app.ts`** — deferred by choice. Picks up after naming normalization and transcript-fidelity work stop competing for the same workflow files.

3. **Router / query ownership refinement for interview surfaces** — deferred by choice. Replace coarse route-wide invalidation with deliberate loader / query ownership once the renamed surfaces make the real invalidation boundaries legible.
   - Why deferred: this pass should consume notes gathered during naming normalization and transcript-fidelity work instead of running in parallel with them.
   - What this later slice should harvest from the preceding frontier:
     - the transition points whose correctness still depends on coarse invalidation
     - the route / loader / query seams that had to change as enabling work during rename cleanup
     - places where route-wide refresh is masking unclear ownership rather than expressing it
     - any repeated pattern in stale handoff state, over-refresh, or mixed workflow/query responsibilities

## Horizon

- **Output route and markdown export refinement** — independent parallel lane; refine the conditional route available when all phases are closed, with accepted review outputs projected into markdown export (D101).
- **Close Phase confirmation modal** — modal UX for the Close Phase button with readiness / turn-count context and closeability gating (D104); review phases may stay on their lighter accept-to-close path.
- **Workflow projector extraction** — conditional parallel refactor lane; extract `getCurrentWorkflowState()` into a pure projector over a `WorkflowSnapshot` struct without changing semantics on the active projector frontier. Note: the broader runtime/state-machine ownership claims in `docs/design/state-machines/README.md` still constrain lifecycle work even though this extraction remains deferred.
- **Grounding-card transcript primitive** — add visible provisional grounding cards with optional comment + continue semantics, keeping card content non-durable while allowing user reactions to feed later knowledge capture.
- **Brownfield workspace-analysis grounding brief** — use read-only workspace analysis to produce the first visible grounding card, then hand off into the first substantive grounding question.
- **Reusable interviewer-invoked context gathering beyond opening grounding** — defer until opening brownfield brief proves the card / provenance model.
- **Dashboard / result summaries and completeness metrics** — post-interview surface.
- **Edit mode + cascade preview** — revisit affordance after interview-surface refinement settles.
- **Cascade execution + secondary thread lifecycle** — structural follow-on.
- **Drizzle Kit audit remediation** — recommended independent hardening lane.
- **Git-friendly file-based persistence representation for diffable specs**.
- **Headless interview driver for scripted end-to-end probes** — complements the current manual-heavy outer loop once the existing contract, integration, fixture, controller, and build-boundary oracle stack is no longer enough for projector/interaction regressions.
- **MCP server adapter for core operations**.

## Recently Completed

- 2026-04-19 — **Phase transition and handoff stabilization retired from the active frontier** — requirements acceptance now advances directly into criteria kickoff, criteria acceptance closes the workflow into export-ready state, closed phases project explicit handoff/completion artifacts, and in-flight close / force-close actions show explicit control markers instead of relying on stale proposal/frontier UI. Verified: `npm run verify`.
- 2026-04-19 — **Legacy fixture side path removed; one TS-native fixture model remains** — the public walkthrough catalog now proves direct builder ownership, app and observer tests seed specifications through direct TS setup, the observer corpus probes seed from TS helpers instead of a second scenario format, and the legacy fixture support layer plus fixture artifacts are deleted. Verified: `npm run verify`.
- 2026-04-19 — **Narrow D113 lifecycle proving slices landed for kickoff, recovery, and rejected auto-submit** — specification-scoped auto phase intents now cover current reachable kickoff auto-present, current reachable recovery auto-continue, and rejected-submit fallback without reintroducing route-local lifecycle authority. Verified: `npm run verify`.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
interaction-family-canonicalization-durable-turn-cards-plus-projected-control-cards
  └──→ naming-normalization-project-specification-scope-grounding-cwd-removal

naming-normalization-project-specification-scope-grounding-cwd-removal
  └──→ transcript-fidelity-stabilization-for-seeded-and-resumed-states (Next)
  └──→ interview-workflow-transition-extraction-from-app-ts (Next)
  └──→ router-query-ownership-refinement-for-interview-surfaces (Next)
```

### Parallelism Opportunities

Spawn separate worktrees only after the control worktree is clean, and keep the mainline focused on the active naming-normalization frontier while these lanes stay inside their file boundaries.

- **Recommended worktree lane — Drizzle Kit audit remediation**
  - Objective: audit Drizzle Kit config, migration journal integrity, and schema-generation hygiene without widening into product naming migration or projector semantics.
  - Primary files: `drizzle.config.ts`, `drizzle/*.sql`, `drizzle/meta/*`, `package.json`, and `src/server/schema.ts` only if the audit proves schema/migration drift that must be reconciled.
  - No-go zones: `src/server/app.ts`, `src/server/core.ts`, `src/shared/project-state-turn.ts`, and `src/client/routes/project/$id/_view/*`; do not bundle `project → specification` or `scope → grounding` renames into this lane.
  - Merge-risk notes: low if it stays tooling-only; medium if it regenerates or edits migrations that the mainline also needs. Review for migration ordering conflicts and snapshot drift.

- **Recommended worktree lane — Output route and markdown export refinement**
  - Objective: improve export projection and the dedicated export route without changing workflow-complete semantics or the merged-stream/read-model contract.
  - Primary files: `src/server/export.ts`, `src/server/export.test.ts`, `src/server/app.ts` (export endpoint only), `src/server/app.test.ts` (export assertions only), `src/client/routes/project/$id/export.tsx`, `src/client/routes/project/$id/-export-preview.tsx`, `src/client/routes/project/$id/export-loader.test.ts`, `src/client/routes/project/$id/ExportPreview.test.tsx`, and `src/client/routes/project/$id/-phase-navigation-sidebar.tsx` plus its test if navigation copy changes.
  - No-go zones: `src/client/routes/project/$id/_view/-interview-view.tsx`, `src/client/routes/project/$id/_view/-workspace-stream-projector.ts`, `src/client/routes/project/$id/_view/-interview-controller*`, and workflow closure rules in `src/server/db.ts`.
  - Merge-risk notes: medium. The route itself is isolated, but route copy and link targets may overlap with the active naming frontier. Check carefully for missed route-name and copy updates before merging.

- **Conditional worktree lane — Workflow projector extraction**
  - Objective: perform a behavior-preserving refactor that extracts `getCurrentWorkflowState()` into a pure projector over a snapshot struct while leaving workflow semantics unchanged.
  - Primary files: `src/server/db.ts`, `src/server/db.test.ts`, and, if needed for the extracted contract, a new shared/server-local projector module plus supporting notes in `docs/design/state-machines/README.md`.
  - No-go zones: do not change workflow status meaning, landing derivation, phase progression, export readiness, or client-facing interview/view behavior; avoid `src/server/app.ts`, `src/server/core.ts`, and `src/client/routes/project/$id/_view/*` unless a tiny mechanical import adjustment is unavoidable.
  - Merge-risk notes: medium-high because `src/server/db.ts` and surrounding shared types are hot during naming normalization. Only run this lane in parallel if the brief is explicitly constrained to pure extraction and the reviewer is prepared to check carefully for merge gaps against mainline rename work.

- **Do not parallelize yet**
  - The active naming-normalization frontier still crosses schema, routes, shared API types, fixtures, and export-adjacent copy; keep that mainline sequential until the canonical terms settle.
  - Next items remain downstream of the naming pass or intentionally deferred until the current rename and route-key churn stop competing for the same files.
  - Horizon items tied directly to the interview surface itself — Close Phase confirmation modal, grounding-card transcript primitive, brownfield grounding brief, reusable interviewer-invoked context gathering, and the headless interview driver — should wait until naming drift stops moving the same UI seams.
