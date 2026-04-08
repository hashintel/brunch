# Self review — flow talkthrough findings

_Date:_ 2026-04-07
_Status:_ living session note; update as the talkthrough continues

## Purpose

Capture findings surfaced while pressure-testing the current Brunch runtime flow described in `memory/SPEC.md` and `memory/PLAN.md` against the implemented system and real project data.

## Current findings

### 1. Phase semantics and turn schema are currently misaligned

**Observed**
- The implemented turn/question contract is globally shaped around `ask_question` with:
  - `question`
  - `why`
  - `impact`
  - `options[]`
  - one recommended option
- This schema is enforced for every current phase by `structuredQuestionSchema` in `src/shared/chat.ts` and by phase prompts in `src/server/interview.ts`.
- The phase enum is `scope | design | requirements | criteria`, but the interaction primitive is currently the same for all phases.

**Why this matters**
- The scope/kickoff phase appears conceptually different from the design/decision phase.
- Scope is primarily about framing: concept, goal, business context, domain, user need, and constraints.
- That makes the current question-with-options decision-oriented turn shape feel like an interview primitive being applied too broadly.

**Implication**
- We likely need to separate:
  - a generic `turn` record in persistence
  - from phase-specific interaction shapes and extraction policies

### 2. Scope phase appears misfit for decision/assumption extraction

**Observed**
- The observer prompt in `src/server/observer.ts` is phase-agnostic and always extracts only:
  - `decisions[]`
  - `assumptions[]`
- It does not branch behavior by phase.
- The context builder also presents the current turn without phase-specific extraction guidance.

**Inference**
- In scope, many user answers are better modeled as framing facts / context / problem statements rather than decisions or assumptions.
- Because the observer only knows how to emit decisions and assumptions, it is incentivized to reinterpret framing facts as assumptions.

**Implication**
- Scope likely needs either:
  1. a different observer mode, or
  2. a different entity family for kickoff/framing outputs
  3. or both

### 3. Project 18 shows assumption overproduction and weak decision/assumption differentiation

**Observed from `brunch.db` project 18 (`post-react-refinements`)**
- Turns captured: 6, all in `scope`
- Extracted entities:
  - decisions: 1
  - assumptions: 10
- Single decision:
  - `Build a minimal storybook-like component testing layer`
- Many assumptions are closer to paraphrased facts or inferred framing summaries than falsifiable assumptions, e.g.:
  - `The primary users are developers focused on isolated component development and rapid iteration`
  - `The team is using modern React tooling (Vite, Next.js, or similar) in their development workflow`
  - `The team experiences friction in their component development process when testing different prop/state combinations`

**Interpretation**
- The extractor is currently collapsing at least three distinct kinds of knowledge into `assumption`:
  - direct user-provided facts
  - contextual summaries
  - actual falsifiable assumptions
- That makes the ontology blurry very early in the interview.

### 4. Scope resolution is underdefined

**Observed**
- `SPEC.md` defines phase resolution generically as `turn.is_resolution = true` when the model judges shared understanding has been reached.
- `PLAN.md` slice 7 adds a future `resolve_phase` tool and summary/confirmation UI.
- There is no explicit phase-specific completion contract yet for scope.

**Inference**
- For scope, “shared understanding reached” is too vague unless we define the minimum framing bundle.

**Candidate close condition for scope**
A scope phase could be considered ready to close only once the system has enough confidence in a framing bundle such as:
- concept / artifact being specified
- user / actor
- user need / pain
- business or workflow context
- core success shape or intended outcome
- major constraints / non-goals (if already known)

### 5. The current model probably needs a stronger distinction between framing and commitment

**Observed + inferred**
- Design phases are where `decision` and `assumption` seem most natural.
- Scope is where `framing context` seems natural.
- Current runtime and schema flatten both into one extraction model too early.

**Implication**
- The product may want an explicit two-step epistemic progression:
  1. capture framing/context
  2. drill into decisions/assumptions

### 6. The entity typology emerging in practice is richer than `decision` + `assumption`

**Observed + inferred**
- The current schema has durable tables for `decision`, `assumption`, `requirement`, and `criterion`, but the observer currently extracts only decisions and assumptions.
- `SPEC.md` already says requirements "accumulate during the decision drill-down and are reviewed in a dedicated phase," which implicitly allows requirements to exist before the requirements-review phase.
- Session evidence and user feedback suggest the interview also surfaces additional knowledge kinds that are not well represented today, including:
  - user stories / problem statements
  - fixed preconditions / context facts
  - constraints
  - non-goals
  - requirements emerging before the explicit requirements-review mode

