# Context reference harvest ledger

Status: backstage-only curation ledger. This file is not runtime prompt payload, is not copied into packaged agent assets, and is not a shared context reference. Runtime-eligible references live under `src/agents/contexts/references/`; skill-local progressive-disclosure references live under the owning skill's `references/` directory.

Purpose: record the row-by-row disposition of recovered or design-era data-model guidance before any authored runtime reference is created. Rows point to source material and next action; they do not restate the ontology.

A source may carry more than one disposition class when it has separable uses. Treat the classes as labels, not an exclusive enum. Generated-reference inputs are the exception that preserves D97-L: only typed code sources may generate reference tables; recovered/design prose may motivate which table to generate, but it is authored-reference input or backstage rationale, not the source of truth.

## Disposition classes

| Class | Meaning |
| - | - |
| generated-reference input | Typed code source for generated content, not hand-authored prose. |
| authored-runtime-reference input | Candidate source for a shared reference under `src/agents/contexts/references/`. |
| skill-local-reference input | Candidate source for a specific skill's `references/` payload. |
| backstage-only rationale | Useful design history or validation record, but not model-facing prompt payload. |
| historical/archive candidate | Superseded or stale enough that future work should retire/archive rather than harvest directly. |
| leave-as-is | Current prompt/resource file already sits in the right home; no harvest action now. |

## Source ledger

| Source | Disposition labels | Candidate future reference | Reader / blocker | D98-sensitive notes | Next action |
| - | - | - | - | - | - |
| `/private/tmp/igs_recovered.md` (`INTENT_GRAPH_SEMANTICS`) | authored-runtime-reference input; backstage-only rationale; historical/archive candidate | `graph-authoring-heuristics.md`; `checkability-ladder.md`; may motivate generated edge-category/detail-form table scope but is not their generated-reference input | Reader: capture/commit/generate methods needing graph vocabulary and graph-authoring judgment. Blocker: reconcile every subtype/checkability claim against live `src/graph/schema/{kinds,nodes}.ts`, `src/graph/policy/category-policy.ts`, D87-L, D88-L, D94-L before accepting it. | Contains retired subtype proposals and old edge/ontology language; do not revive stale modality/subtype claims or create runtime `strategy` / `lens` / `method` session state. | Derive generated tables only from current typed sources; separately review promotion rules, checkability ladder, and subtype material as authored judgment rows. |
| `docs/design/ELICITATION_QUESTIONS.md` | authored-runtime-reference input | `elicitation-question-hints.md` | Reader: future elicitor question/gap guidance. Blocker: refresh against post-FE-1052 kind names, `story` / `unknown` / `entity` / `sketch`, and four-band D94-L model. | Uses older band framing and mentions strategy/lens as prompt-space terms; keep as prompt-resource vocabulary only, not runtime state. | Treat the durable thesis as: node kind is closed ontology; questions are open/projectable hints inside a kind. Rewrite examples before model-facing use. |
| `docs/design/ONTOLOGY_REVIEW_PROTOCOL.md` | backstage-only rationale; authored-runtime-reference input | possible `graph-authoring-heuristics.md` citations; may motivate generated edge-category/detail-form table scope but typed code remains the generated-reference input | Reader: data-model maintainers and future generated-reference authors. Blocker: live code/SPEC are authoritative; §0/§2–3/§9 are historical and `thesis → claim` did not land. | Mentions methods as validation lenses; preserve only as prompt/resource vocabulary where useful, never as user-changeable runtime axes. | Use as design-validation record for D87-L/D88-L, not as prompt payload. Pull only claims that still match current SPEC/code. |
| `docs/design/ELICITATION_LENSES.md` | authored-runtime-reference input; skill-local-reference input; historical/archive candidate | `proposal-meta-rubric.md`; `projection-guidance.md` | Reader: `generate-proposal` and future `project` capability. Blocker: D98-L retired `strategy` / `lens` / `method` as runtime state; A33-L still design-gates `project`. | Highly D98-sensitive: old lens catalogue must not reintroduce runtime lens/strategy/method axes. Fan-out/fan-in and D31 meta-rubric may survive as prompt conduct. | Harvest fan-out/fan-in, grounding-density, and meta-rubric ideas only into the relevant method/reference home after translating away runtime-axis assumptions. |
| `docs/design/BEHAVIORAL_KERNELS.md` | authored-runtime-reference input; historical/archive candidate | `checkability-ladder.md`; possible `elicitation-question-hints.md` | Reader: future elicitation/gap guidance if kernel prompts prove useful. Blocker: no current runtime kernel ontology; must not create a parallel data model or prompt taxonomy without a concrete reader. | Kernel terminology is interviewer machinery at most, not graph state and not runtime session state. | Defer. Mine only specific checkability/question patterns if a later scope names a reader. |
| `src/agents/skills/methods/capture/SKILL.md` | leave-as-is; authored-runtime-reference input; partially materialized | `graph-authoring-heuristics.md` materialized; `checkability-ladder.md` deferred | Reader: capture now cites the shared authoring reference for declarative graph claims, low-confidence routing, contradiction routing, relation-bearing confidence, and role-named mutation grammar. FE-861 sweep sequencing, gap conduct, and commitment-gradient table remain local. | Method is a prompt-resource id, not runtime state. No D98 issue while it stays code-owned prompt-resource conduct. | Materialized shared graph-authoring guidance; defer checkability-ladder extraction until a second concrete reader needs it. |
| `src/agents/skills/methods/commit-graph/SKILL.md` | leave-as-is; authored-runtime-reference input; materialized | `graph-authoring-heuristics.md` | Reader: graph-write methods needing declarative-node, promotion, settled-commitment, confident-endpoint, and role-named mutation discipline. | Method remains prompt-resource conduct; do not make it a user-changeable runtime mode. | Materialized shared authoring reference and cite from this method; remaining direct-commit sequencing stays local. |
| `src/agents/skills/methods/generate-proposal/SKILL.md` | leave-as-is; skill-local-reference input; authored-runtime-reference input | `proposal-meta-rubric.md`; `projection-guidance.md` | Reader: current generate method and future project design. Blocker: proposal meta-rubric might belong skill-local unless `project` becomes a second reader. | Names intent/design/oracle lenses/planes as prompt conduct; keep out of runtime state and schema fields. | Leave body unchanged now. Revisit after `elicitor-project` design chooses whether projection folds into generate or needs a distinct surface. |
| `src/agents/skills/methods/generate-proposal/references/intent.md` | leave-as-is; skill-local-reference input | `proposal-meta-rubric.md` only if shared beyond generate | Reader: generate intent-plane fan-out. Blocker: no second reader yet. | Plane-specific prompt payload is okay; do not turn `pick` into a schema/runtime field. | Leave in skill-local home. |
| `src/agents/skills/methods/generate-proposal/references/design.md` | leave-as-is; skill-local-reference input | `proposal-meta-rubric.md`; possible `projection-guidance.md` | Reader: generate design-plane fan-out and possible future project design. Blocker: A33-L design verdict. | `synthesize` is method conduct, not schema or runtime axis. | Leave in skill-local home; use as input to `project` design only if that frontier needs it. |
| `src/agents/skills/methods/generate-proposal/references/oracle.md` | leave-as-is; skill-local-reference input | `proposal-meta-rubric.md`; `checkability-ladder.md` | Reader: generate oracle-plane fan-out; possible future oracle/checkability guidance. Blocker: avoid mixing verification-strategy guidance with graph ontology unless a concrete citing need appears. | `compose` is method conduct, not schema or runtime axis. | Leave in skill-local home; selectively mine oracle-family/checkability phrasing if a later shared reference has multiple readers. |

