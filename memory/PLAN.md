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
    - Shipped: workspace controller projects streamed `tool-ask_question` into visible turn card before durable route refresh
    - Established: I24 (workspace seam)

6d. **Flexible turn-response model** `done`
    - Shipped: `data-turn-response` parts carry zero/one/many selections + free-text; workspace stages multi-select locally
    - Established: I44 (turn response seam)

6e. **Generic knowledge layer schema + sidebar projection** `done`
    - Shipped: `knowledge_item` + `turn_knowledge_item` + `knowledge_edge` persistence; kind-specific entity collections + typed relationships
    - Established: I48 (generic knowledge seam)

6f. **Phase-aware observer extraction** `done`
    - Shipped: observer biases extraction by phase — scope→goals/terms/contexts/constraints, design→decisions/assumptions, requirements→requirements, criteria→criteria
    - Established: I54 (observer widening seam)

## Phase 5: Mode Closure + Full Interview `done`

### Slices

7. **Explicit phase outcomes + scope closure** `done`
   - Shipped: durable `phase_outcome` records; `data-phase-summary` + `data-confirmation` chat seams; workspace header phase status
   - Established: I72 (phase-close seam)
   - Debt: shared closeability/readiness/closure-basis generalization folded into slice 8

7a. **Knowledge-layer redesign spike** `done`
   - Shipped: canonical ontology (8 kinds); `framing` demoted to migration alias; primary review UX is dedicated knowledge workspace

7b. **Canonical knowledge model foundation + cutover seam** `done`
   - Shipped: registry/observer/entities/sidebar use canonical kinds; decisions/assumptions persist through generic seam
   - Established: I48 (updated), I54 (updated)

8. **Design mode (commitment / exploration)** `done`
   - Shipped: shared workflow projection replaces scope-only seam; discriminated phase-close commands; force-close + durable closure basis
   - Established: I72 (updated)

9. **Requirements-review mode** `done`
   - Shipped: interviewer grounded in requirement inventory; targeted approve/reject; closeability from full review coverage; shared phase-close reused for requirements → criteria handoff
   - Established: I87 (requirements-review seam)

10.1 **Criteria grounding + first synthesis/review loop** `done`
     - Shipped: criteria interviewer grounded in approved requirements; initial criterion round-trips through observer/entity persistence
     - Established: I97 (criteria-review grounding)

10.2 **Explicit criterion review state + minimal closeability** `done`
     - Shipped: per-criterion approve/reject with latest-action-wins projection; closeability from full criterion review coverage
     - Established: I98 (criteria-review seam)

10.3 **Criteria closure + completed workflow state** `done`
     - Shipped: shared phase-close seam closes criteria; all four phases project `closed` with no stale active phase
     - Established: I99 (criteria closure)

## Phase 6: Readiness Surfaces + Export

<!-- Surface readiness outside the workspace, add a broader knowledge workspace/review surface,
     then export from the reviewed knowledge layer. Knowledge-graph revisit is now Phase 8. -->

### Slices

11a. **Project dashboard workflow state** `FE-573` `done`
     - Shipped: project list shows per-phase status/readiness/closure-basis from durable phase outcomes + live workflow projection
     - Distinguishes forced-close debt from ordinary closed state

12a. **Knowledge workspace review surface** `FE-574` `done`
     - Shipped: read-only `/project/:id/knowledge` route with kind-grouped items, review badges, and dependency edges
     - First dedicated review surface beyond sidebar

12b. **Spec export from the reviewed knowledge layer** `FE-574` `done`
     - Shipped: markdown export from active-path reviewed knowledge with closure caveats; gated on all phases closed
     - Evidence: export.test.ts, KnowledgeWorkspace.test.tsx

11b. **Fixture scenarios + dev seed CLI** `done`
     - Shipped: shared fixture module + `npm run seed <scenario>` CLI; test files import from shared module
     - 10 programmatic scenarios cover all workflow states

