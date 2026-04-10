<!-- PLAN.md — single source of truth for WHAT we're doing next.
     Created by ln-plan · Read by all skills · Updated by ln-sync, ln-build, ln-spike.
     Authority: phases, slices, spikes, ordering, status, and traceability to SPEC.md.

     Re-run ln-plan frequently to retire completed slices, occasionally to add new ones.
     Every slice and spike names its dependent requirements and assumptions from SPEC.md.
     Invalidating an assumption in SPEC surfaces every slice it touches here. -->

# Plan

<!-- Phases are temporal groups, ordered. Within each phase, slices and spikes are ordered
     by uncertainty first, dependency second (retire risk early).
     Status: not-started | in-progress | done -->

## Phase 1: Foundation

<!-- Prove the stack works end-to-end, then add persistence. All subsequent phases depend on this. -->

### Slices

1. **Walking skeleton: SDK → SSE → React** `FE-534` `done` — I1, I2, I3, I4
2. **SQLite foundation + project persistence** `FE-535` `done` — I5, I6

## Phase 2: Architecture `done`

3. **Turn tree schema + API** `FE-544` `done` — I6, I9, I10
3c. **Drizzle ORM + core extraction** `FE-552` `done` — I11, I12, I13
3d. **Multi-project routing** `FE-553` `done` — I14, I15

## Phase 3: Interview Engine `done`

<!-- Spikes -->
- Spike: **Observer extraction fidelity** `FE-557` `done` — narrowly validated observer extraction for the original decisions/assumptions ontology (≥80% capture rate); broadened knowledge-layer extraction still needs follow-up coverage
- Spike: **Raw Anthropic SDK** `done` — invalidated A2, validated A26, led to D30

<!-- Slices -->
3b. **Rich chat UI** `FE-541` `done` — I7
4. **Structured interview: scope phase** `FE-554` `done` — I16
4a. **Parts-based persistence + context builders** `FE-555` `done` — I17, I18, I19
4b. **Structured interview: client UI** `FE-556` `done` — I17↑, I18↑
4c. **UI foundation: shadcn/ui + Tailwind 4 + AI Elements** `FE-558` `done`
5. **Observer agent + entity persistence** `FE-537` `done` — I20, I21, I22
6. **Entity sidebar (read-only)** `FE-538` `done` — I23
6b. **AI SDK-native chat pivot** `FE-559` `done` — I21↑, I22↑, I23↑
6b1. **Workspace seam characterization oracle** `done` — I24
    - Purpose: add a client integration harness around the interview workspace before the state-ownership refactor
    - Coverage: initial hydration from persisted turns, same-project refresh stability, observer-result sidebar reactivity, option-selection follow-through
    - Unblocks: 6c live streaming fix, workspace state-ownership refactor commits

## Phase 4: Interaction + Knowledge Foundations `done`

### Slices

6c. **Live streaming fix** `done`
    - Requirements: → SPEC.md §Requirements #2, #3, #4
    - Assumptions: → SPEC.md §Assumptions A16, A28
    - Invariants to respect: → SPEC.md §Invariants I16, I17, I18, I22
    - Invariants established: → SPEC.md §Invariants I24
    - Acceptance: streamed turn card appears live without refresh; `npm run verify` passes
    - Result: workspace controller projects streamed `tool-ask_question` into visible turn card before durable route refresh
    - Evidence: InterviewWorkspace.test.tsx, workspace-controller.test.tsx, workspace-data.test.ts, app.test.ts

6d. **Flexible turn-response model** `done`
    - Requirements: → SPEC.md §Requirements #3, #6
    - Assumptions: → SPEC.md §Assumptions A16, A28, A33
    - Decisions: → SPEC.md §Decisions D23, D24, D25
    - Invariants to respect: → SPEC.md §Invariants I17, I18, I19, I22
    - Invariants established: → SPEC.md §Invariants I44
    - Acceptance: zero/one/many selections plus free-text round-trip through persistence, hydration, and interviewer context
    - Result: `data-turn-response` parts carry structured replies; workspace stages multi-select locally and submits one response
    - Tracer bullets: 6d.1 single + free-text `done`, 6d.2 free-text-only `done`, 6d.3 many-selection `done`

