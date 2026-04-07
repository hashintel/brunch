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
6b. **AI SDK-native chat pivot** `FE-559` `done` — I21↑, I22↑, I23↑; core tools spike proven (A29)
6b1. **Workspace seam characterization oracle** `done` — I24, I25
    - Purpose: add a client integration harness around the interview workspace before the state-ownership refactor
    - Coverage: initial hydration from persisted turns, same-project refresh stability, observer-result sidebar reactivity, option-selection follow-through
    - Unblocks: 6c live streaming fix, workspace state-ownership refactor commits

## Phase 4: Interaction + Knowledge Foundations

<!-- The live rendering regression must be fixed first. Then the interview model widens:
     richer answer semantics, generic knowledge capture, and phase-aware observer behavior. -->

### Slices

6c. **Live streaming fix** — Fix the turn-card rendering regression: during live SSE streaming, the structured turn card does not render until page refresh. Thinking streams live; server persists correctly; hydration from DB works. Root cause is in the interaction between `toUIMessageStream()`, `useChat` part accumulation, and the tool-part lifecycle. `done`
    - Requirements: → SPEC.md §Requirements #2, #3, #4
    - Assumptions: → SPEC.md §Assumptions A16, A28
    - Candidate invariant goals: live tool-part rendering matches persisted state after refresh
    - Invariants to respect: → SPEC.md §Invariants I16, I17, I18, I22
    - Invariants established: → SPEC.md §Invariants I43
    - Acceptance: send a message in dev, see the structured turn card appear live without refresh; `npm run verify` passes
    - **Observed current state (2026-04-07, post-build):** the workspace controller now projects the latest streamed `tool-ask_question` input into the visible `TurnCard` before `onFinish` route invalidation, targeted regression tests (`InterviewWorkspace`, `workspace-controller`, `workspace-data`, `app`) are green, the branch's latest full `npm run verify` passed before the docs-only SPEC commit, and manual browser verification confirmed the live turn card now appears without refresh.
    - **Observed code seam:** `InterviewWorkspace.renderParts()` still drops `tool-ask_question` transcript parts, but `workspace-controller-core.ts` now projects the latest streamed tool input into a temporary visible turn card while loading; durable loader state still owns the post-finish turn card after router invalidation.
    - **Recommended next move for the implementing agent:** retire 6c and move on to 6d's response-model remodeling work.
    - **Verification approach**: inner — unit/integration tests for tool-part state transitions or alternate live render path. Outer — manual interview: turn card renders live, matches post-refresh state.

6d. **Flexible turn-response model** — Replace the single-select answer assumption with typed turn responses that support zero/one/many selections plus unified free-text response content. Keep structured interviewer guidance, recommendation, and strategic grounding, but stop assuming every turn maps to one categorical choice or one scalar answer string. `done`
    - Requirements: → SPEC.md §Requirements #3, #6
    - Assumptions: → SPEC.md §Assumptions A16, A28, A33
    - Decisions: → SPEC.md §Decisions D23, D24, D25, D45, D46, D47, D48
    - Candidate invariant goals: turn-response payload round-trip fidelity; multi-select/custom-answer state hydrates and replays correctly
    - Invariants to respect: → SPEC.md §Invariants I17, I18, I19, I22
    - Invariants established: → SPEC.md §Invariants I44, I45, I46, I47
    - Acceptance: a turn can be answered with one-or-more selections plus optional free-text response or with zero selections plus required free-text response; transcript, persistence, interviewer context, and resume stay aligned
    - **Observed current state (2026-04-07, tracer bullets 1–3):** zero/one/many selected options plus optional free-text now persist as `data-turn-response`, store a user-visible summary seam, rehydrate through the workspace path, and project into interviewer context coherently. The client turn card now stages many selections locally and submits them through the same turn-response seam as the other remodeled paths.
    - **Verification approach**: inner — response-schema + projection characterization tests (`SPEC.md` §Verification Design, inner loop) prove cardinality and response-shaped context projection; middle — round-trip integration from submit → persistence → hydration → interviewer-context composition (`SPEC.md` §Verification Design, middle loop) validates A33 while protecting I17, I18, I19, and I22; outer — manual interview with zero/one/many option responses plus free-text-only replies confirms coherent follow-through (`SPEC.md` §Verification Design, outer loop).
    - Tracer bullets:
      - `6d.1` Single selected option + optional free-text response. `done`
      - `6d.2` Zero selections + required free-text-only response. `done`
      - `6d.3` True many-selection UX + persistence/hydration. `done`

