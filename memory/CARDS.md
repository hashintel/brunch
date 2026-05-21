<!-- CARDS.md — temporary execution queue for one PLAN frontier item.
     Created by ln-scope. Delete or overwrite when exhausted/superseded.
     Frontier: mode-shell-and-fixture-driver / FE-735 / ln/fe-735-mode-shell-fixture-driver -->

# Scope Cards — FE-735 Review Fixes and Next M1 Slices

## Orientation

- **Containing seam:** M1 transport/projection seam: CLI transport-mode dispatch, named JSON-RPC handlers, coordinator-owned workspace/session state, Pi JSONL transcript projection, and fixture capture.
- **Frontier item:** `mode-shell-and-fixture-driver` (FE-735) remains the tracker/branch boundary. The initial print/RPC/projection cards landed, but review found two blocker defects in the projection/RPC seam.
- **Volatile state:** No `HANDOFF.md`; current review found that synthetic tests pass while real `SessionManager` JSONL projects as empty, and that public `session.elicitationExchanges` currently accepts an arbitrary filesystem path.
- **Main open risk:** fixture-driver work would encode the wrong transcript model if it proceeds before real Pi JSONL projection and coordinator-owned session access are fixed.
- **Frontier obligations:** keep transport modes distinct from agent modes/lenses (D23-L); keep named RPC methods product-shaped, not generic filesystem/data reads (D5-L, D19-L); keep Pi JSONL as transcript truth without chat/turn tables (D6-L, D12-L, D13-L, I10-L); derive/import/project TypeScript shapes from owning seams rather than duplicating Pi state spaces.

## Blocking instruction

Complete Cards 1 and 2 before any fixture-driver or brief-capture work. Card 3 may follow immediately after those blockers. Cards 4–5 are the next M1 delivery slices after the seam is trustworthy.

## Card 1 — Real Pi JSONL elicitation projection

**Status:** done

### Weight

Full scope card — corrects the transcript projection seam that M1 fixture capture depends on.

### Target Behavior

A `SessionManager`-created assistant→user JSONL transcript projects to one ready elicitation exchange.

### Boundary Crossings

```text
→ Pi SessionManager JSONL file
→ JSONL loader
→ Pi transcript-entry projection boundary
→ elicitation exchange projector
→ session projection result
```

### Risks and Assumptions

- RISK: Tests keep using synthetic top-level `role` entries and miss Pi's real nested `message.role` shape → MITIGATION: add a test that writes the transcript through `SessionManager.appendMessage`, reloads the JSONL file, and asserts the exchange projection.
- RISK: Fixing real Pi message entries accidentally loses custom structured prompt/response support → MITIGATION: keep custom-entry tests, but make their shape match Pi custom entries and classify custom entries separately from message entries.
- RISK: Orphan user/response entries before any prompt are later paired with an unrelated prompt → MITIGATION: ignore unmatched response-side entries or return an explicit unmatched/invalid diagnostic shape; do not silently attach them to later prompts.
- ASSUMPTION: Pi exports enough session entry/message types to avoid restating the message state space → VALIDATE: import/project from Pi exported types where available; if not exported, keep a narrow local runtime projection from `unknown` and document it as a trust-boundary parser rather than a duplicate Pi DTO.

### Acceptance Criteria

✓ `elicitation-exchange.test.ts` creates a real persisted session with `SessionManager.create(...).appendMessage(...)`, loads that JSONL file, and observes one ready exchange with assistant prompt id and user response id.
✓ Existing synthetic tests are updated to use Pi-shaped entries (`entry.message.role`) or intentionally named boundary fixtures; no production classifier relies on top-level `entry.role` for Pi message entries.
✓ A transcript with a user response before any prompt does not produce an exchange pairing that response with a later assistant prompt.
✓ Structured Brunch prompt/response custom entries still project to the correct side when they use the Pi custom entry shape.

### Verification Approach

