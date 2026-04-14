# `ln-*` Skills Review After Alignment

Date: 2026-04-06

## Purpose

This note captures a post-alignment review of the local `ln-*` skill family after the recent cleanup pass.

It is meant to preserve:

1. the current assessment of the family as a working system
2. the main risks that still deserve observation in real use
3. the recommended next feedback loop: use the skills, then review behavior rather than continuing speculative redesign

## Executive Summary

The `ln-*` family now appears to be in good working shape.

The biggest earlier problems were:

- family members not modeling the full family
- template/schema mismatches
- fork residue from `dev-*`
- project-local workflow assumptions embedded too directly into the generalized planning method

Those are now mostly resolved.

Current verdict:

- no major internal contradictions remain
- the family has a clearer identity distinct from `dev-*`
- the document model now more closely matches what the skills ask the agent to do
- the remaining risks are mostly about calibration and ergonomics, not correctness

## What Now Feels Strong

### 1. The family understands its own lifecycle

The family router and downstream skills now model the larger method more coherently:

- `ln-consult` includes `ln-oracles`
- `ln-scope` can route to `ln-oracles`
- `ln-handoff` includes `ln-design`, `ln-oracles`, and `ln-refactor`
- the canonical flow is easier to read as one system rather than a loose collection of prompts

This gives the skill family a stronger methodological spine.

### 2. The skill instructions and document schemas now mostly agree

This is the most important practical improvement.

Notable gains:

- `PLAN.md` now has room for parallelism, verification approach, candidate invariant goals, invariants established, and optional execution tracking
- `SPEC.md` now distinguishes assumption confidence from validation status
- `ln-build`, `ln-spike`, and `ln-sync` now operate against that same assumptions schema
- bookkeeping steps now more closely match actual fields in the templates

The system is much less likely to ask an agent to write into a structure that does not exist.

### 3. Local workflow protocol is no longer the core planning model

The `ln-plan` skill now treats issue/ticket mapping and branch naming as local project protocol rather than universal method.

That is the right abstraction boundary:

- projects may have their own execution workflow
- `ln-plan` should respect those protocols
- but slice identity should remain conceptual, not tied to one tracker or branch scheme

This makes the family more reusable without discarding project-specific rigor.

### 4. `ln-oracles` now feels integrated instead of appended

`ln-oracles` was previously the strongest conceptual addition but the least integrated operationally.

It now has:

- better routing
- better relationship to `ln-scope`
- a clearer optional-vs-required posture
- a sharper boundary with `ln-spec`

That makes it feel like a real member of the family, not an isolated extra.

## Remaining Risks To Watch

These are not current defects so much as operational watch items.

### 1. Method heaviness

This is now a coherent governed-document system, but it is still heavier than `dev-*`.

The risk is not contradiction; it is over-ritualization.

Watch for cases where agents:

- over-scope trivial work
- over-update planning artifacts for small changes
- invoke too much bookkeeping relative to the size of the task
- route through `ln-oracles` when direct inner-loop checks would have sufficed

This has already been mitigated somewhat through:

- patch/update modes
- trivial/purely structural exceptions
- optional oracle design for simple slices

But the family should still be observed for ceremony creep.

### 2. `PLAN.md` may become over-specified in practice

The richer plan template is now much better aligned with the method, but it is also denser.

A slice can now carry:

- requirements
- assumptions
- candidate invariant goals
- invariants to respect
- acceptance
- verification approach
- invariants established
- optional execution tracking

That is powerful when these fields carry real information.

It becomes noise if agents fill them mechanically.

Watch for signs of placeholder behavior such as:

- generic verification text that says little
- invariant fields populated before any meaningful understanding exists
- execution tracking added before it is useful
- every slice looking equally elaborate regardless of risk

If this appears, the next refinement should likely be stronger guidance about when fields may be left intentionally minimal.

### 3. Refactor execution remains slightly less explicit than feature-slice execution