6e. **Generic knowledge layer schema + sidebar projection** — Introduce the broader semantic layer (`framing`, `constraint`, `decision`, `assumption`, `requirement`, `criterion`) with generic provenance and graph edges, then project it cleanly into the sidebar without regressing existing reads. `done`
    - Requirements: → SPEC.md §Requirements #5, #6, #14
    - Assumptions: → SPEC.md §Assumptions A14, A34, A35
    - Decisions: → SPEC.md §Decisions D5, D13, D25, D49, D50, D51
    - Candidate invariant goals: generic knowledge-item persistence with turn linkage; graph-edge fidelity across item kinds
    - Invariants to respect: → SPEC.md §Invariants I20, I21, I23, I34
    - Invariants established: → SPEC.md §Invariants I48, I49, I50, I51, I52, I53
    - Acceptance: project state can load and display generic knowledge items and edges from the active path without losing current resume behavior
    - **Observed current state (2026-04-07, tracer bullets 1–2b):** generic `knowledge_item` + `turn_knowledge_item` persistence now carries `framing`, `constraint`, `requirement`, and `criterion` items with subtype/rationale metadata, `/api/projects/:id/entities` returns those kind-specific collections plus a typed `relationships[]` projection alongside legacy decisions/assumptions, and the workspace sidebar renders Framing, Constraints, Requirements, Criteria, Decisions, and Assumptions tabs without regressing existing dependency affordances.
    - **Verification approach**: inner — DB/core tests for generic item persistence and relationship projection. Middle — workspace integration tests for sidebar hydration and dependency rendering.
    - Tracer bullets:
      - `6e.1` Framing items through the generic knowledge seam. `done`
      - `6e.2a` Legacy dependency edges through the generic entity seam. `done`
      - `6e.2b` Remaining kind widening through the sidebar seam. `done`

6f. **Phase-aware observer extraction** — Teach the observer to bias extraction by mode: scope prefers framing/constraints, design prefers decisions/assumptions, later modes can surface requirements/criteria and revisions. Keep the observer as a single structured extraction pass, but give it richer context and a broader ontology. `in-progress`
    - Requirements: → SPEC.md §Requirements #5, #6, #11, #12
    - Assumptions: → SPEC.md §Assumptions A14, A20
    - Decisions: → SPEC.md §Decisions D4, D5, D13, D25, D52
    - Candidate invariant goals: observer extracts framing without assumption inflation; phase-aware extraction deltas stay attributable to source turns
    - Invariants to respect: → SPEC.md §Invariants I20, I21, I23
    - **Observed current state (2026-04-07, tracer bullet 6f.1):** scope-mode observer output now widens to generic `framing`, the observer context includes existing framing alongside legacy decisions/assumptions, persisted assistant parts and SSE `data-observer-result` payloads carry created framing IDs, and sidebar invalidation can refetch and render observer-created framing through the generic entity seam.
    - Acceptance: scope turns primarily yield framing/constraints; design turns primarily yield decisions/assumptions; observer results still stream in-band to the sidebar
    - **Verification approach**: inner — schema + DB/parts tests prove widened observer contracts and generic persistence; middle — mocked observer-sync round-trip proves observer result → entities API → sidebar refresh coherence without gating on live-model quality; outer — manual scope/design walkthroughs judge ontology fit and seed future observer fixtures. See SPEC.md §Verification Design.
    - Tracer bullets:
      - `6f.1` Scope-mode framing extraction through the generic observer seam. `done`
        - Invariants established: → SPEC.md §Invariants I54, I55
      - `6f.2` Scope-mode constraint extraction through the generic observer seam. `not-started`
      - `6f.3` Design-mode observer bias over decisions/assumptions with generic spillover. `not-started`
      - `6f.4` Later-mode requirement/criterion emergence through the observer seam. `not-started`

