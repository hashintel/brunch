# ln-* Skill System Reference

This is the working guide for Brunch's project-local `ln-*` skills in `.agents/skills/`.

The skills are a development workflow for keeping product intent, planning, implementation, verification, and handoff aligned. They do not replace judgment: choose the smallest skill that matches the current uncertainty.

## Canonical state

| File | Authority |
| --- | --- |
| `memory/SPEC.md` | What and why: product contract, live assumptions, decisions, invariants, lexicon, verification stance. |
| `memory/PLAN.md` | What's next: frontier items, sequencing, acceptance, verification notes. |
| `HANDOFF.md` | Temporary resumability state when a session ends or context is fragile. |
| `memory/cards/<frontier-id>--<slug>.md` | Scope files holding one vertical card, a short slice sequence, or a sweep ledger. Multiple files per frontier permitted for independent concerns; one file = one execution context for `ln-build`. |
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

### Operating posture

Planning and scoping pressures depend on each frontier's **certainty posture**. The project default lives in `memory/POSTURE.md` (`certainty: proving | earned`); individual frontiers in `memory/PLAN.md` may carry an explicit `Certainty:` override. Posture is **per-frontier**, not per-project — a mostly-earned repo can carry a fresh proving seam, and a settled seam can regress to proving on a new unknown.

| Certainty | Ask | Optimize for | Reference |
| --- | --- | --- | --- |
| `proving` | What does landing this *tell us*? | information gain | `.agents/skills/ln-plan/references/proving.md` |
| `earned` | What does landing this *close*? | closure gain | `.agents/skills/ln-plan/references/earned.md` |

This section orients; the operational doctrine lives in the references named below, which `ln-plan` and `ln-scope` load at point of use.

#### Proving posture (tracer-bullet sequencing)

