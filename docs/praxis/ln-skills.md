# ln-* Skill System Reference

This is the working guide for Brunch's project-local `ln-*` skills in `.agents/skills/`.

The skills are a development workflow for keeping product intent, planning, implementation, verification, and handoff aligned. They do not replace judgment: choose the smallest skill that matches the current uncertainty.

## Canonical state

| File | Authority |
| --- | --- |
| `memory/SPEC.md` | What and why: product contract, live assumptions, decisions, invariants, lexicon, verification stance. |
| `memory/PLAN.md` | What's next: frontier items, sequencing, acceptance, verification notes. |
| `HANDOFF.md` | Temporary resumability state when a session ends or context is fragile. |
| `memory/cards/<frontier-id>--<slug>.md` | Scope files holding one or more prepared scope cards. Multiple files per frontier permitted for independent concerns; one file = one execution context for `ln-build`. |
| `memory/REFACTOR.md` | Temporary refactor execution plan, when explicitly created. |

Do not invent alternate planning stores. If a fact matters durably, promote it through `ln-spec`, `ln-plan`, or `ln-sync`.

## Default flow

```text
ln-consult
  → ln-grill or ln-disambiguate
  → ln-spec
  → ln-plan
  → ln-scope     ← default uncertainty-attack: thin tracer-bullet slice
  → ln-build       whose landing falsifies the load-bearing belief
  → ln-review
  → ln-witness (optional)
  → ln-refactor (optional)
  → ln-sync
  → ln-handoff (when stopping or transferring)
```

The flow is not a checklist. Skip steps whose uncertainty is already retired.

### Tracer-bullet sequencing

A good tracer-bullet frontier or slice earns its keep on three convergent axes:

- **Proof of life.** Does landing it light up an end-to-end path that did not exist?
- **Invariants.** Does it locate or stabilize a seam that future slices will aim from?
- **Uncertainty.** Does it retire a load-bearing assumption from `memory/SPEC.md` §Assumptions?

The strongest next move scores on more than one axis. Prefer a slice that does several at once over one that maximizes a single axis.

- **Reshape, don't defer.** If an assumption blocks a slice, reshape the slice before switching to study.
- **Spike exception.** Use `ln-spike` only when no buildable tracer bullet can carry the proof — a third-party API contract, vendor characteristic, or research-grade unknown.
- **Fire the tracer that tells you the most.** Given the repo's pre-release posture, attack uncertainty by building. Spikes, design passes, and prototypes are escape hatches when no slice could carry the proof more cheaply.

`ln-plan`, `ln-design`, `ln-scope`, and `ln-consult` all carry this sequencing pressure.

## Skill map

### Triage and orientation

| Skill | Use when | Produces |
| --- | --- | --- |
| `ln-consult` | You are unsure which `ln-*` skill applies, starting a fresh thread, or re-entering ambiguous work. | A short assessment and recommended next route. |
| `ln-handoff` | Ending a session, switching threads, nearing context limits, or preserving volatile state. | `HANDOFF.md` with current state and next action. |

### Knowledge shaping

| Skill | Use when | Produces |
| --- | --- | --- |
| `ln-grill` | The idea is fuzzy and needs broad Socratic pressure-testing. | Shared understanding; constraints, motivations, and lexicon pressure surfaced. |
| `ln-disambiguate` | Several plausible meanings exist and examples/counterexamples would clarify faster than open-ended questioning. | Collapsed ambiguity, typed candidate conclusions, or named unresolved ambiguity. |
| `ln-spec` | Understanding should become durable product truth, or requirements/assumptions/decisions/invariants changed. | Updates to `memory/SPEC.md`. |
| `ln-plan` | Product truth is clear enough to sequence frontier work. | Updates to `memory/PLAN.md`. |
| `ln-sync` | SPEC/PLAN are stale, overweight, drifted from code, or need mature reconciliation. | Refreshed canonical docs and retired stale derivative artifacts. |

### Design and verification strategy

| Skill | Use when | Produces |
| --- | --- | --- |
| `ln-design` | API shape, module boundary, ownership, or information hiding is uncertain. Use especially before committing to a public seam. | Competing module shapes, chosen direction, rejected tradeoffs. |
| `ln-oracles` | Verification strategy is uncertain or materially shapes implementation order, especially for LLM, visual, compositional, or multi-surface work. | Oracle strategy by loop tier, observability diagnosis, blind spots. |
| `ln-witness` | A slice has tests but evidentiary strength is unclear, or tests pass while the spec feels under-witnessed. Post-hoc complement to `ln-oracles`. | Per-test kernel attribution and ladder rung; unwitnessed proof obligations; contrastive rivals tests fail to rule out. |
| `ln-prototype` | A throwaway playable/model/UI probe would answer design questions faster than production work. | Disposable prototype evidence; no production commitment. |
| `ln-spike` | One hard technical question blocks a scoped slice or frontier item. | Spike verdict and recommendation; throwaway code unless explicitly promoted. |