6e. **Generic knowledge layer schema + sidebar projection** `done`
    - Requirements: → SPEC.md §Requirements #5, #6, #14
    - Assumptions: → SPEC.md §Assumptions A14
    - Decisions: → SPEC.md §Decisions D5, D13, D25, D49, D50, D51
    - Invariants to respect: → SPEC.md §Invariants I20, I21, I23
    - Invariants established: → SPEC.md §Invariants I48
    - Acceptance: generic knowledge items and edges load and display from the active path without losing resume behavior
    - Result: `knowledge_item` + `turn_knowledge_item` + `knowledge_edge` persistence; entities API projects kind-specific collections plus typed relationships
    - Tracer bullets: 6e.1 framing items `done`, 6e.2a legacy edges `done`, 6e.2b remaining kinds `done`

6f. **Phase-aware observer extraction** `done`
    - Requirements: → SPEC.md §Requirements #5, #6, #11, #12
    - Assumptions: → SPEC.md §Assumptions A14, A20
    - Decisions: → SPEC.md §Decisions D4, D5, D13, D25
    - Invariants to respect: → SPEC.md §Invariants I20, I21, I23
    - Invariants established: → SPEC.md §Invariants I54
    - Acceptance: observer biases extraction by phase; results stream in-band to sidebar without breaking sync
    - Result: scope yields goals/terms/contexts/constraints, design yields decisions/assumptions with scope spillover, requirements yields requirements, criteria yields criteria
    - Tracer bullets: 6f.1 scope framing `done`, 6f.2 scope constraints `done`, 6f.3 design bias `done`, 6f.4a requirements `done`, 6f.4b criteria `done`

## Phase 5: Mode Closure + Full Interview

<!-- Once turns and knowledge capture fit the real interview, add explicit readiness artifacts.
     Slice 7 can proceed on the current foundation, but later mode/review slices should not harden
     the transitional `framing`-based ontology or mixed legacy/generic knowledge seam; retire that
     design risk before treating the remaining workflow modes as shape-stable. -->

### Slices

7. **Explicit phase outcomes + scope closure** `done`
   - Requirements: → SPEC.md §Requirements #7, #8
   - Assumptions: → SPEC.md §Assumptions A15, A28
   - Decisions: → SPEC.md §Decisions D2, D3, D6, D62, D65, D66
   - Invariants to respect: → SPEC.md §Invariants I18, I24
   - Invariants established: → SPEC.md §Invariants I72
   - Acceptance: scope proposes closure, user confirms, explicit phase outcome persists, workflow state updates
   - Result: durable `phase_outcome` proposal/confirmation records; `data-phase-summary` + `data-confirmation` chat seams; workspace header shows scope status and confirmation card
   - Debt: shared closeability/readiness/closure-basis generalization folded into slice 8

7a. **Knowledge-layer redesign spike** `done`
   - Decisions: → SPEC.md §Decisions D5, D17, D59, D61, D62, D63, D64, D67, D68, D69
   - Invariants to respect: → SPEC.md §Invariants I20, I21, I23, I48
   - Acceptance: approved target model for canonical kinds, cross-kind edges, storage direction, and knowledge-workspace boundaries
   - Result: canonical ontology is 8 kinds (`goal`, `term`, `context`, `constraint`, `assumption`, `decision`, `requirement`, `criterion`); `framing` demoted to migration alias; primary review UX is dedicated knowledge workspace, not sidebar

7b. **Canonical knowledge model foundation + cutover seam** `done`
   - Assumptions: → SPEC.md §Assumptions A14, A40
   - Decisions: → SPEC.md §Decisions D5, D13, D17, D49, D51, D59, D61, D62, D63, D67, D68, D69
   - Invariants to respect: → SPEC.md §Invariants I20, I21, I23, I48, I72
   - Invariants established: → SPEC.md §Invariants I48, I54
   - Acceptance: all eight canonical kinds plus generic edges work; scope closure reads coherent scope bundle; no new writes rely on `framing`
   - Result: registry/observer/entities/sidebar use canonical kinds on clean DB; decisions/assumptions persist through generic seam; compatibility projections preserve slice-7 readiness
   - Tracer bullets: 7b.1 canonical scope kinds `done`, 7b.2 generic edge/storage cutover `done`

