# Orchestrator POC — Design Proposal

> Status: **landed POC** — CLI orchestrator that consumes a brunch-shaped execution plan (epics → slices) and dispatches agents and deterministic checks to drive the plan to completion. Canonical decisions in `memory/SPEC.md` (R46–50, D155-K–D159-K, I121-K–I123-K). Tracked as FE-730; umbrella H-6476.
>
> Scope is intentionally narrow: two interchangeable execution engines behind a shared seam, plan-as-YAML, an append-only event log as the communication medium, and an isolated worktree per run. The 15-step build sequence, fixture definitions, and pi-agent invocation details are operational scaffolding kept separate from this doc. Code lives under `src/orchestrator/` in the brunch repo; `cook` is only the CLI subcommand name.
>
> **Full design vs POC implementation:** this doc describes the design as it should land if/when the orchestrator productizes. The POC implements a deliberate subset to avoid premature abstraction — see [§POC scope and deferrals](#12-poc-scope-and-deferrals) for the explicit map of designed-but-deferred items.

## 1. Concept & problem

Brunch elicits specs and (eventually) projects them into execution plans. The orchestrator closes the loop: it takes such a plan, walks its work units, and produces real code + verification results.

Two pressures shaped the design:

- The team explicitly wants to **test the Petri-net substrate as a hypothesis** rather than commit to it on faith. Running it side-by-side with a hand-coded baseline is the only way to get empirical signal on whether the abstraction earns its complexity.
- The plan model is **provisional**. Brunch does not yet emit execution plans; canonical fixtures are forthcoming. The orchestrator should be forward-compatible (room for intent/design/oracle pointers, status semantics, milestone-level structure) without invalidating the engine seam when the plan model sharpens.

The orchestrator is not productized brunch. It is an experiment that should produce: (a) one working CLI built end-to-end from a plan, (b) two engines reaching the same outcome, (c) enough qualitative comparison to justify the next architectural commitment.

## 2. Architecture

```
                    brunch cook
                         │
                         ▼
              ┌──────────────────────┐
              │   Orchestrator       │  <-- shared seam
              │   .run(input)        │
              └──────────┬───────────┘
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
       petrinet engine            procedural engine
       (interpreter +             (walks epics, then
        net + tokens)              slices within each)
            │                         │
            └────────────┬────────────┘
                         ▼
            ┌──────────────────────┐
            │  ActionRegistry      │  <-- name-keyed dispatch
            └──────────┬───────────┘
                       │
            ┌──────────────────────┐
            │ AgentDispatch        │
            │ ReportSink (jsonl)   │
            │ TestRunner (det.)    │
            │ Worktree (fs)        │
            └──────────────────────┘
```

### The seam

```ts
interface Orchestrator {
  run(input: OrchestratorInput): Promise<OrchestratorResult>;
}

type OrchestratorInput = {
  plan: Plan;                  // { epics, slices }
  worktreeDir: string;         // cwd-scoped isolated run directory
  actions: ActionHandlers;     // Record<string, ActionHandler> — inline dispatch (POC); ActionRegistry when productized (§12)
  reports: ReportSink;         // append-only jsonl
  testRunner: TestRunner;      // deterministic exec
  policy: RunPolicy;           // { maxRetries }
};

type OrchestratorResult = {
  status: 'completed' | 'halted';
  reason?: string;
  reports: ReportRef[];
  epics: EpicOutcome[];
  slices: SliceOutcome[];
};
```

Every dependency is injected. Contract tests swap in fakes — a fake `ActionRegistry` returns canned report refs without invoking any real agent or test runner. This is what makes the two-engine experiment cheap.

### How each engine handles the hierarchy

- **procedural:** `topoOrder(epics)` → for each ready epic, `topoOrder(epic.slices)` → for each ready slice, run inner loop → after all slices done, run epic-level verifications → if fail, halt.
- **petrinet:** Epic and slice readiness states are places in the net. Slice completion produces tokens that feed into an epic-completion transition. Epic verification is itself a transition. Epic dependencies become input arcs into the first slices' ready-places.

Both produce identical observable behavior on the contract test suite. That's the non-negotiable.

## 3. ActionRegistry — name-keyed dispatch

> **POC note:** The POC uses inline `ActionHandlers` (a record of handler functions) instead of a formal registry class. The `ActionRegistry` interface below is the productized target — see [§12 POC scope and deferrals](#12-poc-scope-and-deferrals).

The TDD inner loop's transitions (`write-tests`, `write-code`, `run-tests`, `evaluate-done`, `verify-epic`) are not hardcoded inside the engines. They are registered handlers the engines look up by name:

```ts
interface ActionRegistry {
  register(name: ActionName, handler: ActionHandler): void;
  get(name: ActionName): ActionHandler;       // throws on unknown
  has(name: ActionName): boolean;
}

type ActionHandler = (ctx: ActionContext) => Promise<ReportRef>;
```

Engines orchestrate **which** action fires when (the state machine). The registry owns **how**. Adding `lint`, `human-review`, or `research` later is a registration, not engine surgery. This satisfies the PRD's "actions looked up by name, extensible without restructuring" intent without changing the plan schema — slices still trigger the fixed TDD loop, but the loop's primitives are pluggable.

## 4. Plan model: epics → slices

Two levels. **Slices** are the execution unit; **epics** are organizational groupings that can carry their own integration-level verification. No milestones in POC.

```yaml
epics:
  - id: scaffolding
    summary: "CLI scaffolding"
    depends_on: []
    verification:
      - kind: integration-test
        target: "tests/cli.integration.test.ts"

slices:
  - id: version-flag
    epic_id: scaffolding
    definition: "Add `--version` flag printing version from package.json"
    depends_on: []
    verification:
      - kind: unit-test
        target: "tests/version.test.ts"
```

### Readiness rules

- An epic is **ready** when every epic in its `depends_on` is **done**.
- A slice is **ready** when (a) its parent epic is ready and (b) every slice in its `depends_on` is done.
- An epic is **done** when (a) every slice with that `epic_id` is done and (b) the epic's own verifications all pass.
- A failed epic-level verification halts the run. POC does not scope remediation slices.

### Slicing principle

Slice **vertically** through layers, not horizontally. Each slice produces a thin end-to-end increment; epics carry the cross-slice integration checks. This mirrors the walking-skeleton posture: keep all layers moving together at minimum increments rather than building one layer at a time.

### Schema provenance

The schema is **provisional**. The PRD says plans are "based on a brunch produced plan's speculative schema," but brunch (the elicitation tool) does not yet emit execution plans. The design here is intentionally minimal and forward-compatible: as canonical fixtures land, the schema may grow new fields (intent/design/oracle pointers, status semantics, milestone level) without invalidating the engine seam.

## 5. Reports as communication medium

This is the load-bearing communication discipline:

> **Tokens carry only pointers. All event content lives in `reports.jsonl`. Transitions communicate by appending lines and reading prior lines by `reportId` — never by passing data through the net.**

The log isn't a side-effect of the run; it's *the* communication medium. The net stays narrow (tiny token shape) precisely because the log carries everything else.

### Discipline

- Tokens carry exactly `{ reportId, sliceId, epicId }`. Nothing else.
- Every transition appends one line per event. Each line has a fresh `reportId` (UID).
- When a downstream transition needs prior context (e.g. `write-code` needs the test files from `write-tests`), it reads the prior line by `reportId` from the log.
- The whole log is also the post-run audit trail.

### Line schema

```json
{
  "id": "rpt_01J...",
  "ts": "2026-05-20T14:23:00Z",
  "epicId": "epic-1",
  "sliceId": "slice-1",
  "actor": "test-writer | code-writer | test-runner | evaluator | orchestrator",
  "event": "tests-written | code-written | tests-run | eval-done | epic-verified | halt",
  "payload": { /* event-specific */ }
}
```

### Resumability-readiness

POC runs are not resumable per PRD, but the architecture preserves the affordance: `reports.jsonl` is sufficient to reconstruct epic/slice state at any point. A future `brunch cook resume <fixture-dir>` could replay the log to the last consistent transition and continue without changing the engine seam.

## 6. Per-slice inner loop

The execution of one slice is the same state machine in both engines. The procedural engine implements it as a hand-coded loop; the petrinet engine compiles it into a generic net and runs a solver.

### Places (states)

- `slice spec ready` — slice received; ready to evaluate
- `testing agent ready` / `coding agent ready` — agent resources (single-token discipline in POC; pool later)
- `failing tests exist` — tests written and a deterministic run failed (or have just been written, awaiting first run)
- `untested code ready` — code written; needs deterministic re-run
- `NO spec needs more` — evaluator says spec isn't satisfied yet
- `YES spec is done` — evaluator says spec satisfied; slice can terminate

### Transitions (actions)

- `evaluate done state` (testing agent) — reads slice spec + prior reports; emits `NO/YES`; returns testing-agent token
- `write tests` (testing agent) — consumes `NO spec needs more` + testing-agent token; emits `failing tests exist`; appends a report line
- `write code` (coding agent) — consumes `failing tests exist` + coding-agent token; emits `untested code ready`; appends a report line
- `run latest tests` (deterministic, orchestrator-owned) — consumes `untested code ready`; emits either `failing tests exist` (loop) or `slice spec ready` (re-evaluate); appends a report line
- `return DONE` — consumes `YES spec is done`

### Loop pattern

```
slice spec ready → evaluate
  ├─ needs more → write tests → write code → run tests
  │                                              ├─ fail → write code → ... (up to maxRetries)
  │                                              └─ pass → slice spec ready (re-evaluate)
  └─ done → return DONE
```

The "run latest tests → slice spec ready" arc is what makes the orchestrator handle multi-criterion slices: a passing run doesn't end the slice, it triggers another `evaluate done state` to check whether the spec is fully satisfied.

### Why the orchestrator owns the deterministic test run

Agents can be wrong about whether their own tests passed. The orchestrator re-runs tests itself as an outside check, so the coding agent's claim of success is verified independently. This isn't anti-gaming (the deeper anti-gaming move would be ensuring test quality); it's anti-lying — the agent can't accidentally or sloppily claim a pass that didn't happen.

## 7. Dual-mode CLI resolver

The CLI takes a single directory argument:

```
brunch cook <dir>
```

Cook decides between **fixture mode** (greenfield) and **codebase mode** (brownfield) by where it finds the plan:

| Plan location | Mode | Worktree behavior | POC status |
|---|---|---|---|
| `<dir>/plan.yaml` | Fixture (greenfield) | Empty worktree | Implemented |
| `<dir>/.brunch/cook/plan.yaml` | Codebase (brownfield) | `git worktree add` on `cook/<runId>`, plus CoW copy of missing top-level runtime deps | Implemented |

Naming intuition: a **fixture** *is* a plan with supporting artifacts (`plan.yaml` at root, like a manifest); a **codebase** *has* a plan as configuration (`.brunch/cook/plan.yaml`, alongside other brunch workspace state).

The plan may declare `mode: greenfield | brownfield` to override the default inferred from location.

POC implements fixture mode end-to-end and codebase mode for git repositories. In codebase mode, cook creates a fresh `cook/<runId>` branch with `git worktree add`, then CoW-copies missing top-level runtime dependencies such as `node_modules/`. If filesystem clone/reflink support is unavailable, the copy helper falls back to a normal recursive copy: slower and larger on disk, but semantically equivalent.

## 8. Worktree isolation

Each run gets an isolated worktree at `<cwd>/.brunch/cook/runs/<runId>/worktree/`, where `<cwd>` is the directory the user invoked `brunch cook` from (not the fixture/plan directory). Reports land alongside at `<cwd>/.brunch/cook/runs/<runId>/reports.jsonl`. Agents write freely inside the worktree; the fixture directory (`<dir>`) and the invoking repo are never mutated. Codebase-mode agents may commit on the generated `cook/<runId>` branch, but cook never pushes. Recovery = throw the worktree away and start a new run.

The run location is cwd-scoped rather than fixture-scoped so that:

- **Fixtures stay pristine.** Checked-in fixture directories (e.g. `fixtures/txt/`) contain only `plan.yaml` and are byte-identical before and after a run.
- **No path traversal.** Because the worktree is not a descendant of the fixture dir, agents cannot accidentally read or write fixture-level files.
- **Easy cleanup.** `rm -rf .brunch/cook/runs/` in the invoking directory clears run artifacts. Codebase mode also creates a git worktree and branch, so full cleanup is `git worktree remove .brunch/cook/runs/<runId>/worktree` and `git branch -D cook/<runId>`. `.brunch/` is gitignored at the repo level.

`--worktree <path>` overrides the default location for explicit pinning.

## 9. Verification stance

Three tiers, each with a distinct purpose:

| Tier | Real or fake | Purpose |
|---|---|---|
| **Engine contract tests** | Fake agents, fake test runner | Both engines must produce identical observable behavior. This is the experiment. |
| **Adapter tests** | N/A (per-engine internals) | Petri-net compilation, solver step semantics, transition firing for the petrinet engine. Topo sort, inner-loop state, retry counter for the procedural engine. |
| **Integration fixture run** | Real pi-agent, real test runner | One greenfield CLI fixture executed end-to-end. Manual inspection of outcomes and `reports.jsonl` legibility. |

The contract tier is where the two-engine experiment is decided. Both engines must pass the same suite; any divergence is a bug in one of them, not a "different design." The adapter tier covers per-engine internals that don't have a meaningful equivalent in the other engine. The integration tier is what gets demoed.

## 10. PRD reconciliation

| PRD claim | Design posture |
|---|---|
| "Plan can be based on both greenfield and brownfield projects." | Dual-mode resolver makes the brownfield slot explicit and reachable. POC implements greenfield only; seed-copy/git-worktree step is the only added work to enable brownfield. PRD intent satisfied structurally. |
| "Actions looked up by name; extensible without restructuring." | Internal `ActionRegistry`. Plan schema unchanged — slices don't declare actions, they trigger the fixed TDD loop. New action types (lint, research, human-review) register without engine surgery. |
| "Live progress stream the user can watch." | Per-event streaming is the default UX, not opt-in. Verbose mode adds raw agent stdout. |
| "Architecture should allow future resumability." | Append-only `reports.jsonl` is the substrate; sufficient to reconstruct epic/slice state. Implementation deferred. |
| "Realistic fixture run all the way through." | One greenfield CLI fixture (TypeScript + Bun), two epics, five slices. Exercises happy paths, intra/inter-epic deps, epic-level integration verification, and the retry loop. |

## 11. Out of scope

- Milestones (third level above epics)
- Remediation slices when epic-level verification fails
- Dynamic replanning during a run
- Resumability implementation (architecture supports it)
- Parallel slice or epic execution
- Brownfield seed implementation (resolver branch reserved)
- Halt-and-continue across independent slices (halt-all on any failure for POC)
- Multiple test-runner backends (let fixture pick one)
- Human-review checkpoint (PRD stretch goal)
- Plan generation from spec (separate concern)
- Petrinaut / brunch UI integration

## 12. POC scope and deferrals

The design above is the target shape. The POC builds a deliberate subset and defers the rest as architectural slots — designed in the doc, not in the code. The full design is preserved here so future iterations have somewhere to start from rather than re-deriving it.

| Design element | Full design | POC posture |
|---|---|---|
| **Action dispatch** | `ActionRegistry` registers handlers by name; engines look up by name; new actions (e.g. `lint`, `human-review`, `research`) register without engine surgery. | Inline handler dispatch per engine (e.g. a record literal or switch). Promote to a real registry when a 3rd action type lands. |
| **Plan resolver** | Dual-mode by plan location: `<dir>/plan.yaml` → fixture (greenfield); `<dir>/.brunch/cook/plan.yaml` → codebase (brownfield). | Implemented for fixture mode and git-backed codebase mode. |
| **Brownfield seed** | When codebase mode is used and `<dir>/.git` exists, prefer `git worktree add`; copy missing runtime deps with CoW/reflink where possible. | Implemented for git-backed repos; non-git filtered copy remains deferred. |
| **Token-pointer discipline** | Universal rule: tokens between transitions carry only `{ reportId, sliceId, epicId }` pointers; all event content lives in `reports.jsonl`. Applied across both engines. | Petrinet engine enforces this internally (it's a hard constraint of the substrate). Procedural engine is free to pass data through normal function calls — each engine handles its own state shape, the shared seam is just inputs and outputs. |
| **Layer 2 adapter tests** | Per-engine internal tests (net compilation / solver / transition firing for petrinet; topo sort / inner-loop state transitions / retry counter for procedural). | Optional. Defer until a debugging need surfaces. Layer 1 (contract) + Layer 3 (integration) are mandatory; Layer 2 is added if and when it pays for itself. |
| **Streaming UX formatting** | Compact per-event lines like `[slice-1 ▸ test-writer] tests-written → 3 files`. | Implemented: elapsed timing, icons (▸/✓/✗/●/○), structured header/footer, `--verbose` for raw pi output. JSON stays in `reports.jsonl` only. |

Rationale for deferring: each item above is "right" for the productized version and "premature" for the POC. The experiment we actually need to run is whether the Petri-net substrate earns its complexity — none of the deferred items affect that experiment's signal. Adding them now would inflate the LOC count and make the comparison muddier, not crisper.

When the experiment concludes and the orchestrator productizes (or merges into something else), the deferrals become the natural follow-up backlog: lift inline dispatch into `ActionRegistry`, wire the codebase-mode resolver branch, add the seed step, etc.

## 13. Two-path experiment results

Both engines completed Fixture #1 end-to-end. Procedural: 206 LOC, ~9 min, 23 events. Petri-net: 410 LOC, ~13 min, 27 events. Both produced a working `txt` CLI with 154 agent-written tests passing.

**Verdict:** The procedural engine is half the code, faster to debug (stack traces point to loop lines, not fire() closures), and trivially readable. The Petri-net engine's main advantage is parallelism readiness — independent slices could fire concurrently without restructuring the engine. For serial execution, proc wins. Petri earns its complexity only when parallel execution or dynamic replanning enters scope.

Full comparison table in the POC summary doc.

## Lexicon

| Term | Definition |
|---|---|
| **plan** | YAML file describing epics + slices with definitions, dependencies, and verifications. The orchestrator's input. |
| **epic** | Organizational grouping of slices with cross-slice integration verification. |
| **slice** | The execution unit. A thin vertical increment across all relevant layers with its own definition and verifications. |
| **fixture** | Packaged test scenario for the orchestrator (plan + supporting artifacts). Used to test `cook` itself. |
| **engine** | Implementation of the `Orchestrator` interface. Two engines exist: `petrinet` and `procedural`. |
| **action** | A handler in the `ActionRegistry` (e.g. `write-tests`, `write-code`, `run-tests`, `evaluate-done`, `verify-epic`). Engines look up by name. |
| **report** | One structured event line in `reports.jsonl`. Carries the durable content; tokens carry only pointers to reports. |
| **worktree** | Isolated filesystem location where agents write during a run. Per-run; ephemeral. |
| **fixture mode** | Greenfield execution: plan at `<dir>/plan.yaml`, empty worktree. POC default. |
| **codebase mode** | Brownfield execution: plan at `<dir>/.brunch/cook/plan.yaml`, worktree seeded from `<dir>` on generated `cook/<runId>` branch. |
