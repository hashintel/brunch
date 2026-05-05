# Intent Spec Evolution

> Synthesis started 2026-05-04 from external agent conversations about intent formalization, formal verification, and Brunch's elicitation methodology.
> Status: working design capture, not canonical product truth.
> Canonicality: for live authority, prefer `memory/SPEC.md` and `memory/PLAN.md`. This note collects emerging concepts before promotion into those files.

## Why this note exists

Brunch currently elicits and maintains software specifications through a structured but mostly prose-centered workflow. The live development spec already contains requirements, assumptions, decisions, invariants, criteria, provenance, confidence, staleness, and traceability, but much of that structure is carried by markdown convention and agent discipline.

The conversations captured so far suggest a stronger frame:

> Brunch should move from eliciting planning specs toward eliciting intent specs: structured, progressively checkable claims about what correctness would mean, what remains uncertain, and how the user validated or rejected competing interpretations.

This note separates the broad areas that are emerging so later excerpts can be collated against them instead of being reduced to generic summaries.

## 1. From Planning Specs to Intent Specs

A planning spec is optimized for downstream work sequencing:

- what to build
- what matters next
- what scope is in or out
- which implementation slices follow

An intent spec is optimized for preserving and validating meaning:

- what the user or project commits to
- what properties define correctness
- which examples and counterexamples disambiguate the intent
- which assumptions remain open
- which claims are verified, manually judged, or explicitly unresolved
- how generated artifacts might drift from the original intent

This shift does not make planning irrelevant. It changes the source artifact that planning consumes. A plan becomes one projection from a richer intent graph rather than the primary purpose of the spec.

## 2. Progressive Checkability

The cleanest product-facing phrase from the second excerpt is:

> Make specs progressively checkable, not "formal" as a binary category.

The useful ladder is:

1. human-readable claim
2. concrete example
3. counterexample
4. regression test
5. runtime-checkable contract
6. state-machine rule
7. invariant
8. proof obligation
9. explicit unresolved ambiguity

This keeps formal verification as one endpoint on a spectrum. The tool should emit the weakest sufficient artifact for the claim at hand. Some claims need only examples. Some deserve property tests, state-machine checks, runtime assertions, or Dafny / Lean / TLA+-style proof obligations. Some should remain qualitative, but they should be marked honestly rather than laundered into fake precision.

## 3. Shared Claims as the Core Ontology

The strongest modeling proposal so far is to factor requirements and acceptance criteria through a shared primitive, tentatively called `Property`.

```typescript
type Property = {
  id: PropertyId
  description: string
  shape: PropertyShape
  predicate?: PredicateLocator
}

type Requirement = {
  id: RequirementId
  commits: PropertyId[]
}

type AcceptanceCriterion = {
  id: CriterionId
  observes: PropertyId[]
  observationMode: ObservationMode
}
```

This resolves a persistent ambiguity in the current Brunch development spec:

- a requirement is a normative commitment: the system shall satisfy these properties
- an acceptance criterion is an epistemic witness: this observation would show those properties hold
- an invariant is a property with state or transition shape
- an assumption is a claim whose status should be tied to probes or validation evidence

Requirements and criteria therefore should not collapse into the same item, but they should stop being parallel prose containers. Their relationship should be referential and many-to-many, not inferred from paraphrase similarity.

The ontology branch sharpens this further: a spec can be understood as a graph of typed claims. Top-level item kinds are not merely buckets; they are modalities of claim.

```text
goal         value or outcome claim
context      descriptive claim
constraint   boundary claim
assumption   uncertainty claim
decision     choice claim
requirement  obligation claim
invariant    preservation claim
criterion    oracle claim
example      concrete witness or disambiguator
```

This distinguishes two ontologies now in play:

- **Brunch-internal development ontology**: the richer `ln-*`-produced `SPEC.md` register, with assumptions, decisions, invariants, verification stance, oracle tiers, blind spots, and planning traceability.
- **Brunch-product elicitation ontology**: the product's currently captured user-spec ontology: goals, context, constraints, assumptions, decisions, requirements, and criteria.

