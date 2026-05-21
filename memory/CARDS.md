<!-- CARDS.md — temporary execution queue for one PLAN frontier item.
     Created by ln-scope. Delete or overwrite when exhausted/superseded.
     Frontier: mode-shell-and-fixture-driver / FE-735 / ln/fe-735-mode-shell-fixture-driver -->

# Scope Cards — FE-735 Capture-Seam Fixes and Remaining M1 Slices

## Orientation

- **Containing seam:** M1 fixture-capture seam over the transport/projection layer: `brunch --mode rpc`, named `workspace.*` / `session.*` handlers, `WorkspaceSessionCoordinator`, Pi JSONL transcript truth, and `.brunch-fixtures/` bundle output.
- **Frontier item:** `mode-shell-and-fixture-driver` (FE-735) remains the Linear/branch boundary. Prior cards established print/RPC/projection and seeded briefs, but review found the real capture path still loses session identity without a fake coordinator.
- **Volatile state:** `memory/CARDS.md` had been exhausted/deleted; `memory/SPEC.md` has an uncommitted lexicon cleanup (`Lens switch`). `npm run verify` is green, but an additional no-injected-coordinator probe showed `captureFixtureRun()` copies a freshly opened empty session rather than the session that was seeded.
- **Main open risk:** M1 could appear fixture-ready while the fixture driver only proves an injected test double path, not the real Brunch host/session path.
- **Frontier obligations:** keep `WorkspaceSessionCoordinator` as the owner of session/spec selection (D21-L); keep public RPC methods product-shaped rather than filesystem/generic data APIs (D5-L, D19-L); keep Pi JSONL as transcript truth with no chat/turn store (D6-L, D12-L, D13-L, I10-L); keep captured-run bundles forward-compatible without overclaiming graph/coherence artifacts.

## Blocking instruction

Complete Card 1 before any actual captured-run work for briefs #1–#3. Cards 2–4 are hardening/cleanup and can be committed before or after Card 1, but should land before tying off FE-735. Card 5 depends on Card 1.

## Card 1 — Stable current-session capture path

**Status:** done

### Weight

Full scope card — fixes the real product seam between coordinator-owned session state, RPC projection, and fixture capture.

### Target Behavior

`captureFixtureRun()` copies the same selected session that `session.elicitationExchanges` projects.

### Boundary Crossings

```text
→ fixture capture caller
→ RPC stdio client (`workspace.snapshot`, `session.elicitationExchanges`)
→ Brunch host/coordinator session selection
→ selected Pi JSONL session file
→ `.brunch-fixtures/<brief-id>/<run-id>/` bundle writer
```

### Risks and Assumptions

- RISK: `FileWorkspaceSessionCoordinator.openExisting()` creates a fresh session on each call, so separate RPC requests see different session files → MITIGATION: add a no-injected-coordinator regression test first; fix by making the capture/RPC path use one stable host/session context or by teaching the coordinator to reopen/select the actual current session instead of creating a new one for each read.
- RISK: The fix bypasses `WorkspaceSessionCoordinator` and hardcodes `.brunch/sessions` lookup in fixture capture → MITIGATION: keep session identity resolution behind the coordinator/host seam; fixture capture should remain an RPC client over product handlers.
- RISK: Stabilizing current-session identity mutates the M0 session-binding invariant → MITIGATION: run existing coordinator and store-oracle tests; ensure exactly one `brunch.session_binding` per selected session remains true.
- ASSUMPTION: M1 only needs stable current-session capture, not arbitrary historical session selection → VALIDATE: a temp workspace with one selected spec/session and assistant→user entries captures that same JSONL and reports `exchangeCount: 1` without injecting a fake coordinator.

### Acceptance Criteria

