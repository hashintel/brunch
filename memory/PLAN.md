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

## Phase 4: Interaction + Knowledge Foundations `done`

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
    - Assumptions: → SPEC.md §Assumptions A14
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

6f. **Phase-aware observer extraction** — Teach the observer to bias extraction by mode: scope prefers framing/constraints, design prefers decisions/assumptions, later modes can surface requirements/criteria and revisions. Keep the observer as a single structured extraction pass, but give it richer context and a broader ontology. `done`
    - Requirements: → SPEC.md §Requirements #5, #6, #11, #12
    - Assumptions: → SPEC.md §Assumptions A14, A20
    - Decisions: → SPEC.md §Decisions D4, D5, D13, D25, D52, D53, D54, D55, D56
    - Candidate invariant goals: observer extracts framing without assumption inflation; phase-aware extraction deltas stay attributable to source turns
    - Invariants to respect: → SPEC.md §Invariants I20, I21, I23
    - **Observed current state (2026-04-08, tracer bullets 6f.1–6f.4b):** scope-mode observer output now widens to generic `framing` and `constraint`, design-mode observer prompting biases toward legacy `decision`/`assumption` extraction while allowing framing corrections and constraint spillover, requirements-mode observer prompting can now surface generic `requirement` items while deferring premature criteria, and criteria-mode observer prompting can now surface generic `criterion` items without collapsing them back into requirements. The observer context includes existing framing/constraints/requirements/criteria alongside legacy decisions/assumptions, persisted assistant parts and SSE `data-observer-result` payloads carry mixed framing/constraint/requirement/criterion/decision/assumption IDs, and sidebar invalidation can refetch and render those observer-created entities through the shared entity seam, including the `Criteria` tab.
    - Acceptance: scope turns primarily yield framing/constraints; design turns primarily yield decisions/assumptions; later review turns can surface requirements/criteria without breaking observer sync; observer results still stream in-band to the sidebar
    - **Verification approach**: inner — schema + DB/parts tests prove widened observer contracts and generic persistence; middle — mocked observer-sync round-trip proves observer result → entities API → sidebar refresh coherence without gating on live-model quality; outer — manual scope/design/requirements/criteria walkthroughs judge ontology fit and seed future observer fixtures. See SPEC.md §Verification Design.
    - Tracer bullets:
      - `6f.1` Scope-mode framing extraction through the generic observer seam. `done`
        - Invariants established: → SPEC.md §Invariants I54, I55
      - `6f.2` Scope-mode constraint extraction through the generic observer seam. `done`
        - Invariants established: → SPEC.md §Invariants I56, I57
      - `6f.3` Design-mode observer bias over decisions/assumptions with generic spillover. `done`
        - Invariants established: → SPEC.md §Invariants I58, I59
      - `6f.4a` Requirements-mode requirement emergence through the generic observer seam. `done`
        - Invariants established: → SPEC.md §Invariants I60, I61
      - `6f.4b` Criteria-mode criterion emergence through the generic observer seam. `done`
        - Invariants established: → SPEC.md §Invariants I62, I63

## Phase 5: Mode Closure + Full Interview

<!-- Once turns and knowledge capture fit the real interview, add explicit readiness artifacts.
     Slice 7 can proceed on the current foundation, but later mode/review slices should not harden
     the transitional `framing`-based ontology or mixed legacy/generic knowledge seam; retire that
     design risk before treating the remaining workflow modes as shape-stable. -->

### Slices

7. **Explicit phase outcomes + scope closure** — Replace pure `is_resolution` semantics with explicit phase outcomes and user-confirmed scope closure. Scope mode closes when sufficient shared understanding of goals, terms, context, and constraints is reached, not just when the model feels done. `done`
   - Requirements: → SPEC.md §Requirements #7, #8
   - Assumptions: → SPEC.md §Assumptions A15, A28
   - Decisions: → SPEC.md §Decisions D2, D3, D6, D62, D65, D66
   - Candidate invariant goals: confirmed scope outcome survives refresh and invalidates correctly when upstream turns change
   - Invariants to respect: → SPEC.md §Invariants I18, I24, I25
   - Invariants established: → SPEC.md §Invariants I72, I73
   - Acceptance: scope mode proposes closure with a summary over the current scope knowledge family, user confirms, explicit phase outcome persists, and the project shows updated workflow state
   - **Observed current state (2026-04-08, slice 7):** scope-mode interviewer turns can now persist explicit `phase_outcome` proposal records in a dedicated readiness table, stream/persist typed `data-phase-summary` artifacts, confirm those proposals through typed `data-confirmation` chat parts, project workflow state from the active path, and supersede outcomes when their proposal turn leaves the active path. The workspace header now shows scope status, suppresses the normal prompt while a closure proposal is pending, and renders a dedicated confirmation card wired to the chat seam. This establishes the durable proposal/confirmation substrate only; shared closeability/readiness/closure-basis semantics are folded into slices 8, 11a, and 13 rather than reopening slice 7.
   - **Verification approach**: inner — schema + DB/core/parts tests for explicit phase-outcome proposal/confirmation contracts and lifecycle. Middle — round-trip + model-based lifecycle oracles prove submit → persistence → reload → workspace projection and supersession on upstream branch changes. Outer — manual closure/confirmation walkthrough deferred until after 7a.