The branch argues that the product ontology likely needs two additions:

- `invariant`: a property that must remain true across relevant states, transitions, versions, or executions.
- `example`: a concrete scenario, trace, input/output, edge case, or counterexample that illustrates or disambiguates intent.

The useful distinction is:

```text
Requirement:
  What the system must do.

Invariant:
  What must never be broken.

Criterion:
  How we judge, test, review, or prove it.

Example:
  A concrete case that disambiguates or witnesses it.
```

`Decision` should become narrower, not disappear:

> A decision is a chosen direction among plausible alternatives, with durable consequences for future design, implementation, or interpretation.

That avoids treating every user answer as a decision. A decision captures the choice; an invariant captures the rule that must keep holding after the choice.

`Constraint` should remain a top-level kind, but gain internal subtypes such as `non_goal`, `scope`, `technical`, `policy`, `resource`, `compatibility`, and `environmental`. A constraint restricts the acceptable solution space; an invariant states what must remain true as the system operates or evolves.

`Context` remains necessary, but should have promotion rules:

- if it must be true for success, consider requirement or invariant
- if it limits acceptable solutions, consider constraint
- if it may be false and matters, consider assumption
- if it chooses among alternatives, consider decision
- if it just helps interpretation, keep it as context

## 4. Knowledge Edges as Intent Semantics

The ontology branch treats `knowledge_edge` as a critical signal, not merely graph-view infrastructure.

> A planning spec can be a list. An intent spec needs a graph.

Item kinds say what claims exist. Edge kinds say how claims justify, constrain, depend on, refine, and verify one another. That reasoning topology is where intent becomes inspectable.

The important shift:

```text
Planning-spec edge:
  Task B depends on Task A.
  Feature Y implements Requirement X.

Intent-spec edge:
  Requirement R exists to satisfy Goal G.
  Requirement R is constrained by Constraint C.
  Requirement R assumes Assumption A.
  Invariant I protects Decision D.
  Criterion K verifies Requirement R.
  Example E disambiguates Requirement R.
  Counterexample CE rules out Interpretation P.
```

The current relation vocabulary already points in this direction with relations like `depends_on`, `derived_from`, `constrains`, `verifies`, and `refines`. The branch proposes organizing relation kinds into semantic families:

| Family | Example relations | Purpose |
| --- | --- | --- |
| Justification | `derived_from`, `motivated_by`, `supports` | Explain why a claim exists |
| Dependency | `depends_on`, `assumes`, `requires` | Explain what must remain valid |
| Boundary | `constrains`, `excludes`, `rules_out` | Explain how one claim limits another |
| Refinement | `refines`, `specializes`, `decomposes` | Explain how claims become more specific |
| Verification | `verifies`, `illustrates`, `counterexample_for`, `tested_by` | Connect intent to evidence |

Negative edges are especially important. Intent is often clarified by ruling out plausible interpretations:

```text
Counterexample CE1:
  "Rejected review item appears in export."

CE1 violates Invariant I-review-authority.
Constraint C-no-fake-closure rules_out Requirement candidate "auto-export draft reviews".
```

Edges also need epistemic metadata so inferred relations do not silently become false dependencies:

```typescript
type KnowledgeEdge = {
  sourceId: KnowledgeItemId
  targetId: KnowledgeItemId
  relation: RelationKind
  support: 'explicit' | 'strong_inference' | 'weak_candidate'
  status: 'proposed' | 'accepted' | 'rejected' | 'stale'
  provenanceTurnId?: TurnId
  rationale?: string
}
```

Not every visible graph edge should drive cascade, staleness, export explanation, or criteria generation. Relation policy should say whether an edge is user-visible, cascade-participating, export-relevant, staleness-producing, or useful only as a low-confidence suggestion.

For LLM collaboration, the most important practical change is to provide edge-local neighborhoods, not only grouped item lists:

```text
R17: Each phase exposes an explicit kickoff/frontier/recovery/handoff affordance.

Incoming:
  motivated_by G2: avoid fake closure and stranded users
  constrained_by C8: no generic task-planning surface
  derived_from D94: phase progression is frontier-anchored

Outgoing:
  verified_by K13: open phases bottom-load one visible artifact
  protected_by I24: stream projection/hydration stability
  refined_by R18: open interview phases default to kickoff/frontier/generation/recovery
```

That is a stronger context object than "all goals, all constraints, all requirements." It lets the interviewer and observer reason about consequences, gaps, and drift.

## 5. Formalization Targets in Current Brunch

The ontology branch also identifies the most promising formalization target in Brunch itself: not interview quality, but the workflow and stream projection model.

The current product spec already has a crisp abstract model:

```text
active-path turns
+ anchored workflow facts
+ projected control cards
+ activity cards
+ phase markers
+ phase section headers
= workspace stream
```

And it already makes authority claims:

- only conversational turns are branch-bearing
- workflow facts are durable but non-branch-bearing
- control cards and markers are projected
- requirements and criteria become durable only through accepted review outputs
- preface cards are provisional until paired with a validated user response
- anchored facts whose turn leaves the active path must be hidden or superseded

These are high-value behavioral properties hiding in prose. Candidate named properties:

- `P1 Single Actionable Frontier`
- `P2 Review Authority`
- `P3 Provisional Preface Safety`
- `P4 Active Path Anchoring`
- `P5 No Second Durable Workflow Model`
- `P6 Export Requires Accepted Reviews`
- `P7 Observer Capture Is Turn-Owned`

Each property should eventually have valid traces, invalid traces, current oracle, desired oracle, and checkability strength.

Example:

```text
Claim:
  Requirements become durable only through accepted review outputs.

Valid trace:
  review v1 -> request changes -> review v2 -> accept v2 -> export v2 items

Invalid trace:
  review v1 -> request changes -> export v1 item

Current oracle:
  app tests / project-state tests

Desired oracle:
  state-machine property test
```

This suggests a practical formalization roadmap:

- first, extract named behavioral properties from current prose
- then add examples and counterexamples as trace fixtures
- then write property tests over a TypeScript state-machine model
- only later consider Dafny, TLA+, or another heavier model

The branch's bottom line is crisp: the whole Brunch product is too qualitative to formalize at once, but the workflow state machine and stream projection model have clear states, actions, authority boundaries, and invariants.

## 6. Elicitation as Ambiguity-Targeted Disambiguation

The TiCoder-style lesson is that users are usually better at recognizing intent in concrete cases than authoring formal predicates.

Brunch should ask high-yield questions where plausible interpretations diverge:

- Does this example match your intent?
- Which candidate outcome is correct?
- Is this edge case inside or outside the commitment?
- Does this criterion intentionally omit part of the requirement?
- Which interpretation would count as a serious bug if implemented?

The goal is not a larger questionnaire. The goal is to generate candidate interpretations, find their disagreement points, and ask only where the answer collapses meaningful ambiguity.

Approved examples, rejected examples, and "not relevant" labels become durable spec artifacts. They are not merely conversational aids; they are regression seeds and evidence for the intent graph.

## 7. Behavioral Pattern Elicitation

The second excerpt adds an important product direction: do not elicit only freeform documents; elicit into reusable behavioral patterns.

Candidate patterns include:

| Pattern | User-facing question | Artifact shape |
| --- | --- | --- |
| Workflow | What states can this object move between? | State machine |
| Ownership | Who may perform this action? | Authorization predicate |
| Containment | Can this item belong to more than one parent? | Uniqueness / membership invariant |
| Undo / redo | What happens to redo after a new action? | History / future invariant |
| Collaboration | What happens to stale or offline actions? | Rebase / conflict semantics |
| Deletion | What references must disappear or remain valid? | Referential-integrity rule |

This gives Brunch an intermediate surface between prose and formal methods. The interviewer can detect or propose a behavioral pattern, ask pattern-specific questions, and then generate the weakest useful checkable artifact.

## 8. Kernel Typology

The kernel branch develops the behavioral-pattern idea into a more general interviewer architecture.