### Execution and quality

| Skill | Use when | Produces |
| --- | --- | --- |
| `ln-scope` | A frontier item or next step needs a thin vertical slice with target behavior and acceptance criteria. | Scope card / slice definition. |
| `ln-build` | A scoped slice is ready for TDD implementation. | Code, tests, inner-loop verification, and PLAN updates when appropriate. |
| `ln-diagnose` | Something is broken, failing, flaky, slow, or nondeterministic. | Trusted repro loop, falsified hypotheses, regression oracle, route back to planning if needed. |
| `ln-review` | After implementation bursts, or when architecture/model hygiene needs an opinionated audit. | Quality findings and next-step recommendations. |
| `ln-refactor` | Working code needs restructuring without behavior change. | Refactor plan as tiny safe commits. |

## Discretionary skills that are easy to miss

These are not always visible in the shortest default path, but they are important.

| Skill | Why it matters |
| --- | --- |
| `ln-grill` | Prevents premature specs by forcing motivations, constraints, and premises into the open. |
| `ln-disambiguate` | Prevents vague requirements by asking contrastive example/counterexample questions where interpretations diverge. |
| `ln-design` | Prevents shallow modules and accidental public APIs by exploring multiple shapes before implementation. |
| `ln-oracles` | Prevents fake confidence by designing the right evidence before build work. |
| `ln-witness` | Prevents fake confidence after the fact: distinguishes tests that witness named claims from tests that merely pass, and surfaces rival interpretations the suite fails to rule out. |
| `ln-prototype` | Retires UX/state/model uncertainty cheaply before the production seam hardens. |
| `ln-diagnose` | Keeps debugging scientific and routes durable lessons back into SPEC/PLAN. |
| `ln-review` | Catches domain-model erosion and agent-navigability problems after code lands. |
| `ln-sync` | Keeps canonical docs from becoming an append-only attic. |

There is currently no project-local `ln-map` skill in `.agents/skills/`. If you mean milestone/topology mapping, use `ln-plan` for frontier sequencing, `ln-scope` for one slice, or create a new `ln-map` skill only after its boundary is distinct from those two.

## Choosing between similar skills

| If you are asking… | Use |
| --- | --- |
| “What are we even trying to do?” | `ln-grill` |
| “Which interpretation is intended?” | `ln-disambiguate` |
| “What should the canonical truth say?” | `ln-spec` |
| “What work items should exist?” | `ln-plan` |
| “What is the smallest buildable slice?” | `ln-scope` |
| “Which module/API shape should we choose?” | `ln-design` |
| “How will we know this works?” | `ln-oracles` |
| “What do these tests actually prove?” | `ln-witness` |
| “Can this technical approach work?” | `ln-spike` |
| “Can we make the idea tangible before committing?” | `ln-prototype` |
| “Why is this failing?” | `ln-diagnose` |
| “Is this code still conceptually clean?” | `ln-review` |
| “How do we restructure safely?” | `ln-refactor` |
| “Are the docs still true?” | `ln-sync` |

## Branch and tracker boundary

Plan-level frontier items in `memory/PLAN.md` are the unit of Linear issue and Graphite branch work. Scope-card slices do not get their own issue/branch by default.

When starting a new frontier item, follow `AGENTS.md` and `docs/praxis/graphite-workflow.md`: create the Linear issue, create the Graphite stacked branch, then scope/build within that branch.

## Verification ownership

| Layer | Owner |
| --- | --- |
| Verification commands and inner-loop policy | `ln-spec` |
| Middle/outer loop strategy and blind spots | `ln-oracles` |
| Per-slice application of oracle strategy | `ln-scope` |
| TDD and inner-loop execution | `ln-build` |
| Coverage audit after implementation | `ln-review` |
| Evidentiary audit of an existing test suite | `ln-witness` |

Default commands:

- Inner loop after meaningful edits: `npm run fix`
- Gate before commit: `npm run verify`

## References

- Runtime skill instructions: `.agents/skills/ln-*/SKILL.md`
- Repo protocol summary: `AGENTS.md`
- Dev-layer design rationale: `docs/design/ln-skills/EVOLUTION.md`