✓ `fixture-capture.test.ts` (or equivalent) creates a real coordinator-backed temp workspace, appends assistant→user messages to the selected session, calls `captureFixtureRun()` without passing `coordinator`, and observes a copied JSONL containing those messages.
✓ The resulting `.meta.json` has `projectionSummary.status: "ready"` and `exchangeCount: 1` for that real no-injection capture.
✓ `workspace.snapshot` and `session.elicitationExchanges` in one capture operation refer to the same session id/file.
✓ Existing `verifyWorkspaceSessionStores` / coordinator tests still prove one binding per session and no incompatible session rebinding.

### Verification Approach

- Inner: regression unit/integration tests — prove no-injected-coordinator capture uses the real selected session.
- Middle: store/projection oracle — inspect temp `.brunch/state.json`, source JSONL, copied JSONL, and metadata for matching session identity and exchange count.
- Outer: none for this fix.

### Cross-cutting obligations

- Do not make fixture capture a privileged direct store reader for product semantics; use RPC/product handlers for projection.
- Preserve `cwd → spec → session` hierarchy and one-spec-per-session binding.
- Keep stable current-session identity narrow; defer historical session selection unless a later scope needs it.

## Card 2 — Reconcile fixture brief format docs

**Status:** done

### Weight

Light scope card — naming/documentation cleanup inside the established fixture area.

### Objective

Make fixture brief documentation and plan text agree with the implemented JSON brief format.

### Acceptance Criteria

✓ `.brunch-fixtures/README.md` describes JSON brief files and no longer says the directory is empty until M1.
✓ `memory/PLAN.md` no longer says `brief-library-curation` outputs YAML or validates brief YAML unless the implementation is changed back to YAML.
✓ README layout examples match the current `.brunch-fixtures/briefs/brief-001-*.json` naming style.

### Verification Approach

- Inner: `npm run fix` / `npm run verify`.
- Middle: doc grep/check — no stale “briefs are YAML” or “empty by design until M1” claims remain in touched fixture docs.

### Cross-cutting obligations

- Keep one canonical brief format for M1.
- Do not move brief curation into a loose examples folder; it remains under `.brunch-fixtures/briefs/`.

### Promotion checklist

- [ ] Does this change a requirement? No.
- [ ] Does this create, retire, or invalidate an assumption? No.
- [ ] Does this make or reverse a non-trivial design decision? No; it reconciles docs to existing implementation.
- [ ] Does this establish a new seam-level invariant? No.
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer? No.
- [ ] Does it cross more than two major seams? No.
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread? No.
- [ ] Can you not name the containing seam or current rationale from the live docs? No.

## Card 3 — Pi session-entry source-of-truth typing cleanup

**Status:** done

### Weight

Light scope card — type-source hardening inside the already-established projection seam.

### Objective

Make `elicitation-exchange.ts` project from Pi-owned session entry types instead of restating Pi message entry shape locally.

### Acceptance Criteria

✓ `elicitation-exchange.ts` imports/projects from Pi exported session entry types (`FileEntry`, `SessionEntry`, `SessionMessageEntry`, `CustomEntry`, `CustomMessageEntry`, or whichever exported types fit) where available.
✓ Local interfaces are retained only for Brunch semantic outputs (`EntryRange`, `ElicitationExchange`, `ElicitationExchangeProjection`) or narrow trust-boundary parse results that add new meaning.
✓ Tests still cover real `SessionManager` JSONL, structured Brunch custom entries, and orphan response handling.

### Verification Approach

- Inner: typecheck/build plus projector unit tests.
- Middle: real `SessionManager` JSONL round-trip test remains the seam oracle.

### Cross-cutting obligations

- Apply source-of-truth typing: import/infer/project; do not duplicate Pi's state space unless establishing a trust-boundary parser.
- Keep Brunch projection types as the new semantic boundary.

### Promotion checklist

- [ ] Does this change a requirement? No.
- [ ] Does this create, retire, or invalidate an assumption? No.
- [ ] Does this make or reverse a non-trivial design decision? No.
- [ ] Does this establish a new seam-level invariant? No.
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer? No.
- [ ] Does it cross more than two major seams? No.
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread? No.
- [ ] Can you not name the containing seam or current rationale from the live docs? No.