> A kernel is a reusable family of questions that exposes one class of latent requirement and maps answers into progressively checkable artifacts.

This is related to Midspiral's technical "kernel" concept, but shifted toward elicitation. A technical kernel is reusable state-management or proof machinery parameterized by a domain. An elicitation kernel is reusable question-and-artifact machinery parameterized by a user's feature.

Kernels are not domains. "Kanban," "subscription billing," "document sharing," and "calendar scheduling" are domains. Each domain composes several kernels.

Example: offline Kanban editing likely combines:

- state and lifecycle: cards move through workflow states
- containment and topology: cards belong to columns and positions
- concurrency and collaboration: stale moves need merge / reject / rebase semantics
- resource accounting: WIP limits bound column capacity
- temporal history: undo, redo, or event ordering may matter
- derived data and views: column counts and filters must agree with source state

The interviewer should therefore not ask every possible requirements question. It should infer likely kernels and ask diagnostic, contrastive questions for those kernels.

### Kernel Families

The v0.1 kernel ontology from the excerpt:

| # | Kernel | Interview focus | Artifact shape |
| -: | --- | --- | --- |
| 1 | Identity & reference | What exists, how it is identified, what can point to it | Entity model, reference invariant |
| 2 | Containment & topology | Parent / child, membership, ordering, graph constraints | Tree, list, or graph invariant |
| 3 | Validation & normalization | Valid inputs, canonical forms, equivalence | Validator / parser contract |
| 4 | State & lifecycle | States, transitions, terminality | State machine |
| 5 | Temporal history | Undo, audit, monotonicity, expiration | History / timeline invariant |
| 6 | Optimization & preference | Best valid outcome, tie-breaking | Objective or ranking relation |
| 7 | Authority & capability | Who may do what, delegation, revocation | Authorization predicate |
| 8 | Concurrency & collaboration | Conflicts, stale actions, merge / rebase | Conflict-resolution semantics |
| 9 | Transactions & atomicity | All-or-nothing multi-object updates | Transaction invariant |
| 10 | Resource accounting | Balances, quotas, conservation, capacity | Conservation / bounds invariant |
| 11 | Derived data & views | Cache, index, projection consistency | View consistency invariant |
| 12 | Error & recovery | Retry, rollback, compensation, degraded mode | Failure / recovery contract |
| 13 | External effects | APIs, queues, clocks, webhooks, side effects | Boundary / adapter contract |
| 14 | Change & migration | Compatibility, legacy data, feature evolution | Migration / refinement invariant |
| 15 | Observability & evidence | Logs, provenance, explanations, auditability | Trace / audit invariant |

This should be treated as a working ontology, not final truth. The test is whether each kernel produces a distinct class of high-value questions and emitted artifacts.

### Super-Families

The fifteen kernels can be grouped into five super-families:

| Super-family | Kernels | Framing question |
| --- | --- | --- |
| Structural correctness | Identity & reference; containment & topology; validation & normalization | What exists? |
| Behavioral correctness | State & lifecycle; temporal history; optimization & preference | What can happen? |
| Multi-actor correctness | Authority & capability; concurrency & collaboration | Who or what can act? |
| System correctness | Transactions; resource accounting; derived data & views; external effects; error & recovery | What must stay consistent operationally? |
| Evolution & accountability | Change & migration; observability & evidence | How does this survive time, change, and scrutiny? |

This hierarchy is useful because kernels are "orthogonal-ish" but real features compose them. The interviewer can classify a feature at the super-family level first, then activate narrower kernels.

### Contrastive Kernel Questions

Kernel questions should usually be contrastive, not open-ended.

Poor shape:

```text
How should permissions work?
```

Better shape:

```text
If Alice shares a folder with Bob, and then a document is added to that folder later,
should Bob automatically get access to the new document?

A. Yes, permissions inherit dynamically.
B. No, sharing applies only to current contents.
C. It depends on the document type.
```

This generalizes the TiCoder move beyond tests. The interviewer generates cases where plausible interpretations diverge, then asks the user to classify them.

