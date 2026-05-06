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
- `INTENT_SPEC_EVOLUTION.md` — broader intent-spec ontology and progressive checkability synthesis.

Schema reference artifacts are intentionally kept outside this design directory. The canonical generated DBML lives at `docs/schema.dbml` and is derived from `src/server/schema.ts`; do not add parallel `schema.dbml` or `schema.dbdiagram` copies under `docs/design/`.

Do not create `docs/plan/` for active roadmap state. `memory/PLAN.md` remains the single source of truth for the plan; design docs may be linked from plan items as supporting rationale.