11c. **Rich fixture generation for outer-loop testing** `done`
     - Shipped: JSON manifest seeder with issue-tracker domain (5 scenarios, 27 knowledge items, 14 edges, 24 turns)
     - Evidence: 223 tests pass; all 10 scenarios seed; knowledge workspace + export render from seeded state

13a. **Review lifecycle refinement across requirements + criteria** — Revisit the first-cut review model only after the thin end-to-end path is working, and add the deferred variants that were intentionally excluded from slices 9 and 10 so the app kept moving toward completion. Depends on 12a + 12b. `not-started`
     - Requirements: → SPEC.md §Requirements #11, #12, #13
     - Assumptions: → SPEC.md §Assumptions A15, A40
     - Decisions: → SPEC.md §Decisions D17, D61, D65, D66, D69
     - Candidate invariant goals: richer review actions and invalidation semantics can evolve without regressing the thin end-to-end workflow; deferred edge-case variants are collected in one explicit refinement slice rather than fragmenting earlier mode slices
     - Invariants to respect: → SPEC.md §Invariants I18, I21, I24
     - Acceptance: deferred review refinements such as edit/add/merge/stale semantics across requirements and criteria can land behind one cross-cutting slice without regressing completion, export, or workflow-state coherence
     - **Verification approach**: inner — mutation/read-model/invalidation tests per refinement added. Outer — manual cross-phase review lifecycle walkthrough after the dedicated knowledge workspace exists.

## Phase 7: Distribution + Brownfield + UI Alignment

<!-- Local-first storage, npx distribution, greenfield/brownfield routing, codebase exploration,
     and design-system alignment from the brunch-ui prototype.
     Must-haves for the first delivery deadline. -->

### Slices

17. **UI refinement + design-system alignment** — Port design tokens, layout primitives, card patterns, and component iteration environment from the parallel `brunch-ui` prototype. **Foundation**: Inter Variable font (replacing Geist), Figma-precise color ramp (ink/sub/hint/rule/wash/tint), shadow tokens (card/ring/card-ring), fine-grained typography scale (xxs 10px–sm 16px), font weight discipline (regular/medium/semi-bold only). **Layout shell**: AppHeader, StageSidebar/PhaseSidebar with working collapse/expand toggle, resizable main+right panels via `react-resizable-panels`, AppFooter spanning full width. **Components**: card-within-card pattern (white header / tinted body) for knowledge group cards and question cards; collapsible question card (V2 with inline `why` grounding, answered cards collapse to read-only summary, re-answering routes through revisit model not casual toggle); empty-state vocabulary (6 patterns: text-only, with icon, with CTA, centered hero, inline within list, attention/warning); metadata rows (label-over-value flex columns); badge refinement (mono font, no black-on-color, no all-caps); mandatory skeleton loading for all pending states. **Infrastructure**: Ladle story environment (`.ladle/` config with theme provider, `@source` directives, stories as living component reference), shadcn CLI + `components.json`. **Dependencies**: `@fontsource-variable/inter`, `react-resizable-panels`, `@ladle/react`, `shadcn`. `not-started`
    - Requirements: → SPEC.md §Requirements #4, #5, #7, #9, #15
    - Decisions: → SPEC.md §Decisions D58, D59, D69
    - Candidate invariant goals: design tokens are Figma-authoritative and shared between app and Ladle stories; layout shell supports sidebar collapse/expand without breaking workspace data flow; card patterns are composable across knowledge workspace, interview workspace, and dashboard; empty-state and skeleton patterns are systematic, not ad-hoc; answered question cards visually communicate finality — re-opening to edit is a revisit-model action, not a UI toggle
    - Invariants to respect: → SPEC.md §Invariants I24, I44, I48
    - Acceptance: Inter font renders across all routes; color ramp matches Figma reference values; StageSidebar collapses to PhaseSidebar and back; resizable panels work in interview and knowledge workspaces; at least one Ladle story renders with shared design tokens; question card shows inline `why` with collapsible answered state; empty states appear for all unpopulated sections; skeleton loading renders during route transitions
    - **Verification approach**: inner — Ladle stories as visual regression surface; existing workspace seam tests pass after layout migration. Outer — manual walkthrough comparing rendered UI against Figma reference screens.