### Kernel Cards

Each kernel could become a reusable spec-interview module:

```text
Kernel: Containment & Topology

Detects:
  parent / child relations, lists, folders, graphs, ordered collections

Goal:
  discover structural invariants

Questions:
  - Can an item have multiple parents?
  - Can cycles exist?
  - Does order matter?
  - Are duplicates allowed?
  - What happens to children when a parent is deleted?

Artifacts:
  - entity relationship diagram
  - acyclicity invariant
  - unique-parent invariant
  - ordering invariant
  - deletion cascade policy

Proof obligations:
  - add preserves topology
  - move preserves topology
  - delete preserves topology
  - reorder preserves topology

Example tests:
  - moving item between parents removes it from old parent
  - deleting parent does or does not delete children
  - attempting to create cycle is rejected
```

The important product move is to build around question families and emitted artifacts, not formal-methods terminology. Formality is the compilation target, not the user interface.

## 9. Specification Validation and Drift

Both source conversations converge on the same bottleneck:

> There is no oracle for spec correctness other than the user.

Therefore Brunch's core problem is not only generating stronger artifacts. It is validating whether generated artifacts still capture the user's intent.

Important drift cases:

- an LLM silently changes a spec while trying to satisfy a proof or test
- an acceptance criterion observes a property no requirement commits to
- a requirement commits to a property no criterion observes
- an invariant predicate no longer matches its prose description
- a prompt, schema, fixture, UI label, or API type drifts from the canonical ontology

Drift should be surfaced in human terms:

```text
Original intent:
  "Redo should behave like most apps."

Generated behavior:
  "Any new action after undo clears the future."

Potential mismatch:
  "Some apps support branching histories. Do you want linear history or branching history?"
```

This is more useful than exposing formal artifacts directly. It asks the user to validate meaning at the point where meaning could have changed.

## 10. Brunch Development Methodology

The first conversation eventually shifts from Brunch-the-product to the methodology used to build Brunch itself.

The current `memory/SPEC.md` is already structured, but the structure is markdown-mediated. That creates cognitive strain for LLM contributors:

- they must parse the whole document to make local changes
- cross-reference maintenance is textual and fragile
- retirement, supersession, and validation status require editorial discipline
- consistency is checked by rereading, not by querying

The emerging direction is to make the development spec queryable and tool-operated, then render markdown as a view:

```text
spec/
  properties.json
  requirements.json
  criteria.json
  assumptions.json
  decisions.json
  predicates/
  validators/
memory/SPEC.md    # generated projection
```

Agent skills would move from document editing to structured operations:

- query relevant spec slice
- add property
- link requirement to property
- attach criterion witness
- retire claim with rationale
- run spec validators
- generate human-readable projection

This would make the richer ontology less burdensome. Complexity moves into schemas, validators, and tools; the LLM sees scoped projections and structural diffs.

The alternate branch gives this a more operational shape: Brunch's development spec should become a small source-code-like registry, not a miniature runtime database.

The current `SPEC.md` is doing many jobs at once:

- human-readable product narrative
- agent-readable current truth
- decision / assumption register
- verification map
- glossary
- architecture model
- test coverage index
- working memory for coding agents

That is powerful, but it forces every contributing LLM to repeatedly parse a large prose document, infer active vs retired concepts, preserve cross-section consistency, and perform global housekeeping while trying to make local code changes.

The proposed development shape:

```text
memory/spec/
  schema/
    record.schema.json
    relation.schema.json
  records/
    goals.yaml
    context.yaml
    constraints.yaml
    assumptions.yaml
    decisions.yaml
    requirements.yaml
    invariants.yaml
    criteria.yaml
    examples.yaml
    terms.yaml
    verification.yaml
  generated/
    SPEC.md
    AGENT_BRIEF.md
    VERIFY_MAP.md
    OPEN_RISKS.md
  tools/
    check.ts
    render.ts
    slice.ts
```

The important view distinction:

- **canonical**: small typed records, one per claim
- **rendered**: disposable generated markdown views for humans and agents

