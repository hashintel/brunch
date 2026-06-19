# False-commit scenario-matrix completeness (FE-861)

Frontier: generalized-capture | FE-861
Status:   active
Mode:     single
Created:  2026-06-19

## Orientation

- **Seam:** the capture commitment-gradient gate (`src/graph/__tests__/capture-commitment-gradient-gate.test.ts`, with its `routeFixedConfidenceTaggedExtraction` harness over the real `mutate_graph` / `update_elicitation_gaps` / `update_reconciliation_needs` adapters) + the closed scenario family in `src/probes/capture-quality-loop.ts` (`CAPTURE_QUALITY_SCENARIOS`).
- **Frontier item:** `generalized-capture` (FE-861), the **last** remaining acceptance item. Everything else (D80/D81/D82 + the reconciliation_need outlet) has landed. Continues on `ln/fe-861-generalized-capture-2`.
- **What's done vs open:** the routing gate proves the *key* classes (high→commit, low→one gap, contradiction→recon, structural answered, manual close, illegal fail-loud) with ad-hoc fixtures. **Open:** the *closed scenario family* from `capture-quality-spike` is still modeled on the spike's binary `shouldCommit`, which D81-L supersedes. Completeness = re-aim that family to the gradient and give **every scenario class** a deterministic probe-tier regression guard, with expected gap-spawns assertable.
- **Posture:** proving (inherited from FE-861). The matrix itself is deterministic; capture *classification accuracy* stays outer-loop fitness (SPEC §Verification Design).

## Objective

Re-aim the closed `capture-quality-spike` scenario family from the binary `shouldCommit` model to the D81-L commitment gradient, and give every scenario class a deterministic regression guard asserting its gradient routing (commit-explicit / commit-implicit / spawn-gap / reconciliation-need) through the real adapters.

## Light-card cold-start reads

```
- memory/SPEC.md   — D81-L (commitment gradient; "Supersedes the spike matrix's shouldCommit expectations as written"), I30-L, §Verification Design (deterministic gate = only deterministic capture oracle; classification accuracy = fitness); A22-L
- memory/PLAN.md    — frontier: generalized-capture, Context §Completeness obligations ("false-commit scenario matrix … re-aimed at the low-confidence line; probe-tier, closed matrix, not a coverage frontier")
- src/graph/__tests__/capture-commitment-gradient-gate.test.ts — the routing-gate harness to extend (routeFixedConfidenceTaggedExtraction over real adapters)
- src/probes/capture-quality-loop.ts — CAPTURE_QUALITY_SCENARIOS + CaptureQualityExpectedFact (the shouldCommit model to remodel) + precision/recall scoring
```

## Decision (resolve at build; recommendation)

**One scenario source, two consumers.** Re-aim `CAPTURE_QUALITY_SCENARIOS` so each expected fact carries a gradient `expectedOutcome` (`commit_explicit | commit_implicit | spawn_gap | reconciliation_need`) instead of `shouldCommit: boolean`. Then:
- **Deterministic regression guard (CI, LLM-out-of-loop):** the gate test drives each scenario class's facts as a *fixed gradient-tagged extraction* through the real adapters and asserts the routing outcome — the closed-family completeness guard. This is the gated oracle.
- **Fitness probe (LLM-in-loop):** `capture-quality-loop.ts` keeps measuring, re-scored against `expectedOutcome` (gradient-routing accuracy) rather than binary precision/recall. Stays fitness, not gated.

This matches SPEC's split (deterministic gate is the only deterministic capture oracle; classification accuracy is fitness) and retires the superseded `shouldCommit` model in one move. The implication rows re-aim per D81-L: confidently-materialized implications → `commit_implicit`; low-confidence/undecided → `spawn_gap`; contradictions → `reconciliation_need`.

## Acceptance Criteria

```
✓ CAPTURE_QUALITY_SCENARIOS expected facts carry a gradient expectedOutcome (commit_explicit | commit_implicit | spawn_gap | reconciliation_need); the binary shouldCommit field is retired
✓ every scenario class (free_prose, file_ref, implication_heavy, + a contradiction class) has a deterministic regression guard asserting its routing through the real mutate_graph / update_elicitation_gaps / update_reconciliation_needs adapters
✓ low-confidence rows: zero graph commits, each maps to exactly one existing-or-new elicitation_gap (gap-spawns assertable); re-aimed implication rows that are confidently-materialized commit with basis implicit; any contradiction row routes to a semantic_conflict recon need, not a gap
✓ the capture-quality probe re-scored against expectedOutcome (gradient-routing accuracy), still fitness (not gated); precision/recall-over-shouldCommit retired
✓ npm run verify green
```

## Verification Approach

```
- Inner: vitest — the closed-family deterministic regression guards in the gradient-gate test (fixed gradient-tagged extraction → real adapters); probe unit coverage for the re-scored fitness metric
- Outer: fitness — the LLM-in-loop capture-quality probe scores gradient classification (manual / .brunch/debug; not gated)
```

## Cross-cutting obligations

```
- Low-confidence material never becomes graph truth — it becomes agenda (D81-L); contradictions route to reconciliation_need, not gaps (D8-L)
- One {specId, lsn} / change_log clock for all capture writes
- Do not revive the binary shouldCommit model or a directness-based commit rule (D81-L: confidence, not directness)
- Deterministic gate stays LLM-out-of-loop; classification accuracy stays fitness (do not gate it)
```

## Assumption dependency

`Depends on: A22-L` — capture fitness for the POC; validated enough (capture-quality-spike reached precision 1.0 / recall 1.0 with zero false commits on this family), and the gradient routing this slice guards is deterministic regardless of classification quality.

## Expected touched paths (tentative)

```
src/probes/capture-quality-loop.ts                            ~  (CaptureQualityExpectedFact: shouldCommit -> expectedOutcome; scenario rows re-aimed; scoring re-aimed)
src/graph/__tests__/capture-commitment-gradient-gate.test.ts  ~  (consume the closed family as per-class regression guards; add the contradiction class)
src/probes/__tests__/capture-quality-loop.test.ts             ?  (if the re-scored fitness metric needs unit coverage; create/modify as present)
```

## Promotion checklist

- [ ] Changes a requirement? No — D81-L set the gradient.
- [ ] Creates/retires/invalidates an assumption? No (further exercises A22-L; does not change it).
- [ ] Depends on an unvalidated high-impact assumption? No.
- [ ] Makes/reverses a non-trivial design decision? No — the shouldCommit→gradient remodel is mandated by D81-L ("supersedes the spike matrix's shouldCommit expectations").
- [ ] Establishes a new seam-level invariant? No — the gate invariant already exists; this completes its scenario coverage.
- [ ] Crosses >2 major seams? No — capture gate + the spike scenario family, one seam.
- [ ] First touch in an unfamiliar seam? No.

Stays light.