14. **Local-first storage + npx distribution** — `resolveBrunchProject()` with shallow walk-up discovery creates/finds `.brunch/` directory. `bin` entry, Express launcher serves built Vite assets + API on one port, opens browser. `npx brunch` for web UI. Single env var: `ANTHROPIC_API_KEY`. `not-started`
    - Requirements: → SPEC.md §Requirements #1, #14
    - Decisions: → SPEC.md §Decisions D10, D20, D81
    - Candidate invariant goals: `.brunch/` discovery works from subdirectories (walk-up); DB lifecycle unchanged after path migration; packaged launcher preserves working app
    - Invariants to respect: → SPEC.md §Invariants I1, I2, I4, I5
    - Acceptance: `npx brunch` in a project directory creates `.brunch/`, opens working app; running from subdirectory finds parent `.brunch/`; `BrunchProject` struct exposes root, dbPath, cwd
    - **Verification approach**: inner — launcher/path-resolution tests plus packaged app smoke checks. Outer — packaged manual walkthrough includes seeded closed-project knowledge/export routes using `forced-close-all-phases-closed` and `low-readiness-all-phases-closed`, so the deferred Phase 6 browser coherence pass lands at the real distribution boundary rather than in the pre-distribution refactor thread.
    - Design: `docs/design/LOCAL_STORAGE.md`

14a. **Greenfield/brownfield first-screen + exploration** — First screen routes between greenfield (blank concept) and brownfield (existing codebase). Project records store `mode` and `cwd`. Brownfield adds core tools to interviewer, brownfield system prompt variant instructs explore-then-interview on first turn. Observer extracts from that turn as usual. `not-started`
     - Requirements: → SPEC.md §Requirements #2, #3, #16
     - Assumptions: → SPEC.md §Assumptions A7, A47
     - Decisions: → SPEC.md §Decisions D32, D82, D83
     - Candidate invariant goals: brownfield first turn is grounded in discovered codebase context; greenfield path is unchanged; observer extracts from exploration turn normally
     - Invariants to respect: → SPEC.md §Invariants I16, I22, I24, I54
     - Acceptance: create brownfield project → agent explores codebase → first scope question is grounded in findings; create greenfield project → existing scope flow unchanged
     - Design: `docs/design/BROWNFIELD_EXPLORATION.md`

## Phase 8: Knowledge-Graph Revisit (stretch)

<!-- Knowledge-graph-level revisit with edit mode, cascade, and secondary threads.
     Stretch goal — may not land before the first delivery deadline.
     Replaces the earlier "generalized revisit" concept (hard turn-tree branching). -->

### Slices

15. **Edit mode + cascade preview** — Knowledge workspace edit mode lets user select items to invalidate/remove. Read-only cascade preview traces knowledge graph edges (BFS over `depends_on`, `derived_from`, `constrains`, `verifies`, `refines`), shows affected items and phases that would reopen. No mutations yet — preview only. `not-started`
    - Requirements: → SPEC.md §Requirements #10
    - Assumptions: → SPEC.md §Assumptions A48
    - Decisions: → SPEC.md §Decisions D5, D17, D80
    - Candidate invariant goals: cascade preview correctly identifies all downstream items via graph edges; preview matches what execution would produce; edit mode is modal (no other edits while active)
    - Invariants to respect: → SPEC.md §Invariants I48
    - Acceptance: enter edit mode, select items, see accurate cascade preview with affected items and phases listed; exit without confirming leaves state unchanged
    - Design: `docs/design/REVISIT_MODULE.md`

