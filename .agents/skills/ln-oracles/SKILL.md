---
name: ln-oracles
description: "Design verification strategy: diagnose observability, select oracle families, map to loop tiers, surface blind spots. Use after ln-plan when slices need oracle design, or when verification coverage has drifted."
argument-hint: "[slices to design oracles for, or 'all' for full reassessment]"
---

# Dev Oracles

Design what proves the system works before choosing how to build it.

The best oracle removes the most bad degrees of freedom per unit time (Regehr). A system without feedback is open-loop -- it cannot correct errors (Wiener). Verification is first-class work, not accessory: second only to building the product itself. A slice without an oracle strategy is not scoped.

Read `./assets/diagnostic-framework.md` and `./assets/oracle-taxonomy.md` before starting.

## Input

The slices to design oracles for: $ARGUMENTS

Read `memory/SPEC.md` (invariants, assumptions, decisions, verification design) and `memory/PLAN.md` (slices, acceptance criteria). If SPEC.md already has a §Verification Design section, this is an update -- read it as prior state to evolve, not preserve uncritically.

## Procedure

This is an **interactive process** -- each step involves presenting analysis and grilling the user for pushback, corrections, and design input. Do not produce a finished oracle design in one pass. Walk the design tree like `ln-grill`: present your assessment, ask pointed questions, incorporate answers, then move to the next step.

### 1. Diagnose

Score **Observability**, **Reproducibility**, and **Controllability** (see `./assets/diagnostic-framework.md`). Present the scoring table to the user with specific notes per dimension. Low scores constrain which oracle families are feasible and must be addressed before oracle selection proceeds.

**Grill**: For each dimension scored below `high`, ask: is this a deliberate deferral, a blind spot, or something we should address now? What would change the score?

### 2. Extract verification claims

From SPEC.md invariant bundles, acceptance criteria, and PLAN.md slice definitions -- list what must be proved. Distinguish:

- **Structural claims** (schema conformance, DB round-trips, type safety) -- oracle-able programmatically
- **Behavioral claims** (LLM output quality, UX judgment) -- require human assessment or statistical thresholds
- **Compositional claims** (graph integrity over time, cumulative drift) -- may need property-based or model-based oracles

**Grill**: For behavioral claims, ask: is schema validation sufficient for the inner loop, with qualitative assessment deferred to manual testing? Where is the boundary between "structurally valid" and "qualitatively good"?

### 3. Select oracle families

Using `./assets/oracle-taxonomy.md`, select families ranked by ROI for this project's verification needs. Apply the combination principle: the best oracle is a pair of independent artifacts. Prefer pairs when they compound; don't force them when a single oracle suffices.

**Grill**: For each selected family, present: what it proves, what it costs, and what it misses. Ask the user which tradeoffs are acceptable given timeline and confidence levels.

### 4. Map to loop tiers

Assign each selected oracle to inner (ms, agent-autonomous), middle (seconds-minutes, regression/fitness), or outer (slow hardening). Apply verification economics: cheapest checks first, expensive checks less often.

**Boundary with ln-spec**: ln-spec owns the inner loop (verification commands, policy, fast automated checks). ln-oracles owns the middle and outer loops, plus strategic framing (diagnostic, stance, blind spots). When updating, preserve ln-spec's inner loop content and extend with middle/outer strategy.

**Grill**: For middle-loop oracles that require external resources (API calls, fixtures), ask: how will fixtures be created? What bootstraps ground truth? Is single-shot measurement sufficient or do we need multi-run variance?

### 5. Design per-slice verification approach

For each in-scope slice in PLAN.md, specify: which oracles apply, what they prove, and which loop tier they belong to. This becomes the `**Verification approach**` annotation on each slice.

**Grill**: For each slice, ask: does this oracle strategy cover the slice's acceptance criteria? What's the gap between "oracle says pass" and "slice is actually correct"?

### 6. Surface blind spots

Name what this verification design does NOT cover and why. Categories: cost exceeds value, observability gap, deferred to later milestone, not oracle-able. A verification design with no blind spots is incomplete.

**Grill**: For each blind spot, ask: is this an acceptable deferral or a risk that should promote to "needs an oracle now"? What would trigger revisiting?

## Output

Update `memory/SPEC.md` §Verification Design:

- **Verification Stance** -- the meta position on verification as first-class work
- **Diagnostic Assessment** -- O/R/C scoring table with notes
- **Oracle Strategy by Loop Tier** -- middle and outer loop oracle families, mapped to what they prove (preserve ln-spec's inner loop content)
- **Design notes** -- project-specific oracle design decisions (e.g. observer history projection, fixture bootstrapping strategy)
- **Acknowledged Blind Spots** -- table with blind spot, reason, mitigation, and revisit trigger

Update `memory/PLAN.md` per-slice annotations:

- Add `**Verification approach**` line to each in-scope slice with oracle family, loop tier, and cross-reference to SPEC.md sections

### Cross-reference integrity

After writing, verify:
- Every SPEC.md invariant has at least one oracle assigned (inner, middle, or outer)
- Every in-scope PLAN.md slice has a verification approach annotation
- The blind spots section is non-empty
- Middle/outer loop oracles cross-reference the invariants or assumptions they prove

## Routing

After filing the oracle design, present these options to the user (use `tool-ask-question`):

| #   | Label          | Target       | Why                                              |
| --- | -------------- | ------------ | ------------------------------------------------ |
| 1   | Scope a slice  | `ln-scope`   | Oracle design is complete, ready to scope work   |
| 2   | Spike first    | `ln-spike`   | Oracle feasibility is uncertain for a key claim  |
| 3   | Revise spec    | `ln-spec`    | Oracle design revealed spec gaps                 |
| 4   | Revise plan    | `ln-plan`    | Oracle design changes slice ordering or priority |
| 5   | Back to triage | `ln-consult` | Direction needs reassessment                     |

Recommended: **1** unless oracle feasibility is uncertain (then **2**).
