# FE-705 scope cards — fixture-capable LLM-as-user probe path

> Prepared by `ln-scope` on 2026-05-12 and revised after the packaged-boundary proof. These cards stay under the existing FE-705 frontier item and branch (`ln/fe-705-agent-capability-cli`). They are sub-slices, not new Linear issues or branches. The goal is a tracer-bullet path from external JSONL runner → preserved local DB fixture candidate → minimal model-backed user simulation, without adding phase closure/export or changing product UI.

## Orientation for a new thread

- Start by reading `memory/SPEC.md`, `memory/PLAN.md`, and this file. There is currently no `HANDOFF.md`.
- Containing seam: FE-705 agent capability CLI / external probe-runner seam governed by `memory/SPEC.md` Requirement 43, A89, D147, and I114.
- Relevant frontier item: `memory/PLAN.md` Next item 2, **Agent capability CLI + LLM-as-user fixture probe**. Keep all cards on branch `ln/fe-705-agent-capability-cli`; do not create a new Linear issue or Graphite branch for these sub-slices.
- Current repo state at scoping time: branch is ahead of origin with four FE-705 probe-runner commits; only known unrelated dirty state is untracked `.agents/skills/d3k/`, which should be left alone.
- What has already been proved: `scripts/agent-probes/probe-runner.ts` contains a scripted process-backed runner, tests, artifact bundle writing, redaction, and an import-boundary guard. A manual packaged-boundary smoke built the app, drove `node bin/brunch.js agent` through two real-provider turns, and wrote artifacts at `/tmp/brunch-probe-artifacts-9FQyPB`.
- Main open risk: probe / LLM-as-user / fixture-candidate code must stay clearly outside Brunch product runtime and mutation authority. The next card preserves fixture state without making it product runtime state.

## Layering decision for this queue

Treat `brunch agent` itself as product/runtime code, but treat the probe runner and fixture generator as **development harness** code.

- Keep in `src/server/`:
  - `agent-jsonl.ts`
  - `capabilities.ts`
  - capability registry / DB / product mutation handlers
- Move out of `src/server/`:
  - `probe-runner.ts`
  - `probe-runner.test.ts`
  - future LLM-as-user simulator
  - future fixture-candidate helpers
- Target location:

```text
scripts/agent-probes/
  probe-runner.ts
  probe-runner.test.ts
  llm-user.ts                 # later card, if useful
  fixture-candidate.ts         # later card, if useful
```

- Tooling must cover `scripts/` so this harness remains linted/formatted/tested. Update `package.json` scripts as needed so `npm run fix`, `npm run check`, and `npm run verify` include `scripts/`.
- Boundary rule: `scripts/agent-probes/**` may spawn `node bin/brunch.js agent`, use Node filesystem/process utilities, and import narrow shared request schemas if necessary, but must not import Brunch DB, capability dispatch/registry, ORM schema, core workflow handlers, route-transition handlers, or turn-response transition handlers.

## Card 11 — Move probe runner to scripts harness boundary

**Status:** done

### Objective

The probe runner lives under `scripts/agent-probes/` as development harness code while remaining covered by project lint/format/test tooling and protected from product mutation-authority imports.

### Acceptance Criteria

✓ `src/server/probe-runner.ts` and `src/server/probe-runner.test.ts` are moved to `scripts/agent-probes/probe-runner.ts` and `scripts/agent-probes/probe-runner.test.ts` or an equivalent `scripts/agent-probes/` mini-library shape.
✓ `package.json` `fmt`, `fmt:check`, `lint`, and `lint:fix` include `scripts/` so the moved harness remains in the normal `npm run fix`, `npm run check`, and `npm run verify` gates.
✓ The moved tests still pass and continue proving scripted JSONL transport, process-backed runner, artifact bundle writing, redaction, and import-boundary behavior.
✓ The import-boundary test is updated for `scripts/agent-probes/**` and forbids imports from `src/server/db`, `src/server/capabilities`, `src/server/capability-registry`, `src/server/schema`, `src/server/core`, `src/server/chat-route-transition`, and `src/server/turn-response-transition`.
✓ Any manual smoke snippets or comments refer to importing from `./scripts/agent-probes/probe-runner.ts`, not `./src/server/probe-runner.ts`.

### Verification Approach

- Inner: `npm run test -- scripts/agent-probes/probe-runner.test.ts` (or the moved test path) plus the static import-boundary test.
- Gate: `npm run verify` to prove scripts are included in check/test/build and the product runtime still builds without bundling the harness as server code.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

Result: stays light. This aligns file placement with the existing FE-705 decision that probe artifacts and LLM-as-user scenarios belong to an external runner, while `brunch agent` remains the product JSONL adapter.

## Card 12 — Preserve probe workspace state for fixture candidates

**Status:** done

### Objective

Process-backed probe runs can optionally preserve the temp workspace state that contains the real `.brunch` SQLite database alongside the review artifacts.

### Acceptance Criteria

✓ `scripts/agent-probes/probe-runner.test.ts` — `runProcessBackedProbe()` records the temp `workspaceCwd` in the artifact bundle and run result without exposing it as ambient selected product state.
✓ `scripts/agent-probes/probe-runner.test.ts` — when fixture preservation is enabled, the runner copies the workspace `.brunch/` directory or database file into the output artifact directory under a stable `workspace-state/` path.
✓ `scripts/agent-probes/probe-runner.test.ts` — when fixture preservation is disabled, existing minimal artifacts still write without copying `.brunch/` state.
✓ The copied fixture state is outside the live temp workspace and can survive temp workspace cleanup.

### Verification Approach