Optimize for **information gain**. A good tracer-bullet frontier scores on at least one of three axes — **proof of life** (lights a new end-to-end path), **invariants** (locates/stabilizes a seam), **uncertainty** (retires a load-bearing assumption) — and the strongest score on several. Attack uncertainty by *building*; spikes are the escape hatch only when no slice could carry the proof. Required annotation: at least one of `Retires`, `Depends on`, `Blocked by`, `Lights up`, `Stabilizes`. Full doctrine (epistemic horizon, reshape-don't-defer, spike exception) in `.agents/skills/ln-plan/references/proving.md`.

#### Earned posture (closure sequencing)

Optimize for **closure gain**. The decision kernel changes — the planner asks *what does this close?*, not *what does this tell us?* Closure move-set: **materialize, consolidate, name canonically, delete-as-progress, retire bridges/aliases/dual paths, take-the-bigger-step.** You are *circling* (switch posture) when each new slice re-proves established meaning and "caution" names no specific risk. Required annotation: at least one of `Closes`, `Materializes`, `Canonicalizes`, `Deletes / retires`, `Locks in`. Guardrails still bind (one named seam, named closure target, declared touched paths, no auto-implementation); regression earned → proving is a state transition, not a third mode. Full doctrine in `.agents/skills/ln-plan/references/earned.md`.

#### Coverage sweeps / coverage frontiers (a frontier shape, not a posture)

**Vertical work terminates on a witness (∃ — there exists one end-to-end path that holds); sweep work terminates on closure (∀ — the property holds for every required row in the inventory).** Tracer bullets buy integration evidence; sweeps buy role readiness.

Tracer-complete is not load-bearing. Posture ranks the next *vertical* slice; it has no completeness test, so vertical tracers can leave a horizontal capability layer permanently shallow while every slice is "done." A **coverage frontier** is the plan-level container for a **sweep**: a pass that closes a named layer inventory with an aggregate DoD — "no required row in a closed enumerated inventory is left open" — while each row still builds under `proving` or `earned`. It is therefore a different frontier *shape*, not a third posture. The rule-of-three is now met in this repo, so coverage has a first-class planning reference at `.agents/skills/ln-plan/references/coverage.md`: use it for the admission gate, buildability classes (`buildable-now` / `evidence-gated` / `wait-gated`), temporary-ledger protocol, and anti-patterns (`category laundering`, `wrong-input derivation`, `residue denial`, `sequencing leakage`, `symmetry regrowth`). `ln-plan` recognizes and bounds the frontier; the row ledger lives in a `Mode: sweep` scope file under `memory/cards/` (authored via `ln-scope`); `ln-build` closes rows; `ln-sync` audits the contradictions sweep mode tends to create.

#### Posture distribution across skills

`ln-plan`, `ln-design`, `ln-scope`, and `ln-consult` all carry posture-dependent sequencing pressure. `ln-plan` reads posture and loads the matching reference; `ln-scope` inherits posture from the containing frontier and applies the matching posture check. `ln-refactor` owns closure as safe mechanics (when an earned frontier is principally restructuring); `ln-sync` owns closure as canonical garbage collection (when artifacts the planner is already done with need cleanup).

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
| `ln-induct` | Review-bot comments or point observations may be symptomatic of a systemic-ish fault. | An induced diagnostic lens, an audit for unsampled instances, and a triaged report. |
| `ln-review` | After implementation bursts, or when architecture/model hygiene needs an opinionated audit. | Quality findings and next-step recommendations. |
| `ln-judo-review` | A stricter sibling of `ln-review`: a PR preserves incidental complexity, a file nears a size boundary, or spaghetti branching is creeping in and you want deletion-over-rearrangement pressure. | High-conviction restructuring findings; before/after `pseudo` shape pairs. |
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
| “All paths are lit, but is the layer load-bearing?” | `ln-review` for diagnosis, then `ln-plan` for a coverage frontier / sweep |
| “Is a whole capability layer going shallow under vertical slicing?” | `ln-plan` (coverage frontier / sweep) |
| “What is the smallest buildable slice?” | `ln-scope` |
| “Which module/API shape should we choose?” | `ln-design` |
| “How will we know this works?” | `ln-oracles` |
| “What do these tests actually prove?” | `ln-witness` |
| “Can this technical approach work?” | `ln-spike` |
| “Can we make the idea tangible before committing?” | `ln-prototype` |
| “Why is this failing?” | `ln-diagnose` |
| “Is this small finding a symptom of something systemic?” | `ln-induct` |
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

## Self-governance

The skill system verifies itself, the same way the product code does. This is the layer adapted from the ponytail project's engineering discipline (consistency tests, drift-proofing) — deliberately *not* its always-on minimalism control plane, which would collide with the invoke-on-uncertainty model and the topology-stub guardrails above.

**Shipped — static consistency check.** `npm run check:skills` (`scripts/check-ln-skills.mjs`, no dependencies) runs as the last step of `npm run check` and fails on:

- a `ln-*` folder name that disagrees with its SKILL.md frontmatter `name`
- a `ln-*` skill missing from this working guide
- a dead cross-skill link (`../ln-x/SKILL.md`) inside any `ln-*` SKILL.md
- a missing required guardrail phrase — currently the topology-stub carve-out in `ln-review` / `ln-judo-review` / `ln-build`, and the verification-harness commitment in `ln-build`

Extend the guardrail list when a new Brunch-specific invariant must not silently disappear from a skill. Keep the script dependency-free and read-only.

**Deferred — behavioral routing benchmarks (a.k.a. "Move B").** The static check proves the skill set is internally consistent; it does not prove the skills *route* correctly. A future addition: 3–5 small scenario fixtures that judge **method behavior**, not code LOC. Candidate scenarios:

- an ambiguous request routes to `ln-grill` / `ln-disambiguate`, not straight to `ln-build`
- a direct fix inside a settled seam routes to `ln-build`
- a review of a topology-stub-heavy area does **not** recommend deleting `export {}` stubs absent contradicted-topology evidence (the highest-value guard — it pins the #1 ponytail false-positive this repo engineered around)
- an implementation path cites `npm run verify`
- a coverage/frontier question routes to `ln-plan` / `ln-review`, not ad-hoc implementation

Scope notes when picking this up: this is the only piece that introduces a new namespace (a benchmarks/scenarios directory) and likely a `test:skills` script; it is *not* cross-harness portability (Brunch is single-harness — do not cargo-cult ponytail's 14-adapter machinery). Decide the judge mechanism (assertion over a recorded routing decision vs. an LLM-graded transcript) before building.

## References

- Runtime skill instructions: `.agents/skills/ln-*/SKILL.md`
- Repo protocol summary: `AGENTS.md`