The most important generated view may be `AGENT_BRIEF.md`: a compact, redundant file containing the product thesis, global non-negotiables, current architecture seams, active invariants, verification commands, and "for any change" rules. Most coding agents should not need the whole `SPEC.md`; they should need the brief plus a task-local slice.

Task-local slices should be generated by tag and relation traversal:

```text
Feature area: graph-view

Relevant requirements:
  REQ-...

Relevant decisions:
  DEC-128
  DEC-129

Relevant invariants:
  INV-graph-projection-authority
  INV-no-second-durable-model

Relevant criteria:
  CRIT-graph-structured-list

Open assumptions:
  A69
  A70
```

This turns "read the whole spec again" into indexed retrieval by concern.

### Tool vs Direct File Edits

The branch separates canonical substrate from mutation interface.

For development, a staged approach seems right:

1. Agents may edit structured files directly while the model is changing, but a deterministic checker validates schema, IDs, relations, and generated views.
2. Common semantic mutations move behind a CLI/tool: add requirement, retire assumption, link criterion to invariant, regenerate views, produce task slice.
3. Direct edits remain possible for humans, but agents prefer tools and CI rejects invalid registry state.

The contract:

```text
Canonical records are editable files.
The tool is the preferred mutation interface.
The checker is the authority.
Generated markdown is never edited directly.
```

This avoids overbuilding too early while still moving housekeeping out of the LLM's context window.

### Spec Checker

The tool should behave less like a database and more like a compiler for spec records:

```text
records -> validated graph -> rendered views / task slices / check reports
```

Possible commands:

```text
spec check
spec render
spec slice --tag graph
spec list --kind invariant --status active
spec add --kind invariant
spec retire INV-024 --reason "superseded by INV-031"
spec link CRIT-012 verifies INV-024
```

Possible checks:

- no dangling relation targets
- no duplicate IDs
- every requirement has at least one criterion or explicit verification gap
- every criterion verifies at least one requirement or invariant
- every invariant has an oracle, or is marked manual / proof-candidate / gap
- every active decision has rationale and affected scope
- every assumption has validation approach or retirement condition
- no retired record appears in active generated views
- no forbidden legacy term appears outside glossary aliases

The LLM should propose semantic changes, rationale, examples, and likely affected records. Deterministic tools should own ID uniqueness, schema validity, relation integrity, status transitions, coverage gaps, staleness reports, and generated views.

## 11. Persistence and Interaction Model

The persistence question is broader than file format. An intent spec is not produced by one linear conversation. It evolves through:

- primary interview turns
- side conversations
- graph refinement
- revisit flows
- formalization passes
- validation probes
- agent-generated candidate interpretations
- user-labeled examples and counterexamples

That suggests the durable model should preserve:

- claim identity independent of the conversation turn that surfaced it
- provenance back to turns, examples, and user validations
- status transitions such as proposed, accepted, superseded, retired, open, validated, or falsified
- many-to-many links between commitments, observations, assumptions, and evidence
- projections for human review, implementation planning, test generation, and verification

This aligns with Brunch's existing direction: chat view and graph view should be projections over shared specification truth, not separate durable models.

### Turn Spine vs Patch Ledger

A missing branch of the current capture concerns early-user feedback about how knowledge items are created and updated.

One original Brunch assumption was that a single primary conversation would sit at the center of the product. The current architecture reflects that: durable conversational turns are the branch-bearing lineage spine, and knowledge items are extracted from answered turns or accepted review outputs.

The intent-spec direction creates pressure against that assumption. Brunch is starting to look less like a linear guided interview and more like a flexible workbench for building an intent graph:

- users may add knowledge directly from graph view
- users may edit or split existing items
- side-chats may refine one node or neighborhood
- candidate specs may introduce a batch of claims
- examples and counterexamples may be added outside the original turn
- verification probes may update confidence or checkability
- downstream implementation feedback may revise upstream intent

In that world, the chat turn is still valuable provenance, but it may no longer be the natural historical spine for all semantic change.

