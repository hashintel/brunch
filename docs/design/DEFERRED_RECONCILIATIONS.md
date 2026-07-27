# Deferred Reconciliations — Audit Verdicts

> Status: **audited 2026-05-13**.
> Original date: 2026-05-07.
> Scope: product-direction items derived from the archived intent-spec synthesis ([`INTENT_SPEC_EVOLUTION.md`](../archive/design/INTENT_SPEC_EVOLUTION.md)) that needed a decision: promote into `memory/SPEC.md` / `memory/PLAN.md`, keep gated, or retire as duplicate/deprecated.

## Audit summary

No item should be promoted into `memory/SPEC.md` or `memory/PLAN.md` immediately.

| Theme | Verdict | Reason |
| --- | --- | --- |
| Spec drift surfacing | **Keep deferred** | The concept is still worth preserving, but it is not yet actionable as a requirement or horizon item until FE-700 lands typed checkability / witness metadata and FE-702-style probes can show drift detection is real rather than aspirational. `memory/SPEC.md` already has a lexicon entry for `spec drift`, which is enough for now. |
| Topology-driven disambiguation / next-question ranking | **Covered; do not promote standalone** | The useful part is already represented by the FE-700 semantic model and FE-702 behavioral-kernel / graph-review probe direction. It may later emerge as interviewer behavior, but promoting a separate horizon item now would duplicate those frontier items and over-specify mechanism before probes. |
| Edge epistemic metadata / relation participation | **Duplicate of current FE-700 direction** | `memory/SPEC.md` already records relation policy, support/status gating, operational directionality, edge-local neighborhoods, and relation-family vocabulary through Requirements 30/38, assumptions A81/A93, decisions D137/D150, invariants I109/I118, and lexicon rows. `memory/PLAN.md` FE-700 explicitly calls out edge epistemic metadata and relation-policy directionality. |

## Retained deferred item

### Spec drift surfacing

**Deferred requirement candidate.** When a generated artifact (criterion, requirement, candidate-spec direction, export bundle, or downstream implementation behavior) diverges from its source intent, Brunch should surface the divergence in human terms — "original intent vs generated behavior vs potential mismatch" — so the user can validate meaning at the point where it could have changed, rather than after the divergence has been laundered into a final document.

- **Current canonical coverage:** `memory/SPEC.md` lexicon entry `spec drift`; broader progressive-checkability direction in Requirement 38, A77/A78, D134, and FE-700.
- **Why not promote now:** drift detection needs typed checkability / witness metadata and generated-artifact comparison evidence. Without that substrate, a requirement or plan item would be vague product aspiration rather than an actionable frontier.
- **Trigger to revisit:** FE-700 lands typed checkability / witness metadata and FE-702 or a follow-on probe demonstrates at least one credible drift-detection workflow.
- **Likely promotion path after trigger:** run `ln-spec` to add a requirement and paired assumption; run `ln-plan` only if the probe supports a distinct product surface beyond FE-700/FE-702 follow-through.
- **Possible future design doc:** `docs/design/SPEC_DRIFT.md`, created only if the requirement is promoted.

## Retired as standalone promotions

### Topology-driven disambiguation / next-question ranking

**Original impulse.** The interviewer could issue contrastive A/B/C disambiguation questions when graph topology reveals high-fanout assumptions, unwitnessed requirements, unverified invariants, decisions without rejected alternatives, goals without derived requirements, or conflicting constraints.

**Audit verdict:** do not promote as a separate SPEC requirement or PLAN horizon item now.

- **Captured by:** FE-700 intent graph semantics + relation-policy directionality; FE-702 graph-review / scenario-options probes; `docs/design/INTENT_GRAPH_SEMANTICS.md`; `docs/design/BEHAVIORAL_KERNELS.md`; A80/A85/A91; D134/D137/D151/D152.
- **Reason:** topology is one ranking signal inside the graph-review / behavioral-kernel direction, not a separate product capability yet. It should remain a probe hypothesis until the semantic substrate exists and kernel probes show that topology-driven ranking beats simpler prompt/context heuristics.
- **Future revisit condition:** if FE-702 probes demonstrate a specific topology-ranking algorithm that should become user-visible interviewer behavior, promote it through `ln-spec` / `ln-plan` then.

### Edge epistemic metadata / relation participation rules

**Original impulse.** Knowledge edges would carry support/status/provenance/rationale, and only certain support/status combinations would participate in cascade, staleness, export trace, reconciliation, and weak-suggestion behavior.

**Audit verdict:** already adopted into canonical direction; no standalone promotion remains.

- **Captured by:** Requirement 30, Requirement 38, A81, A93, D137, D150, I109, I118, and the lexicon rows for `edge-local neighborhood`, `relation family`, and `relation policy`; `memory/PLAN.md` FE-700 explicitly includes edge epistemic metadata and relation-policy directionality.
- **Reason:** keeping this as a pending promotion would create duplicate planning state. FE-700 is the right owning frontier.
- **Future revisit condition:** FE-700 implementation may refine field names or policy axes, but that should happen inside FE-700 scope rather than via this deferred ledger.

## How to use this doc

1. Keep this file only while **spec drift surfacing** remains a deferred, not-yet-actionable product impulse.
2. Before opening post-FE-700 semantic/generative work, check whether the spec-drift trigger has fired.
3. If the trigger fires, promote through the canonical skills: `ln-spec` for SPEC.md changes and `ln-plan` for PLAN.md changes.
4. If spec drift is promoted or explicitly retired, delete this file. The synthesis source remains in [`INTENT_SPEC_EVOLUTION.md`](../archive/design/INTENT_SPEC_EVOLUTION.md).

## References

- [`INTENT_SPEC_EVOLUTION.md`](../archive/design/INTENT_SPEC_EVOLUTION.md) — synthesis source for the original deferred impulses.
- [`INTENT_GRAPH_SEMANTICS.md`](./INTENT_GRAPH_SEMANTICS.md) — typed-graph reference and FE-700 semantic direction.
- [`BEHAVIORAL_KERNELS.md`](./BEHAVIORAL_KERNELS.md) — kernel-driven question reference, including topology-adjacent probe ideas.
- `memory/PLAN.md` Next items for FE-700 and FE-702 — the owning frontier items for the retired standalone topology and edge-metadata impulses.