**Interpretation**
- The product ontology is currently too narrow for the information the interview naturally produces.
- `assumption` is absorbing multiple incompatible knowledge types because there are not enough semantic buckets.

### 7. Phase boundaries may be correct for workflow mode while still being too rigid for entity capture

**Observed + inferred**
- The application needs phases because each phase changes the interviewing mode, UI expectations, and closure logic.
- But the docs already partially weaken strict capture boundaries by stating that requirements can accumulate before the dedicated review phase.
- This suggests a more general rule: phases should govern how the system behaves, not strictly when an entity is allowed to first appear.

**Implication**
- A better model may be:
  - **capture-anytime** for entities that naturally surface during conversation
  - **review-in-phase** for the phase that is responsible for confirming, editing, or closing that entity family
- Under this model:
  - scope can surface early requirements, constraints, and non-goals
  - design can surface additional framing facts and requirements
  - requirements phase becomes the place where requirements are audited and confirmed, not necessarily first created

### 8. `turn` should likely remain the provenance spine, but not the only semantic container

**Observed**
- The current implementation already treats the turn tree as the core history structure:
  - `turn.parent_turn_id` forms the tree
  - `project.active_turn_id` is the HEAD pointer
  - entities are linked back to turns through provenance join tables (`turn_decision`, `turn_assumption`)
  - phase provenance currently lives on each turn (`turn.phase`)
- `SPEC.md` explicitly defines the turn tree as version history.

**Inference**
- This is still the right center of gravity.
- What should change is not the centrality of `turn`, but how much semantic weight is forced directly into the turn row and its single global interaction schema.

**Implication**
- A stronger model is:
  - `turn` remains the chronological / branching spine of the interview
  - phase outcomes, summaries, resolutions, and extracted entities attach to turns through explicit linked records or typed payloads
  - phase-specific interaction contracts can vary without breaking the turn tree as the version-history backbone

### 9. Revisitation semantics can likely be generalized around turn-local invalidation frontiers

**Observed + inferred**
- The current model already uses turn-tree branching plus downstream invalidation for revisit behavior.
- The same logic can plausibly be extended beyond design decisions if phase outcomes and review states are attached to turns clearly enough.

**Candidate revisit semantics**
- revisiting / editing **framing** in scope should unresolve scope and force re-walk of downstream design, requirements, and criteria readiness
- revisiting **design commitments** should branch from the relevant interview turn and force re-resolution of design plus downstream review phases
- editing **requirements** should invalidate criteria generation/review downstream of the edited requirement set
- editing **criteria** should invalidate only criteria review completeness unless the edit exposes a requirements mismatch

**Design pressure this creates**
- We probably need explicit resolution records / predicates per phase rather than treating phase completion as only a boolean on the latest turn.
- We may also need to distinguish:
  - conversational turns
  - review/edit actions performed outside the main transcript
- Otherwise sidebar edits risk becoming second-class mutations that sit outside the main provenance story.

### 10. Later phases should likely synthesize from the full knowledge layer rather than act as first-capture phases

**Observed + inferred**
- The existing spec already allows requirements to accumulate before the explicit requirements-review phase.
- User feedback suggests the later phases are better understood as structured review/synthesis passes over the accumulated knowledge layer.

**Candidate behavior spec**
- **Requirements-review mode**:
  - gather tentative requirements already surfaced
  - map/extrapolate from the broader knowledge layer (framing, constraints, decisions, assumptions, non-goals, problem statements)
  - propose a fuller requirement set
  - ask for approval, edits, merges, deletions, and missing items
- **Criteria-review mode**:
  - gather any already-mentioned proofs / benchmarks / KPIs / acceptance signals
  - map/extrapolate from both the knowledge layer and confirmed requirements
  - propose a complete criteria set
  - ask for approval and edits until criteria are review-complete

**Implication**
- These later phases look more like normalization, completeness checking, and confirmation passes than like virgin capture phases.

### 11. The current question/option UI shape is too narrow for real interview behavior

**Observed in code**
- `structuredQuestionSchema` requires `options` and assumes one recommended option.
- `data-option-selection` carries a single `selectedOptionId` plus optional `rationale`.
- `selectOption()` in `src/server/db.ts` clears previous selections and marks exactly one option as selected.
- `TurnCard` in `src/client/routes/InterviewWorkspace.tsx` disables further option interaction once one choice has been made.

