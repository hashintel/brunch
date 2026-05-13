# Deferred Reconciliations — Pending Promotions to SPEC / PLAN

> Status: **interim backlog, audited 2026-05-13**.
> Date: 2026-05-07.
> Scope: shaped product-direction items derived from the archived intent-spec synthesis ([`INTENT_SPEC_EVOLUTION.md`](../archive/design/INTENT_SPEC_EVOLUTION.md)) that are *worthy but gated*: either partially captured in `memory/SPEC.md` / `memory/PLAN.md`, or deliberately deferred until prerequisite work lands.
>
> Each entry below has a clear destination (a `memory/SPEC.md` requirement / assumption / decision, a `memory/PLAN.md` item, or a new design doc) and a clear **trigger condition**. When the trigger fires, promote the entry through the appropriate `ln-*` skill and remove the entry from this file. When the file is empty it can be deleted.
>
> Audit result: none of the product impulses below should be promoted immediately. Edge metadata and topology-driven ranking are now represented in the FE-700/FE-702 frontier direction, but implementation evidence has not landed. Spec drift has a lexicon entry and remains a plausible product surface, but still lacks the typed-claim substrate that would make it actionable.

## How to use this doc

1. Before opening a new frontier item, check whether any deferred entries below have triggers that have now fired.
2. When promoting an entry, route through the canonical skill: `ln-spec` for SPEC.md changes, `ln-plan` for PLAN.md changes. Do not hand-edit canonical memory.
3. Delete promoted entries from this file. The synthesis source remains in [`INTENT_SPEC_EVOLUTION.md`](../archive/design/INTENT_SPEC_EVOLUTION.md) for context, but this backlog is the single live tracking place.
4. If a trigger never fires, decide explicitly whether the entry is still relevant or should be retired with a note in the synthesis source.

---

## Pending SPEC.md additions

### Requirement candidates (3)

**REQ-D1. Spec drift surfacing.**
When a generated artifact (criterion, requirement, candidate-spec direction, export bundle, or downstream implementation behavior) diverges from its source claim, Brunch surfaces the divergence in human terms — "original intent vs generated behavior vs potential mismatch" — so the user can validate meaning at the point where it could have changed, rather than after the divergence has been laundered into a final document.
- **Trigger:** FE-700 lands the `checkability` field and `claimMetadata` so drift can actually be detected at the typed-claim level.
- **Promotes through:** `ln-spec` patch.
- **Cross-refs once promoted:** proposed design doc `docs/design/SPEC_DRIFT.md` (entry C3 below; not yet created); links to existing Requirement 38 (invariant + example as kinds) and the `spec drift` Lexicon entry that already exists.

**REQ-D2. Disambiguation probes from graph topology.**
The interviewer can issue contrastive A/B/C disambiguation questions when the typed graph contains a high-fanout assumption, an unwitnessed requirement, an unverified invariant, a decision without rejected alternatives, a goal without derived requirements, or a conflicting constraint. The TiCoder-style move is generalized beyond test cases: the interviewer generates cases where plausible interpretations diverge, then asks the user to classify them; the classifications emit typed claims and edges per [`INTENT_GRAPH_SEMANTICS.md`](./INTENT_GRAPH_SEMANTICS.md).
- **Trigger:** FE-700 lands the typed graph (kinds + subtypes + relation families + edge metadata); FE-702 first kernel probes complete and the contrastive-question pattern is validated.
- **Promotes through:** `ln-spec` patch.
- **Cross-refs once promoted:** the topology-driven heuristics table in [`INTENT_GRAPH_SEMANTICS.md`](./INTENT_GRAPH_SEMANTICS.md); new horizon plan item B3 (below); behavioral-kernel composition in [`BEHAVIORAL_KERNELS.md`](./BEHAVIORAL_KERNELS.md).

**REQ-D3. Edge epistemic metadata participation rules.**
Knowledge edges carry `support` (`explicit` / `strong_inference` / `weak_candidate`), `status` (`proposed` / `accepted` / `rejected` / `stale`), `provenanceTurnId`, and `rationale`. Only edges of certain support / status combinations participate in cascade, staleness, export-trace, reconciliation, and weak-suggestion capabilities, per the relation-policy registry. Inferred edges do not silently become false dependencies.
- **Trigger:** FE-700 lands the edge schema and the relation-policy registry.
- **Promotes through:** `ln-spec` patch.
- **Cross-refs once promoted:** the edge schema and relation-policy table in [`INTENT_GRAPH_SEMANTICS.md`](./INTENT_GRAPH_SEMANTICS.md); the existing I109 (compact existing-knowledge anchors); the existing `relation family` and `relation policy` Lexicon entries.

### Assumption candidates (3)

**A-D1. Spec drift can be made user-legible without exposing formal-methods terminology.**
Drift surfaced as "original intent → generated behavior → potential mismatch" with a chosen-direction question is sufficient for users to validate meaning, without requiring users to read predicates, contracts, or proof obligations.
- **Trigger:** REQ-D1 promotion (paired assumption).
- **Validation approach:** prototype drift surfacing on one corpus of generated criteria; compare user comprehension against direct exposure to the underlying typed-claim diff.

