# Design Documents

This directory holds exploratory and working design rationale. These files are not canonical planning state.

Canonical project memory lives in:

- `memory/SPEC.md` — accepted product direction, decisions, assumptions, invariants, and lexicon.
- `memory/PLAN.md` — the rolling frontier for upcoming work.
- `docs/archive/PLAN_HISTORY.md` — retired plan history.

Use design documents for deeper argumentation, raw synthesis, alternatives, and qualifying principles that are too large for `memory/SPEC.md` or `memory/PLAN.md`. Promote conclusions into canonical memory through the `ln-spec` and `ln-plan` workflows before treating them as roadmap commitments.

## Status language

- `source archive / raw synthesis` — broad source material preserved for provenance; active docs may cite it, but it is not live guidance.
- `working design proposal` — a shaped proposal that may guide planning, but still needs canonical SPEC / PLAN links.
- `active synthesis` — the current cross-document concept map for a cluster; subsystem/source docs remain useful for details, but this doc owns the combined direction.
- `shipped substrate reference` — an RFC whose first implementation has landed; use it for invariants, migrations, and historical rationale, but check `memory/SPEC.md` / `memory/PLAN.md` for current status.
- `historical design pressure` — still valuable for unresolved questions or algorithms, but terminology or product shape has been superseded.
- `interim backlog` — shaped impulses that are deliberately not in the plan until their triggers fire.
- `future-facing draft` — intentionally deferred architecture map.
- `archived` — historical context only; no longer live design guidance.

## Live index

### Product ontology and strategy

| Document | Role |
| --- | --- |
| `INTENT_GRAPH_SEMANTICS.md` | Product-layer ontology, edge taxonomy, relation policy, and progressive-checkability binding. Canonical design reference for FE-700. |
| `BEHAVIORAL_KERNELS.md` | Behavioral-kernel typology, kernel cards, signal-phrase routing, and contrastive-question workflow. Canonical design reference for kernel probes. |
| `SPEC_EVOLUTION_STRATEGIES.md` | FE-705-era synthesis for chat-local strategies, scenario options, graph review, proposal turns, relation directionality, and candidate bundles. Graduated into `memory/SPEC.md` / `memory/PLAN.md`; keep as rationale. |
| `AGENT_MUTATION_SURFACE.md` | Audit of agent-originated/adjoining mutation paths and the capability/changeset boundary needed before agents write durable truth. |

### Conversational workspace runtime cluster

Start with `CONVERSATIONAL_WORKSPACE_RUNTIME.md`. The other files in this cluster are retained source/subsystem references; do not read them as independent future roadmaps.

| Document | Role |
| --- | --- |
| `CONVERSATIONAL_WORKSPACE_RUNTIME.md` | **Active synthesis** for the continuous workspace + unified chat + reconciliation + changeset-ledger concept. Owns the cluster supersession map and current open questions. |
| `MULTI_CHAT.md` | Shipped substrate reference for `chat`, `turn.chat_id`, `specification.primary_chat_id`, and `reconciliation_need`. Phase 2/3/4 rows are historical staging, not current sequence authority. |
| `SIDE_CHAT.md` | User-surface history and phasing for side-chat V1–V3.1, with V4 notes. Patch-list/top-bar and Pending review claims are bridge/history unless reaffirmed by the runtime synthesis. |
| `PATCH_LEDGER.md` | Historical design pressure for semantic mutation history, reconciliation bases, and target ordering. Future-facing vocabulary is `changeset` / `change`; use it for algorithms, not names. |
| `CONTINUOUS_WORKSPACE_HYBRID.md` | Workspace-shell shape exploration; owns the route-alias / workspace-controller / chart-backed-supervisor choice. |

### Dev process and deferred impulses

| Document | Role |
| --- | --- |
| `ln-skills/EVOLUTION.md` | Dev-layer trajectory for the `ln-*` skill family, `memory/` ontology, proposed file-backed spec registry, and possible dev/product ontology convergence. Not product SPEC. |
| `DEFERRED_RECONCILIATIONS.md` | Interim backlog for product impulses that are worthy but intentionally gated. Audit before promoting or retiring entries. |

### Isolated / future-facing notes

| Document | Role |
| --- | --- |
| `PORTABILITY_BOUNDARIES.md` | Future adapter/hosting/remote-workspace boundary map. |
| `GRAPH_KIND_CHIP_TOGGLE.md` | Standalone graph-view split-button chip proposal; audit against current horizon before implementation. |
| `README.md` | This index and local design-doc policy. |

### Archived source

| Document | Role |
| --- | --- |
| `../archive/design/INTENT_SPEC_EVOLUTION.md` | Raw synthesis / ideation source for the May 2026 intent-spec evolution work. Active docs above supersede its conclusions. |

Schema reference artifacts are intentionally kept outside this design directory. The canonical generated DBML lives at `docs/schema.dbml` and is derived from `src/server/schema.ts`; do not add parallel `schema.dbml` or `schema.dbdiagram` copies under `docs/design/`.

Do not create `docs/plan/` for active roadmap state. `memory/PLAN.md` remains the single source of truth for the plan; design docs may be linked from plan items as supporting rationale.
