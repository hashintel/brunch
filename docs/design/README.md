# Design Documents

This directory holds exploratory and working design rationale. These files are not canonical planning state.

Canonical project memory lives in:

- `memory/SPEC.md` — accepted product direction, decisions, assumptions, invariants, and lexicon.
- `memory/PLAN.md` — the rolling frontier for upcoming work.
- `docs/archive/PLAN_HISTORY.md` — retired plan history.

Use design documents for deeper argumentation, raw synthesis, alternatives, and qualifying principles that are too large for `memory/SPEC.md` or `memory/PLAN.md`. Promote conclusions into canonical memory through the `ln-spec` and `ln-plan` workflows before treating them as roadmap commitments.

Status language:

- `raw synthesis / ideation` — broad source material; requires grilling before promotion.
- `working design proposal` — a shaped proposal that may guide planning, but still needs canonical SPEC / PLAN links.
- `archived` — historical context only; no longer live design guidance.

Current live design proposals:

- `MULTI_CHAT.md` — concrete phase-one substrate for chat containers and reconciliation needs.
- `PATCH_LEDGER.md` — deeper semantic mutation history and reconciliation design pressure after the multi-chat substrate.
- `INTENT_SPEC_EVOLUTION.md` — broader intent-spec ontology and progressive checkability synthesis (raw, the source for the more focused docs below).
- `INTENT_GRAPH_SEMANTICS.md` — product-layer ontology, edge taxonomy, relation policy, and progressive-checkability binding. Canonical reference for FE-700.
- `BEHAVIORAL_KERNELS.md` — product-layer behavioral-kernel typology, kernel cards, signal-phrase routing, and the contrastive-question interviewer workflow. Canonical reference for FE-702 kernel probes.
- `DEV_WORKFLOW_EVOLUTION.md` — **dev-layer** trajectory for the `ln-*` skill family, the proposed file-backed spec registry, and the long-horizon convergence between dev and product ontologies. Distinct from the product-layer docs above; not part of `memory/SPEC.md`.
- `DEFERRED_RECONCILIATIONS.md` — interim backlog of shaped product-direction items (SPEC requirements, assumptions, PLAN horizon items, future design docs) that are ready for promotion but deliberately deferred until prerequisite work fires their triggers. Delete the file when all entries have promoted.

Schema reference artifacts are intentionally kept outside this design directory. The canonical generated DBML lives at `docs/schema.dbml` and is derived from `src/server/schema.ts`; do not add parallel `schema.dbml` or `schema.dbdiagram` copies under `docs/design/`.

Do not create `docs/plan/` for active roadmap state. `memory/PLAN.md` remains the single source of truth for the plan; design docs may be linked from plan items as supporting rationale.