- Inner: unit tests over projector helpers — prove role classification, custom-entry classification, and orphan-response behavior.
- Middle: Pi JSONL round-trip test using `SessionManager` — proves projection against the actual canonical transcript store.
- Outer: none for this fix.

### Cross-cutting obligations

- Preserve Pi JSONL as transcript truth and avoid chat/turn tables.
- Use source-of-truth typing: import/infer/project Pi-owned shapes when possible; only declare local types for the new semantic projection (`ElicitationExchange*`).
- Keep exchange ranges stable enough for later observer jobs and replay fixtures.

## Card 2 — Product-scoped session exchange RPC

**Status:** done

### Weight

Full scope card — corrects the public RPC method boundary so it remains product-shaped and coordinator-owned.

### Target Behavior

`session.elicitationExchanges` projects the coordinator-selected Brunch session instead of reading an arbitrary client-supplied file path.

### Boundary Crossings

```text
→ JSON-RPC stdio request
→ named `session.*` handler
→ WorkspaceSessionCoordinator
→ selected session JSONL file under `.brunch/sessions/`
→ elicitation exchange projector
→ JSON-RPC response
```

### Risks and Assumptions

- RISK: Keeping `{ file }` as a public param turns a named product method into a filesystem read primitive → MITIGATION: remove public file-path params; resolve the current session through the coordinator, or accept only a product identifier that is resolved under the workspace session directory.
- RISK: The handler creates a session in a `select_spec` workspace when the caller only asked for projection → MITIGATION: define and test the no-selected-session result/error explicitly; do not prompt and do not run an agent turn.
- RISK: JSON-RPC request typing treats invalid ids as valid because the type guard under-validates → MITIGATION: validate/project `id` at the runtime boundary while touching the handler parser.
- ASSUMPTION: For M1, projecting the current coordinator-selected session is enough; historical session lookup can wait → VALIDATE: contract tests cover current-session projection and reject raw file params.

### Acceptance Criteria

✓ `session.elicitationExchanges` with no params returns exchanges for the coordinator's current ready session.
✓ `session.elicitationExchanges` with `{ file: ... }` returns `Invalid params` and never reads that path.
✓ A no-selected-spec/session state returns a product-shaped JSON-RPC error or empty/no-session result that does not create a session or prompt the user.
✓ JSON-RPC requests with invalid `id` shapes are rejected as `Invalid Request` rather than being accepted by TypeScript-only narrowing.

### Verification Approach

- Inner: handler unit tests — prove params rejection, id validation, and no-selected-session behavior.
- Middle: stdio contract test — request `session.elicitationExchanges` through `brunch --mode rpc` and assert the response is derived from the coordinator-selected session.
- Outer: none for this fix.

### Cross-cutting obligations

- Public RPC methods remain named product methods, not generic data/filesystem APIs.
- Coordinator remains the owner of workspace/session selection and session binding.
- Keep raw-file projection as a private helper/test utility only if it remains useful for projector tests.

## Card 3 — RPC/print projection parity smoke

**Status:** done

### Weight

Light scope card — hardens an already-established seam after the two blocker fixes.

### Objective

Prove the print snapshot and RPC workspace snapshot expose the same product-shaped coordinator state.

### Acceptance Criteria

✓ A temp workspace with a selected spec produces matching key fields from `brunch --mode print` and `workspace.snapshot` over RPC.
✓ The parity test uses the real coordinator/store path rather than only injected fake states.
✓ The test does not require an agent turn or `InteractiveMode`.

### Verification Approach

- Inner: integration-style vitest with temp cwd.
- Middle: optional CLI spawn if direct `runBrunchCli` coverage is insufficient.

### Cross-cutting obligations

- Keep print as a snapshot transport mode only.
- Keep snapshot projection reusable without becoming a generic read-model platform.

### Promotion checklist

- [ ] Does this change a requirement? No.
- [ ] Does this create, retire, or invalidate an assumption? No.
- [ ] Does this make or reverse a non-trivial design decision? No.
- [ ] Does this establish a new seam-level invariant? No; it tests D19-L/D23-L.
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer? No.
- [ ] Does it cross more than two major seams? No.
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread? No.
- [ ] Can you not name the containing seam or current rationale from the live docs? No.