**Observed from user testing + inferred implications**
- Some questions are multi-select in reality; more than one proposed option may apply.
- Users need stronger affordance to provide explanation / grounding along with selections.
- Users need a first-class way to reject all provided options and answer in free text.

**Interpretation**
- The current turn UI assumes a categorical question with a single categorical answer.
- That assumption is too narrow for framing and likely too narrow for parts of design and review as well.

**Implication**
- The turn interaction model likely needs to expand beyond single-select options into some combination of:
  - multi-select
  - explicit rationale capture
  - none-of-the-above / custom answer
  - possibly phase-specific response widgets

### 12. The observer is intentionally a single extraction call with a different context projection than the interviewer

**Observed**
- The interviewer is created via `ToolLoopAgent` in `src/server/interview.ts` and receives active-path conversational context via `buildInterviewerContext(...)`.
- The observer is not a looped agent. It is a single `generateObject(...)` call in `src/server/observer.ts`.
- The observer currently receives:
  - the current turn
  - existing extracted entities for the project
  - `activePathSummary`, which is currently passed as an empty string from `runObserver(...)`
- `SPEC.md` explicitly documents this as a deliberate projection difference: interviewer gets conversational continuity, observer gets extraction context for incremental delta capture.

**Why this design exists**
- The stated intent is to keep extraction incremental: “given what we already know, what did this turn add?”
- That makes the observer cheaper, simpler, and easier to validate than a second full conversational agent loop.

**Current limitation**
- Although the design allows an active-path summary, the current implementation is not yet actually providing one (`activePathSummary: ''`).
- So today the observer does **not** receive the same history richness as the interviewer.

**Implication**
- The split is principled, but the current observer context is also thinner than the design likely wants long-term.
- As the ontology broadens, the observer will probably need a richer, phase-aware context projection even if it remains a single structured extraction call.

## Evidence reviewed

- `memory/SPEC.md`
- `memory/PLAN.md`
- `src/server/interview.ts`
- `src/server/observer.ts`
- `src/server/context.ts`
- `src/shared/chat.ts`
- `brunch.db` project 18 and associated `turn`, `decision`, `assumption`, and join-table records

## Proposed minimal expanded ontology

This is the smallest broadened ontology that currently seems able to fit the interview without exploding complexity.

### Durable entity families

1. **framing**
   - Purpose: capture the stable framing bundle that scope/kickoff is trying to establish.
   - Typical examples:
     - project goal
     - user / actor
     - user need / pain
     - business or workflow context
     - domain fact
     - fixed precondition
   - Why it exists: these are not well modeled as either decisions or assumptions.

2. **constraint**
   - Purpose: capture hard limits, exclusions, and boundaries on the solution space.
   - Typical examples:
     - must use React
     - Anthropic-only
     - single-user
     - no collaborative editing
     - no offline mode
   - Why it exists: constraints shape downstream design but are not necessarily decisions and should not be hidden inside framing text.

3. **decision**
   - Purpose: capture actual commitments or chosen forks in the design tree.
   - Typical examples:
     - use SQLite
     - use a turn tree for version history
     - use AI SDK `ToolLoopAgent`
   - Keep: rationale and dependency edges.

4. **assumption**
   - Purpose: capture beliefs that downstream choices rely on and that could prove false.
   - Typical examples:
     - observer latency is hidden under user think-time
     - users arrive with a reasonably defined goal
   - Why it remains: it is still useful, but should shrink back to a stricter semantic meaning.

5. **requirement**
   - Purpose: capture what the system must do.
   - Note: capture-anytime, review-in-phase.

6. **criterion**
   - Purpose: capture how a requirement will be verified or recognized as satisfied.
   - Note: capture-anytime, review-in-phase, but mostly synthesized/confirmed in criteria-review mode.

### Deliberate omissions from the minimal set

The following may still matter, but should probably start life as typed sub-kinds or annotations rather than first-class top-level tables:
- non-goal (could initially be a `constraint` subtype)
- problem statement / user story (could initially be a `framing` subtype)
- benchmark / KPI / proof signal (could initially be a `criterion` subtype)

### Core rule

- `decision` = chosen fork
- `assumption` = belief that could be wrong
- `framing` = contextual truth or intent statement
- `constraint` = boundary on the acceptable solution space
- `requirement` = must-do capability
- `criterion` = verifiable success condition

## Proposed minimal expanded turn-response model