7a. **Knowledge-layer redesign spike (ontology + graph + workspace direction)** — Retire the current `framing` umbrella and mixed legacy/generic storage risk by specifying the canonical knowledge ontology, cross-kind graph model, and non-sidebar-first review surface before design/review modes harden today's transitional semantics. `done`
   - Requirements: → SPEC.md §Requirements #5, #6, #11, #12, #13
   - Assumptions: → SPEC.md §Assumptions A14, A15
   - Decisions: → SPEC.md §Decisions D5, D17, D59, D61, D62, D63, D64, D67, D68, D69
   - Candidate invariant goals: later Phase 5/6 slices can treat the knowledge layer as one coherent semantic model rather than a provisional migration seam
   - Invariants to respect: → SPEC.md §Invariants I20, I21, I23, I68
   - Acceptance: produce an approved target model for canonical kinds, cross-kind edges, storage direction, and knowledge-workspace boundaries, plus a migration path that keeps slice 7 valid while gating slices 8–10 and 12 on the redesign
   - **Observed current state (2026-04-09, spike verdict):** the canonical durable ontology should be `goal`, `term`, `context`, `constraint`, `assumption`, `decision`, `requirement`, and `criterion`; `framing` is demoted to a migration-only intake alias rather than a final stored kind. The long-term storage direction is one generic knowledge-item/readiness model plus one generic cross-kind edge model, with a compatibility projection that preserves slice 7's `phase_outcome` closure mechanics by summarizing a scope bundle over canonical kinds and any unmigrated legacy `framing` rows. The primary review UX should be a dedicated knowledge workspace with phase-oriented list/detail review; the sidebar remains summary/navigation, not the main review surface.
   - **Recommendation:** land a canonical knowledge foundation slice before design/review mode work so the migration seam is explicit rather than hidden inside slice 8.
   - **Verification approach**: inner — concrete model examples and seam inventory reviewed against SPEC lexicon/decisions. Outer — design review over representative knowledge items and graph relationships to prove the ontology is discriminable and useful.

7b. **Canonical knowledge model foundation + cutover seam** — Introduce canonical `goal` / `term` / `context` kinds, unify durable knowledge storage and cross-kind edges behind the generic seam, and preserve slice 7 coherence through the smallest necessary compatibility projection rather than migration-hardening legacy scratch data. `done`
   - Requirements: → SPEC.md §Requirements #5, #6, #7, #11, #12, #13
   - Assumptions: → SPEC.md §Assumptions A14, A40, A41
   - Decisions: → SPEC.md §Decisions D5, D17, D49, D51, D52, D53, D54, D59, D61, D62, D63, D67, D68, D69
   - Candidate invariant goals: canonical knowledge writes/readiness coexist with scope closure during cutover; no new Phase 5/6 slice depends on durable `framing`
   - Invariants to respect: → SPEC.md §Invariants I20, I21, I23, I68, I72
   - Invariants established: → SPEC.md §Invariants I74, I75, I76, I77, I78
   - Acceptance: schema/registry/context/API can represent all eight canonical kinds plus generic cross-kind edges; scope closure still reads a coherent scope bundle; no new writes rely on durable `framing` or decision/assumption-only edge semantics; destructive schema reset remains acceptable
   - **Observed current state (2026-04-09, tracer bullets 7b.1 + 7b.2):** the shared knowledge registry, observer-result payload schema, scope-mode observer output, entities API, workspace entity state, and sidebar tabs now use canonical `goal` / `term` / `context` / `constraint` collections on a clean DB rather than durable `framing` rows. Design-mode observer prompting still biases toward `decision` / `assumption` extraction, but those commitments now persist through `knowledge_item` / `turn_knowledge_item` / `knowledge_edge` instead of legacy decision/assumption tables and edge joins. The shared entities API preserves dedicated `decisions` / `assumptions` collections as compatibility projections, and an explicit canonical scope-bundle projection remains available so the slice-7 `phase_outcome` readiness seam stays intact during the cutover.
   - **Verification approach**: inner — schema/registry/core/API tests for canonical kinds, generic edges, and the minimal scope-closure compatibility projection. Middle — workspace/entity projection tests for canonical scope kinds on a clean DB. Outer — manual inspection of a representative project's scope bundle and carry-forward into the next mode.
   - Tracer bullets:
     - `7b.1` Canonical scope kinds through the generic seam. `done`
     - `7b.2` Generic edge/storage cutover + scope-readiness compatibility projection beyond legacy decision/assumption tables. `done`

