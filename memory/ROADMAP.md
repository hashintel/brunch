# Roadmap

## Active: Brunch v2 — Spec Elicitation Tool

### Slices

1. **Walking skeleton: SDK → SSE → React** `FE-534` — Prove the integration seam end-to-end. New Express route, `pipeSDKStream` adapter (Design A with internal normalize step), React + Vite + `useChat`. Thinking, text, tool-use events visible in browser. No DB, no domain logic. `pending`
   - Acceptance: `npm run dev` opens browser, type a message, see streamed response with visible thinking and text. `useChat` manages all state.
   - Risk retired: SSE adapter correctness, AI SDK protocol conformance, React/Vite setup.
   - Blocks: all subsequent slices.
   - Branch: `ln/fe-534-walking-skeleton`

2. **SQLite foundation + project persistence** `FE-535` — Replace Dolt with `better-sqlite3`. Schema: `project`, `interview_exchange`, `spec_output`. Auto-create DB on startup. Session CRUD. Resume via Claude Agent SDK `resume`. `pending`
   - Acceptance: create project, close browser, reopen, resume conversation.
   - Branch: `ln/fe-535-sqlite-persistence`

3. **Interview Phase 1: scope establishment** `FE-536` — System prompt drives scope elicitation. LLM presents structured questions with options. Exchanges stored in `interview_exchange`. `pending`
   - Acceptance: user describes goal, LLM asks structured scope questions, exchanges persisted.
   - Branch: `ln/fe-536-interview-phase-1`

4. **Entity extraction pipeline** `FE-537` — After each exchange, separate `queryStructured` call extracts entities. Materialize into entity tables. Emit `data-entities` SSE event. `pending`
   - Acceptance: entity dashboard shows extracted items within 1-3s of answering.
   - Branch: `ln/fe-537-entity-extraction`

5. **Entity dashboard UI** `FE-538` — React sidebar showing accumulated entities by type. Updates live via `data-entities` events. Read-only. `pending`
   - Acceptance: entities appear in categorized lists as interview progresses.
   - Branch: `ln/fe-538-entity-dashboard`

6. **Phase transition: scope → design** `FE-539` — LLM proposes transition with summary. User confirms. Phase stored on project. Dashboard shows indicator. `pending`
   - Acceptance: LLM summarizes scope, user confirms, Phase 2 begins.
   - Branch: `ln/fe-539-phase-transition`

7. **Interview Phase 2: design tree exploration** `FE-540` — LLM works down design tree with structured questions. Decisions extracted and materialized. `pending`
   - Acceptance: design questions with options, decisions in dashboard.
   - Branch: `ln/fe-540-interview-phase-2`

8. **Freeform side-channel** `FE-541` — "Ask about this" escape hatch. Separate `useChat` scoped to current question. Doesn't pollute main transcript. `pending`
   - Acceptance: digress, get answer, return to main flow unchanged.
   - Branch: `ln/fe-541-side-channel`

9. **Interview Phase 3: acceptance criteria validation** `FE-542` — LLM surfaces criteria, proposes additions, walks risks. `acceptance_criterion` and `risk` tables populated. `pending`
   - Acceptance: criteria and risks appear in dashboard after validation.
   - Branch: `ln/fe-542-interview-phase-3`

10. **Spec export** `FE-543` — Flatten entity state to markdown SPEC.md. LLM generates from entities + exchanges. Download button. `pending`
    - Acceptance: click export, markdown downloads. Re-export after changes updates spec.
    - Branch: `ln/fe-543-spec-export`

11. **Snapshot versioning** `FE-544` — `project_snapshot` table. Auto-snapshot at phase transitions. Restore from previous. `pending`
    - Acceptance: snapshot, change, restore, state reverts.
    - Branch: `ln/fe-544-snapshot-versioning`

12. **npx distribution** `FE-545` — `bin` entry, launcher script, single port, opens browser. Single env var: `ANTHROPIC_API_KEY`. `pending`
    - Acceptance: `npx brunch` with key in scope opens working app.
    - Branch: `ln/fe-545-npx-distribution`

### Blocking relationships

```
1 (skeleton) ──→ 2 (SQLite) ──→ 3 (Phase 1) ──→ 4 (extraction) ──→ 5 (dashboard)
                                     │                                    │
                                     ├──→ 6 (phase transition) ──→ 7 (Phase 2) ──→ 9 (Phase 3) ──→ 10 (export)
                                     │
                                     └──→ 8 (side-channel) [independent after 3]
                                     
11 (snapshots) [independent after 2+5]
12 (npx) [independent after 10, or parallelizable earlier]
```

### Parallelism opportunities

- Slices 8 (side-channel) and 6-7 (phase transition + Phase 2) can run in parallel after slice 5.
- Slice 11 (snapshots) can run in parallel with slices 6-10.
- Slice 12 (npx) can start as soon as slice 1 is done (basic launcher), with full completion after slice 10.

### Horizon

- Pre-prompting phase (Phase 0) — category-narrowing quiz
- Decision DAG tracking (join tables, graph visualization)
- Assumption↔decision links and belief invalidation
- Multi-provider support via AI SDK server-side (if Claude Agent SDK becomes limiting)
- Entity editing outside interview flow (direct CRUD on dashboard)
- Export to GitHub Issues, Linear, YAML task definitions