- Inner: fake process / filesystem oracle in `scripts/agent-probes/probe-runner.test.ts` for workspace path metadata, fixture copy behavior, and disabled-by-default compatibility.
- Middle: manual packaged-boundary smoke can inspect the copied SQLite fixture candidate after `npm run build` when provider credentials are present.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

Result: stays light. This preserves evidence inside the already-established external probe-runner seam and does not change Brunch product persistence semantics.

## Card 13 — User-simulator policy interface

**Status:** done

### Objective

The probe runner can obtain turn responses through an injected user-simulator policy instead of only through positional scripted answers.

### Acceptance Criteria

✓ `scripts/agent-probes/probe-runner.test.ts` — `runScriptedProbe()` or its successor accepts an injected policy that receives the scenario brief, current `chat.read` projection, active turn, and prior answered turns.
✓ `scripts/agent-probes/probe-runner.test.ts` — the existing scripted behavior is reimplemented as one policy and still handles free-text and option-bearing turns.
✓ `scripts/agent-probes/probe-runner.test.ts` — policy errors become structured probe errors and artifact summaries instead of uncaught exceptions.
✓ No `scripts/agent-probes/**` code imports DB, capability dispatch/registry, schema, core, route-transition, or turn-response authority modules directly.

### Verification Approach

- Inner: fake transport / policy oracle proves response-policy inputs, response payload construction, and structured policy failure handling.
- Middle: import-boundary test protects the external-runner authority boundary.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

Result: stays light. This is a local extension point inside the external runner, not a new Brunch product API.

## Card 14 — Model-backed LLM-as-user policy with prompt artifacts

**Status:** done

### Target Behavior

A model-backed user-simulator policy can answer one probe turn from the current `chat.read` projection by rendering a strict JSON-response prompt and parsing the model output into a `turn.submitResponse` payload.

### Boundary Crossings

```text
→ scripts/agent-probes user-simulator policy
→ rendered simulated-user prompt/context
→ injected model adapter
→ strict JSON parse / response validation
→ turn.submitResponse payload
→ probe artifact event
```

### Risks and Assumptions

- RISK: The simulated user accidentally acts like the interviewer or invents product state → MITIGATION: prompt frames the model as the user only, includes only scenario brief + current question/options + compact prior Q/A, and accepts only strict response JSON.
- RISK: Model output is malformed or semantically invalid for the current turn → MITIGATION: parse through the existing turn-response payload schema shape and record structured parse failures in artifacts.
- ASSUMPTION: A `chat.read` projection contains enough context for a minimal LLM-as-user to answer early grounding turns without `turn.get` → VALIDATE: fake adapter tests plus opt-in real-provider smoke over two turns → `memory/SPEC.md` §Assumptions A89.

### Acceptance Criteria

✓ `scripts/agent-probes/probe-runner.test.ts` or `scripts/agent-probes/llm-user.test.ts` — a fake model adapter receives a rendered prompt containing scenario brief, active question, options when present, and compact prior Q/A.
✓ Valid model JSON for free-text and option-selection turns becomes the correct `turn.submitResponse` payload.
✓ Invalid JSON or schema-invalid model output becomes a structured probe error, not a thrown crash.
✓ `artifact-bundle.json` includes simulated-user prompt, raw model output, parsed response, and parse/validation status events.

### Verification Approach

- Inner: fake model-adapter oracle proves prompt rendering, parsing, validation, and artifact event capture without provider credentials.
- Middle: opt-in real-provider smoke after Card 15 proves the adapter can drive the packaged CLI through real interviewer questions.

## Card 15 — Opt-in LLM-as-user packaged-boundary smoke

**Status:** done

### Objective

A manual/opt-in smoke command can run the model-backed user simulator against `node bin/brunch.js agent`, preserve fixture state, and report whether a two-turn fixture candidate was produced.

### Acceptance Criteria

✓ A documented invocation or tiny test helper runs `npm run build` then `runProcessBackedProbe()` with the default packaged command, model-backed user policy, explicit output directory, and fixture preservation enabled.
✓ The smoke prints the artifact directory, final frontier state, turns answered, and errors as JSON only.
✓ On success, the artifact directory contains review artifacts plus preserved workspace state suitable for later golden-fixture curation.
✓ On provider/model failure, the artifact directory contains redacted failure artifacts and no secret-bearing stack dumps.

### Verification Approach

- Inner: fake model / fake process test covers smoke helper command construction and JSON summary shape without provider credentials.
- Outer: manual real-provider smoke proves packaged CLI + Brunch interviewer + LLM-as-user + persisted fixture artifacts end to end.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

Result: stays light if implemented as an opt-in/manual proof wrapper over the existing runner seam. Promote if it becomes a committed product CLI surface or changes fixture authority semantics.

## Card 16 — Fixture-candidate normalization checkpoint

**Status:** next

### Objective

A completed probe artifact directory can be evaluated as a fixture candidate using deterministic metadata checks before it is promoted into a golden fixture corpus.

### Acceptance Criteria

✓ A fixture-candidate helper inspects an artifact directory and reports presence/shape of `artifact-bundle.json`, `summary.json`, `raw-jsonl.ndjson`, `final-chat.json`, and preserved workspace state when expected.
✓ The helper reports non-deterministic fields that would need normalization for goldens, including timestamps, ids, durations, temp paths, and provider-dependent question wording.
✓ Tests cover a complete candidate, a missing workspace-state candidate, and an error-run candidate without requiring a provider.
✓ The helper does not bless or copy artifacts into a permanent corpus yet; it only reports readiness and normalization debt.

### Verification Approach

- Inner: filesystem fixture oracle over synthetic artifact directories.
- Middle: run against the manual smoke artifact directory to decide whether the next frontier is golden corpus curation or more normalization.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

Result: stays light. This is a diagnostic checkpoint before creating any durable golden fixture corpus policy.
