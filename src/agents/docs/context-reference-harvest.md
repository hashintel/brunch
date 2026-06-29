# Context reference harvest notes

Status: backstage curation note. This file is not runtime prompt payload and is not copied into packaged agent assets. Runtime-eligible shared references live in `src/agents/contexts/references/`; skill-local progressive-disclosure references live under the owning skill's `references/` directory.

## Current outcome

The ontology/context harvest now has one generated vocabulary home, one broad authored judgment home, and draft topical slice candidates:

- `src/agents/contexts/references/graph-ontology.md` — generated from typed graph schema/policy sources. Exact kind list, readiness bands, edge-category policy, detail payloads, and `detail.form` legality live there.
- `src/agents/contexts/references/graph-authoring-heuristics.md` — broad authored prompt judgment: kind classification, promotion rules, decision criteria, negative examples, edge authoring, edge-local neighborhoods, topology-driven question ranking, and progressive-checkability conduct.
- `src/agents/contexts/references/context-slice-index.md` — draft selector for smaller injectable slices.
- `src/agents/contexts/references/intent-capture-slice.md` — draft intent/spec capture slice.
- `src/agents/contexts/references/design-projection-slice.md` — draft design projection slice.
- `src/agents/contexts/references/oracle-witness-slice.md` — draft oracle/verification slice.
- `src/agents/contexts/references/plan-sequencing-slice.md` — draft plan-plane slice.
- `src/agents/contexts/references/neighborhood-consumption-slice.md` — draft edge-local context consumption slice.
- `src/agents/contexts/references/review-set-drafting-slice.md` — draft review-set proposal slice.

This note exists only to explain what was translated, rejected, or deferred while turning older design material into those references. The topical slices are not yet cited by skill bodies; promote citations only when a concrete reader chooses them.

## Harvest rule

Design prose can motivate authored guidance, but it is not the source of closed vocabulary. Closed node kinds, edge categories, endpoint roles, readiness bands, and detail shapes come from typed code and are projected into `graph-ontology.md`.

When an old document proposes a schema field or enum that the current model rejected, translate the useful conduct into existing graph vocabulary instead of reviving the old field.

## Source dispositions

### Salvaged `INTENT_GRAPH_SEMANTICS` / older nine-kind ontology

**Translated into:** `graph-authoring-heuristics.md` and the draft topical slice files listed above.

Kept:

- graph-as-typed-claims mental model, updated to the current four-plane graph;
- modality-based kind classification;
- promotion before defaulting to `context`;
- strict decision-capture criteria;
- negative examples and counterexamples as first-class prompt guidance;
- edge-local neighborhood guidance;
- topology-driven question ranking;
- weakest-sufficient verification/checkability conduct.

Updated for the current model:

- nine top-level kinds became current four-plane vocabulary from `graph-ontology.md`;
- `term`, `thesis`, `story`, `unknown`, oracle-plane, design-plane, and plan-plane kinds are included;
- subtype proposals are not schema: preserve subtype-like distinctions in node text, `detail.form`, or edges;
- old named relations map to current structural edge categories;
- edge status/provenance/support metadata maps to `basis`, edge `rationale`, `change_log`, review-set drafts, and `reconciliation_need`;
- checkability/strength fields remain prompt/oracle conduct, not graph metadata.

Rejected as current schema:

- `constraint` / `invariant` / `criterion` / `example` subtype enums;
- accepted-edge `support` / `status` / `provenanceTurnId` metadata;
- claim-level `checkability`, `strength`, `validTraces`, or `invalidTraces` fields;
- a per-relation policy registry with free-form relation names.

### `docs/design/ONTOLOGY_REVIEW_PROTOCOL.md`

**Translated into:** `graph-authoring-heuristics.md`; canonical facts already live in `memory/SPEC.md` and typed schema.

Kept:

- method closure rule: a method is `spec.kind` + `detail.form` + renderer + heuristic set, not new node/edge kinds;
- `detail.form` is inert payload; `kind` drives graph behavior;
- context/assumption/unknown routing;
- Gherkin/formal-verification mapping discipline;
- role-named endpoints and explicit impact policy, not verb-direction inference.

Do not revive:

- historical `thesis -> claim` rename proposal (did not land);
- stale pre-FE-1052 baseline tables;
- workbench/bench/speculation plane proposals without a new scoped reader;
- deferred nodes/edges such as `actor`, `scenario`, `conflict`, `participation`, `coverage`.

### `docs/design/ELICITATION_QUESTIONS.md`

**Partially translated into:** `graph-authoring-heuristics.md` kind classification and phrase-to-kind priors.

Kept:

- node kind is the closed ontology;
- questions are open, situated projections inside a kind;
- elicitation gaps carry free-text questions referring to node kinds, not a parallel question-type enum.

Still deferred:

- a refreshed `elicitation-question-hints.md` shared reference. Reopen only when a scoped reader such as `elicitation-gap-guidance` needs reusable question patterns and updates examples against current kind names and D94-L bands.

### `docs/design/ELICITATION_LENSES.md`

**Disposition:** skill-local/reference input only when a concrete reader appears.

Kept as conduct where already relevant:

- fan-out/fan-in prompting;
- grounding-density judgment;
- D31-style meta-rubric language for proposal/oracle generation.

Do not revive:

- runtime `strategy` / `lens` / `method` axes as user-changeable session state;
- old lens catalogues as schema or graph state.

Possible future homes:

- `proposal-meta-rubric.md` if a second reader beyond `generate-proposal` earns a shared reference;
- `projection-guidance.md` only after the `elicitor-project` design verdict.

### `docs/design/BEHAVIORAL_KERNELS.md`

**Disposition:** skill-local oracle and elicitation conduct; not runtime ontology.

Kept:

- examples/counterexamples clarify intent;
- weakest-sufficient verification artifact language;
- behavioral kernels as question/probe inspiration.

Do not revive:

- kernel labels as graph kinds, runtime state, or a parallel prompt taxonomy.

### Current skill bodies

`capture` and `commit-graph` cite `graph-authoring-heuristics.md` for shared graph-authoring judgment. `generate-proposal/references/oracle.md` remains the skill-local home for progressive verification/oracle conduct until another concrete reader needs the same payload.

## Deferred tripwires

Reopen a shared reference only when the reader is concrete:

- `elicitation-question-hints.md` — when `elicitation-gap-guidance` or another elicitor-question feature needs reusable question patterns.
- `proposal-meta-rubric.md` — when `project` or another generator becomes a second reader for the current generate-proposal rubric.
- `projection-guidance.md` — after `elicitor-project` decides whether cross-plane derivation folds into `generate` or needs a distinct surface.

Until then, do not bulk-import old design docs into runtime prompt references.

## Guardrails for future harvests

- Keep generated vocabulary generated; run `npm run generate:ontology` only when typed sources change.
- Keep authored runtime guidance tied to at least two concrete readers, or keep it skill-local.
- Preserve negative knowledge through `example` + `witness:against` or `exclusion`, not through new relation names.
- Put low-confidence material in `elicitation_gap`; put contradictions in `reconciliation_need`.
- Treat D98-sensitive vocabulary as prompt-resource conduct only, not persisted runtime axes.
