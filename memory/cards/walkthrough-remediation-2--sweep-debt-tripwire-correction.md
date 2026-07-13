# FE-1187 sweep-debt tripwire correction

Frontier: walkthrough-remediation-2
Status:   active
Mode:     slices
Created:  2026-07-13

Posture: proving (inherited from walkthrough-remediation-2)

- The containing seam is the scenario-scoped sweep-debt JSONL oracle under A40-L and D80-L/D117-L.
- `ln-judo-review` found that the tripwire's synthetic fixtures reverse production `before_agent_start` ordering, so a normal completed session becomes uncheckable.
- The chosen `ln-design` shape keeps the narrow `assessSweepDebt` surface: assess the latest non-empty closed interval and report, rather than reject, a newer open tail.
- This correction stays inside FE-1187 and must resume the human-gated consolidated outer checkpoint after both cards land.

## Card 1 · Judge the latest closed production interval — `done`

### Target Behavior

The sweep-debt tripwire judges the latest non-empty closed interval even when a normal newer conversational tail remains open.

### Full-card cold-start reads

```text
- memory/SPEC.md — A40-L; D80-L, D81-L, D117-L; acknowledged blind spot "Sweep ingestion reliability"
- memory/PLAN.md — frontier: walkthrough-remediation-2; tripwire row
- HANDOFF.md — deterministic tranche and actual-session checkpoint state
- src/projections/session/sweep-watermark.ts — production marker timing and conversational classification
- src/app/pi-extensions.ts — createCaptureSweepAdvanceStep before_agent_start wiring
- memory/cards/walkthrough-remediation-2--consolidated-outer-checkpoint.md — actual-session acceptance contract
```

### Boundary Crossings

```text
Pi-shaped session JSONL
→ production capture-sweep watermark ordering
→ latest non-empty closed interval selection
→ successful capture-result classification
→ compact pass / fail / uncheckable report + CLI exit status
```

### Risks and Assumptions

```text
- RISK: ignoring the newer open tail could make a closed-interval verdict look like a whole-session verdict
  → MITIGATION: include openConversationalEntryCount in every report variant and keep the report explicitly interval-scoped
- ASSUMPTION: after the checkpoint advances once, its target scenario is the latest non-empty closed interval
  → IMPACT IF FALSE: the chosen module shape would need explicit interval selection and Card 2 would remain valid
  → VALIDATE: construct marker ordering through prepareCaptureSweepAdvance, leave a normal assistant tail open, and require the preceding closed interval to remain checkable
  → A40-L names the before_agent_start mechanism; the active checkpoint names the advance-once operator protocol
```

### Posture check

```text
Lights up: the real Session B JSONL → tripwire operator path
Stabilizes: A40-L's detection oracle at the actual before_agent_start ordering seam
Retires or locates: the load-bearing belief that latest-closed interval selection works despite the inevitable next-turn tail
Stop condition: if production ordering cannot identify the intended interval without operator-supplied indices, stop before Card 2 and route back to ln-design
```

### Acceptance Criteria

```text
✓ src/probes/__tests__/sweep-debt-tripwire.test.ts — a transcript assembled with prepareCaptureSweepAdvance passes `capture` for the latest closed interval while a newer assistant tail remains open
✓ src/probes/__tests__/sweep-debt-tripwire.test.ts — the same production ordering passes `ignore` only when the closed interval has no successful capture evidence
✓ src/probes/__tests__/sweep-debt-tripwire.test.ts — checkable reports name interval bounds and openConversationalEntryCount; uncheckable is reserved for no non-empty closed interval
✓ src/probes/__tests__/sweep-debt-tripwire.test.ts — failed or malformed capture attempts, empty bootstrap intervals, malformed JSONL, and honest CLI exit statuses remain covered
✓ node --import tsx src/probes/sweep-debt-tripwire.ts --session <real-shaped-jsonl> --expect capture|ignore — source CLI reports the selected closed interval rather than rejecting a normal open tail
```

### Invariants preserved

- Only `mutate_graph {status:'success'}` and `update_elicitation_scratchpad {status:'ok'}` count as capture evidence — guarded by: `src/probes/__tests__/sweep-debt-tripwire.test.ts`
- Empty closed intervals are skipped rather than mistaken for ignored material — guarded by: `src/probes/__tests__/sweep-debt-tripwire.test.ts`
- Invalid JSONL fails loudly with a one-based line number — guarded by: `src/probes/__tests__/sweep-debt-tripwire.test.ts`
- The source and built operator entry points stay equivalent — guarded by: focused CLI tests plus `npm run build`

### Verification Approach

```text
- Inner: production-order unit/CLI contract tests — prove interval selection, evidence classification, report shape, and exit status
- Middle: source and built CLI over a temporary Pi-shaped JSONL assembled in production order — prove both supported entries
- Outer: owned by memory/cards/walkthrough-remediation-2--consolidated-outer-checkpoint.md — rerun both expectations against the actual Session B JSONL after this correction lands
```

### Cross-cutting obligations

- The tripwire remains a dev/operator oracle, never product truth or a new event plane.
- Reuse `isCaptureSweepWatermarkEntry`, `isSweepConversationalEntry`, and `prepareCaptureSweepAdvance`; do not duplicate production classification in the harness.
- Do not pull Later `mechanism-trace` timeline breadth into this correction.
- Do not change the optimistic watermark advance itself; A40-L keeps that upgrade open.

### Expected touched paths (tentative)

```text
src/probes/
├── sweep-debt-tripwire.ts                   ~
└── __tests__/
    └── sweep-debt-tripwire.test.ts          ~
```

## Card 2 · Replace bespoke CLI option scanning — `queued`

### Objective

The tripwire CLI uses Node's native strict argument parser instead of hand-rolled adjacent-array reads.

### Light-card cold-start reads

```text
- memory/SPEC.md — A40-L; D80-L
- memory/PLAN.md — frontier: walkthrough-remediation-2
- HANDOFF.md — supported source/built invocation contract
- src/app/brunch.ts and src/dev/dev-cli.ts — existing node:util parseArgs precedent
```

### Acceptance Criteria

```text
✓ src/probes/__tests__/sweep-debt-tripwire.test.ts — valid source invocation still returns the assessment and honest exit status
✓ src/probes/__tests__/sweep-debt-tripwire.test.ts — unknown options, positionals, and missing option values fail with usage guidance
✓ src/probes/__tests__/sweep-debt-tripwire.test.ts — source and built invocation strings remain advertised
```

### Verification Approach

```text
- Inner: focused CLI subprocess tests
- Middle: `npm run build` plus the built entry invocation
- Outer: none — parser-only hardening has no qualitative surface
```

### Cross-cutting obligations

- Preserve `--session <session.jsonl> --expect capture|ignore`; do not add interval-selection flags.
- Keep CLI/library coexistence in the current file; no speculative module split.

### Assumption dependency

None — this replaces bespoke parsing inside a settled operator contract.

### Expected touched paths (tentative)

```text
src/probes/
├── sweep-debt-tripwire.ts                   ~
└── __tests__/
    └── sweep-debt-tripwire.test.ts          ~
```

## Sequence rule

Card 2 may proceed after Card 1 because it preserves the chosen CLI surface and does not depend on Card 1's implementation details. If Card 1 invalidates the latest-closed design and returns to `ln-design`, stop this file before Card 2 rather than laundering a changed interface through parser cleanup.