**A-D2. Topology-driven question ranking outperforms template-driven next-question generation as graph density grows.**
Once the typed graph carries kinds, subtypes, and edge metadata, an interviewer that ranks next questions by topology (gap-finding heuristics on the graph) produces more useful questions than one that ranks by phase template — especially for incremental-feature elicitation where the graph is dense from the start.
- **Trigger:** REQ-D2 promotion (paired assumption).
- **Validation approach:** scenario-substrate probes comparing template-driven vs topology-driven next-question generation on the same seeded graphs.

**A-D3. The five-family relation taxonomy is right-sized.**
Five families (justification / dependency / boundary / refinement / verification) is small enough to teach the observer reliably and large enough to drive cascade / export / staleness / reconciliation policy without flat equality of edges. Adding a sixth family creates more confusion than precision; collapsing to four loses too much policy distinction.
- **Trigger:** REQ-D3 promotion (paired assumption).
- **Validation approach:** observer corpus probes labelling edges across the five families; check whether classifier confusion concentrates on family boundaries that suggest splits or merges.

---

## Pending PLAN.md additions

### Horizon items (2)

**PLAN-D1. Spec drift detection product surface.**
After the typed claim metadata lands (FE-700) and the scenario substrate has probed drift detection (FE-702 follow-on), promote drift detection from a discipline to a user-facing product surface: how divergences are surfaced in the workspace stream, how the user validates or corrects, what they produce durably, and whether drift items become first-class typed claims (likely a new `drift_finding` subtype on `example` or a new top-level kind).
- **Trigger:** REQ-D1 promotion + scenario-substrate drift probe complete.
- **Depends on:** intent graph semantics + progressive checkability (FE-700 → next-3); scenario substrate (FE-698 → next-2); generative prompt probes (FE-702 → next-4).
- **Promotes through:** `ln-plan` patch.
- **Once promoted:** point at the proposed design doc `docs/design/SPEC_DRIFT.md` (entry C3 below; not yet created).

**PLAN-D2. Topology-driven next-question ranking interviewer behavior.**
Refactor the interviewer's next-question selection to consult typed-graph topology (high-fanout low-confidence assumptions, requirements without `verifies` incoming, criteria without targets, decisions without rejected alternatives, conflicting `constrains` edges, goals without derived requirements). Distinct from kernel-driven questions: kernels suggest *what kind* of question; topology heuristics suggest *which item* to ask about.
- **Trigger:** REQ-D2 promotion + first behavioral-kernel probes complete.
- **Depends on:** intent graph semantics + progressive checkability (FE-700); generative prompt probes for behavioral kernels (FE-702 partial).
- **Promotes through:** `ln-plan` patch.
- **Once promoted:** complement to behavioral-kernel work, not replacement.

---

## Pending design docs (1)

**C3. Proposed `docs/design/SPEC_DRIFT.md`.**
Canonical reference for spec-drift detection as a product surface. This file does not exist yet; create it only if REQ-D1 is promoted. Layer 4 of the source synthesis's four-layer architecture (intent capture / ambiguity discovery / spec artifact generation / spec drift detection). Should specify:
- What counts as drift (intent ↔ artifact ↔ implementation divergence cases)
- How drift is detected per artifact type (criterion divergence, candidate-spec divergence, export divergence, implementation behavior divergence)
- How drift is surfaced in the workspace stream (UI shape, when it interrupts, when it stays passive)
- How the user validates or rejects (chosen-direction question shape)
- What drift findings become durably (typed-claim subtype vs. process state vs. activity card)
- Relation to reconciliation needs (drift can produce reconciliation needs but is distinct from them)
- Drift detection vs. drift recovery — the second is a different problem
- **Trigger:** REQ-D1 promotion (the SPEC requirement should exist before the design doc commits to a shape).
- **Author through:** ordinary `docs/design/` workflow, not a skill.

---

## When everything has promoted

When this file's three sections (SPEC, PLAN, design docs) are all empty, delete the file. The synthesis source remains in [`INTENT_SPEC_EVOLUTION.md`](../archive/design/INTENT_SPEC_EVOLUTION.md) and the canonical references stand on their own.

If items remain unpromoted past their triggers (e.g., FE-700 ships but REQ-D1 still hasn't promoted three months later), reopen this file's relevant entry with a note explaining why — either retire it with reasoning, or escalate it to active triage through `ln-consult`.

## References

- [`INTENT_SPEC_EVOLUTION.md`](../archive/design/INTENT_SPEC_EVOLUTION.md) — synthesis source for every entry above.
- [`INTENT_GRAPH_SEMANTICS.md`](./INTENT_GRAPH_SEMANTICS.md) — typed-graph reference; entries above all assume this lands first.
- [`BEHAVIORAL_KERNELS.md`](./BEHAVIORAL_KERNELS.md) — kernel-driven question reference; complementary to topology-driven ranking.
- `memory/PLAN.md` Next items for FE-700 intent graph semantics and FE-702 graph-review / scenario probes — the frontier items whose completion will fire most triggers above.