8. **Design mode (commitment / exploration)** `done`
   - Requirements: → SPEC.md §Requirements #2, #3, #5, #6, #7, #8
   - Assumptions: → SPEC.md §Assumptions A14, A15, A28, A40
   - Decisions: → SPEC.md §Decisions D2, D5, D6, D61, D62, D65, D66, D67, D68, D70, D71, D72, D73, D74, D75
   - Invariants to respect: → SPEC.md §Invariants I18, I19, I21, I22, I72
   - Invariants established: → SPEC.md §Invariants I72
   - Acceptance: design mode enters after scope close; design turns yield commitments on canonical knowledge seam; user can accept recommended close or force-close with persisted closure basis
   - Result: shared workflow projection (status/closeability/readiness/closureBasis) replaces scope-only seam; explicit discriminated phase-close commands; force-close availability from shared policy; durable closure basis on `phase_outcome`
   - Tracer bullets: 8.1 design entry + shared workflow `done`, 8.2 design closure + requirements handoff `done`, 8.3 user-forced close + carried debt `done`

9. **Requirements-review mode** `done`
   - Requirements: → SPEC.md §Requirements #6, #7, #8, #11, #13
   - Assumptions: → SPEC.md §Assumptions A15, A28, A40, A44, A45, A46
   - Decisions: → SPEC.md §Decisions D2, D5, D6, D61, D62, D65, D66, D67, D68, D69, D70, D71, D77, D78, D79
   - Invariants to respect: → SPEC.md §Invariants I18, I19, I21, I24
   - Invariants established: → SPEC.md §Invariants I87
   - Acceptance: requirement set synthesized from canonical knowledge; explicit approve/reject state; requirements closeability + closure proposal; criteria handoff on confirmation
   - Result: interviewer grounded in requirement inventory; targeted approve/reject via review metadata + `turn_knowledge_item` links; closeability from full review coverage; shared phase-close seam reused for requirements → criteria handoff
   - Tracer bullets: 9.1 inventory grounding `done`, 9.2 targeted approval `done`, 9.3 targeted rejection `done`, 9.4 closeability + proposal `done`, 9.5 closure + criteria handoff `done`

10.1 **Criteria grounding + first synthesis/review loop** `done`
     - Requirements: → SPEC.md §Requirements #6, #8, #12
     - Assumptions: → SPEC.md §Assumptions A28, A40
     - Decisions: → SPEC.md §Decisions D25, D55, D56, D71
     - Candidate invariant goals: the first criteria turn is grounded in approved requirements; criteria-mode interviewer/observer behavior stays criteria-shaped and can persist one initial criterion through the existing seam
     - Invariants to respect: → SPEC.md §Invariants I18, I19, I21, I24, I95, I96
     - Acceptance: after requirements closes, the first criteria turn includes the approved requirement inventory, asks a criteria-shaped question rather than a generic follow-up, and one initial criterion can round-trip through observer/entity persistence without dropping out of criteria mode
     - **Verification approach**: inner — criteria context/prompt seam tests plus criterion projection tests. Middle — round-trip oracle proving approved requirement inventory → criteria interviewer turn → criterion persistence/entities refresh. Outer — manual walkthrough judges whether the first criteria turn feels grounded in the reviewed requirement set.