The current single-select option turn is too narrow. The minimal response model should support structured guidance without forcing all answers into a single categorical choice.

### Recommended response shapes

1. **single-select with rationale**
   - use when one best branch really should be chosen
   - keep recommendation support

2. **multi-select with rationale**
   - use when several proposed options may all apply
   - especially useful for constraints, priorities, applicable contexts, requirement bundles

3. **custom answer / none-of-the-above**
   - user can reject all offered options and provide free text
   - should be first-class, not an accidental escape hatch through the global text box

4. **approve / edit / reject review turn**
   - for requirements-review and criteria-review modes
   - better fit than pretending review is the same as exploratory interviewing

### Minimal answer payload capabilities

A turn answer should be able to express at least:
- selected option IDs: zero, one, or many
- free-text rationale / explanation
- custom free-text answer
- approval state for review-style turns

### Recommended principle

Keep the interviewer's habit of proposing structure, options, and recommendations — that is a product strength — but stop assuming that every answer is a single categorical pick.

## Proposed schema shape

### Recommendation: keep the four-layer model explicit in storage

1. **History spine** → turn tree
2. **Workflow mode** → phase/mode on turns plus phase outcomes
3. **Knowledge layer** → generic knowledge items + provenance + edges
4. **Readiness layer** → phase outcomes + item review records

### A. History spine

#### `project`
Keep essentially as-is:
- `id`
- `name`
- `active_turn_id`
- timestamps

#### `turn`
Refactor toward a more generic turn record.

Recommended fields:
- `id`
- `project_id`
- `parent_turn_id`
- `phase` (`scope | design | requirements | criteria`)
- `kind` (`interaction | review | system | edit`)
- `prompt_payload` (JSON)
- `response_payload` (JSON, nullable until answered)
- `user_parts` (UI resume state)
- `assistant_parts` (UI resume state)
- timestamps

**Key recommendation**
- Stop treating `question`, `why`, `impact`, `answer`, and normalized `option` rows as the primary durable schema.
- Those are really interaction payloads, not the stable semantic core of a turn.
- Keep them only as transitional projections if needed during migration.

### B. Prompt / response payloads

Use typed JSON payloads validated by Zod per turn kind.

#### `choice` prompt payload
- `kind: "choice"`
- `selectionMode: "single" | "multi"`
- `question`
- `why`
- `impact`
- `options[]`
- `recommendedOptionIds[]`
- `allowCustomAnswer: boolean`
- `encourageRationale: boolean`

#### `choice` response payload
- `selectedOptionIds[]` (zero / one / many)
- `rationale` (optional text)
- `customAnswer` (optional text)

#### `review` prompt payload
- `kind: "review"`
- `targetKind` (`requirement | criterion | framing | constraint | decision | assumption`)
- `items[]`
- `reviewGoal` (`approve | edit | prune | fill-gaps`)
- `summary` (optional)

#### `review` response payload
- `approvals[]`
- `edits[]`
- `rejections[]`
- `additions[]`
- `rationale` (optional)

**Why JSON here**
- Turn interactions are mode-shaped and likely to evolve.
- Trying to normalize every interaction form into columns and child tables will overfit the current UI and make the schema brittle.

### C. Knowledge layer

#### `knowledge_item`
Replace multiple narrow entity tables with one generic durable table.

Recommended fields:
- `id`
- `project_id`
- `kind` (`framing | constraint | decision | assumption | requirement | criterion`)
- `subtype` (nullable text)
- `content`
- `rationale` (nullable)
- timestamps

**Why one table**
- The ontology is broadening.
- The provenance and dependency mechanics are structurally similar across these kinds.
- A generic table avoids six parallel CRUD paths, join tables, invalidation rules, and observer extraction codepaths.

#### `turn_knowledge_item`
Generic provenance join:
- `turn_id`
- `item_id`
- `relation` (`captured | confirmed | edited | invalidated | reviewed`)

This replaces specialized joins like `turn_decision` / `turn_assumption`.

#### `knowledge_edge`
Generic dependency / derivation graph:
- `from_item_id`
- `to_item_id`
- `relation` (`depends_on | derived_from | constrains | verifies | refines`)

Examples:
- decision `depends_on` assumption
- requirement `derived_from` decision or framing
- constraint `constrains` decision
- criterion `verifies` requirement

### D. Readiness layer

#### `phase_outcome`
Make phase closure explicit instead of encoding it only as `turn.is_resolution`.