15a. **Cascade execution + secondary thread lifecycle** — Confirm cascade → write invalidation records, create `revisit_session`, spawn secondary thread turn anchored to highest associated primary turn, reopen affected phases. Secondary thread conversation re-resolves affected items via interviewer. Complete revisit when all items resolved; phases can be re-closed. `not-started`
     - Requirements: → SPEC.md §Requirements #10
     - Assumptions: → SPEC.md §Assumptions A48, A49
     - Decisions: → SPEC.md §Decisions D80, D84
     - Candidate invariant goals: secondary thread anchored to primary tree; affected phases reopen; re-resolution conversation produces valid knowledge items; session completes when all items resolved; knowledge item validity dual-checks active path + graph integrity
     - Invariants to respect: → SPEC.md §Invariants I48, I54, I72, I87
     - Acceptance: confirm cascade → phases reopen → secondary thread conversation → all items resolved → phases can be re-closed → export valid again
     - Design: `docs/design/REVISIT_MODULE.md`

## Phase 9: Post-Distribution Hardening

<!-- Defer dependency-risk changes until the packaged app exists and can be regression-tested as a distributed artifact. -->

### Slices

16. **Drizzle Kit audit remediation** — Revisit the current `npm audit` finding on `drizzle-kit` after distribution is stable. Do not use `npm audit fix --force`, which currently resolves to `drizzle-kit@0.18.1`; that downgrade crosses the modern config boundary and is not a safe path for this repo. Instead, validate a non-vulnerable upgrade path (currently the `1.0.0-beta` line) against this app's SQLite config, migration history, and `studio` workflow before changing dependencies. `not-started`
    - Requirements: → SPEC.md §Requirements #1
    - Candidate invariant goals: packaged distribution remains stable while the Drizzle toolchain is upgraded off the vulnerable `@esbuild-kit/*` loader chain
    - Invariants to respect: → SPEC.md §Invariants I1, I2, I4, I5
    - Acceptance: chosen `drizzle-kit` version removes the vulnerable loader chain, keeps `drizzle.config.ts` compatible, preserves existing migration history, and `npm run studio` still works against the existing SQLite database
    - **Verification approach**: inner — dependency tree/audit check plus config-load and migration/studio smoke tests. Outer — manual `npm run studio` walkthrough on the distributed app path.

## Horizon

<!-- Future work not yet broken into slices. Revisit after Phase 9. -->

- MCP server adapter (expose core operations as MCP tools)
- Knowledge graph visualization (interactive graph view of the canonical knowledge ontology)
- Exploratory pathway (for projects where the goal itself is unclear — distinct from brownfield which is about context, not goal uncertainty)
- Hard turn-tree branching (deferred from V1; the linked-list structure supports it but UX is not exposed)
- Git-integrated diff-able persistence format (file-based representation of the DB for version control)
- Headless interview driver (programmatic harness driving `/api/projects/:id/chat` with scripted answers)

## Dependencies

<!-- Blocking relationships between slices. Update when slices are added or retired. -->

```
done ─────────────────────────────────────────────────────────────┐
  Phase 1–6: all complete                                         │
──────────────────────────────────────────────────────────────────┘
                        │
Phase 7:  12b ──→ 14 (local-first storage + npx distribution)
          14 ──→ 14a (greenfield/brownfield + exploration)
          done ──→ 17 (UI refinement + design-system alignment)  [parallel with 14]
Phase 8:  12a ──→ 15 (edit mode + cascade preview)        [stretch]
          15 ──→ 15a (cascade execution + secondary threads) [stretch]
Phase 9:  14 ──→ 16 (drizzle-kit audit remediation)
Deferred: 12a + 12b ──→ 13a (review lifecycle refinement)
```

### Parallelism opportunities

- Phase 6 is fully done (11a, 11b, 11c, 12a, 12b all complete).
- **14 (local-first + npx) and 17 (UI refinement) are both unblocked and can run in parallel.**
- 17 is purely presentational — no schema or API changes — so it has no dependency on 14 or vice versa.
- 14a (brownfield) depends on 14 landing first (needs the launcher and `.brunch/` resolution).
- 15 + 15a (knowledge-graph revisit) are stretch goals; they depend on 12a (knowledge workspace) which is done, but may not land before the first deadline.
- 13a (review lifecycle refinement) is explicitly deferred; it should collect rarer review variants after the revisit model stabilizes.
- 16 (drizzle-kit audit) should wait until 14 lands.