10.2 **Explicit criterion review state + minimal closeability** — Establish the first explicit per-criterion review seam and deterministic closeability rule in one slice rather than splitting approval, rejection, and closeability into separate tracer bullets. `done`
     - Requirements: → SPEC.md §Requirements #7, #8, #12, #13
     - Assumptions: → SPEC.md §Assumptions A15, A28
     - Decisions: → SPEC.md §Decisions D24, D61, D65, D66, D70
     - Candidate invariant goals: criteria project explicit `approved` / `rejected` / `pending` review state; criteria becomes closeable only when every current criterion has explicit non-pending review state
     - Invariants to respect: → SPEC.md §Invariants I18, I21, I24, I62, I63, I96
     - Acceptance: a targeted criteria-review turn can persist one explicit positive review action and one explicit non-positive review action, read-side projection resolves latest review state per criterion, and workflow marks criteria closeable only when no criterion remains `pending`
     - **Verification approach**: inner — criterion review metadata/read-model/workflow-state tests. Middle — round-trip oracle proving explicit criterion review actions persist and project without drift, plus lifecycle oracle proving criteria stays `in_progress` until review coverage is complete. Outer — manual criteria review walkthrough judges whether the thin approve/reject semantics are legible enough to keep moving.

10.3 **Criteria closure + completed workflow state** — Reuse the shared phase-close seam to close the final workflow phase and project a completed interview state once criteria review reaches the minimum bar. `done`
     - Requirements: → SPEC.md §Requirements #7, #8, #13
     - Assumptions: → SPEC.md §Assumptions A15, A28
     - Decisions: → SPEC.md §Decisions D65, D66, D71
     - Candidate invariant goals: the terminal phase can propose and confirm closure through the shared seam; workflow can project all phases closed with no stale active interviewer phase
     - Invariants to respect: → SPEC.md §Invariants I18, I24, I96
     - Acceptance: once criteria is closeable, the interviewer can propose criteria closure, user confirmation persists the final `phase_outcome`, and workflow projects all phases closed with no remaining active phase before export
     - **Verification approach**: inner — phase-summary/confirmation/workflow-state tests. Middle — round-trip oracle proving criteria proposal → confirmation → confirmed final outcome → completed workflow projection. Outer — manual walkthrough judges whether final closure feels coherent before export/polish work.

## Phase 6: Readiness Surfaces + Export

<!-- Surface readiness outside the workspace, add a broader knowledge workspace/review surface,
     then export from the reviewed knowledge layer. Generalized revisit is deferred until the
     readiness/export path is stable enough to absorb branch invalidation semantics without
     widening this phase further. -->

### Slices

11a. **Project dashboard workflow state** — Surface durable workflow state on the project list so users can tell which projects are unstarted, in progress, closed with debt, invalidated, or export-ready without opening each workspace. This replaces the deferred revisit slot with a missing but lower-risk requirement. `not-started`
     - Requirements: → SPEC.md §Requirements #7, #8, #11, #12, #13, #15
     - Assumptions: → SPEC.md §Assumptions A15, A28
     - Decisions: → SPEC.md §Decisions D3, D17, D65, D66, D70
     - Candidate invariant goals: project-list workflow state derives from durable phase outcomes, closeability/readiness projection, and review records, not ad hoc turn heuristics
     - Invariants to respect: → SPEC.md §Invariants I24
     - Acceptance: the project list shows each project's per-phase status/readiness/closure-basis summary from persisted readiness artifacts plus live workflow projection, distinguishes forced-close or low-readiness debt from ordinary closed state, and updates correctly after refresh/resume
     - **Verification approach**: inner — workflow-summary projection tests plus project-list route/component tests. Outer — manual multi-project walkthrough covering in-progress, forced-close debt, invalidated, and export-ready states.

12. **Knowledge workspace review surface + lifecycle API** — CRUD/review endpoints for the broader knowledge layer plus a fit-for-purpose workspace for inspecting, editing, and reviewing graph-shaped knowledge. The sidebar may remain a summary/navigation view, but the primary interaction model should no longer assume a narrow tab strip. This slice assumes the redesigned knowledge ontology/graph from 7a + 7b. `not-started`
     - Requirements: → SPEC.md §Requirements #6, #11, #12, #13
     - Assumptions: → SPEC.md §Assumptions A14, A40
     - Decisions: → SPEC.md §Decisions D5, D17, D61, D63, D67, D68, D69
     - Candidate invariant goals: review/edit actions are reflected in both knowledge state and readiness state; the knowledge workspace can present graph relationships and review actions without lossy sidebar compression
     - Invariants to respect: → SPEC.md §Invariants I23, I24
     - Acceptance: inspect and review/edit canonical knowledge items from a dedicated phase-oriented workspace surface; affected readiness updates visibly and persist across refresh/resume; dependency/provenance context remains legible during those actions
     - **Verification approach**: inner — mutation + projection tests. Outer — manual knowledge-workspace review/edit walkthrough.