`ln-build` can now accept a commit-sized step from `memory/REFACTOR.md`, which resolves the direct contract conflict with `ln-refactor`.

Still, the build skill is clearest when given:

- target behavior
- acceptance criteria
- verification approach

A refactor step may not always present those as cleanly as a scope card.

Watch for whether agents executing refactor steps:

- infer too much
- widen the step beyond one safe commit
- produce weak or ambiguous verification

If this becomes a recurring issue, the next iteration might introduce a more explicit “refactor execution card” shape inside `ln-refactor`.

### 4. `ln-design` still assumes a subagent-rich environment

`ln-design` still instructs the agent to spawn 3+ sub-agents with divergent constraints.

That is acceptable locally, but it remains one of the few places where the family still strongly reflects a particular execution environment.

Watch for:

- failure when parallel subagenting is unavailable or awkward
- overuse of subagent generation when a lighter design pass would suffice
- low-quality variation across the generated alternatives

This is not a correctness issue, just a portability and execution-quality watch item.

### 5. `ln-sync` remains the most judgment-sensitive skill

`ln-sync` is conceptually strong but depends heavily on judgment:

- what counts as embedded vs moot vs superseded
- when to prune vs preserve
- how aggressively to repair cross-references

Watch for:

- helpful simplification vs accidental truth loss
- over-pruning of useful rationale
- under-pruning that leaves stale context alive
- repair of refs that is formally correct but semantically weak

This may remain a skill best suited to stronger agents or more deliberate sessions.

### 6. `ln-handoff` is doctrinally strong but execution-dependent

The handoff skill now reflects the family more faithfully, including design, oracle, and refactor state.

The risk here is not method design but discipline:

- can the agent actually capture all volatile state with fidelity?
- does it preserve evidence, not just conclusions?
- does it treat persisted artifacts and chat-only artifacts differently enough?

Watch for handoffs that are structurally complete but operationally thin.

## Signals To Watch In Real Use

The best next feedback will come from actual use of the family, not another abstract redesign pass.

Key questions:

### Routing quality

- Does `ln-consult` suggest the right next skill?
- Does `ln-scope` correctly distinguish “build now” from “design oracles first”?
- Does `ln-spike` route invalidations toward `ln-spec` vs `ln-plan` sensibly?

### Planning quality

- Does `ln-plan` produce plans that clarify sequencing under uncertainty?
- Do slices remain thin and demoable?
- Do candidate invariant goals and verification approach fields improve planning rather than bloat it?

### Verification quality

- Do `ln-oracles` outputs materially improve slice scoping and test design?
- Do recent slices actually implement the promised verification approaches?
- Do blind spots get surfaced honestly?

### Build quality

- Does `ln-build` keep slices small?
- Does bookkeeping after builds feel worth the overhead?
- Are invariants and coverage updates informative rather than ceremonial?

### Documentation quality

- Does `ln-sync` improve clarity?
- Are assumptions, decisions, and invariants evolving cleanly?
- Do `SPEC.md` and `PLAN.md` become more navigable over time, not less?

### Handoff quality

- Can a new thread resume from `memory/SPEC.md`, `memory/PLAN.md`, and the current card without clarifying questions?
- Are volatile artifacts preserved with enough detail to prevent re-investigation?
- Is review debt and verification state visible enough to survive thread boundaries?

## Recommended Next Step

Do not continue speculative redesign immediately.

Instead:

1. use the `ln-*` skills on real slices
2. observe where they produce clarity vs overhead
3. collect examples of good and bad outputs
4. review again after some real usage

The family now seems coherent enough that empirical behavior is the highest-value source of further improvement.

## Bottom Line

The `ln-*` family now feels like a real governed planning-and-execution system rather than a partially renamed fork.

What remains to evaluate is less about fixing contradictions and more about watching how the method behaves under real load:

- Does it stay sharp?
- Does it stay proportional?
- Does the extra structure pay for itself?

Those are now the right questions.