## Card 4 — Brunch-owned fixture metadata version

**Status:** done

### Weight

Light scope card — hardens metadata correctness at the fixture bundle boundary.

### Objective

Fixture metadata reports Brunch package version without reading the caller project's `package.json` by accident.

### Acceptance Criteria

✓ `readPackageVersion()` or its replacement resolves Brunch-owned package metadata from a stable module/package-root source, or writes an explicit `unknown`/omitted value when unavailable.
✓ A test proves capture from a temp cwd containing a conflicting `package.json` does not record that caller package version as `brunchVersion`.
✓ Metadata remains deterministic when a timestamp is supplied.

### Verification Approach

- Inner: fixture-capture unit/integration test.
- Middle: temp workspace metadata inspection.

### Cross-cutting obligations

- Captured-run metadata should describe the Brunch driver/runtime, not the user's project unless a distinct user-project metadata field is later added.
- Keep metadata minimal and forward-compatible with later `.graph.json` / `.coherence.json` artifacts.

### Promotion checklist

- [ ] Does this change a requirement? No.
- [ ] Does this create, retire, or invalidate an assumption? No.
- [ ] Does this make or reverse a non-trivial design decision? No.
- [ ] Does this establish a new seam-level invariant? No.
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer? No.
- [ ] Does it cross more than two major seams? No.
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread? No.
- [ ] Can you not name the containing seam or current rationale from the live docs? No.

## Card 5 — Actual captured runs for briefs #1–#3

**Status:** queued

### Weight

Full scope card — completes the remaining fixture-capture claim for M1 after the capture seam is trustworthy.

### Target Behavior

Briefs #1–#3 each have a deterministic captured run bundle.

### Boundary Crossings

```text
→ seeded brief file
→ deterministic scripted-user/driver path
→ `brunch --mode rpc` stdio surface
→ selected Pi JSONL transcript and exchange projection
→ `.brunch-fixtures/<brief-id>/<run-id>/` captured bundle
```

### Risks and Assumptions

- RISK: Captured runs are hand-authored files rather than produced by the fixture driver → MITIGATION: provide a command/test path that invokes the driver and writes bundles reproducibly.
- RISK: The driver pretends to be a full LLM agent-as-user before the loop is ready → MITIGATION: keep runs deterministic/scripted for M1, with metadata explicitly saying scripted/deterministic; defer generative/adversarial runs.
- RISK: Captures overclaim graph/coherence outputs before M4/M8 → MITIGATION: produce `.jsonl` + `.meta.json` only and record graph/coherence artifacts as absent/deferred, not empty truth.
- ASSUMPTION: A deterministic scripted response path is sufficient to establish the first replay-regression layer → VALIDATE: three bundles replay through projection checks and have non-empty exchange summaries.

### Acceptance Criteria

✓ Running the fixture driver creates one run bundle for each of `brief-001`, `brief-002`, and `brief-003` under `.brunch-fixtures/<brief-id>/<run-id>/`.
✓ Each bundle contains copied `.jsonl` and `.meta.json` artifacts; metadata names the brief id, run id, scripted/deterministic mode, session id, projection summary, and absent/deferred graph/coherence artifacts.
✓ A replay/projection test loads each captured `.jsonl` and asserts projection parity with the metadata summary.
✓ The capture path uses JSON-RPC stdio product methods rather than direct projection calls for the behavior it is proving.

### Verification Approach

- Inner: fixture driver and metadata tests — prove bundle creation and metadata shape.
- Middle: replay-regression fixture test — load captured JSONL bundles and assert projection parity for briefs #1–#3.
- Outer: none; qualitative LLM elicitation remains deferred.

### Cross-cutting obligations

- Establish the replay-regression layer without claiming property/adversarial layers are complete.
- Keep fixture outputs forward-compatible with `.graph.json` and `.coherence.json` while not creating fake placeholders as canonical truth.
- Keep generated run IDs stable or deterministic enough for review; if timestamped, tests should select runs through metadata, not brittle names.
