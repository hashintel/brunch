---
name: ln-consult
description: "Lightweight triage for the ln-* skill set. Use when unsure which ln skill to use next, starting work on something new, or when the user asks for guidance on their development process."
---

# Ln Consult

Assess where the user is, classify the work, and suggest the next `ln-*` skill.

If context is unclear, ask **one** clarifying question — then recommend.

The canonical rule is simple: durable planning state lives only in `memory/SPEC.md` and `memory/PLAN.md`, and new or uncertain work defaults to the canonical flow until a narrow exception is clearly justified.

Do not invent new planning documents, sidecar ledgers, or alternate storage locations without explicit user permission. If a fact matters beyond the current step, reconcile it into `memory/SPEC.md` or `memory/PLAN.md`; if it is temporary transfer state, keep it in `HANDOFF.md`; if it is a temporary multi-card execution queue inside one frontier item, keep it in `memory/CARDS.md`; if it is a temporary refactor execution plan, keep it in `memory/REFACTOR.md`. Derivative files stay live only while they still carry unfinished work.

Orient, then classify.

## Fresh-thread re-entry

If this is a fresh thread or an unfamiliar area, reload the live context before routing:

1. `memory/SPEC.md`
2. `memory/PLAN.md`
3. `HANDOFF.md` if present
4. `docs/archive/PLAN_HISTORY.md` only if the current frontier or touched area is still unclear

Start the assessment with 2-4 bullets naming:

- the containing seam or subsystem
- the active frontier item or nearby priority
- volatile state or manual follow-up from handoff
- the main open risk
- the dominant load-bearing uncertainty (which `memory/SPEC.md` §Assumption, if any) and the cheapest way to retire it

## Work-type classification

Classify the request before routing.

| Work type | Signals | Default handling |
| --- | --- | --- |
| **Structural** | New seam, new boundary, durable architectural choice, invalidates assumptions | `ln-spec` / `ln-plan` / `ln-scope` as needed |
| **Bounded feature** | New capability inside settled seams | `ln-scope` with a light scope card, then `ln-build` |
| **Hardening** | Dependency audit, fixture work, perf, tooling upkeep | direct `ln-build` only if the seam is already settled and scope is obvious; otherwise `ln-scope` |
| **Bugfix** | Regression or incorrect behavior inside known seams | direct `ln-build` only if the seam is settled and reconciliation is likely to be a no-op |
| **Refactor** | Rename, extract, restructure without changing behavior | `ln-refactor` |

If the work crosses more than two seams, changes a requirement, or would change future planning if it went differently, promote it to **structural**.

If you cannot name the containing seam from the live docs, treat the work as **structural** until proven otherwise.

Presume **structural** on a fresh thread when the work touches workflow closure, routed layout ownership, persistence schema, knowledge-graph behavior, observer sync, or transport contracts.

## Canonical flow

Default rule:

`ln-grill` or `ln-disambiguate` → `ln-spec` → `ln-plan` → optional `ln-design` / `ln-oracles` → `ln-scope` → optional `ln-spike` → `ln-build` → `ln-review` → optional `ln-refactor` / `ln-sync`

Bounded exception:

`ln-scope → ln-build`

Bounded serial exception:

`ln-scope → ln-build → commit → ln-build ...` inside one already-settled frontier item, optionally with the prepared queue persisted in `memory/CARDS.md`

Direct-build exception:

`ln-build`

Only recommend the bounded or direct-build exceptions when all of these are true:

- the containing seam is already named in the live docs
- no durable requirement / assumption / decision / invariant change is expected
- post-build reconciliation can plausibly be a no-op
- no high-impact unresolved `memory/SPEC.md` §Assumption is load-bearing for this work

Only recommend the bounded serial exception when those same conditions hold and the next several commit-sized steps are obvious enough to queue without fresh planning.

## Uncertainty-first override

When several routes fit the work, prefer the one with the highest information gain per unit of cost. Given the repo's pre-release posture, the default uncertainty-attack vehicle is **a thin vertical slice that would break if the assumption is wrong**, built via `ln-scope` → `ln-build`. That is usually cheaper and more informative than a study-step spike.

Recommend a non-build route **only when** the cheapest informative move genuinely is not a slice:

- `ln-design` — the module shape itself rests on a low-confidence claim and building any slice would lock in the wrong seam
- `ln-oracles` — the verification strategy is so uncertain that you cannot tell a passing slice from a wrong one
- `ln-spike` — the question is research-grade or external (third-party API contract, vendor perf characteristic, library behavior under load) and no vertical slice would be cheaper than a pure probe
- `ln-prototype` — the question is about feel, comparison, or UX legibility, where playable variants beat real code

This override is for **attacking** uncertainty aggressively, not deferring it. If in doubt, build the thinnest slice that would break if the belief is wrong, and let landing it produce the evidence. Spikes are the escape hatch, not the default.

## Routing table

| Situation | Work type | Suggest |
| --- | --- | --- |
| Idea is vague, needs fleshing out | structural | `ln-grill` |
| Plausible interpretations diverge; examples would clarify faster than open-ended questioning | structural | `ln-disambiguate` |
| Understanding exists, needs a written spec | structural | `ln-spec` |
| Spec exists, needs work sequencing | structural | `ln-plan` |
| Verification strategy is the main uncertainty | structural | `ln-oracles` |
| Next work item needs precise boundaries | structural or bounded | `ln-scope` |
| One settled frontier item needs several small verified commits in sequence | bounded, hardening | `ln-scope` then serial `ln-build` loop, optionally via `memory/CARDS.md` |
| Module interface needs exploration | structural | `ln-design` |
| Full or light scope card exists, ready to code | bounded, hardening, bugfix | `ln-build` |
| Technical uncertainty blocks progress, or a cheap investigation could invalidate planned work | any | `ln-spike` |
| Code works but needs restructuring | refactor | `ln-refactor` |
| Code works but quality / architecture needs audit | any | `ln-review` |
| Docs are stale, overweight, or milestone context needs cleanup | structural / maintenance | `ln-sync` |
| Session is ending or context is getting fragile | any | `ln-handoff` |

## Output

```md
## Assessment
- [orientation bullet]
- [orientation bullet]
- [1-2 sentences on current state and work classification]
```

## Routing

After assessment, present the top 2–3 relevant options from the routing table to the user (use `tool-ask-question`). Mark the best fit as recommended. If two skills are clearly sequential (for example `ln-scope` then `ln-build`), note the sequence in the recommended option's description.
