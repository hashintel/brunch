# Minimal Petri editor end-to-end comparison

## Overview

**Problem.** Determine whether differences between Brunch- and Claude-elicited specifications survive an exact, content-addressed handoff into Brunch and Claude Code execution.

**Result.** Both elicitation lanes produced valid approved specifications and both handoffs remained byte-identical. All four retained execution cells were valid failed attempts: the two Brunch cells halted before implementation, while the two Claude Code cells passed their own test/build gates but failed the unchanged common browser oracle. No execution cell passed end to end.

**Confidence.** High for the retained case-level facts and exact-handoff identity; low for any comparative product conclusion. This is one case, one retained final attempt per cell, no predeclared scoring rubric, and no fully passing execution cell.

## Study design

- Kind: staged end-to-end comparison.
- Case: `minimal-petri-net-editor-v1`, greenfield whole frontend application, build-to-spec.
- Axes: two approved specification sources (`brunch_spec`, `claude_spec`) by two executors (`brunch`, `claude_code`).
- Handoff: exact approved Markdown bytes, SHA-256 addressed, with no repair or normalization.
- Execution budget: 90 minutes, at most two mechanical interventions, zero substantive human interventions.
- Evaluation: the same frozen `petri-editor-browser-v2` oracle for every cell.
- Sample: one retained final attempt per cell. No rubric, judge, aggregate score, or winner rule was frozen.

The canonical study contract is in
[`../../../../testing/end-to-end-comparisons/cases/minimal-petri-net-editor/study-contract.json`](../../../../testing/end-to-end-comparisons/cases/minimal-petri-net-editor/study-contract.json).

## Run identity

- Run: `petri-editor-e2e-20260721T132600Z`
- Study contract: `sha256:7ed2c2c867cf611c28908992492c6f5d89c9f7806ad76e28546547749f20a5c7`
- Brunch specification: `sha256:894c9e80126967613adb3745b025185b300cc62c4cf61f01b454225c0112aaff`
- Claude specification: `sha256:60582a1447e38c46cb9e4d8fdd57bc227d28bc351d40b826bd84d49c0d68189e`

The [matrix manifest](matrix-manifest.json) links each cell to its immutable [handoff](handoffs/) and `ExecutionAttempt`.

## Validity before outcomes

### Elicitation

Both lanes completed under the same mission, shared baseline, actor recipe, question/turn limits, and controller reveal policy. Each produced one operator-approved specification. The retained handoff records preserve the approved bytes and study identity.

### Handoff

Both handoffs are valid. The specifications supplied to all four execution workspaces match their approved handoff hashes exactly. No silent repair occurred.

### Execution

All four final matrix attempts are valid failed attempts. None exceeded its final-attempt intervention or elapsed-time budget, received substantive human help, read controller-only material, or landed into a host repository.

Claude Code required launch/runtime replacements before the final matrix attempts. Those protocol/runtime-invalid invocations were not used as outcome cells and are disclosed in the [replacement log](replacement-log.json). The valid poor outputs were not rerun.

## Outcome by cell

- **Brunch spec → Brunch:** failed before implementation. Execute mode compiled the specification, then `plan_slice_invalid` halted the first slice. The unchanged oracle could not run past the missing package entry point.
- **Brunch spec → Claude Code:** the executor reported 47 local tests passing and produced a static build. The common oracle mounted the application, then failed the node-lifecycle contract; dependent journeys were not assessable.
- **Claude spec → Brunch:** failed before implementation with the same `plan_slice_invalid` terminal state. The unchanged oracle could not run past the missing package entry point.
- **Claude spec → Claude Code:** the executor reported 77 local tests passing and produced a static build. The common oracle failed the initial accessibility surface and node lifecycle; subsequent journey groups either failed or could not complete setup.

Local executor tests are process evidence, not substitutes for the shared browser oracle.

## Requirement traceability

The [audience-safe requirement ledger](requirement-ledger.public.json) records elicitation, handoff, implementation, verification, and evidence per concern.

- The Claude specification explicitly covered all 13 registered concerns.
- The Brunch specification explicitly covered 11, omitted numeric-domain validation, and contradicted reload persistence by choosing no session persistence.
- The Brunch executor cells produced no implementation, so requirement closure is not assessable there.
- In the Brunch-spec/Claude-Code cell, application startup verified but node lifecycle failed.
- In the Claude-spec/Claude-Code cell, application startup and node lifecycle failed.
- Remaining requirement rows are marked `not_assessable` where a shared journey's setup failure prevented criterion-level evidence.

The broader elicitation coverage in the Claude specification did not produce a passing execution outcome in this single case. The evidence therefore does not support a causal or winner claim.

## Issue classification

- **Runtime/integration:** both Brunch executions reached `plan_slice_invalid` before their first implementation slice.
- **Implementation:** both Claude Code outputs passed self-authored gates but failed common browser behavior.
- **Protocol:** initial Claude Code launch/runtime replacements were needed; they are disclosed and excluded from matrix outcomes.
- **Validity consequence:** exact-handoff composition is demonstrated, but this run cannot rank elicitors or executors because all four outcome cells failed and the sample is one case.

## Limitations

- One case and one retained final attempt per cell.
- No predeclared scoring rubric, judge, or winner rule.
- Common cost, token, and permission-prompt metrics were not available across both executors and remain `not_assessable`.
- Grouped browser journeys can leave individual requirements `not_assessable` after a setup failure.
- Brunch lane-only Petri and plan diagnostics are not common outcome evidence.

## Recommendations

1. Diagnose `plan_slice_invalid` as a Brunch execution-integration defect before using this matrix for product comparison.
2. Add executor-authored browser smoke tests that exercise the public accessibility and pointer contracts, without exposing controller journeys.
3. Repeat the frozen case only after the integration defect is fixed; retain the current failed attempts and do not replace them.
4. Use multiple cases and a predeclared rubric before making elicitation- or executor-ranking claims.

## Supporting material

- [Matrix manifest](matrix-manifest.json)
- [Audience-safe requirement ledger](requirement-ledger.public.json)
- [Replacement log](replacement-log.json)
- [Immutable handoffs](handoffs/)
- [Immutable execution attempts](attempts/)
- [Portable common evidence](evidence/)