## Card 4 — Fixture capture bundle skeleton

**Status:** next

### Weight

Full scope card — starts the fixture-driver half of M1 over the now-trusted RPC/projection seam.

### Target Behavior

A deterministic fixture capture command writes a `.jsonl` plus `.meta.json` bundle for one scripted run.

### Boundary Crossings

```text
→ fixture driver command/module
→ `brunch --mode rpc` stdio client
→ `workspace.snapshot` / `session.elicitationExchanges`
→ selected Pi JSONL transcript
→ `.brunch-fixtures/<brief-id>/<run-id>/` bundle writer
```

### Risks and Assumptions

- RISK: The driver becomes a one-off harness disconnected from product RPC → MITIGATION: run it through the JSON-RPC stdio surface, not direct function calls, except for unit-level bundle writer tests.
- RISK: Bundle metadata overpromises graph/coherence artifacts before those substrates exist → MITIGATION: write `.jsonl` and `.meta.json` only, with explicit placeholders/omissions for future `.graph.json` and `.coherence.json`.
- RISK: LLM variability obscures whether capture plumbing works → MITIGATION: keep this first run deterministic/scripted; do not require a model-generated interview yet.
- ASSUMPTION: A replay-regression skeleton is valuable before full agent-as-user behavior exists → VALIDATE: bundle writer and RPC driver tests assert stable paths, metadata, and transcript/projection parity.

### Acceptance Criteria

✓ A fixture driver can start/connect to RPC mode, request workspace/session projections, and write a run directory under `.brunch-fixtures/<brief-id>/<run-id>/`.
✓ The bundle includes the source session `.jsonl` and `.meta.json` with brief id, run id, timestamp, brunch version/commit if available, session id, and projection summary.
✓ The driver is deterministic in tests and does not require live LLM output.

### Verification Approach

- Inner: bundle writer unit tests — prove metadata shape and path layout.
- Middle: stdio driver integration test — prove capture through RPC and JSONL copy/projection parity.
- Outer: none until real brief walkthroughs land.

### Cross-cutting obligations

- Establish replay-regression fixture architecture without pretending property/adversarial layers are complete.
- Keep captured-run format forward-compatible with later `.graph.json` and `.coherence.json` artifacts.
- Do not bypass RPC for the product behavior the fixture driver is meant to prove.

## Card 5 — Seed first deterministic briefs

**Status:** queued

### Weight

Light scope card — text/fixture seed work inside the established fixture strategy.

### Objective

Create the first three deterministic brief files aligned with `BEHAVIORAL_KERNELS.md` and the fixture capture metadata shape.

### Acceptance Criteria

✓ `.brunch-fixtures/briefs/` contains briefs #1–#3 with stable ids, titles, kernel tags, expected structural observations, and deterministic scripted-user notes.
✓ Brief files validate against any schema/helper introduced by Card 4, or a minimal shape checker is added if no schema exists yet.
✓ Brief wording stays product-brief-like rather than implementation-test-like.

### Verification Approach

- Inner: brief shape/schema tests or fixture file checker.
- Middle: run the deterministic fixture capture against at least one seeded brief if Card 4 is complete.

### Cross-cutting obligations

- Keep the brief corpus aligned with replay/property/adversarial fixture architecture.
- Do not encode graph/coherence expectations before those substrates exist; note future expectations as deferred metadata if needed.

### Promotion checklist

- [ ] Does this change a requirement? No.
- [ ] Does this create, retire, or invalidate an assumption? No.
- [ ] Does this make or reverse a non-trivial design decision? No.
- [ ] Does this establish a new seam-level invariant? No.
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer? No.
- [ ] Does it cross more than two major seams? No.
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread? No.
- [ ] Can you not name the containing seam or current rationale from the live docs? No.