The alternative under exploration is a **semantic patch ledger**:

```text
Patch:
  operation: add | update | split | merge | retire | link | unlink | verify | invalidate
  target: knowledge item / relation / property / criterion / example
  before: previous semantic state
  after: new semantic state
  rationale: user / agent explanation
  provenance: turn, side-chat, graph edit, review action, import, verifier result
  affected: downstream items marked stale or needing reconciliation
```

This would make the intent graph itself the durable semantic surface, while patches record how it changed over time.

The key difference:

```text
Turn spine:
  history is organized by conversational sequence.

Patch ledger:
  history is organized by semantic mutations to the intent graph.
```

The patch-ledger idea is attractive because arbitrary upstream edits create reconciliation needs. If a goal, assumption, constraint, or invariant changes, Brunch needs to know which downstream requirements, criteria, examples, decisions, and verification artifacts may now be stale.

A typed patch can make that explicit:

```text
User updates Assumption A12.
Patch P81 records the old and new assumption text.
Relation policy finds dependents R4, D7, I3, K9.
Those items become needs_reconciliation unless a validator can prove they still hold.
The UI surfaces a reconciliation queue rather than silently leaving the graph inconsistent.
```

This is closely related to `knowledge_edge` becoming intent semantics. Edges tell Brunch what might be affected; patches tell Brunch what changed.

The hard question is whether a patch ledger becomes a second durable workflow model. A useful distinction:

```text
Workflow state:
  where the user is in the interview / workbench process.

Semantic history:
  how the intent graph changed.
```

If patches are treated as workflow authority, they violate the current "no second durable workflow model" constraint. If patches are treated as semantic provenance and reconciliation input, they may complement the turn spine rather than replace it.

Possible hybrid:

- turns remain the user-legible conversation and interaction provenance spine
- the intent graph becomes the semantic truth surface
- patches become the semantic history of graph mutations
- workflow projection still derives from durable workflow state, not from replaying arbitrary patches
- reconciliation, staleness, audit, and export explanation can use the patch ledger

This suggests a future architecture split:

| Concern | Candidate spine |
| --- | --- |
| Conversation replay | turn spine |
| Phase/workflow progression | workflow state anchored to turns or explicit workflow records |
| Intent graph truth | current typed knowledge graph |
| Semantic history | patch ledger over graph mutations |
| Reconciliation need | edge traversal from changed patch targets |
| Export explanation | current graph plus provenance patches |

Open design tension:

> Does Brunch need a patch ledger beside the turn spine to support open-ended intent-graph editing, or can typed graph records with turn provenance and status transitions cover the same need with less machinery?

The answer likely depends on how central non-linear graph editing becomes. If Brunch remains primarily interview-led, turn ownership may be enough. If Brunch becomes a workbench where claims can be edited from many entry points, semantic patches become much more compelling.

The alternate branch makes an important persistence distinction:

> Use the same ontology concepts where possible, but do not force Brunch's development registry and Brunch's runtime product state into the same storage substrate.

For Brunch's development workflow:

```text
file-backed canonical records
+ CLI mutation helpers
+ deterministic checker
+ generated markdown views
+ task slices for agents
```

Files are appropriate because development memory should be diffable, reviewable, branchable, and easy for coding agents to inspect.

For Brunch-the-product:

```text
SQLite + Drizzle remain runtime truth.
Markdown / YAML / implementation briefs are projections or interchange bundles.
```

The running app has concerns that a file registry should not own:

- multiple specifications
- turn lineage
- semantic patch history if graph edits become first-class
- streaming state
- observer capture status
- phase outcomes
- review turns and review versions
- graph edges
- route hydration
- resume / reload
- local `.brunch/` persistence

Those are relational, interactive, and stateful. SQLite remains the right canonical runtime substrate.

The product should distinguish:

| Layer | Contents |
| --- | --- |
| Spec content | goals, context, constraints, assumptions, decisions, requirements, invariants, criteria, examples, terms |
| Operational metadata | specification id, workspace path, timestamps, phase status, frontier turn id, observer status, streaming state, review version, lifecycle bookkeeping |
| Relational structure | provenance, lineage, graph edges, patch history, review membership, accepted items, phase anchors, verification links |

