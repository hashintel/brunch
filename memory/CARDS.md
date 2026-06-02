<!-- CARDS.md — derivative scope-card queue for ONE frontier item.
     Not canonical planning state. Canonical = memory/SPEC.md + memory/PLAN.md.
     Frontier: spec-persistence-and-startup (see memory/PLAN.md §Frontier Definitions).
     Delete/overwrite when the queue is exhausted or superseded. -->

# Cards — `spec-persistence-and-startup`

Frontier: **spec-persistence-and-startup** (PLAN.md). Branch: to create.
Two cards: an additive persistence foundation, then the integration that makes
startup correct end-to-end. Card 2 consumes Card 1's spec API; the model is
fully locked, so Card 2's shape does not depend on Card 1's build findings.

Locked state-model decisions this queue implements (from the survey session):

```yml
specs[]                       # lives: .brunch/data.db
  id: integer                 # autoincrement; replaces 'spec-${uuid}'
  name: string
  slug: string
  readiness_grade: enum       # rename optional; elicitation_posture + commitment_focus RETIRED

workspace                     # lives: .brunch/workspace.json (renamed from state.json)
  project: { name, slug }     # 'source' DROPPED (dead)
  current: { specId:int, sessionId }
  posture: { certainty, stakes, audience, horizon, migration, sourcing }  # POC stub, empty strings
  # activation, chrome: coordinator-derived at startup, NOT persisted

binding                       # lives: Pi JSONL (brunch.session_binding)
  { schemaVersion, specId:int }   # sessionId + specTitle DROPPED; self-id guard removed
```

---

## Card 1 — Spec entity + DB-on-startup foundation  [status: done]

### Target Behavior

A Brunch process opening a workspace creates `.brunch/data.db` when absent and can create, read, and grade-update a `specs` row exclusively through the `CommandExecutor`.

### Boundary Crossings

```
→ createDb(path)                       (creates file if missing, idempotent)
→ db/schema.ts + initSchema DDL        (new `specs` table)
→ graph/ CommandExecutor               (createSpec / getSpec / updateReadinessGrade)
→ specs row persisted; integer id returned
```

### Risks and Assumptions

```
- RISK: should spec writes consume a graph LSN + change_log entry, or are they a
        separate control-plane write?
    → MITIGATION: default — route through CommandExecutor for the no-bypass invariant
      and append a change_log entry for audit; reuse the single graph_clock LSN unless
      the build surfaces a concrete reason to separate the clocks. Settle in build.
- RISK: graph nodes remain unscoped to a spec (no nodes.spec_id this slice).
    → MITIGATION: out of scope — spec-row only; node↔spec scoping is a separate
      decision, deliberately not opened here.
- ASSUMPTION: Drizzle + better-sqlite3 line is settled.
    → IMPACT IF FALSE: low — already validated.
    → VALIDATE: existing M4 A20-L spike. [→ memory/SPEC.md §Assumptions A20-L]
```

### Tracer-bullet check

Scores on **uncertainty** (retires the spec-row persistence hole) and **proof of life** (first real `specs` row written to a real `.brunch/data.db` outside `:memory:` tests). Build it as-is.

### Acceptance Criteria

```
✓ schema/initSchema — `specs` table created (Drizzle table def + CREATE IF NOT EXISTS DDL),
  columns {id INTEGER PK AUTOINCREMENT, name, slug, readiness_grade}; NO elicitation_posture,
  NO commitment_focus
✓ createSpec — writes a row through CommandExecutor, returns integer id
✓ getSpec — returns the row by integer id
✓ updateReadinessGrade — mutates grade through the command boundary; invalid grade rejected
✓ createDb on a non-existent path — creates the file; reopening the same path is idempotent
✓ no-bypass — a direct ORM write to `specs` outside CommandExecutor is caught by the
  architectural boundary test (I26-L extension)
```

### Verification Approach

```
- Inner: vitest unit — CommandExecutor spec ops + createDb file-creation/idempotence
- Middle: architectural no-bypass test extended to `specs`
- Outer: n/a (boot integration is Card 2)
```