Recommended fields:
- `id`
- `project_id`
- `phase`
- `status` (`proposed | confirmed | superseded`)
- `source_turn_id`
- `confirmed_turn_id` (nullable)
- `invalidated_by_turn_id` (nullable)
- `summary`
- timestamps

This gives each phase its own closure artifact tied back to the turn tree.

#### `knowledge_review`
Represent review-in-phase explicitly.

Recommended fields:
- `id`
- `item_id`
- `phase`
- `status` (`pending | approved | edited | rejected | stale`)
- `source_turn_id`
- `superseded_by_turn_id` (nullable)
- timestamps

This replaces special-case `reviewed_at` fields on only some entity tables and supports the broader model where many entity kinds may be captured early but reviewed later.

### E. What to de-emphasize or remove from the current schema

If we move to the recommended shape, the following are either transitional or become obsolete:
- turn scalar columns: `question`, `why`, `impact`, `answer`, `is_resolution`
- `option` as a first-class normalized table for all turns
- narrow entity tables: `decision`, `assumption`, `requirement`, `criterion`
- specialized provenance joins: `turn_decision`, `turn_assumption`
- specialized edge tables like `decision_parent_decision`, `decision_parent_assumption`, `assumption_parent_assumption`
- special-case `reviewed_at` fields only on requirements / criteria

### F. Why this is the right amount of generality

This is intentionally more generic in storage than the current implementation, but not fully abstract or event-sourced everywhere.

It keeps:
- one turn tree as the branching history
- one knowledge table as the semantic layer
- one edge table as the dependency graph
- one review mechanism for readiness

That feels like the smallest schema that matches the architecture we are converging toward.

## Proposed phase / mode behavior spec

This section assumes the schema shape above: `turn` as history spine, `knowledge_item` as the semantic layer, and `phase_outcome` / `knowledge_review` as the readiness layer.

### 1. Scope mode (framing)

**Primary job**
- establish a usable framing bundle for the rest of the interview

**Interviewer behavior**
- ask broad-to-focused framing questions
- prefer clarifying concept, actors, pain, workflow context, success shape, and major boundaries
- use structured options when helpful, but allow custom answers and mixed truths
- encourage rationale whenever the answer reveals priorities or tradeoffs

**Observer behavior**
- preferentially capture:
  - `framing`
  - `constraint`
  - early `requirement` when the user states a must-have directly
- avoid manufacturing `decision` or `assumption` unless the turn truly contains them

**Primary artifacts expected by end of mode**
- framing bundle with enough coverage to begin meaningful design exploration
- identified hard constraints / non-goals
- possibly some seed requirements

**Closure condition**
Scope is ready to propose closure when the knowledge layer contains a minimally sufficient framing bundle, likely covering:
- what is being built
- for whom
- why it matters / what pain exists
- operating context / domain / workflow
- major constraints or exclusions known so far
- enough clarity to pursue design without asking basic identity questions again

**Readiness representation**
- interviewer proposes a `phase_outcome` for `scope`
- user confirms or edits
- confirmation creates / updates relevant `knowledge_review` records on framing and constraints

### 2. Design mode (commitment / exploration)

**Primary job**
- walk the design tree and turn framing into commitments, assumptions, and downstream implications

**Interviewer behavior**
- ask branch-shaping design questions
- surface tradeoffs explicitly
- use single-select when one fork should be chosen
- use multi-select when several forces or applicable patterns may coexist
- encourage rationale strongly because explanation is part of the design substance

**Observer behavior**
- preferentially capture:
  - `decision`
  - `assumption`
  - newly surfaced `constraint`
  - newly surfaced `requirement`
  - occasional `framing` refinements when the user corrects or deepens earlier understanding
- attach graph edges across all relevant item kinds

**Primary artifacts expected by end of mode**
- a coherent decision set
- explicit assumptions under key decisions
- requirement candidates derived from design consequences
- refined constraints and framing where needed

**Closure condition**
Design is ready to propose closure when:
- the major design forks relevant to the current scope have been resolved enough to support requirement synthesis
- the remaining uncertainty is acceptable / local rather than architecture-shaping
- the current decision / assumption graph is coherent on the active path

**Readiness representation**
- interviewer proposes `phase_outcome` for `design`
- user confirms the summary of commitments and open assumptions
- relevant `knowledge_review` records for decisions / assumptions can be marked approved or left pending where explicit follow-up is needed

### 3. Requirements-review mode (audit / completeness)

**Primary job**
- normalize, complete, and confirm the requirement set implied by the whole knowledge layer