8. **Design mode (commitment / exploration)** — Implement the second workflow mode on the new turn and canonical knowledge model after 7b lands, while generalizing the current scope-only proposal/confirmation seam into a shared phase-closing model with deterministic closeability, coarse readiness bands, and explicit closure basis. The interviewer walks design forks; the observer captures decisions, assumptions, new constraints, and emerging requirements against the unified knowledge seam. `in-progress`
   - Requirements: → SPEC.md §Requirements #2, #3, #5, #6, #7, #8
   - Assumptions: → SPEC.md §Assumptions A14, A15, A28, A40
   - Decisions: → SPEC.md §Decisions D2, D5, D6, D61, D62, D65, D66, D67, D68, D70, D71, D72, D73, D74, D75
   - Candidate invariant goals: mode transition preserves interview continuity; design-mode turns produce coherent decision/assumption graph growth on the canonical knowledge seam; phase-closing state separates status, closeability, readiness, and closure basis instead of hidden interviewer authority
   - Invariants to respect: → SPEC.md §Invariants I18, I19, I21, I22, I72, I73
   - Invariants established: → SPEC.md §Invariants I79, I80, I81, I82, I83, I84, I85
   - Acceptance: after scope closes and slice 7b lands, the interview enters design mode; design turns yield coherent commitments and assumptions on the canonical knowledge layer; the UI projects design status/closeability/readiness; and once the minimum bar is met the user can either accept an interviewer-recommended close or force-close design with persisted closure basis/readiness snapshot
   - **Observed current state (2026-04-09, tracer bullets 8.1–8.3 + refactor commits 1–5):** confirmed scope closure now projects through a shared workflow state carrying `status`, `closeability`, `readiness`, `closureBasis`, and pending-proposal visibility instead of the old scope-only `open/proposed/confirmed` seam. The next prepared turn after confirmed scope closure now enters `design` automatically, the observer runs against that design turn phase, and the workspace header renders shared workflow summaries for closed scope plus the newly active design phase rather than hardcoding scope-only status copy. Design now also uses the same typed `data-phase-summary` closure seam as scope: the design interviewer can recommend closure, the workflow projects a pending design summary through the shared phase state, confirmation persists design closure, and the next prepared turn enters `requirements`. That same typed confirmation seam now also carries a user-forced design close with visible `closureBasis: user_forced`, so forced-close debt survives refresh/resume and still hands the next prepared turn into `requirements`. Since those tracer bullets landed, the seam has also been hardened by `memory/REFACTOR.md`: close intent first moved into explicit shared phase-close commands, force-close availability now projects from one shared workflow-policy seam consumed by both UI and server validation, confirmed `phase_outcome` rows persist durable `closure_basis`, read-side workflow projection now trusts that durable phase-outcome field instead of reconstructing provenance from confirmation-turn payloads, and the `data-confirmation` transport itself is now an explicit discriminated command union consumed consistently by the workspace controller and `/chat` request handling.
   - **Verification approach**: inner — mode-transition/controller/workflow-state projection tests. Outer — manual design walkthrough covering interviewer-recommended close, user-forced close, and visible carried-debt caveats.
   - Tracer bullets:
     - `8.1` Design-mode entry + shared workflow-state projection. `done`
     - `8.2` Design-phase closure proposal + requirements handoff. `done`
     - `8.3` User-forced design close + carried-debt projection. `done`

9. **Requirements-review mode** — Synthesize the requirement set from the full canonical knowledge layer, then let the user approve, edit, merge, reject, and add requirements through review turns using the shared phase-closing seam rather than a requirements-only completion bit. This slice assumes the redesigned ontology/graph from 7a + 7b, not the current transitional `framing` seam. `not-started`
   - Requirements: → SPEC.md §Requirements #6, #7, #8, #11, #13
   - Assumptions: → SPEC.md §Assumptions A15, A28, A40
   - Decisions: → SPEC.md §Decisions D2, D5, D6, D61, D62, D65, D66, D67, D68, D69, D70
   - Candidate invariant goals: requirements are capture-anytime but review-complete only through explicit review state; requirements workflow state stays legible as status + closeability + readiness + closure basis
   - Invariants to respect: → SPEC.md §Invariants I18, I19, I21, I24
   - Acceptance: requirements-review mode presents a synthesized requirement set from canonical knowledge items, records explicit approval/edit state, projects requirements status/closeability/readiness, and lets the user close once the minimum bar is met while carrying unresolved debt forward visibly when readiness is low
   - **Verification approach**: inner — review-state + workflow-state lifecycle tests. Outer — manual requirement review with approvals, edits, missing-item additions, and a low-readiness forced-close walkthrough.

