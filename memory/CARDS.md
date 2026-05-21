# Scope cards — FE-735 M1 review fixes

## Orientation

- Containing seam: M1 mode shell / fixture driver, especially the JSON-RPC fixture capture path and elicitation-exchange projection over Pi JSONL.
- Frontier item: `mode-shell-and-fixture-driver` / FE-735; these are review-fix slices inside the same frontier, not new Linear or branch units.
- Volatile state: `HANDOFF.md` remains transfer-only and untracked; the completed M1 queue was deleted, but review found blocking correctness issues before M1 tie-off.
- Main open risk: the first golden fixture captures can look structurally valid while encoding the wrong product state, so fixes must assert semantic binding/projection parity rather than only file existence.
- Cross-cutting obligations: preserve thin named RPC methods over projection handlers, Pi JSONL as transcript truth, no canonical chat/turn store, source-of-truth typing from Pi session entries, and the replay/runbook oracle layer for M1.

## Card 1 — status: done

### Objective

Scripted captures for briefs #1–#3 bind each captured session to the brief being captured.

### Acceptance Criteria

✓ Capturing deterministic runs for briefs #1–#3 produces JSONL whose single `brunch.session_binding.data.specTitle` matches the corresponding brief title.
✓ Capturing deterministic runs for briefs #1–#3 does not reuse brief #1's spec id/title for later brief sessions.
✓ The committed `scripted-001` bundles for briefs #1–#3 are regenerated so their bindings, prompts, metadata, and projection summaries agree.

### Verification Approach

- Inner: fixture-capture tests — assert per-brief binding/title/id semantics and existing projection metadata parity.
- Middle: fixture replay/parity test over committed bundles — catches stale golden files after regeneration.
- Outer: human brief-quality review remains manual/qualitative after the scripted oracle confirms structural correctness.

### Cross-cutting obligations

- Captured runs are replay-regression seeds, not generic examples; they must not smuggle wrong workspace/spec/session state into M2.
- Keep fixture capture routed through the coordinator/RPC-selected session path; do not reintroduce an injected-coordinator-only capture path.
- Preserve JSONL transcript truth and avoid any parallel chat/turn representation.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Card 2 — status: next

### Objective

Elicitation exchange projection treats Pi `toolResult` messages as prompt-side transcript entries using Pi-owned message roles.

### Acceptance Criteria

✓ A Pi-shaped `toolResult` message between assistant prompt and user response is included in the prompt-side entry range.
✓ The projector no longer checks for a non-canonical `tool` message role.
✓ The role helper preserves the Pi-owned message role union closely enough that future role-literal drift is type-visible instead of widened away unnecessarily.

### Verification Approach

- Inner: elicitation-exchange unit test with a real Pi-shaped tool-result entry.
- Inner: type-aware lint/build — verifies source-of-truth typing remains imported/projected from Pi rather than locally restated.
- Middle: existing RPC/session projection tests — ensure the handler still returns product-shaped exchanges from the selected session.

### Cross-cutting obligations

- Pi session entry and agent-message types own transcript shape; Brunch owns only the semantic `ElicitationExchange` projection.
- Preserve D13 prompt-side span semantics: system/assistant/tool-side entries since the previous user response belong to the prompt span.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Card 3 — status: next

### Objective

M1 manual verification is available as a single runbook command that prints expected outcomes and actual observed outputs.

### Acceptance Criteria

✓ `./runbooks/verify-m1.sh` runs from the repository root and prints clearly separated `Expected outputs` and `Actual outputs` sections.
✓ The runbook checks per-brief binding/title alignment, committed bundle metadata/projection parity, print-mode smoke output, and RPC `workspace.snapshot` / `session.elicitationExchanges` smoke output.
✓ The runbook exits nonzero on structural failures while still printing enough actual output for quick human diagnosis.
✓ The runbook includes explicit human-review prompts for qualitative judgments that cannot be fully automated yet, such as brief quality and golden-capture representativeness.

### Verification Approach

- Inner: runbook script smoke from tests or a direct command in the build slice — proves the command executes in a clean repo checkout.
- Middle: runbook oracle — checks durable artifacts and projection/RPC surfaces, matching SPEC §Runbook Oracle Design.
- Outer: human uses the runbook output to approve fixture representativeness and product shape.

### Cross-cutting obligations

- Runbooks are executable oracles over canonical stores/projection handlers, not ad hoc manual notes.
- Keep the output product-shaped; do not turn the runbook into a generic file dump.
- The runbook should aid manual judgment without pretending to automate LLM/brief quality review completely.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?
