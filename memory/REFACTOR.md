## Problem Statement

The live skill surface around `generate` is split in the wrong place, and the broader live/suspended skill boundary has drifted.

- `propose` currently preserves much of the theory layer but not the operational spine the runtime exchange tools actually need.
- The best procedural material for proposal generation still lives under suspended methods, so the live home does not teach the actual `present_candidates` and `present_review_set` choreography.
- `_suspended/` still contains a mix of genuinely retired material, duplicated material, and high-signal conduct that should either be lifted into a live home or explicitly left suspended with a reason.
- The ownership split between `propose`, `map`, `analyze`, `review`, and `ingest` is only partially reflected in the live docs: some guidance still speaks as if proposal generation owns graph-shaped payloads, while some of the strongest live conduct remains quarantined in `_suspended/`.
- The result is a skill family that has the right nouns but the wrong distribution of procedural weight: the live layer is harder to execute from, and the suspended layer still carries behavior we want to keep.

```pseudo
tree current
  skills/
    analyze      thin orientation surface
    ingest       active acquisition + routing conduct
    map          active graph-expression / persistence conduct
    review       active evaluation surface, still light on plane heuristics
    propose      active theory-heavy generate surface
      present-review-set ref
    _suspended/
      methods/
        generate-proposal      real fan-out / fan-in spine
          intent ref           grounding + pick
          design ref           design-it-twice + synthesize
          oracle ref           oracle ensembles + compose
        read-context           best edge-local reading discipline
        review-for-gaps        best plane-specific critique prompts
        explore/read/ingest    acquisition conduct to map home-by-home
        others                 need explicit keep / lift / leave-suspended judgment
```

## Solution

The live skill family should own the current generate/evaluate/orient behavior directly, with `_suspended/` reduced to truly retired or not-yet-re-adopted material after an explicit one-by-one audit.

- `propose` becomes procedure-first: one shared generate spine, explicit exchange choreography, and a clean boundary that it creates source material while `map` decides graph expression and persistence.
- Branch-specific generate payload moves into live propose references: intent, design, and oracle.
- The current theory in `propose` is retained only where it still teaches current behavior; the rest is pushed into the branch references.
- `analyze` absorbs the best surviving edge-local read discipline from the suspended context-reading method.
- `review` absorbs the best plane-specific gap/weakness heuristics from the suspended review method.
- Acquisition and capture material that already has a good live owner stays out of `propose` and is either confirmed in or lifted into `ingest` / `map`.
- Every suspended method/reference we touch gets an explicit disposition: lift into a live home, leave suspended, or retire as superseded.

```pseudo
tree desired
  skills/
    analyze
      owns orientation + edge-local neighborhood reading discipline
    ingest
      owns paste / referenced-doc / brownfield acquisition conduct
    map
      owns graph vocabulary, routing, persistence, and review-set acceptance boundary
    review
      owns critique heuristics over accepted or proposed material
    propose
      owns shared fan-out / compare / fan-in procedure
      references/
        intent      grounding-density + single-pick framing proposals
        design      radically different shapes + synthesize into exact draft
        oracle      ensemble comparison + compose into exact draft
        present-review-set  drafting / coherence checks only
    _suspended/
      retains only material explicitly left suspended or intentionally retired
```

## Commits

1. Rewrite the live generate home so its opening, description, and procedure teach the real fan-out / compare / fan-in exchange spine and the current ownership split with graph persistence.
2. Audit the suspended generate references and lift the intent, design, and oracle proposal references into the live generate home, rewriting them against current runtime contracts and the design/oracle discipline already established elsewhere in the repo.
3. Trim or rewrite the current live generate theory so only behavior-driving material remains inline, with branch-specific payload moved behind the new live references.
4. Reconcile the live review-set drafting reference so it is clearly a drafting/coherence aid and points exact payload authorship at the graph-owned review-set boundary.
5. Audit suspended context-reading material and lift the best surviving edge-local reading conduct into the live orientation home, removing any now-redundant overlap.
6. Audit suspended review material and lift the best surviving plane-specific review heuristics into the live evaluation home, removing any now-redundant overlap.
7. Audit the remaining suspended acquisition/capture/exchange material one by one and either confirm its live owner, backport missing high-signal conduct into that owner, or explicitly leave it suspended as superseded.
8. Reconcile the top-level skill topology so live homes, their responsibilities, and the suspended remainder all describe the post-salvage state truthfully.

## Decisions

- Modules built or modified
  - Live skill homes for orientation, generation, and evaluation.
  - Live generate references for intent, design, oracle, and review-set drafting.
  - Suspended method/reference set as an audited source set whose members each receive an explicit disposition.
