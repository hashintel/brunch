# Capture-quality fitness spike

Frontier: capture-quality-spike (gates exchanges-and-generalized-capture)
Status:   active
Mode:     single
Created:  2026-06-08

## Orientation

- **Containing seam:** post-exchange / ordinary-message capture. The production path commits only **directly-labeled** high-confidence facts today: `captureExplicitTextFacts` in `src/graph/capture/structured-response.ts` accepts `Goal:`/`Context:`/`Constraint:`/`Criterion:` lines and routes them through `CommandExecutor.commitGraph({basis: explicit})` (wired on `session.submitExchangeResponse` and `session.submitMessage`). Capture beyond labeled facts is unbuilt.
- **Relevant frontier item:** this spike is the **named forcing function** for the horizon frontier `exchanges-and-generalized-capture`. That frontier is *evidence-gated, not wait-gated* (PLAN.md): it cannot graduate until we have real measurement of capture fitness over free text/files/refs. The output of this card is **knowledge + evidence artifacts**, not production capture code.
- **Volatile handoff state:** no `HANDOFF.md`. The `capture-*` projector/renderer stubs were deliberately deleted in the snapshot migration (35eff395) precisely because the capture inventory was not honest yet; **do not** recreate them. The probe precedent is `src/probes/fixture-curation-loop.ts` (an LLM-driven measurement probe that emits report artifacts under `.fixtures/runs/`).
- **Main open risk:** the spike quietly turning into production capture work — adding LLM extraction into `src/graph/capture/` or materializing broad runtime/product seams. It must stay throwaway: measure fitness, record a confidence shift on A22-L, and recommend whether/how the frontier graduates.

Posture: proving (this is a spike; output is evidence and a confidence shift, not a tracer).

## Light scope card (spike)

### Objective

Produce real evidence of how reliably an LLM-driven capture step can extract high-confidence graph facts from free prose / files / refs **beyond** directly-labeled lines, so `exchanges-and-generalized-capture` can graduate (or stay parked) on measurement rather than guesswork.

### Acceptance Criteria

```
✓ A spike probe under src/probes/ runs a capture-quality measurement over a small fixed scenario set
  (free-prose answers, file/ref-bearing answers, implication-heavy answers) and emits a report artifact
  under .fixtures/runs/capture-quality/ with per-scenario extraction vs expected-fact comparison.
✓ The report quantifies fitness against the A22-L split: high-confidence facts that SHOULD commit vs
  low-confidence implications that should STAY OUT of graph truth (precision/recall or false-commit count).
✓ A short verdict is written (in the run artifact and/or a spike note) recording the confidence shift on
  A22-L and a concrete recommendation: graduate the frontier, narrow it, or keep it parked with the next gate.
✓ No production capture behavior changes: src/graph/capture/ logic is not extended, and no capture-*
  projector/renderer stubs are reintroduced.
```

### Verification Approach

```
- Inner: a deterministic harness test (like src/probes/fixture-curation-loop.test.ts) that proves the
  probe's report/summarization mechanics WITHOUT requiring a live LLM (fixture-fed transcript in → summary out).
- Outer: the real LLM measurement run, recorded as artifacts under .fixtures/runs/capture-quality/
  (mixed-basis output stays in runs/, never registered as a reusable seed).
```

### Cross-cutting obligations

```
- Throwaway investigation: knowledge + evidence, not production capture code.
- Do not regrow deleted capture-* topology; do not reintroduce `snapshot` as an architecture noun.
- Any commit the probe demonstrates still routes through CommandExecutor with basis: explicit (D63-L);
  the probe must not invent a side channel into graph truth.
- Keep src/renderers/ for durable text only; measurement output is run-artifact data, not a renderer.
```

### Assumption dependency

Depends on: A22-L (capture is "partially validated" — labeled facts proven; broader fitness explicitly open). This spike exists precisely to move A22-L's evidence; building against it is sound because the spike's job is to test it, not assume it.

### Expected touched paths (tentative)

```pseudo
src/probes/
├── capture-quality-loop.ts            +   # LLM measurement probe + report summarizer
└── capture-quality-loop.test.ts       +   # deterministic harness mechanics (no live LLM)

.fixtures/runs/capture-quality/        +   # real-run evidence artifacts (transcript, extraction, verdict)

memory/SPEC.md                         ?   # update A22-L evidence/status after the verdict (reconciliation)
```

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption? — *expected:* it will shift A22-L evidence; reconcile SPEC after the verdict.
- [ ] Does this slice depend on an unvalidated high-impact assumption? — it tests one; that is the point of a spike.
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?
