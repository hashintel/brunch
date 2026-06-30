---
name: propose
description: Generate candidate graph material or alternative framings for human recognition and review without treating the proposal as settled graph truth.
---

# Propose

Propose is a skill primarily for the `elicitor` agent when the next move is to generate candidate material for user recognition rather than ask for a missing answer.

### Fan-out / fan-in as unifying pattern

Three product-level flows share a structure:

| Flow                    | Object of variation                                          | Fan-in move                                                                                  |
| ----------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **candidate-spec**      | *territory* — alternative problem framings                   | mostly pick one (framings have internal coherence; cherry-picking produces incoherent specs) |
| **technical-design**    | *map* — module shapes / seams interior to a chosen territory | synthesis is legitimate (combine insights across alternatives)                               |
| **verification-design** | *gauges* — oracle ensembles judging a chosen territory + map | compose (oracles are additive; redundancy across families is a feature)                      |

All three are "design-it-twice" moments where the agent's job is not to optimize a single answer but to **make variation legible** so the user can recognize what they value. That is structurally different from a quiz flow: the user is not supplying answers they already hold; they are recognizing preferences against rendered alternatives.


### Generative lenses

Produce batch proposals carrying structured entity-draft payloads; the elicitor captures the proposal at proposal time; the `reviewer` Operational Mode analyzes post-acceptance.

- **`propose-scenarios-with-tradeoffs`** — candidate-spec flow at the territory level
- **`propose-design-shapes`** — technical-design flow at the map level
- **`propose-oracle-ensembles`** — verification-design flow at the gauges level
- **`project-requirements-from-upstream`** — derive requirements / acceptance criteria as a batch from upstream graph material

## Grounding and density

### The grounding bundle

Generative lenses require a minimum bundle of session-level anchors before they can produce non-speculative output:

| Anchor          | Question it answers                                                        |
| --------------- | -------------------------------------------------------------------------- |
| **Domain**      | What kind of thing is being built?                                         |
| **Protagonist** | Who is this for?                                                           |
| **Pain / pull** | What's the friction or aspiration motivating it?                           |
| **Constraint**  | What's binding (time, regulatory, integration, organizational, technical)? |

Each anchor is fillable in a sentence. The constraint anchor is where volunteered technical constraints land — caught and held as boundary conditions, not refused. With the bundle in place, the agent has **legitimate axes to vary on** when fanning out (different protagonists as primary, different pains framed as central, different constraints as binding).

### Lens is always available — output scales with density

The lens itself is never gated. A user can request a generative lens at any density. What scales is the **rendering resolution** of the output and the **epistemic-status** signaling on it:

| Spec density                             | Mode of generative output                | Per-alternative artifact resolution                                                                                                                                   |
| ---------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty / thin (no grounding bundle yet)   | **framing proposals** (Shape Up pitches) | low — name, 200–400 word pitch, breadboard sketch, fat-marker anchor scenario; `inferred` epistemic status; explicit "let's ground more before committing" suggestion |
| Moderate (some intent-graph nodes exist) | **scenario sketches**                    | medium — concrete situations the framing centers, plus which existing nodes get foregrounded/recontextualized                                                         |
| Rich (substantial intent-graph)          | **completion proposals**                 | high — specific node/edge fills with rationale, gap analysis                                                                                                          |
| Mature (full spec exists)                | **refactor proposals**                   | high — alternative re-framings of existing material, presented as diffs                                                                                               |

The same lens (`propose-scenarios-with-tradeoffs`) produces fundamentally different artifacts at different densities. The agent diagnoses which mode is appropriate; the user can override ("propose at lower resolution; I want framings again").

### Why a gate isn't a refusal

This design sidesteps two failure modes:

- **(A) User demands the impossible** — without grounding, there's nothing to ground a candidate-spec on. The agent could refuse, but that introduces friction and reads as gating.
- **(B) System gates and refuses** — refusing creates the impression that the agent "decided" the user can't have what they want.

The resolution: the lens is always available. The agent produces *some form* of what was asked for, with epistemic-status honestly reflecting how much weight to put on it. The user gets traction immediately; the system stays honest.

## Epistemic-status signaling

Generative-lens outputs carry an `epistemic_status` field (`inferred | assumed | asserted | observed`) per the existing lexicon entry. Status is set based on grounding density at proposal time:

| Grounding density                           | Default epistemic status of generative output                               |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| empty                                       | `inferred`                                                                  |
| thin (1–2 anchors)                          | `inferred` or `assumed`                                                     |
| moderate (3 anchors)                        | `assumed`                                                                   |
| rich (all 4 anchors plus some intent-graph) | `asserted`                                                                  |
| mature                                      | `observed` where backed by graph entities; `asserted` for novel projections |

UI renderings of low-status proposals should *feel* speculative: visible hedging marks, lower visual weight, explicit "speculative — based on N anchors so far" footers. This is a **presentation contract** (I17-L), not just a metadata field.

## Scenario uses

Scenarios are a recurring rendering primitive across lenses with three distinguishable uses:

| Use                      | Role                                                 | Where it appears                      | Persistence                                                                    |
| ------------------------ | ---------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| **Anchor scenario**      | illustrates a single framing / option from inside it | embedded in a pitch or option preview | transcript-rendered, not persisted as graph entity                             |
| **Contrastive scenario** | distinguishes two options from each other            | comparison UI                         | transcript-rendered                                                            |
| **Probing scenario**     | forces the user to react to disambiguate intent      | interactive elicitation prompt        | transcript-rendered; user response persists per existing elicitation mechanics |

All three share a shape: a particular vignette, deliberately under-specified at the boundaries (fat-marker), illustrative not prescriptive, carrying an implicit "vs not-this". A scenario-entry primitive may eventually be worth extracting as a typed custom entry; for now scenarios live as transcript content with role distinguished by context.

**Terminology guard.** Scenarios are user-facing/runtime examples. Probe inputs are testing infrastructure that only matter when they produce transcript-backed probe runs under `.fixtures/runs/`. Do not turn probe inputs into product scenarios, and do not revive a standalone brief-library subsystem.

## Meta-rubric heuristic (D31-L)

Comparison rubrics for fan-out alternatives across all three flows attempt to express each axis in terms of four meta-axes:

| Meta-axis                        | What it asks                                      |
| -------------------------------- | ------------------------------------------------- |
| **Legibility / cost-of-knowing** | How much must you carry in your head to use this? |
| **Failure modes**                | How does this go wrong?                           |
| **Coverage / range**             | What's covered vs left out?                       |
| **Commitment**                   | What does picking this lock in downstream?        |

Per-flow instantiation:

| Meta-axis     | candidate-spec                                                     | technical-design          | verification-design                         |
| ------------- | ------------------------------------------------------------------ | ------------------------- | ------------------------------------------- |
| Legibility    | how much must the team carry to act under this framing?            | depth, locality, leverage | oracle weight to read / run / maintain      |
| Failure modes | which contradictions or coherence breaks does this framing invite? | ease of misuse            | what the oracle misses; false-positive rate |
| Coverage      | appetite, what's foregrounded, what's refused                      | general vs specialized    | coverage across invariants / claims         |
| Commitment    | what does this framing commit tech and verification to?            | implementation efficiency | infra cost, fixture commitment, run time    |

**Soft commitment, not architectural enforcement.** The elicitor attempts the meta-frame when generating rubrics; project-specific axes are allowed alongside; the meta-frame is dropped when it doesn't fit. The hypothesis (uniform comparison UI across all three flows is more useful than per-flow improvisation) is testable via fixture comparison. Promote to schema/UI uniformity only if it holds up.