13. **Spec export from the reviewed knowledge layer** — Render markdown export from active-path, reviewed knowledge items and explicit phase outcomes, including closure caveats when a mode was closed with low readiness or user-forced basis. Export is enabled only when the new readiness predicate is satisfied. `not-started`
     - Requirements: → SPEC.md §Requirements #13
     - Assumptions: —
     - Decisions: → SPEC.md §Decisions D5, D17, D26, D65, D66, D70
     - Candidate invariant goals: export reflects active-path reviewed knowledge only; readiness predicate gates export correctly; closure provenance survives into the final artifact when it changes how trustworthy the result is
     - Invariants to respect: → SPEC.md §Invariants I18, I21
     - Acceptance: complete all modes, satisfy review completeness, navigate to export, see markdown preview from the reviewed knowledge layer plus relevant phase-outcome caveats, download `.md` file
     - **Verification approach**: inner — export projection tests. Outer — manual export after a full walkthrough, after a low-readiness/forced-close path surfaces caveats, and after a readiness-incomplete state blocks export.

13a. **Review lifecycle refinement across requirements + criteria** — Revisit the first-cut review model only after the thin end-to-end path is working, and add the deferred variants that were intentionally excluded from slices 9 and 10 so the app kept moving toward completion. `not-started`
     - Requirements: → SPEC.md §Requirements #11, #12, #13
     - Assumptions: → SPEC.md §Assumptions A15, A40
     - Decisions: → SPEC.md §Decisions D17, D61, D65, D66, D69
     - Candidate invariant goals: richer review actions and invalidation semantics can evolve without regressing the thin end-to-end workflow; deferred edge-case variants are collected in one explicit refinement slice rather than fragmenting earlier mode slices
     - Invariants to respect: → SPEC.md §Invariants I18, I21, I24
     - Acceptance: deferred review refinements such as edit/add/merge/stale semantics across requirements and criteria can land behind one cross-cutting slice without regressing completion, export, or workflow-state coherence
     - **Verification approach**: inner — mutation/read-model/invalidation tests per refinement added. Outer — manual cross-phase review lifecycle walkthrough after the dedicated knowledge workspace exists.

## Phase 7: Distribution

<!-- Package and ship. -->

### Slices

14. **npx distribution + CLI** — `bin` entry, launcher starts Express (serves built Vite assets + API on one port), opens browser. `npx brunch` for web UI. `npx brunch [command]` for CLI operations. Single env var: `ANTHROPIC_API_KEY`. `not-started`
    - Requirements: → SPEC.md §Requirements #1
    - Decisions: → SPEC.md §Decisions D20
    - Candidate invariant goals: packaged launcher preserves working DB lifecycle and browser boot flow
    - Invariants to respect: → SPEC.md §Invariants I1, I2, I4, I5
    - Acceptance: `npx brunch` with key in scope opens working app

## Phase 8: Post-Distribution Hardening

<!-- Defer dependency-risk changes until the packaged app exists and can be regression-tested as a distributed artifact. -->

### Slices

15. **Drizzle Kit audit remediation** — Revisit the current `npm audit` finding on `drizzle-kit` after distribution is stable. Do not use `npm audit fix --force`, which currently resolves to `drizzle-kit@0.18.1`; that downgrade crosses the modern config boundary and is not a safe path for this repo. Instead, validate a non-vulnerable upgrade path (currently the `1.0.0-beta` line) against this app's SQLite config, migration history, and `studio` workflow before changing dependencies. `not-started`
    - Requirements: → SPEC.md §Requirements #1
    - Candidate invariant goals: packaged distribution remains stable while the Drizzle toolchain is upgraded off the vulnerable `@esbuild-kit/*` loader chain
    - Invariants to respect: → SPEC.md §Invariants I1, I2, I4, I5
    - Acceptance: chosen `drizzle-kit` version removes the vulnerable loader chain, keeps `drizzle.config.ts` compatible, preserves existing migration history, and `npm run studio` still works against the existing SQLite database
    - **Verification approach**: inner — dependency tree/audit check plus config-load and migration/studio smoke tests. Outer — manual `npm run studio` walkthrough on the distributed app path.

