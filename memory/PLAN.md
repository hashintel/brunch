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
- Spike: **Observer extraction fidelity** `FE-557` `done` — validated A14 (≥80% capture rate)
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

## Phase 4: Full Interview

<!-- All four phases working end-to-end. The live rendering regression must be fixed first,
     then phase transitions, tool composition, and the remaining interview phases.
     The product becomes usable at the end of this phase. -->

### Slices

6c. **Live streaming fix** — Fix the turn-card rendering regression: during live SSE streaming, the structured turn card (question + options + impact + why) does not render until page refresh. Thinking streams live; server persists correctly; hydration from DB works. The type-strictness refactor (6b) provides typed seams for diagnosis. Root cause is in the interaction between `toUIMessageStream()`, `useChat` part accumulation, and the `ask_question` tool-part lifecycle. `not-started`
    - Requirements: → SPEC.md §Requirements #2, #3, #4
    - Assumptions: → SPEC.md §Assumptions A16, A28
    - Invariants to establish: I24 (live tool-part rendering matches persisted state after refresh)
    - Invariants to respect: → SPEC.md §Invariants I16, I17, I18, I22
    - Acceptance: send a message in dev, see the structured turn card appear live without refresh; `npm run verify` passes
    - **Verification approach**: inner — unit tests for tool-part state transitions in the stream. Outer — manual interview: turn card renders live, matches post-refresh state.

6d. **Tool composition: `activeTools` + `prepareCall`** — Enable per-phase tool sets on the `ToolLoopAgent`. Register core tools + `ask_question` in the agent's full toolset; use `activeTools` or `prepareCall` to gate which are available per step. Scope phase: `ask_question` only. Future kickoff mode: core tools only. This is the wiring layer between `createCoreTools()` and `createInterviewerAgent()`. `not-started`
    - Requirements: → SPEC.md §Requirements #2, #7
    - Assumptions: → SPEC.md §Assumptions A28, A29
    - Decisions: → SPEC.md §Decisions D31, D32
    - Invariants to establish: I25 (tool gating — only declared tools callable per step)
    - Invariants to respect: → SPEC.md §Invariants I16, I22
    - Acceptance: interviewer agent has core tools registered but only `ask_question` active during scope phase; `npm run verify` passes
    - **Verification approach**: inner — unit test that agent receives only active tools per step. Middle — existing interview tests pass unchanged.

7. **Phase transition + resolution** — Agent judges when scope phase is complete. Add `resolve_phase` tool alongside `ask_question`. Agent calls `ask_question` for questions and `resolve_phase` when understanding is reached. Client shows phase summary + confirmation UI. Phase indicator updates. `not-started`
   - Requirements: → SPEC.md §Requirements #7, #8
   - Assumptions: → SPEC.md §Assumptions A15, A28
   - Acceptance: agent marks resolution, summary shows, user confirms, phase indicator reflects completion

8. **Design drill-down phase** — Second agent skill. Walks the design tree with structured questions. Decisions extracted by observer. Continues until agent judges resolution. `not-started`
   - Requirements: → SPEC.md §Requirements #2, #3
   - Acceptance: design questions with options, decisions extracted and shown in sidebar, agent resolves when understanding is reached

9. **Requirements review phase** — Third agent skill. Walks accumulated requirements list. Agent checks for gaps, proposes additions. User confirms each. Requirements get `reviewed_at` stamped. `not-started`
   - Requirements: → SPEC.md §Requirements #11
   - Acceptance: agent presents requirements, suggests gaps, user confirms, reviewed_at updated

10. **Criteria phase** — Fourth agent skill. For each confirmed requirement, agent proposes testable criteria. User selects/edits/confirms. Criteria get `reviewed_at` stamped. `not-started`
     - Requirements: → SPEC.md §Requirements #12
     - Acceptance: agent proposes criteria per requirement, user confirms, spec readiness predicate evaluable

## Phase 5: Revisit + Export

<!-- Decision revisit (branching), entity lifecycle (sidebar writes), soft invalidation,
     and spec export. The product is complete. -->

### Slices

11. **Decision revisit: branch + checkout** — Click "revisit" on a decision in the sidebar → confirmation → `POST /api/projects/:id/branch` → HEAD moves to fork point → conversation rewinds → stale entities leave active path (path exclusion). Branch dropdown shows available branches. Checkout to switch. `not-started`
    - Requirements: → SPEC.md §Requirements #9, #10
    - Assumptions: → SPEC.md §Assumptions A6
    - Decisions: → SPEC.md §Decisions D17 (path exclusion)
    - Acceptance: revisit a decision, new branch created, interview resumes from fork point, checkout returns to previous path
    - Ref: → docs/design/BREADBOARD.md §Wiring → Decision revisit

12. **Entity lifecycle API** — CRUD + review + verify/falsify endpoints for sidebar writes. `PUT .../assumptions/:id` with action (verify/falsify/update) triggers flag propagation per D17. `PUT .../requirements/:id` cascades to criteria. `PUT .../requirements/:id/review` and `.../criteria/:id/review` stamp `reviewed_at`. `not-started`
    - Requirements: → SPEC.md §Requirements #9, #11, #12
    - Decisions: → SPEC.md §Decisions D17 (flag propagation)
    - Acceptance: falsify an assumption → dependent entities flagged; edit a requirement → criteria flagged; review stamps reviewed_at
    - Ref: → docs/design/BREADBOARD.md §Code Affordances → Entity lifecycle

13. **Spec export** — Render markdown spec from active path entities (decisions, assumptions, requirements, criteria). Export route (`/project/:id/export`) shows preview. Download button. Enabled only when spec readiness predicate is true (all phases resolved + reviewed). `not-started`
    - Requirements: → SPEC.md §Requirements #13
    - Assumptions: —
    - Acceptance: complete all phases, navigate to export, markdown preview with all active-path entities, download .md file
    - Ref: → docs/design/BREADBOARD.md §Places → P3

## Phase 6: Distribution

<!-- Package and ship. -->

### Slices

14. **npx distribution + CLI** — `bin` entry, launcher starts Express (serves built Vite assets + API on one port), opens browser. `npx brunch` for web UI. `npx brunch [command]` for CLI operations. Single env var: `ANTHROPIC_API_KEY`. `not-started`
    - Requirements: → SPEC.md §Requirements #1
    - Decisions: → SPEC.md §Decisions D20
    - Acceptance: `npx brunch` with key in scope opens working app

## Horizon

<!-- Future work not yet broken into slices. Revisit after Phase 6. -->

- CLI interactive interview mode (terminal-based interview using core's DomainEvent stream)
- MCP server adapter (expose core operations as MCP tools)
- Turn tree visualization (git-log-style branch graph in sidebar)
- Entity graph visualization (decision + assumption DAG view)
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
          6c ──→ 6d (tool composition)
          6d ──→ 7 (transitions) ──→ 8 (design) ──→ 9 (requirements) ──→ 10 (criteria)
Phase 5:  6 ──→ 11 (branching)
          6 ──→ 12 (entity lifecycle API)
          10 ──→ 13 (export)
Phase 6:  13 ──→ 14 (npx + CLI)
```

### Parallelism opportunities

- 6c (live streaming fix) and 6d (tool composition) are independent — 6c fixes rendering, 6d wires tools. Can proceed in parallel if 6c doesn't require tool-part changes that affect 6d.
- Slice 7 (transitions) and 11 (branching) can start in parallel once 6d lands
- Slice 12 (entity lifecycle API) can proceed in parallel with slice 11
- Slice 14 (npx) can start early with a basic launcher, completing after slice 13