**Interviewer behavior**
- gather already-captured requirements
- synthesize additional requirements from framing, constraints, decisions, and assumptions
- present grouped or itemized review turns
- ask for approval, edits, merges, deletions, and missing requirements

**Observer behavior**
- preferentially capture:
  - new `requirement`
  - edits/refinements to existing `requirement`
  - supporting edges showing which knowledge items requirements were derived from
- capture newly surfaced constraints or framing only when they materially affect the requirement set

**Primary artifacts expected by end of mode**
- deduped, reviewable requirement set
- explicit approval / edit trail for requirements
- stale or superseded requirement drafts clearly marked as such

**Closure condition**
Requirements-review is ready to close when:
- the requirement set is complete enough for verification design
- each in-scope requirement is approved, edited into approval, or explicitly rejected
- obvious gaps / duplicates / contradictions have been handled

**Readiness representation**
- `knowledge_review` for `requirement` items is the main readiness source of truth
- interviewer proposes `phase_outcome` for `requirements` once the requirement review state is sufficiently complete

### 4. Criteria-review mode (verification)

**Primary job**
- turn approved requirements into verifiable success conditions

**Interviewer behavior**
- gather any already-captured criteria-like signals (benchmarks, proofs, KPIs, acceptance signals)
- synthesize candidate criteria from approved requirements plus the broader knowledge layer
- present criteria in review form for approval and edits
- challenge vague or non-verifiable criteria

**Observer behavior**
- preferentially capture:
  - new `criterion`
  - edits/refinements to criteria
  - `verifies` edges from criteria to requirements
- capture escalations when criteria review reveals a requirement is underspecified

**Primary artifacts expected by end of mode**
- criteria attached to each approved requirement that needs verification
- explicit verification-facing success conditions rather than informal aspirations

**Closure condition**
Criteria-review is ready to close when:
- every in-scope approved requirement has sufficient verification coverage
- criteria are concrete enough to evaluate success
- unresolved criteria disputes have either been settled or intentionally pushed back upstream

**Readiness representation**
- `knowledge_review` for `criterion` items is the main readiness source of truth
- interviewer proposes `phase_outcome` for `criteria` once criteria coverage is complete enough for export

### Cross-mode rules

#### Capture-anytime / review-in-phase
- `framing`, `constraint`, `decision`, `assumption`, `requirement`, and `criterion` may surface in any conversational mode
- each mode remains responsible for closing the review state of the entity families it owns

#### Escalation rule
- later modes may push work upstream if review exposes a defect in an earlier layer:
  - criteria exposes bad requirement → requirements becomes stale
  - requirements exposes bad design premise → design becomes stale
  - design exposes bad framing → scope becomes stale

#### Revisit rule
- revisiting a turn re-establishes the active path from that turn forward
- affected `phase_outcome` rows become superseded or invalidated based on turn frontier
- affected `knowledge_review` rows become `stale` where their source basis is no longer trusted

#### Export readiness rule
A project is export-ready only when:
- the latest active-path `phase_outcome` for each mode is confirmed and not invalidated
- all in-scope `requirement` reviews are approved / resolved
- all in-scope `criterion` reviews are approved / resolved
- no upstream staleness remains unresolved on the active path

## Open questions to continue pressure-testing

1. What exact framing subtypes do we need immediately versus later?
2. Should `constraint` and `framing` be separate first-class tables, or one table with typed variants?
3. What is the minimum sufficient close condition for scope?
4. Should the observer be phase-aware?
5. Which entity families should be capture-anytime versus review-in-phase?
6. Are phases primarily workflow modes, extraction policies, or both?
7. Should review/edit actions become explicit turn-linked events rather than side mutations?

## Early remediation directions

These are not yet commitments — just plausible directions surfaced by the talkthrough.

- Introduce phase-specific extraction policies instead of a single observer ontology.
- Add at least two new semantic buckets ahead of `decision` / `assumption`: `framing` and `constraint`.
- Keep `requirement` and `criterion` as durable entities, but treat them as capture-anytime and review-in-phase.
- Shift toward a **capture-anytime, review-in-phase** model so workflow phases do not artificially suppress entities that surface early.
- Define a phase-specific resolution checklist for scope instead of relying only on freeform LLM judgment.
- Expand the turn-response model to support multi-select, rationale capture, custom answers, and explicit review approvals/edits.
- Revisit the global structured-question contract so later phases can use review/confirmation semantics instead of forcing all interactions into the same question shape.
