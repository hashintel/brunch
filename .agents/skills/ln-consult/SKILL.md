---
name: ln-consult
description: "Triage the ln-* skill set — assess state and recommend the next skill. Use when unsure which ln skill applies, starting new work, or re-entering ambiguous work."
---

# Ln Consult

Assess where the user is, classify the work, and suggest the next `ln-*` skill.

If context is unclear, ask **one** clarifying question — then recommend.

The canonical rule is simple: durable planning state lives only in `memory/SPEC.md` and `memory/PLAN.md`, and new or uncertain work defaults to the canonical flow until a narrow exception is clearly justified.

Do not invent new planning documents, sidecar ledgers, or alternate storage locations without explicit user permission. Reconcile durable facts into `memory/SPEC.md` / `memory/PLAN.md`; keep volatile state only in its sanctioned derivative — `HANDOFF.md` (transfer state), `memory/cards/` (prepared scope cards), `memory/REFACTOR.md` (refactor plan) — and only while it still carries unfinished work.

Orient, then classify.

## Fresh-thread re-entry

If this is a fresh thread or an unfamiliar area, reload the live context before routing:

1. `memory/SPEC.md`
2. `memory/PLAN.md`
3. `HANDOFF.md` if present
4. `docs/archive/PLAN_HISTORY.md` only if the current frontier or touched area is still unclear

Start the assessment with 2-4 bullets naming:

- the containing seam, subsystem, or load-bearing layer
- the active frontier item or nearby priority
- volatile state or manual follow-up from handoff
- the main open risk
- the likely **work shape**: vertical slice, slice sequence, sweep, refactor, spike, or sync

## Work-shape classification

Classify the request by the proof it needs, not by whether it sounds like implementation.

> Match the proof to the claim — a witness (one end-to-end path) for a vertical slice, closure (every required row) for a sweep — and don't declare done until they match.

| Shape | Signals | Default handling |
| --- | --- | --- |
| **Vertical slice** | One behavior should work through the relevant boundaries; landing it is a witness | `ln-scope` with `Mode: single`, then `ln-build` |
| **Slice sequence** | Several small vertical follow-ups are obvious inside one settled frontier and do not depend on earlier findings | `ln-scope` with `Mode: slices`, then sliced `ln-build` |
| **Sweep** | All paths are lit but a load-bearing layer remains shallow; the work terminates on closure over an enumerated inventory | `ln-plan` for coverage-frontier admission, then `ln-scope` with `Mode: sweep` |
| **Structural decision** | New seam, boundary, durable architecture choice, or assumption invalidation | `ln-spec` / `ln-plan` / `ln-design` / `ln-oracles` as needed before scoping |
| **Direct fix** | Tiny bugfix, hardening, or docs/tooling edit inside a named settled seam | direct `ln-build` only when reconciliation is plausibly a no-op |
| **Refactor** | Rename, extract, restructure without behavior change | `ln-refactor` |
| **Sync / cleanup** | Canonical docs or derivative artifacts are stale, overweight, or contradictory | `ln-sync` |

Promote the route to structural when the work crosses more than two seams, changes a requirement, changes future planning if it lands differently, or depends on a high-impact unresolved `memory/SPEC.md` §Assumption.

If you cannot name the containing seam or layer from the live docs, treat the work as structural until proven otherwise.

Presume structural on a fresh thread when the work touches workflow closure, routed layout ownership, persistence schema, knowledge-graph behavior, observer sync, or transport contracts.

## Canonical flow

Default rule:

`ln-grill` or `ln-disambiguate` → `ln-spec` → `ln-plan` → optional `ln-design` / `ln-oracles` → `ln-scope` → optional `ln-spike` → `ln-build` → `ln-review` / `ln-witness` → optional `ln-refactor` / `ln-sync`

`ln-scope` chooses the scope-file mode:

- `Mode: single` — one vertical slice
- `Mode: slices` — a short queue of already-legible vertical slices
- `Mode: sweep` — a closed ledger for a coverage frontier

Bounded exceptions:

- `ln-scope → ln-build` for one settled slice
- `ln-scope → sliced ln-build` for one settled sequence
- `ln-plan → ln-scope Mode: sweep → ln-build` for an admitted sweep
- direct `ln-build` for a tiny direct fix inside a named settled seam

Only recommend bounded or direct-build paths when the containing seam/layer is already named, no durable requirement / assumption / decision / invariant change is expected, and post-build reconciliation can plausibly be a no-op.

## Posture-aware route override

When several routes fit the work, the preferred route depends on the active frontier's certainty posture (see `docs/praxis/ln-skills.md` §Operating posture). Posture ranks row/card execution; it does not replace the slice-vs-sweep shape decision.

**Proving posture.** Prefer the route that fires the **tracer bullet that tells you the most**. A tracer-bullet slice or sweep row scores on proof of life, invariants, or uncertainty retirement. The best next unit scores on more than one.

**Earned posture.** Prefer the route that lands the **closure that recent slices have been deferring**. Closure work materializes topology, canonicalizes names, retires bridges, deletes obsolete carriers, or locks in a settled shape. If the closure target is named and one scoped unit can land it, route to `ln-scope` / `ln-build` rather than further planning.

**Sweep shape.** Prefer `ln-plan` before scoping unless the coverage frontier already exists. A sweep is safe only with a named load-bearing layer, a closed inventory, required/deferred rows, and an owner + oracle per required row.

Under proving posture, attack uncertainty by building. Recommend a non-build route only when no buildable tracer can carry the proof:

- `ln-design` — module shape itself is uncertain and any slice would lock in the wrong seam
- `ln-oracles` — verification is too uncertain to distinguish a passing slice from a wrong one
- `ln-spike` — research-grade or external question (third-party API contract, vendor perf characteristic, library behavior under load)
- `ln-prototype` — feel, comparison, or UX-legibility question where playable variants beat real code

Spikes are the escape hatch, not the default.

## Routing table

| Situation | Work type | Suggest |
| --- | --- | --- |
| Idea is vague, needs fleshing out | structural | `ln-grill` |
| Plausible interpretations diverge; examples would clarify faster than open-ended questioning | structural | `ln-disambiguate` |
| Understanding exists, needs a written spec | structural | `ln-spec` |
| Spec exists, needs work sequencing | structural | `ln-plan` |
| All paths are lit but a load-bearing layer still feels thin; vertical slices keep leaving a capability surface shallow | structural | `ln-plan` — author a coverage frontier / sweep only if the admission gate in `ln-plan/references/coverage.md` passes |
| Verification strategy is the main uncertainty | structural | `ln-oracles` |
| Next work item needs precise boundaries | structural or bounded | `ln-scope` |
| One settled frontier item needs several small verified commits in sequence | bounded, hardening | `ln-scope` then sliced `ln-build` loop, optionally via a `Mode: slices` scope file under `memory/cards/` |
| Module interface needs exploration | structural | `ln-design` |
| Full or light scope card exists, ready to code | bounded, hardening, bugfix | `ln-build` |
| Technical uncertainty blocks progress, or a cheap investigation could invalidate planned work | any | `ln-spike` |
| Review-bot comments or point findings may be symptomatic of a systemic fault | any | `ln-induct` |
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