10. **Criteria-review mode** — Synthesize verification conditions from approved requirements plus any earlier criteria-like signals, then drive review turns until coverage is complete using the shared phase-closing seam rather than a criteria-only completion bit. This slice assumes the redesigned ontology/graph from 7a + 7b, not the current transitional `framing` seam. `not-started`
     - Requirements: → SPEC.md §Requirements #6, #7, #8, #12, #13
     - Assumptions: → SPEC.md §Assumptions A15, A28, A40
     - Decisions: → SPEC.md §Decisions D2, D5, D6, D17, D61, D62, D65, D66, D67, D68, D69, D70
     - Candidate invariant goals: criteria verify requirements explicitly and track review completeness separately from requirement state; criteria workflow state stays legible as status + closeability + readiness + closure basis
     - Invariants to respect: → SPEC.md §Invariants I18, I19, I21, I24
     - Acceptance: criteria-review mode presents synthesized criteria from the canonical knowledge layer, records explicit review state, projects criteria status/closeability/readiness, and lets the user close once the minimum bar is met while preserving caveats when verification coverage remains thin
     - **Verification approach**: inner — criterion/review edge + workflow-state tests. Outer — manual criteria review with edits, coverage checks, and a low-readiness forced-close walkthrough.

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
     - Invariants to respect: → SPEC.md §Invariants I24, I25, I36, I41, I42
     - Acceptance: the project list shows each project's per-phase status/readiness/closure-basis summary from persisted readiness artifacts plus live workflow projection, distinguishes forced-close or low-readiness debt from ordinary closed state, and updates correctly after refresh/resume
     - **Verification approach**: inner — workflow-summary projection tests plus project-list route/component tests. Outer — manual multi-project walkthrough covering in-progress, forced-close debt, invalidated, and export-ready states.

12. **Knowledge workspace review surface + lifecycle API** — CRUD/review endpoints for the broader knowledge layer plus a fit-for-purpose workspace for inspecting, editing, and reviewing graph-shaped knowledge. The sidebar may remain a summary/navigation view, but the primary interaction model should no longer assume a narrow tab strip. This slice assumes the redesigned knowledge ontology/graph from 7a + 7b. `not-started`
     - Requirements: → SPEC.md §Requirements #6, #11, #12, #13
     - Assumptions: → SPEC.md §Assumptions A14, A40
     - Decisions: → SPEC.md §Decisions D5, D17, D61, D63, D67, D68, D69
     - Candidate invariant goals: review/edit actions are reflected in both knowledge state and readiness state; the knowledge workspace can present graph relationships and review actions without lossy sidebar compression
     - Invariants to respect: → SPEC.md §Invariants I23, I36, I41, I42
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
          7b ───┴──→ 8 (design mode) ──→ 9 (requirements-review) ──→ 10 (criteria-review)
Phase 6:  7 ──┐
          8 ──┼──→ 11a (project dashboard workflow state)
          9 ──┤
          10 ─┘
          7b ──→ 12 (knowledge workspace review surface + lifecycle API)
          9  ──→ 12
          10 ──→ 13 (export)
Phase 7:  13 ──→ 14 (npx + CLI)
Phase 8:  14 ──→ 15 (drizzle-kit audit remediation)
```

### Parallelism opportunities

- 7 (explicit phase outcomes + scope closure) and 7a (knowledge-layer redesign spike) can proceed in parallel: 7 establishes workflow closure mechanics, while 7a retires the ontology/graph/workspace risk that would otherwise leak into later mode and review slices.
- With 7b landed, 8 (design mode + shared phase-closing model) is now the next primary unblocked slice. 12 still waits on the later reviewed-artifact path in 9/10 even though the canonical knowledge foundation is now in place.
- 11a (project dashboard workflow state) can begin once the workflow-state artifacts from 7/8/9/10 exist; it does not need the broader knowledge workspace to surface durable project status, readiness bands, and carried-debt caveats.
- 12 (knowledge workspace review surface + lifecycle API) and 13 (export) can proceed in parallel once 7b and the requirements/criteria review artifacts stabilize, because the first reviewed export path does not require the full knowledge workspace to land first.
- 14 (npx) can start early with a basic launcher, completing after slice 13 when the new export predicate stabilizes.
- 15 (drizzle-kit audit remediation) should wait until 14 lands, so packaging/distribution regressions can be judged on the real shipped path instead of the current dev-only setup.