- Interface changes
  - No product API change is assumed in this refactor.
  - The refactor is prompt-resource and authored-guidance restructuring only unless a later slice explicitly widens scope.
- Architectural decisions
  - `generate` stays one deep plane-parameterized capability per D95-L / D96-L.
  - `propose` creates candidate source material; `map` owns graph expression, routing, and persistence.
  - `present_candidates` is fan-out recognition only; exact graph commitment still requires the review-set path.
  - Suspended strategy/lens/method runtime axes stay suspended under D98-L; only current behavior is lifted back.
  - Backporting is home-by-home: suspended material is judged by the quality and current ownership of the live home it would strengthen, not by proximity to `propose`.
- Schema changes, API contracts
  - None planned in this refactor; live skill prose must conform to current structured-exchange and graph-owned payload contracts rather than inventing new fields.
- Topology files touched
  - The top-level skills topology file will be updated as ownership is clarified.

## Suspended Audit Table

| Suspended item | Current signal | Disposition | Target live home | Builder action |
| --- | --- | --- | --- | --- |
| `methods/generate-proposal/SKILL.md` | Highest-signal shared generate spine; teaches the actual fan-out / compare / fan-in exchange choreography missing from the live surface. | Lift and synthesize | `propose` | Rewrite the live `propose` opening/procedure around this spine, then retire or thin the suspended original once the live home fully owns it. |
| `methods/generate-proposal/references/intent.md` | Best current intent-plane proposal guidance: grounding bundle, density scaling, single-pick rule, candidate-never-commits invariant. | Lift and synthesize | `propose/references/intent.md` | Create a live intent reference, preserve the good branch conduct, and trim any stale lens-era framing that is no longer needed. |
| `methods/generate-proposal/references/design.md` | Best current design-plane proposal guidance; already aligned with `ln-design` ideas like radically different shapes and synthesis after recognition. | Lift and synthesize | `propose/references/design.md` | Create a live design reference, update wording to current exchange and graph-boundary contracts, and keep the `ln-design` comparison discipline. |
| `methods/generate-proposal/references/oracle.md` | Best current oracle-plane proposal guidance; already aligned with `ln-oracles` concepts such as ensembles, O/R/C, loop tiers, and blind spots. | Lift and synthesize | `propose/references/oracle.md` | Create a live oracle reference, keep the ensemble/composition logic, and adapt wording to current review-set and graph-boundary contracts. |
| `methods/read-context/SKILL.md` | Highest-signal orientation conduct outside the live set: edge-local neighborhood preference, minimal reads, and context-vs-truth discipline. | Backport elsewhere | `analyze` | Fold the edge-local reading discipline into the live orientation home, then leave only truly retired context-reading residue suspended. |
| `methods/review-for-gaps/SKILL.md` | Highest-signal evaluation heuristics outside the live set: intent/design/oracle-specific weak-spot checks and routing after critique. | Backport elsewhere | `review` | Fold the plane-specific critique heuristics into the live review home and sharpen its route-to-next-move guidance. |
| `methods/elicit-by-question/SKILL.md` | Good quality, but largely already represented in the live `elicit` home. | Confirm live owner; no major lift | `elicit` | Compare against live `elicit`; only backport anything that is materially clearer than what the live skill already says. |
| `methods/explore-and-characterize/SKILL.md` | Good bounded brownfield acquisition conduct, but this is acquisition/digest work rather than proposal or mapping work. | Confirm live owner; selective backport only if missing | `ingest` | Compare against live `ingest`; backport only any missing brownfield-specific guardrails or digest shape that the live home still lacks. |
| `methods/read-referenced-documents/SKILL.md` | Good bounded external/local reference-reading conduct with digest-first discipline. | Confirm live owner; selective backport only if missing | `ingest` | Compare against live `ingest`; backport only any missing source/digest rules, otherwise leave suspended as superseded. |
| `methods/ingest-paste/SKILL.md` | Good thin paste-ingestion conduct, but the live `ingest` home already owns this lane conceptually. | Confirm live owner; no major lift unless gap found | `ingest` | Compare against live `ingest`; only lift missing paste-specific phrasing if the live home is noticeably weaker. |
| `methods/capture/SKILL.md` | Historically important, but its core concerns now belong across live `ingest` + `map` rather than one live `capture` home. | Decompose and confirm live owners | `ingest` and `map` | Do not recreate a live `capture` home; instead verify that any still-useful conduct is already covered by the current ingest and map split, and lift only missing high-signal fragments. |
| `methods/commit-graph/SKILL.md` | Historically important graph-write sequencing guidance, but direct graph commitment now belongs under current graph-expression/persistence ownership. | Confirm live owner; selective backport only if missing | `map` | Compare against live `map` and current graph-boundary docs; only lift missing write-boundary cautions or sequencing rules. |
| `methods/run-structured-exchange/SKILL.md` | Good generic exchange semantics, but most of this is already owned by active exchange schema/tool docs rather than by one live skill. | Backport elsewhere, minimally | `propose`, `elicit`, and exchange docs | Do not create a new live generic exchange skill; only add local reminders where a live home needs them and rely on the active exchange docs for the canonical contract. |
| `methods/generate-proposal/probes.md` | Useful future eval seed, but probe wiring is intentionally deferred until the live system settles. | Leave suspended for now | none yet | Do not build into the current refactor sequence; keep as future oracle material once the live skill family stabilizes. |