Relational and operational data are not "spec content," but they are part of specification state. Keeping those categories distinct prevents the persistence schema from leaking into the product ontology.

A useful architecture split:

```text
1. Storage model
   SQLite tables optimized for persistence, queries, provenance, and resume.

2. Domain model
   Typed TypeScript objects representing specification truth:
   KnowledgeItem, Requirement, Criterion, Invariant, Example, Relation, ReviewSet.

3. Projection model
   Markdown export, graph view, sidebar grouping, agent handoff, implementation brief.
```

Drizzle can own persistence shape, while TypeScript domain schemas and relation-policy registries own semantic shape.

The convergence path is shared ontology with different adapters:

```text
packages/spec-ontology/
  kinds.ts
  relations.ts
  schemas.ts
  validators.ts
  projectors.ts

SQLite adapter:
  runtime app state

File adapter:
  development registry, fixtures, exports

Markdown projector:
  human / agent-readable docs
```

The rule of thumb:

```text
If humans and agents should review it in Git, use files.
If the running app needs to mutate it interactively and resume precisely, use SQLite.
```

The unifying principle is not files vs database. It is:

> The LLM proposes semantic changes; deterministic systems own structure, integrity, and projection.

## 12. Product Implications

Near-term product implications:

- treat unresolved ambiguity as a first-class output category
- add interviewer moves that generate disambiguating probes
- detect behavioral kernels and ask pattern-specific questions
- add `invariant` and `example` as likely product-ontology candidates
- treat `knowledge_edge` as intent semantics, not only graph display
- explore whether open-ended graph editing needs a semantic patch ledger beside the turn spine
- preserve approved / rejected examples as durable evidence
- distinguish human-readable claims from checkable artifacts
- eventually tie requirements and criteria through shared property-like claims

Near-term development-methodology implications:

- prototype a structured spec store for Brunch's own planning artifacts before trying to migrate everything
- generate markdown from structured records rather than making markdown the only source
- add validators for orphan claims, unobserved commitments, stale assumptions, and ontology drift
- rewrite selected `ln-*` skills around scoped spec operations instead of whole-document parsing
- prototype named behavioral properties for the workflow/stream projection model
- provide LLM context as edge-local neighborhoods around active claims
- prototype a file-backed spec registry, renderer, checker, and task-slice generator for Brunch's own development workflow
- keep Brunch runtime persistence on SQLite / Drizzle while strengthening domain schemas and relation policies above the storage layer

## Open Questions

- What is the right granularity for `Property` records?
- Which claims should remain qualitative but explicitly observable-only?
- Should Brunch-the-product expose properties directly, or keep them as an internal normalization layer?
- Should `invariant` and `example` become durable top-level product kinds, or generated review outputs only?
- What relation kinds need to participate in cascade and staleness, and which should remain display-only?
- How should weak inferred edges be reviewed without flooding users or agents?
- Can turn provenance support arbitrary graph edits well enough, or does Brunch need a typed patch ledger for semantic history?
- If a patch ledger exists, which operations are semantic patches and which remain workflow events?
- How can a patch ledger drive reconciliation without becoming a second durable workflow model?
- Which behavioral kernels are common enough to deserve first-class elicitation support?
- Are the fifteen kernel families distinct enough in practice, or should some merge after transcript testing?
- What should a first kernel-card implementation include: detection signals, question templates, artifact schema, validators, or all of these?
- What is the smallest structured-store experiment that would reduce LLM housekeeping without destabilizing current planning flow?
- Should the development registry begin as YAML records, JSONL records, or markdown-embedded `spec-record` blocks?
- Which mutations deserve CLI commands first: add, link, retire, supersede, mark stale, render, slice, or check?
- What should belong in the generated `AGENT_BRIEF.md` versus task-local slices?
- How should user-labeled examples, counterexamples, and ambiguity probes appear in export?
