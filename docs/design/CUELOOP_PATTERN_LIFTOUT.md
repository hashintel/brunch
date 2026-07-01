# CueLoop Pattern Liftout — reference for `orchestrator-tool-port`

A **design-reference liftout**: patterns worth stealing from CueLoop for the
`orchestrator-tool-port` frontier (FE-1107), read against Brunch's committed
architecture. CueLoop is **prior art, not a building block** — a shipped,
file-backed re-implementation of the same shape FE-1107 is building (cook
orchestration ported into executor-owned tools). This doc extracts the
*ideas* to reuse and names, precisely, the ones to leave behind.

- **Source:** [`fitchmultz/cueloop`](https://github.com/fitchmultz/cueloop) —
  Rust CLI + thin SwiftUI macOS app for "queue-driven, auditable AI coding agent
  work." All CueLoop citations below are external GitHub links; nothing here is a
  dependency.
- **Companion prior art:** the external `../brunch` orchestrator
  ([`/Users/lunelson/Code/hashintel/brunch/ORCHESTRATOR.md`](/Users/lunelson/Code/hashintel/brunch/ORCHESTRATOR.md)
  and `src/orchestrator/src/`), already listed in the card's cold-start reads.
  Treat CueLoop as a **second, independent reference point** for the same
  problem — not a replacement for that source.
- **Consumers:** [`memory/cards/orchestrator-tool-port--plan-check-tool.md`](../../memory/cards/orchestrator-tool-port--plan-check-tool.md)
  (first tracer) and the `orchestrator-tool-port` frontier in
  [`memory/PLAN.md`](../../memory/PLAN.md).
- **Status:** reference / advisory. Not a proposal, not a pending decision.
  Nothing here overrides [`memory/SPEC.md`](../../memory/SPEC.md); where a
  pattern collides with an active decision, the decision wins and the pattern is
  marked SKIP.

---

## 0. Positioning — why CueLoop is reference-only

Brunch and CueLoop sit at opposite ends of one lifecycle. Brunch **authors the
"what and why"** (a typed intent graph, downstream oracle/design/**plan**
planes). CueLoop **executes the "do the work"** (a durable task queue driving
coding-agent CLIs through a plan→implement→review loop). The natural seam is
Brunch's plan plane → an execution loop; FE-1107 is Brunch choosing to **own
that loop itself** as executor tooling rather than delegate it to an external
supervisor.

Three active decisions make CueLoop unusable *as product architecture or a
dependency*, and therefore bound what this liftout is allowed to take:

- **D98-L** — CODE mode is one Brunch-aware `executor` that merges the old
  `orchestrator` + `pi-coder` and owns an `orchestrate` tool; the frontier
  "must not preserve the old orchestrator/pi-coder split as product
  architecture." CueLoop *is* that split (a separate supervisor spawning runner
  subprocesses).
- **D39-L** — sealed Pi profile, no shell-wrapped CLI escape hatch; product
  behavior comes from Brunch-owned programmatic policy. CueLoop invokes agents by
  shelling out to runner CLIs (including Pi) with NDJSON — the wrap Brunch
  rejects.
- **D4-L / D6-L / D16-L** — SQLite-through-command-executor is the source of
  truth (LSN, change-log, "agents must not touch storage directly"). CueLoop's
  `.cueloop/*.jsonc` file-ledger cannot be Brunch's store, and its flat task
  graph is far thinner than Brunch's closed nine-category edge model.

So the rule for this doc: **steal shapes and disciplines, re-home them in
Brunch's command/executor/SQLite/sealed-Pi world, and never import CueLoop's
transport, storage, or orchestrator-vs-runner topology.**

---

## 1. Patterns worth stealing

Each pattern: what CueLoop does → why it's worth stealing → how it re-homes in
Brunch → verdict.

### P1 — Explicit multi-phase run with a CI gate and a review checkpoint

CueLoop structures a supervised run as 1/2/3 phases: **plan** (plan-only, no code
changes, cached), **implement + CI**, **review + completion** (review context
from git diff, task marked `done`/`rejected`, CI gate re-run, then finalize)
([phases.md](https://github.com/fitchmultz/cueloop/blob/main/docs/features/phases.md)).
Completion is not "the agent said done" — it requires passing a local CI gate and
producing evidence.

- **Why steal:** this is a concrete, proven shape for `cook_run` after the
  read-only `cook_plan_check` tracer. The plan/implement/review decomposition and
  the "done must clear a gate + leave evidence" rule map directly onto Brunch's
  posture (`stakes: high` — validate at boundaries).
- **Brunch home:** phases become executor-tool run states, not separate agent
  roles (D98-L). The CI gate is Brunch's own `npm run verify`/`check` harness.
  Evidence and phase artifacts are change-log entries / command-executor writes,
  **not** `.cueloop/cache/*.md` files (D4-L/D6-L/D16-L).
- **Verdict:** STEAL the phase decomposition + gate-before-done discipline.
  SKIP the file-cache artifact substrate.

### P2 — Per-work-item execution policy on the queue

A CueLoop task carries an optional `agent` object (runner, model, effort,
iterations, followup effort) — the queue is not just a backlog, it carries
*execution policy per item*
([task-schema.md](https://github.com/fitchmultz/cueloop/blob/main/docs/features/task-schema.md)).

- **Why steal:** a plan-plane work item that can annotate *how* it should be
  executed (thinking budget, iteration cap, which background agent) is more
  useful than a bare backlog entry.
- **Brunch home:** any such policy is **code-owned and allowlisted** (D90-L–D93-L,
  I49-L), not free-form per-task config. Model selection stays `default`
  ("inherit parent") per the sealed-Pi posture — no `runner`/`model` override
  surface. So steal the *concept* (work items carry execution intent), constrain
  the *mechanism* (closed, code-owned fields; no arbitrary runner/model strings).
- **Verdict:** STEAL the concept. SKIP free-form runner/model/effort fields.

### P3 — Separate lifecycle, hierarchy, and actionability

CueLoop keeps three axes independent: `status` (lifecycle:
draft/todo/doing/done/rejected), `parent_id` (hierarchy), and `kind`
(`work_item` = executable vs `group` = decomposition only)
([task-schema.md](https://github.com/fitchmultz/cueloop/blob/main/docs/features/task-schema.md)).
Runnability is not inferred from tree position. It also treats `blocks` as a
runnability constraint even without the inverse `depends_on` edge
([machine-contract.md](https://github.com/fitchmultz/cueloop/blob/main/docs/machine-contract.md)).

- **Why steal:** "is this runnable?" being a first-class, non-inferred property
  avoids a common orchestration bug (executing a grouping node, or mis-deriving
  readiness from hierarchy). The `blocks`-as-constraint subtlety is a real
  decision FE-1107 must make explicitly when projecting the plan plane into
  runnable units.
- **Brunch home:** Brunch already has a richer closed edge model (D51-L:
  `dependency`, `composition`, etc.) and readiness bands (D94-L). The liftout is
  the *principle* — decide runnability explicitly, don't infer it from
  composition edges — expressed in Brunch's existing graph vocabulary.
- **Verdict:** STEAL the principle. Reuse Brunch's edge/band model as the
  mechanism; do not add a parallel `kind`/`status` task ontology.

### P4 — Resumable, phase-scoped run sessions

CueLoop persists resumable sessions with per-phase IDs
(`{task_id}-p{phase}-{timestamp}`) and continue/resume state, so a run can
recover mid-phase ([phases.md](https://github.com/fitchmultz/cueloop/blob/main/docs/features/phases.md#L447-L505)).

- **Why steal:** long coding runs die (timeouts, crashes, operator interrupts).
  Resumability with a stable per-phase identity is table stakes for `cook_run`.
- **Brunch home:** run/session identity and state belong in Brunch's transcript
  (Pi JSONL) + change-log substrate, addressed through the command/session seam —
  not a `.cueloop/cache/session.jsonc` file. Brunch already runs Pi child
  sessions in-process (I29-L); resume state rides that, sealed.
- **Verdict:** STEAL resumability as a run requirement. SKIP the file-based
  session store.

### P5 — Checkpoint/undo before every mutation

CueLoop snapshots the queue before mutating it (undo checkpoints / backups)
([cli.md](https://github.com/fitchmultz/cueloop/blob/main/docs/cli.md#L252-L255)).

- **Why steal:** operator-visible, reversible mutations are core to
  "auditable." A write-capable `cook_run` that can't be inspected or unwound is
  a liability at `stakes: high`.
- **Brunch home:** Brunch gets this *for free and better* — the command executor
  already emits LSN-ordered change-log entries with attribution (D4-L, D16-L).
  The liftout is the **expectation** ("every orchestration mutation is
  reversible and attributable"), which Brunch's existing substrate satisfies
  natively. No new snapshot mechanism needed.
- **Verdict:** STEAL the expectation. It's already satisfied by the command
  seam — do not add a second undo layer.

### P6 — Versioned machine contract; structured API, never stdout scraping

CueLoop's app talks to the CLI only through a **versioned machine JSON contract**
and rejects unsupported document versions rather than parsing human output
([machine-contract.md](https://github.com/fitchmultz/cueloop/blob/main/docs/machine-contract.md)).

- **Why steal:** this is exactly Brunch's own discipline — `rpc.discover` and
  JSON-Schema-shaped method contracts (D48-L, D41-L). CueLoop independently
  arriving at the same rule is corroboration.
- **Brunch home:** already the house style. The `cook_plan_check` /
  future `cook_run` tools should return typed, schema-discoverable results (the
  card already requires a typed `cook_plan_check` result), consistent with the
  RPC surface.
- **Verdict:** ALREADY BRUNCH POLICY — cite as corroboration; keep the tracer's
  typed-result requirement.

### P7 — Ledger-only mode vs supervised mode (the `agent` command family)

CueLoop can act purely as a **durable ledger for a session already in flight**
(`agent` commands: `next`, `claim`, `start`, `note`, `evidence`, `handoff`,
`complete`, `validate`) *without* spawning a runner — distinct from `run` (nested
runner supervision) ([README](https://github.com/fitchmultz/cueloop/blob/main/README.md#L62-L63),
[cli.md](https://github.com/fitchmultz/cueloop/blob/main/docs/cli.md#L71-L89)).

- **Why steal (and note for D98-L):** this is the one place CueLoop *aligns* with
  D98-L's instinct. It shows a design where the executing agent records progress
  into an auditable ledger it does not itself supervise — i.e. the ledger is
  decoupled from "who spawns whom." For Brunch, that reads as: the `executor`'s
  `orchestrate` tool can record plan/run progress into the graph/change-log
  **without** implying a separate orchestrator process. It's evidence that
  "auditable queue" and "separate supervisor" are separable concerns.
- **Brunch home:** the executor writes run/plan progress through its own tools
  into the command/change-log substrate; no second agent tier required.
- **Verdict:** STEAL the *decoupling insight* (ledger ≠ supervisor). This is the
  most D98-L-relevant idea in CueLoop.

### P8 — Preflight sanity/trust gates before a run

CueLoop runs sanity checks and a repo trust/init gate before executing, and ships
a `doctor` command ([architecture.md](https://github.com/fitchmultz/cueloop/blob/main/docs/architecture.md#L76-L88)).

- **Why steal:** a write-capable run should refuse to start in an unsafe state
  (dirty tree it doesn't expect, missing workspace, wrong mode). The read-only
  `cook_plan_check` tracer is itself a first preflight gate.
- **Brunch home:** preflight is executor-tool logic guarded by the sealed profile
  (D39-L) and the op-mode/tool-authority matrix (I25-L, I49-L); `cook_plan_check`
  is the natural first gate, later runs add worktree/tree-state checks.
- **Verdict:** STEAL preflight-before-run as a requirement; `cook_plan_check` is
  the tracer instance of it.

---

## 2. Patterns to explicitly NOT take

- **Separate orchestrator process supervising runner subprocesses.** This is the
  D98-L collision. Brunch merges orchestration into the `executor`; do not
  reintroduce a supervisor/runner tier as product architecture.
- **Shell-out-to-runner-CLI invocation (NDJSON over a spawned `cueloop`/agent
  CLI).** D39-L forbids the shell-wrapped escape hatch; Brunch drives Pi
  in-process through the sealed profile.
- **Plain-files-as-source-of-truth (`.cueloop/queue.jsonc`, `done.jsonc`,
  `cache/`).** D4-L/D6-L/D16-L: the SQLite graph + JSONL transcript through the
  command executor is canonical. A file ledger would be a second, unauthorized
  store.
- **A parallel task ontology (`kind`/`status`/`priority`/`custom_fields`).**
  Brunch's intent graph (nodes, closed edge categories, readiness bands) already
  models work; adding a task schema would fork the domain model.
- **Free-form per-task runner/model/effort config.** Collides with sealed-Pi
  model policy (`default` inheritance) and code-owned authority (D90-L–D93-L).
- **The macOS app / kanban / dependency-graph UI.** Brunch's presentation
  surface is the TUI + read-only web sidecar over RPC (D10-L, D72-L); not in
  scope for FE-1107.

---

## 3. Liftout map

| Pattern | Steal? | Brunch home | Constraint / decision |
| --- | --- | --- | --- |
| P1 phase model + gate-before-done | ✅ shape only | executor-tool run states; `npm run verify` gate | D98-L; posture `stakes: high` |
| P2 per-item execution policy | ⚠️ concept only | code-owned, allowlisted fields | D39-L (model=`default`), D90-L–D93-L, I49-L |
| P3 explicit runnability | ✅ principle | Brunch edge model + readiness bands | D51-L, D94-L |
| P4 resumable phased sessions | ✅ requirement | transcript + change-log; in-process Pi | I29-L; D6-L/D16-L |
| P5 checkpoint/undo before mutation | ✅ expectation (already met) | command-executor change-log/LSN | D4-L, D16-L |
| P6 versioned machine contract | ✅ already policy | typed RPC/tool results | D48-L, D41-L |
| P7 ledger-only vs supervised | ✅ decoupling insight | executor records via own tools | **D98-L** |
| P8 preflight sanity/trust gate | ✅ requirement | executor preflight under sealed profile | D39-L, I25-L, I49-L |
| — separate orchestrator/runner tier | ❌ | — | D98-L |
| — shell-out runner CLIs | ❌ | — | D39-L |
| — files as source of truth | ❌ | — | D4-L/D6-L/D16-L |
| — parallel task ontology | ❌ | — | D51-L, D61-L |

---

## 4. Open questions this raises for FE-1107

1. **Runnability projection.** When the plan plane is projected into executable
   units, which edge categories gate runnability, and does Brunch adopt a
   `blocks`-style "constraint without inverse edge" rule (P3)? Decide explicitly
   before `cook_run`.
2. **Phase boundaries as tool states.** Do plan/implement/review become distinct
   `orchestrate`/`cook_run` tool invocations, a single tool with a phase
   argument, or executor-internal states? P1 gives the decomposition; D98-L
   forbids expressing it as separate agent roles.
3. **Run identity/resumption in the transcript.** What is the Brunch-native
   analogue of CueLoop's `{task}-p{phase}-{ts}` session id, addressed through the
   session/change-log seam rather than a cache file (P4)?
4. **Evidence/finalization home.** Phase artifacts and completion evidence should
   land as change-log entries / graph writes — confirm the schema so `cook_run`
   completion is auditable the way `cook_plan_check` findings already are (P1,
   P5, P6).