### Cross-cutting obligations

```
- All spec writes route through CommandExecutor (D16-L / D20-L no-bypass).
- SPEC reconciliation lands with this card (the model omits the dead fields):
  retire the elicitation_posture half of D45-L; gut/retire D46-L; trim requirement #22;
  simplify I31-L to grade-only.
```

---

## Card 2 — Coordinator startup on the corrected model  [status: next]

### Target Behavior

Brunch boots end-to-end against the DB-backed spec model: it reads the workspace pointer from `.brunch/workspace.json`, the spec from the DB, and the session→spec link from the collapsed binding, and reaches a correct activation state under every foreseeable startup condition.

### Boundary Crossings

```
→ runBrunchCli → openDefaultWorkspace / activateWorkspace
→ .brunch/workspace.json (renamed, reshaped) read / write / first-run scaffold
→ .brunch/data.db (create-if-missing) + spec row create/read  (Card 1 API)
→ brunch.session_binding {specId:int} append/read; spec name resolved from DB
→ WorkspaceSessionState returned; activation/chrome DERIVED, not stored
```

### Risks and Assumptions

```
- RISK: specId string→int flip touches workspace.json + binding + coordinator + many
        test fixtures at once.
    → MITIGATION: pre-release posture — regenerate fixtures; land as one coherent change
      that keeps `npm run verify` green; no compat shim for old spec-${uuid} data.
- RISK: the spec picker/inventory now needs a DB read (new coupling; today it reads JSONL only).
    → MITIGATION: thread the DB/CommandExecutor into inspectWorkspaceInventory; ensure the
      DB is created before inventory runs.
- ASSUMPTION: Card 1's spec API shape is stable.
    → IMPACT IF FALSE: rework limited to the coordinator call sites.
```

### Tracer-bullet check

Scores on **proof of life** (lights up the real boot path: a live `.brunch/data.db` created and read by an actual `brunch` run) and **invariants** (stabilizes "init/startup correct under all conditions" — the frontier's north-star oracle).

### Acceptance Criteria

```
startup condition matrix (each leaf = one assertion):
├── no .brunch/                          → scaffolds workspace.json (empty posture) + data.db
├── workspace.json + data.db, valid      → ready; spec read from DB by specId
├── workspace.json present, db missing    → recreates data.db; reconciles current spec
├── current specId absent from DB        → needs_human(reason)
├── current sessionId/file missing/stale  → needs_human or new-session path
├── multiple specs                        → picker lists names resolved from DB
├── new-spec                              → writes specs row, ready
├── new-session-for-current-spec          → appends binding {specId}, ready
├── cancel                                → cancelled
└── forked session (binding inherited)    → still resolves spec linkage (no self-id reject)
shape assertions:
├── workspace.json has no `source`; persists {project, current:{specId:int,sessionId}, posture}
└── brunch.session_binding is {schemaVersion, specId:int} — no sessionId, no specTitle
```

### Verification Approach

```
- Inner: workspace.json read/write/scaffold unit tests; binding schema test
- Middle: startup-condition-matrix integration tests (NORTH STAR); coordinator↔DB;
          picker-name-from-DB; no-bypass
- Outer: real `brunch --mode print` (and TUI boot) against a regenerated `.brunch/`,
         proving a live `.brunch/data.db` is created and read
```

### Cross-cutting obligations

```
- Session identity stays Pi-owned; Brunch contributes only {specId}; binding is fork-portable.
- Rename .brunch/state.json → .brunch/workspace.json (constant + tests).
- SPEC reconciliation: delete prompt-assembly layer 7 (elicitation posture); flip the
  SPEC §Vocabulary-evolution `posture` note spec-level → workspace-level (POC-stubbed).
- README updates: src/README.md (state.json → workspace.json), src/db/README.md (specs table),
  src/session/README.md (binding collapse).
- Do NOT wire graph-agent tools here — this frontier owns DB lifecycle only.
```