## Phase 5: Mode Closure + Full Interview

<!-- Once turns and knowledge capture fit the real interview, add explicit readiness artifacts,
     then implement the remaining workflow modes on top of that foundation. -->

### Slices

7. **Explicit phase outcomes + scope closure** — Replace pure `is_resolution` semantics with explicit phase outcomes and user-confirmed scope closure. Scope mode closes when framing sufficiency is reached, not just when the model feels done. `not-started`
   - Requirements: → SPEC.md §Requirements #7, #8
   - Assumptions: → SPEC.md §Assumptions A15, A28
   - Decisions: → SPEC.md §Decisions D2, D3, D6
   - Candidate invariant goals: confirmed scope outcome survives refresh and invalidates correctly when upstream turns change
   - Invariants to respect: → SPEC.md §Invariants I18, I24, I25
   - Acceptance: scope mode proposes closure with a summary, user confirms, explicit phase outcome persists, and the project shows updated workflow state
   - **Verification approach**: inner — DB/core tests for phase outcome lifecycle. Outer — manual closure/confirmation walkthrough.

8. **Design mode (commitment / exploration)** — Implement the second workflow mode on the new turn and knowledge model. The interviewer walks design forks; the observer captures decisions, assumptions, new constraints, and emerging requirements. `not-started`
   - Requirements: → SPEC.md §Requirements #2, #3, #5, #6
   - Assumptions: → SPEC.md §Assumptions A14, A15, A28
   - Decisions: → SPEC.md §Decisions D2, D5, D6
   - Candidate invariant goals: mode transition preserves interview continuity; design-mode turns produce coherent decision/assumption graph growth
   - Invariants to respect: → SPEC.md §Invariants I18, I19, I21, I22
   - Acceptance: after confirmed scope closure, the interview enters design mode; design turns yield coherent commitments and assumptions and can propose design closure
   - **Verification approach**: inner — mode-transition/controller tests. Outer — manual design walkthrough from a confirmed scope session.

9. **Requirements-review mode** — Synthesize the requirement set from the full knowledge layer, then let the user approve, edit, merge, reject, and add requirements through review turns. `not-started`
   - Requirements: → SPEC.md §Requirements #6, #11, #13
   - Assumptions: → SPEC.md §Assumptions A15, A28
   - Decisions: → SPEC.md §Decisions D2, D5, D6
   - Candidate invariant goals: requirements are capture-anytime but review-complete only through explicit review state
   - Invariants to respect: → SPEC.md §Invariants I18, I19, I21, I24
   - Acceptance: requirements-review mode presents a synthesized requirement set, records explicit approval/edit state, and can close only when in-scope requirements are resolved
   - **Verification approach**: inner — review-state lifecycle tests. Outer — manual requirement review with approvals, edits, and missing-item additions.

10. **Criteria-review mode** — Synthesize verification conditions from approved requirements plus any earlier criteria-like signals, then drive review turns until coverage is complete. `not-started`
     - Requirements: → SPEC.md §Requirements #6, #12, #13
     - Assumptions: → SPEC.md §Assumptions A15, A28
     - Decisions: → SPEC.md §Decisions D2, D5, D6, D17
     - Candidate invariant goals: criteria verify requirements explicitly and track review completeness separately from requirement state
     - Invariants to respect: → SPEC.md §Invariants I18, I19, I21, I24
     - Acceptance: criteria-review mode presents synthesized criteria, records explicit review state, and can close only when approved requirements have sufficient verification coverage
     - **Verification approach**: inner — criterion/review edge tests. Outer — manual criteria review with edits and coverage checks.

## Phase 6: Revisit + Export

<!-- Generalize revisit semantics from decisions-only branching to active-path readiness invalidation,
     then export from the reviewed knowledge layer. -->

### Slices