## Candidate reference queue

```pseudo
tree context-reference-candidates:
  graph-authoring-heuristics.md:
    home: src/agents/contexts/references/
    status: materialized for capture + commit-graph shared authoring rules
    readers:
      - capture/SKILL.md
      - commit-graph/SKILL.md
      - future project/generate graph-draft guidance
    included:
      - declarative graph claims
      - promotion before context
      - settled commitment paths
      - low-confidence and contradiction routing
      - relation-bearing endpoint confidence
      - role-named mutate_graph grammar
    deferred:
      - checkability ladder
      - constraint/invariant subtype enums
      - generated edge-category/detail-form tables
    d98_guard: method vocabulary allowed only as prompt conduct

  checkability-ladder.md:
    home: src/agents/contexts/references/ or skill-local oracle reference, depending on readers
    readers:
      - oracle generate/project guidance
      - future elicitation question/gap guidance, if checkability becomes cross-method
    likely inputs:
      - recovered progressive checkability ladder
      - BEHAVIORAL_KERNELS artifact shapes
      - oracle reference's oracle-family / blind-spot guidance
    blockers:
      - decide whether the 8-rung ladder and strength field are ruled in or out by data-model-legibility acceptance
      - keep criterion/check/vv_obligation vocabulary aligned with live schema
    d98_guard: no new runtime lens/kernel state

  elicitation-question-hints.md:
    home: src/agents/contexts/references/ only if multiple elicitor methods cite it
    readers:
      - capture / elicit-by-question / review-for-gaps candidates, pending scope
    likely inputs:
      - refreshed ELICITATION_QUESTIONS thesis and examples
      - selected BEHAVIORAL_KERNELS question patterns, if still useful
    blockers:
      - refresh stale kind names and four-band model
      - prevent catalog examples from becoming stored enums or hidden domain facts
    d98_guard: examples are prompt hints, not strategy/lens/method runtime state

  proposal-meta-rubric.md:
    home: skill-local generate-proposal reference unless project creates a second reader
    readers:
      - generate-proposal now
      - possible project capability later
    likely inputs:
      - ELICITATION_LENSES fan-out/fan-in and D31 meta-rubric material
      - generate-proposal SKILL shared candidate constraints
    blockers:
      - wait for elicitor-project design verdict before making shared runtime reference
    d98_guard: pick/synthesize/compose remain conduct, not schema/runtime fields

  projection-guidance.md:
    home: unresolved; likely after elicitor-project design
    readers:
      - future project capability
      - maybe generate-proposal design/oracle references
    likely inputs:
      - ELICITATION_LENSES project-requirements-from-upstream material
      - ONTOLOGY_REVIEW_PROTOCOL method-as-detail/routing rationale
    blockers:
      - A33-L project design verdict
      - decide whether projection is generate-with-upstream-input or distinct surface
    d98_guard: no revival of project strategy/lens/method as user-changeable state
```

## Runtime/backstage guardrails

- This ledger is a pointer and disposition table, not a canonical ontology or prompt body.
- Generated tables must come from typed graph sources, not recovered prose or design docs.
- Authored references need concrete readers; otherwise leave material in the current skill-local or backstage home.
- D98-sensitive vocabulary is allowed only when it describes prompt-resource organization or internal conduct. It must not become session-agent state beyond SPEC/CODE operational mode.
- Rows are harvested one at a time. Do not bulk-import old design docs into runtime references.
