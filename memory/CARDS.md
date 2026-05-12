# FE-705 scope cards — proof-of-life JSONL probe runner

> Prepared by `ln-scope` on 2026-05-11. These cards stay under the existing FE-705 frontier item and branch (`ln/fe-705-agent-capability-cli`). They are sub-slices, not new Linear issues or branches. Do not add `turn.get`, phase closure/export, or LLM-as-user until this queue proves where the runner bottleneck is.

## Orientation

- Containing seam: FE-705 agent capability CLI / probe-runner seam governed by `memory/SPEC.md` Requirement 43, A89, D147, and I114.
- Relevant frontier item: `memory/PLAN.md` Next item 2, **Agent capability CLI + LLM-as-user fixture probe**; the JSONL adapter is working through two real-provider turns, and the next proof is an external runner over JSONL.
- Volatile handoff state: `HANDOFF.md` says no card is live; Card 6 passed `npm run verify` and a manual Anthropic-backed temp-workspace JSONL smoke reached a second answerable frontier.
- Main open risk: the probe runner must become an external client with reviewable artifacts without quietly importing DB/capability handlers or growing into speculative LLM-as-user / phase-export scope.

## Card 7 — Probe runner JSONL client and scripted user policy

**Status:** done

### Target Behavior

A probe-runner core can drive the first two interview responses through an injected JSONL transport using only `chat.read` projections and deterministic scripted answers.

### Boundary Crossings

```text
→ probe runner scenario command sequence
→ JSONL client / injected transport boundary
→ scripted user response policy
→ parsed Brunch read projection / response request payloads
```

### Risks and Assumptions

- RISK: The runner accidentally couples to current `chat.read` object internals instead of the agent-facing projection contract → MITIGATION: centralize projection parsing in a tiny typed client module and keep policy tests fixture-shaped around observable `frontier`, `turns`, `options`, and `nextCommands` fields.
- RISK: Deterministic scripted answers cannot handle option-bearing turns → MITIGATION: support both free-text answers and option-position selection from the first implementation, with tests covering both response shapes.
- ASSUMPTION: `chat.read` is broad enough for a first scripted runner without adding `turn.get` → VALIDATE: tests construct payloads from `chat.read` alone and no card in this queue adds `turn.get` → `memory/SPEC.md` §Assumptions A89.

### Acceptance Criteria

✓ `probe-runner.test.ts` — a fake JSONL transport receives `spec.create → chat.getPrimary → chat.ensureReady → chat.read → turn.submitResponse → chat.read → chat.ensureReady → chat.read` in order.
✓ `probe-runner.test.ts` — the scripted policy submits free-text for an open question and an option selection payload when `chat.read` exposes options.
✓ `probe-runner.test.ts` — the runner reports `turnsAnswered: 2`, final frontier state, and structured errors without importing Brunch DB or capability dispatch modules.

### Verification Approach

- Inner: unit / fake-transport interaction oracle — proves sequencing, response construction, and error propagation without a provider.
- Middle: import-shape/code-boundary oracle — confirms the runner core is client-side over JSONL concepts, not a DB/handler caller.

## Card 8 — Process-backed temp-workspace proof runner

**Status:** done

### Target Behavior

A local probe runner can launch the packaged `brunch agent` process in an isolated temp workspace and persist a minimal proof-of-life artifact bundle.

### Boundary Crossings

```text
→ probe runner process adapter
→ child process stdin/stdout JSONL session
→ packaged Brunch CLI agent command
→ temp workspace `.brunch/` runtime state
→ probe output artifact directory outside `.brunch/`
```

### Risks and Assumptions

- RISK: Real-provider availability makes automated tests flaky → MITIGATION: test process plumbing with a fake child process or injected spawn adapter, and keep compiled CLI / Anthropic smoke opt-in unless credentials are present.
- RISK: Temp workspace cleanup or output paths leak `.brunch/` internals into curated artifacts → MITIGATION: write artifacts to an explicit output directory outside the temp workspace state directory and assert artifact paths do not point inside `.brunch/`.
- ASSUMPTION: The packaged `bin/brunch.js agent` remains the right process boundary for proof-of-life use → VALIDATE: an opt-in/manual smoke command launches that binary in a temp cwd and reaches a second answerable frontier → `memory/SPEC.md` §Assumptions A89.

### Acceptance Criteria

✓ `probe-runner.test.ts` — process-backed runner uses an injected spawn/process adapter to write JSONL requests and parse JSONL responses.
✓ `probe-runner.test.ts` — a run creates an isolated workspace cwd and writes raw request/response JSONL, final `chat.read` projection, and run summary outside `.brunch/`.
✓ opt-in smoke command/documented invocation — when provider credentials and built package output are available, the runner reaches a second answerable frontier through `bin/brunch.js agent`.
  - Manual invocation shape for a future smoke wrapper: build first, then call `runProcessBackedProbe()` with the default command (`node bin/brunch.js agent`), an explicit `outputDir`, and a temp workspace created by the runner; this is intentionally not a CI command until provider credentials are controlled.

### Verification Approach

- Inner: fake child-process oracle — proves process lifecycle, JSONL parsing, artifact paths, and cleanup semantics deterministically.
- Middle: opt-in real-provider smoke — proves the external process boundary against the compiled CLI without making CI depend on credentials.

## Card 9 — Probe artifact schema and safe summaries

**Status:** done

### Objective

Probe runs produce deterministic, reviewable artifact bundles that are safe to inspect, compare, and eventually curate into fixture candidates.

### Acceptance Criteria

✓ Artifact schema records scenario name/brief, command sequence, raw JSONL transcript, parsed events, final chat projection, run summary, errors, duration, and non-secret environment metadata.
✓ Failure summaries redact API-key-like values and avoid provider stack/internal object dumps while preserving useful failure class and message context.
✓ Successful summaries identify final frontier state and compact question/answer pairs from the driven turns.
✓ Tests cover successful and failed artifact rendering without launching a real provider.

### Verification Approach

- Inner: artifact serialization/redaction tests.
- Middle: snapshot-like deterministic summary oracle for success and failure bundles.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

Result: stays light. This hardens artifacts inside the already-established FE-705 probe-runner seam and does not change durable product requirements or capability authority.

## Card 10 — Probe runner import-boundary guard

**Status:** queued

### Objective

The probe-runner module boundary is mechanically guarded so runner code can only exercise Brunch through the JSONL client/process wrapper.

### Acceptance Criteria

✓ Boundary test fails if probe-runner modules import `src/server/db`, `src/server/capabilities`, `src/server/capability-registry`, server handlers, or ORM schema modules directly.
✓ Allowed imports are documented in the test or module boundary helper: Node process/fs/path utilities, probe-runner private modules, and the JSONL client/process wrapper surface.
✓ Existing capability and JSONL tests continue to prove server-owned handlers remain the mutation authority.

### Verification Approach

- Inner: static import-boundary test plus existing capability / agent-jsonl unit tests.
- Middle: `npm run verify` gate.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

Result: stays light. It enforces I114 for the new runner code without changing the I114 invariant itself.