11. **Generalized revisit: branch + readiness invalidation** — Revisit any earlier turn, not just a decision card. Branch from that turn, restore the interview there, and invalidate downstream phase outcomes / review state from the affected frontier. `not-started`
    - Requirements: → SPEC.md §Requirements #9, #10, #13
    - Assumptions: → SPEC.md §Assumptions A6
    - Decisions: → SPEC.md §Decisions D1, D3, D17
    - Candidate invariant goals: active-path switch hides abandoned-branch readiness; downstream stale state is attributed to the correct frontier
    - Invariants to respect: → SPEC.md §Invariants I9, I10, I24, I25
    - Acceptance: revisit a scope/design/review turn, new branch created, interview resumes from that point, and downstream closure/review state becomes stale until re-walked
    - **Verification approach**: inner — branching + readiness invalidation tests. Outer — manual revisit across multiple modes.

12. **Knowledge review lifecycle API + sidebar edits** — CRUD/review endpoints for the broader knowledge layer. Editing or reviewing items should be provenance-bearing and update readiness state without becoming invisible side mutations. `not-started`
    - Requirements: → SPEC.md §Requirements #6, #11, #12, #13
    - Assumptions: → SPEC.md §Assumptions A14
    - Decisions: → SPEC.md §Decisions D5, D17
    - Candidate invariant goals: review/edit actions are reflected in both knowledge state and readiness state; sidebar writes are visible and recoverable
    - Invariants to respect: → SPEC.md §Invariants I23, I36, I41, I42
    - Acceptance: edit/review framing, constraints, requirements, or criteria from the sidebar; affected readiness updates visibly and persists across refresh/resume
    - **Verification approach**: inner — mutation + invalidation tests. Outer — manual sidebar edit/review walkthrough.

13. **Spec export from the reviewed knowledge layer** — Render markdown export from active-path, reviewed knowledge items and explicit phase outcomes. Export is enabled only when the new readiness predicate is satisfied. `not-started`
    - Requirements: → SPEC.md §Requirements #13
    - Assumptions: —
    - Decisions: → SPEC.md §Decisions D5, D17, D26
    - Candidate invariant goals: export reflects active-path reviewed knowledge only; readiness predicate gates export correctly
    - Invariants to respect: → SPEC.md §Invariants I18, I21
    - Acceptance: complete all modes, satisfy review completeness, navigate to export, see markdown preview from the reviewed knowledge layer, download `.md` file
    - **Verification approach**: inner — export projection tests. Outer — manual export after a full walkthrough and after a revisit-induced stale state.

## Phase 7: Distribution

<!-- Package and ship. -->

### Slices

14. **npx distribution + CLI** — `bin` entry, launcher starts Express (serves built Vite assets + API on one port), opens browser. `npx brunch` for web UI. `npx brunch [command]` for CLI operations. Single env var: `ANTHROPIC_API_KEY`. `not-started`
    - Requirements: → SPEC.md §Requirements #1
    - Decisions: → SPEC.md §Decisions D20
    - Candidate invariant goals: packaged launcher preserves working DB lifecycle and browser boot flow
    - Invariants to respect: → SPEC.md §Invariants I1, I2, I4, I5
    - Acceptance: `npx brunch` with key in scope opens working app

## Horizon

<!-- Future work not yet broken into slices. Revisit after Phase 7. -->

- CLI interactive interview mode (terminal-based interview using core's DomainEvent stream)
- MCP server adapter (expose core operations as MCP tools)
- Turn tree visualization (git-log-style branch graph in sidebar)
- Knowledge graph visualization (framing / constraints / decisions / requirements / criteria view)
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
Phase 5:  6f ──→ 7 (explicit phase outcomes + scope closure)
          7 ──→ 8 (design mode) ──→ 9 (requirements-review) ──→ 10 (criteria-review)
Phase 6:  7 ──→ 11 (generalized revisit)
          9 ──→ 12 (knowledge review lifecycle API)
          10 ──→ 13 (export)
Phase 7:  13 ──→ 14 (npx + CLI)
```

### Parallelism opportunities

- 6c (live streaming fix) and design work on 6d (flexible turn-response model) are mostly independent if 6d does not need to rewrite the live tool-part rendering seam.
- 6e (generic knowledge layer) can begin in parallel with 6d after agreeing on the payload shape boundary.
- 11 (generalized revisit) can begin once explicit phase outcomes (7) exist; it does not need requirements/criteria review UX to start proving readiness invalidation mechanics.
- 14 (npx) can start early with a basic launcher, completing after slice 13 when the new export predicate stabilizes.