## Horizon

<!-- Future work not yet broken into slices. Revisit after Phase 7. -->

- Deferred from Phase 6: `11. Generalized revisit: branch + readiness invalidation` — revisit any earlier turn, branch from that point, restore the interview there, and invalidate downstream phase outcomes / review state from the affected frontier. Re-scope after the readiness/export path stabilizes.
- CLI interactive interview mode (terminal-based interview using core's DomainEvent stream)
- MCP server adapter (expose core operations as MCP tools)
- Turn tree visualization (git-log-style branch graph in sidebar)
- Knowledge graph visualization (goal / term / context / constraint / assumption / decision / requirement / criterion view)
- Exploratory pathway (for projects where the goal itself is unclear)
- Project characterization kickoff mode (ToolLoopAgent with core tools explores existing codebase before interview)
- Multi-provider support via AI SDK provider abstraction (architecturally possible now)
- Export to GitHub Issues, Linear, YAML task definitions

## Dependencies

<!-- Blocking relationships between slices. Update when slices are added or retired. -->

```
done ─────────────────────────────────────────────────────────────┐
  Phase 1:  1 (skeleton) ──→ 2 (SQLite)                          │
  Phase 2:  2 ──→ 3 ──→ 3c ──→ 3d                                │
  Phase 3:  3c ──→ 3b ──→ 4 ──→ 4a ──→ 4b ──→ 4c ──→ 5 ──→ 6   │
            spikes ──→ 6b (AI SDK pivot)                          │
──────────────────────────────────────────────────────────────────┘
                        │
Phase 4:  6b ──→ 6b1 (workspace oracle) ──→ 6c (live streaming fix)
          6c ──→ 6d (flexible turn-response model)
          6d ──→ 6e (generic knowledge layer)
          6e ──→ 6f (phase-aware observer)
Phase 5:  6f ──┬──→ 7 (explicit phase outcomes + scope closure)
                └──→ 7a (knowledge-layer redesign spike) ──→ 7b (canonical knowledge foundation)
          7 ────┐
          7b ───┴──→ 8 (design mode) ──→ 9 (requirements-review) ──→ 10.1 (criteria grounding)
                                                          10.1 ──→ 10.2 (criterion review + closeability)
                                                          10.2 ──→ 10.3 (criteria closure)
Phase 6:  7 ──┐
          8 ──┼──→ 11a (project dashboard workflow state)
          9 ──┤
          10.3 ─┘
          7b ──→ 12 (knowledge workspace review surface + lifecycle API)
          10.3 ──→ 12
          10.3 ──→ 13 (export)
          12 ──┬──→ 13a (review lifecycle refinement)
          13 ──┘
Phase 7:  13 ──→ 14 (npx + CLI)
Phase 8:  14 ──→ 15 (drizzle-kit audit remediation)
```

### Parallelism opportunities

- With 7, 7a, 7b, 8, and 9 all done, the next primary slice is 10.1 (criteria grounding + first synthesis/review loop).
- 10.2 and 10.3 should follow linearly; they are intentionally the minimum slices needed to unblock completed interview flow rather than separate variants of the same review seam.
- 11a (project dashboard workflow state) can begin once 10.3 lands; it does not need the broader knowledge workspace.
- 12 (knowledge workspace) and 13 (export) can proceed in parallel once 10.3 stabilizes the criteria artifacts and completed-workflow state.
- 13a (review lifecycle refinement) is explicitly deferred; it should collect rarer review variants after 12 and 13 stabilize rather than fragmenting slices 9 and 10.
- 14 (npx) can start early with a basic launcher, completing after slice 13 when the export predicate stabilizes.
- 15 (drizzle-kit audit remediation) should wait until 14 lands.