### Audit Rules

- Every row must end in one of three outcomes: lifted into a named live home, explicitly left suspended, or retired as superseded.
- "Confirm live owner" means the builder must compare the suspended item against the current live home and make an explicit keep / lift / leave-suspended judgment rather than assuming the work is already done.
- No suspended item should be lifted mechanically. The live home should absorb only high-signal conduct that still matches current D95-L / D96-L / D97-L / D98-L ownership and current exchange or graph boundaries.
- When a suspended item is left suspended, the reason should be recorded in the commit or handoff note so the residue is intentional rather than forgotten.

## Testing Decisions

- What makes a good test here
  - The first proof is contract alignment: the rewritten live skills must agree with current exchange-tool and graph-boundary contracts.
  - If we later add characterization or probe coverage, test public behavior of the proposal flow: candidate presentation, review-set gating, and non-commit behavior before approval.
- Which modules get tested
  - Existing exchange schema/tool tests remain the current safety net.
  - This refactor should avoid requiring new product tests unless a prose fix exposes a real contract mismatch.
- Prior art in the codebase
  - Existing structured-exchange schema/tool tests already pin the current `present_candidates` and `present_review_set` shapes.
  - Suspended generate-proposal references provide the best current behavioral source material for the live rewrite.
  - The suspended methods are also the audit set for orientation, review, acquisition, and exchange conduct; each must be evaluated against the current live family, not only the generate home.

## Out of Scope

- Adding new exchange-tool schema fields or changing structured-exchange API contracts.
- Wiring probe/eval coverage for the skill family.
- Designing or implementing the distinct `project` capability beyond keeping the generate home from swallowing it prematurely.
- Re-adopting the broader strategy/lens/method runtime-axis model.
- Unrelated cleanup of suspended prompt resources that do not affect current live homes or current skill-family ownership clarity.

## Addendum — Strategy / Lens Audit

### Decision: no separate `orient` skill

The current live `analyze` home is the right place for orientation conduct.

- `analyze` already owns both compact startup orientation and targeted follow-up reads.
- Splitting `orient` from `analyze` would create two near-synonyms with weak routing boundaries.
- If the live home later needs a lighter startup slice, add a small orientation reference under `analyze` rather than a new routable skill.

Builder rule: do not create a new `orient` skill in this refactor sequence unless a later design pass proves a distinct repeatedly-used startup/origination behavior with a separate reader and completion boundary.

### Immediate stale prompt fix

The foreground elicitor prompt still uses retired exchange wording.

- `src/agents/prompts/elicitor.md` says the agent should collect answers through matching `request_*` tools.
- The active exchange contract is `present_*` followed by `request_response`.

Builder action: update the elicitor prompt so it teaches the current `present_* -> request_response` pattern and no longer advertises retired request-specific tool names.

### Suspended Strategy / Lens Audit Table

| Suspended item | Current signal | Disposition | Target live home | Builder action |
| --- | --- | --- | --- | --- |
| `strategies/freestyle/SKILL.md` | Captures a useful baseline interaction posture — ordinary user-driven turns remain valid and structured exchanges are optional when they help — but still speaks in suspended axis terms like `AUTO`, `goal`, and `lens`. | Distill, then leave suspended or retire | `elicitor` prompt | Salvage only the baseline posture that still belongs in the foreground system prompt; do not revive `freestyle` as a live skill. Strip or retire the suspended file once its surviving guidance has a current home. |
| `strategies/step-wise-decision-tree/SKILL.md` | Still contains useful one-question-at-a-time elicitation discipline, but also carries stale tool names such as `present_options`, `request_answer`, `request_choice`, and `request_choices`. | Backport elsewhere | `elicit` | Fold the good questioning/branching conduct into the live `elicit` home using current exchange names and contracts; do not restore this as a separate live strategy resource. |
| `strategies/step-wise-disambiguate/SKILL.md` | Still contains useful contrastive-disambiguation conduct for collapsing ambiguity with examples, but also carries stale exchange names and old strategy-axis framing. | Backport elsewhere | `elicit` | Lift the contrastive-example tactic into `elicit` or an `elicit` reference, update to current `present_question` / `request_response` language, and retire or stub the suspended original. |
| `strategies/TOPOLOGY.md` | Stale as current-state documentation: it still describes strategies as prompt resources read when active and speaks in suspended runtime-axis terms. | Rewrite as disposition stub or retire | `_suspended/strategies` | Do not preserve this as-if-live topology. Replace it with a brief explanation that these files are suspended historical tactic sources pending selective salvage into live homes. |
| `lenses/intent/SKILL.md` | Good intent-plane interpretation and next-question heuristics, but its role as a loadable "lens" conflicts with the current move-owned live structure. | Selective backport elsewhere | `elicit` and `review` | Salvage only the still-missing question-selection or interpretation heuristics into current live homes; do not restore `intent` as a peer live skill. |
| `lenses/design/SKILL.md` | Good design-plane interpretation and ownership/boundary heuristics, but those concerns now belong to live `propose`, `review`, and eventually `elicit` by move rather than by lens. | Selective backport elsewhere | `elicit` and `review` | Lift only any design-specific questioning or critique heuristics that are still missing from live homes; leave proposal-specific content with live `propose` references. |
| `lenses/oracle/SKILL.md` | Good oracle-plane interpretation and unwitnessed-claim heuristics, but those concerns now belong to live `propose`, `review`, and eventually `elicit` by move rather than by lens. | Selective backport elsewhere | `elicit` and `review` | Lift only any oracle-specific questioning or critique heuristics that are still missing from live homes; leave proposal-specific content with live `propose` references. |
| `lenses/TOPOLOGY.md` | Stale as current-state documentation: it still presents intent/design/oracle as topical prompt-resource membership rather than as heuristics already decomposed across live move-owned homes. | Rewrite as disposition stub or retire | `_suspended/lenses` | Replace with a short suspended-status note explaining that useful plane heuristics were or will be distributed into live `propose`, `review`, and `elicit` homes instead of reactivating the lens axis. |

### Addendum Audit Rules

- `strategies` and `lenses` are not to be reactivated as user-changeable or model-routable runtime axes under D98-L.
- Salvage by behavior, not by folder: baseline interaction posture belongs in the elicitor prompt; questioning tactics belong in `elicit`; proposal branch payload belongs in `propose`; critique heuristics belong in `review`.
- When a suspended strategy or lens is kept, it must be clearly marked as suspended historical source material rather than reading like an active prompt resource.
- When a suspended strategy or lens is retired, the commit or handoff note should name which surviving guidance was lifted and where it now lives.

### Addendum Commit Sequence

9. [x] Update the foreground elicitor prompt to teach the active `present_* -> request_response` exchange contract.
10. [x] Audit suspended `strategies` one by one, lifting only the surviving baseline posture and elicitation tactics into the elicitor prompt or `elicit`, then rewriting suspended docs so they no longer read as active prompt resources.
11. [x] Audit suspended `lenses` one by one, lifting only still-missing intent/design/oracle heuristics into `elicit` and `review`, then rewriting suspended docs so they no longer read as active prompt resources.
12. [x] Reconcile the top-level refactor notes or handoff with the final disposition of each suspended strategy/lens file touched in this addendum.

### Addendum Completion Record

- `strategies/freestyle` survives only as a suspended historical stub; its ordinary-turn / optional-structured-exchange posture now lives in `src/agents/prompts/elicitor.md`.
- `strategies/step-wise-decision-tree` and `strategies/step-wise-disambiguate` survive only as suspended historical stubs; their one-question branching and contrastive-disambiguation tactics now live in `src/agents/skills/elicit/SKILL.md` using `present_question -> request_response` language.
- `lenses/intent`, `lenses/design`, and `lenses/oracle` survive only as suspended historical stubs; their questioning heuristics now live in `elicit`, critique heuristics in `review`, and proposal payload remains in `propose/references/{intent,design,oracle}.md`.
- `src/agents/skills/TOPOLOGY.md`, `src/agents/skills/_suspended/TOPOLOGY.md`, `_suspended/strategies/TOPOLOGY.md`, and `_suspended/lenses/TOPOLOGY.md` now describe strategies/lenses as suspended source material rather than active prompt-resource axes.
