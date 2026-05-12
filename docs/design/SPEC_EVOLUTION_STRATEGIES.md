# Spec Evolution Strategies

> Status: **conversation capture / design seed**.
> Date: 2026-05-12.
> Scope: alternative strategies for advancing a Brunch specification's intent graph from vague user intent toward phase-mature, reviewable semantic truth. This note captures the model discovered while discussing the FE-705 `brunch agent` / probe-harness branch.
>
> Related docs: [`AGENT_MUTATION_SURFACE.md`](./AGENT_MUTATION_SURFACE.md), [`BEHAVIORAL_KERNELS.md`](./BEHAVIORAL_KERNELS.md), [`INTENT_GRAPH_SEMANTICS.md`](./INTENT_GRAPH_SEMANTICS.md), [`MULTI_CHAT.md`](./MULTI_CHAT.md), [`PATCH_LEDGER.md`](./PATCH_LEDGER.md).

## Why this note exists

The current FE-705 branch adds a local `brunch agent` JSONL capability adapter plus an external probe runner. The immediate implementation looks like CLI / harness infrastructure, but the design pressure behind it is broader: Brunch needs a way to try alternative **spec evolution strategies** outside the browser UI and compare their outputs against realistic completed-spec fixtures.

The current interviewer strategy is grounded but long. Early users noticed that getting to a useful spec can require many questions. Alternative strategies should reduce user burden without weakening the intent graph into plausible but incoherent generated prose.

## Core distinction

A Brunch strategy is not just a prompt. A strategy is a policy for advancing a specification's semantic state:

- what context it reads,
- what questions or candidate artifacts it produces,
- what unit of output it treats as coherent,
- what authority it has to commit graph truth,
- what review or validation must happen before commit,
- what evidence it contributes toward semantic maturity / phase advancement.

This suggests a strategy layer above individual interviewer prompts and below durable graph mutation authority.

## Chat-local strategy and turn shape

A strategy is **chat-local process state**, not specification-level semantic truth. In the multi-chat model, a specification workspace can have many chats, each with its own strategy and resumable context.

A Brunch `turn` is assistant- or system-first: the assistant/system offers, proposes, asks, or reports something, and the user response completes the bundle. Observer assessment reads the whole bundle, because the assistant/system part is the context that gives the user's response meaning.

A strategy can therefore be established by the first turn in a chat:

```text
assistant/system offer:
  "How would you like to proceed?"
  - Walk me through it step by step
  - Show me strong options quickly
  - Ask me targeted design cases

user response:
  "Show me strong options quickly"
```

Some globally-triggered flows may create or reuse a chat that is effectively pre-initialized to a strategy. For example, "start reconciliation" or "review this graph" can create a chat whose first assistant/system turn is already the kickoff for that procedure rather than a generic mode-selection offer.

A chat's strategy should be technically mutable, with changes explainable through later turns, but explicit strategy-switch UX is deferred. Tactical sub-strategies are allowed inside a chat: a `scenario_options` chat might use targeted kernel cases to harden a selected candidate, and a `graph_review` chat might ask clarifying questions.

## Changesets as semantic history spine

The multi-chat move separates conversational provenance from semantic history. Turns should no longer be the specification's only historical spine. The future **changeset ledger** should record intent-graph evolution:

```text
changeset:
  one atomic semantic mutation set

change:
  one atomic add/update/link/unlink/retire/etc. inside the changeset
```

A `changeset` mutates a specification from one semantically / structurally valid and coherent state to another, including any `reconciliation_need` rows that are opened or resolved as part of the mutation. The data changes inside the changeset and the recording of the changeset itself must succeed or fail together.

The changeset boundary should be the smallest atomic unit that preserves semantic coherence. If applying only half of a mutation would leave the graph incoherent, it belongs in one changeset.

A graph-review finding, candidate proposal, or reconciliation suggestion is not itself a changeset until accepted or otherwise acted on. It is the assistant/system half of an open frontier turn in its chat. The turn becomes complete when the user responds through one of the afforded actions, and only then may the runtime apply a changeset.

Proposal / finding artifacts can start as turn-owned structured assistant parts rather than standalone rows. A standalone proposal or proposed-changeset model should wait until batch review, expiry, assignment, cross-chat surfacing, or independent proposal lifecycle demands it.

When a turn is created, it should stamp the latest applied changeset id for the specification — for example `turn.opened_at_changeset_id` or `turn.base_changeset_id`. This is not provenance; it is the semantic graph revision the assistant/system offer was based on. If a turn remains open while `specification.latest_changeset_id` advances, the open offer is considered stale in the first cut. The product can simply offer to regenerate or refresh the proposal rather than attempting sophisticated neighborhood-level staleness analysis.

A chat should have at most one open frontier turn at a time. Otherwise the runtime cannot know which assistant/system offer the user's response completes. In normal operation, every active/resumable chat should have an open frontier turn, even if it is a scripted frontier such as the first offer in a new side-chat. If a chat somehow has no open turn, the UI can offer "continue this chat" or generate a new frontier when the chat is focused. The generated frontier may depend on the specification's current semantic maturity / `phase` value and the chat's strategy. A specification may have many open frontier turns across different chats.

Proposal turns should share a small normalized completion-action vocabulary, with strategy-specific user-facing labels mapped onto common semantics:

- `accept` — authorize the proposed action / bundle / fix; may apply a changeset.
- `reject` — decline the proposal without semantic mutation. This should be narrow: rejecting or arbitrarily editing part of a coherent proposal can itself create incoherence. In reconciliation contexts, rejection may leave the original `reconciliation_need` open or create a new one rather than resolving the issue.
- `revise` — request changes to the proposal; completes the current turn and usually opens a successor proposal turn. User-facing labels such as "Request changes" map here.
- `ask_followup` — request explanation or clarification before deciding.
- `defer` — intentionally leave the matter unresolved or parked.
- `regenerate` — ask the system to recreate the offer, especially when stale or low-quality.

Only `accept` should apply semantic changesets. Other actions may create process metadata or successor turns, but should not mutate intent graph truth directly. If a no-edit outcome still resolves process debt, model it as accepting a proposal whose changeset resolves the relevant need. `revise` is proposal-level transformation: it asks the system to produce a new coherent proposal, not to partially mutate canonical graph truth.

Direct editing is a sibling mutation path, not the same as proposal revision. In explicit edit mode, the user may make direct pending changes to one or more intent items in memory. When the user exits / applies edit mode, Brunch computes affected edges and opens required `reconciliation_need` rows; the direct item changes and reconciliation needs commit together in one changeset. Direct editing is safe because incoherence risk is materialized as process debt, not because arbitrary edits are prevented.

Review-set direct edits have a special consequence: if the user directly edits proposed review-set items, accepting the review set as-is is no longer valid. The UI should disable `accept`; `request changes` becomes a reconciliation-oriented action such as `request reconciliation`. The edited candidate/review set must be reconciled before it can become canonical truth.

Implementation can later choose whether these are distinct response shapes or a `kind` inside a discriminated response union.

Changeset provenance may point to different initiators:

- a turn in a chat,
- a user direct edit,
- a graph-review acceptance,
- a reconciliation pass,
- a verifier result,
- an import or migration,
- a future procedure run if the runtime needs a durable operation record distinct from any one turn.

This makes a `procedure_run` concept useful but not automatically schema-worthy. Some procedures may be represented by one or more turns plus resulting changesets. A first-class `procedure_run` table becomes necessary only when operation lifecycle, retry/cancel, multi-turn grouping, or non-chat provenance cannot be represented cleanly by turns and changesets.

## Strategy taxonomy discovered so far

### 1. Design-decision-tree drilldown

The current default interviewer strategy.

It asks phase-shaped questions that walk down the user's design-decision tree at increasing levels of detail until enough shared understanding exists to project requirements and criteria.

**Strengths**

- High provenance: graph claims are supported by user answers.
- Incremental: each turn can be observed, classified, and committed.
- Good for users who have context and patience.

**Weaknesses**

- Slow and question-heavy.
- Asks the user to do much of the design judgment work.
- Can feel like the app is demanding effort before providing leverage.

**Likely authority shape**

Incremental canonical commits are acceptable when each answer is processed through existing observer / review semantics.

### 2. Scenarios with tradeoffs

A proposed low-friction strategy for users who are impatient, underspecified, or unsure how to judge design choices.

Instead of asking for every detail, Brunch asks enough to identify the user's product / use-case typology, generates two or more complete scenario-shaped candidate specs, summarizes the tradeoffs of each, and lets the user choose or revise a coherent scenario.

**Strengths**

- Gives users something concrete to react to quickly.
- Shifts burden from open-ended design authorship to recognition and comparison.
- Can surface tradeoffs, excluded alternatives, and likely implications earlier.

**Weaknesses / risk**

- Generating a valid intent graph in one pass is a tall order for an LLM.
- The failure mode is not only bad prose; it is plausible graph structure whose items and edges are generic, internally weak, contradictory, overconfident, or unsupported.
- User item-by-item acceptance can create semantic incoherence because graph items are not independent.

**Likely authority shape**

Generated scenarios should enter as **candidate graph bundles**, not loose collections of proposed graph items. The default acceptance unit should be the coherent bundle. User edits should produce a revised coherent candidate, not arbitrary partial mutation of canonical truth.

Partial acceptance should only be allowed when the accepted subset is semantically closed, or when the system can automatically bring along required supporting items / edges.

### 3. Kernel-driven contrastive elicitation

Inferred from [`BEHAVIORAL_KERNELS.md`](./BEHAVIORAL_KERNELS.md).

The interviewer detects latent behavioral / correctness kernels in the user's feature and asks compact contrastive scenario questions. The user classifies a concrete divergent case, and the answer emits typed intent graph artifacts directly.

Example: instead of asking "How should permissions work?", ask whether a user who receives folder access should automatically receive access to documents added later.

**Strengths**

- Lower friction than full drilldown.
- More grounded than whole-spec generation.
- Produces high-signal artifacts: decisions, invariants, criteria, positive examples, negative examples, and typed edges.
- Helps users judge concrete cases rather than author abstract requirements.

**Weaknesses / risk**

- Requires kernel-card machinery: detection signals, question templates, artifact schemas, validators, and cross-kernel deduplication.
- Kernel ordering and composition are unresolved.
- A graph can become locally strong around activated kernels while remaining globally incomplete.

**Likely authority shape**

Kernel answers may be safe to commit incrementally when the emitted artifacts are validated against the kernel contract and relation policy. Kernel-generated artifacts should retain the worked scenario as evidence.

### 4. Topology-driven targeting

Mentioned in the behavioral-kernels design as complementary to kernel-driven questioning.

This may be less a user-facing strategy than a scheduler / targeting policy: once a graph exists, Brunch reads graph topology and epistemic metadata to choose where the next question, critique, or repair should focus.

Examples: high-fanout low-confidence assumptions, decisions without rejected alternatives, requirements without verification edges, criteria without targets, or conflicting constraints.

## Relation directionality

The current `knowledge_edge` relation names mix directionality in ways that become risky once edges drive reconciliation. For example, `depends_on` and `derived_from` naturally read downstream-to-upstream, while `constrains` and `verifies` often read upstream-to-downstream or evidence-to-claim.

Because FE-700 is already expected to expand the intent-graph ontology, breaking existing relation names and records remains acceptable. However, trying to force every useful edge verb into one dependency direction may distort the ontology around one operation. The graph must serve display, prompt context, export trace, requirements projection, reconciliation, critique, verification, candidate generation, and explanation.

The safer rule is:

> Edge verbs should be semantically clear; operational direction belongs in relation policy.

Every relation kind should declare:

- canonical sentence, e.g. `{source} verifies {target}`,
- inverse display sentence,
- whether it participates in visible graph display, export trace, staleness, reconciliation, criteria help, or weak suggestion flows,
- what happens when the source changes,
- what happens when the target changes.

Code should not infer reconciliation behavior from raw edge direction. Direct edit and hard-impact cascade should enumerate incident accepted edges and ask relation policy which opposite endpoint, if any, receives a `reconciliation_need`.

The contrastive-kernel strategy may also drive a further expanded ontology. Kernel questions naturally surface artifacts such as `alternative`, `question`, `ambiguity`, `candidate`, and rejected option records. Example: a containment/topology question about deleting a parent has multiple alternatives; the user's answer chooses one, rejects others, and emits an invariant plus positive/negative examples. FE-700 should leave room for these artifacts, even if the first implementation represents some of them as examples, decisions, or proposal-local structures rather than durable top-level item kinds.

## Graph operations surfaced by the discussion

### Graph reconciliation

Repair-oriented.

Starts from a known disturbance or process obligation, such as an open `reconciliation_need` caused by an edit, semantic conflict, verifier result, or changed upstream item.

The reconciler's question is:

> Given this specific change or conflict, what existing graph truth needs to be repaired, confirmed, dismissed, or escalated?

Likely outputs:

- auto-confirm target still holds,
- auto-edit a target through the standard mutation path,
- mark need irrelevant / resolved,
- escalate to HITL because a semantic conflict requires judgment,
- open or regenerate downstream reconciliation needs.

This should stay tied to known coherence obligations. It should not become the umbrella term for all graph intelligence.

### Graph review / critique

Quality-oriented.

Can run on any intent graph, whether produced by drilldown, scenario generation, import, direct editing, or kernel elicitation.

The reviewer asks:

> If this graph is supposed to represent a good spec at its current maturity stage, where is it weak, thin, overconfident, under-supported, ambiguous, generic, uncheckable, or missing important structure?

Likely review dimensions:

- internal coherence,
- coverage,
- decision usefulness,
- tradeoff honesty,
- checkability,
- granularity,
- scenario fidelity,
- epistemic labeling,
- provenance strength,
- downstream usefulness.

A graph can have no reconciliation needs and still fail graph review.

## Candidate graph bundles

`scenarios-with-tradeoffs` introduces a unit that is not yet represented by today's canonical graph model: a speculative but coherent candidate world.

A candidate bundle should probably contain:

- scenario summary,
- intended maturity stage,
- tradeoff profile,
- generated items,
- generated edges,
- required core items,
- optional / swappable items,
- known risks,
- critic findings,
- provenance / epistemic labels,
- commit preconditions.

The branch's probe harness can help compare candidate bundles against drilldown-produced fixture specs before any product UI commits to this flow.

## Phase / maturity implication

`spec.phase` should be understood as a semantic maturity signal, not merely a positional route label. The frontend currently presents separate phase routes, but phase is better interpreted as a cumulative rating of the spec's evolution stage.

A strategy should therefore not merely "move the user to a phase." It should contribute evidence that the graph has reached a maturity bar.

Potential maturity signals:

- no blocking reconciliation needs,
- graph-review findings above an acceptable threshold,
- coverage across required item and edge families,
- enough checkable criteria,
- enough user-confirmed or strongly-supported provenance for high-impact claims,
- no blocking unresolved critique findings.

This creates useful distinctions:

- **coherent**: no known contradictions / open process debt,
- **complete enough**: covers the necessary semantic territory,
- **good enough**: specific, tradeoff-aware, checkable, and useful,
- **phase-mature**: meets the bar for the next projection / export stage.

## Product sequencing

The most desired product surfaces are likely:

1. first-turn strategy choice for a new chat / spec start,
2. a mid-interview "speed this up" / "show me strong options" affordance.

Engineering still needs part of `graph_review` to make scenario generation credible. `scenario_options` can be the first product-facing strategy while `graph_review` remains an internal oracle used to critique, repair, and score generated candidate bundles before they are shown or committed.

For mid-interview acceleration, the preferred shape is to branch into a new or reused side-chat / strategy chat rather than switching the primary interview chat in place. The side-chat branch can use the current graph and transcript as context, generate reviewed scenario options, and preserve the main interview frontier if the generated path disappoints or needs to be resumed later. This is likely more flexible than the current main-chat UX, which still assumes the original guided interview shape.

A scenario-options side-chat should receive a context pack rather than an unstructured full transcript dump. Minimum context includes the current spec name / mode, semantic maturity / phase, summarized user goal and context, accepted intent graph items, important edge neighborhoods, the current open frontier question if relevant, unresolved assumptions or low-confidence areas, and recent turns only when they explain user style or intent.

For the mid-interview "speed this up" use case, generated scenarios should default to **complete the current direction**: treat accepted graph truth as fixed premises and fill in plausible missing structure. A more radical "show alternatives that challenge prior assumptions" mode is feasible but deferred.

Scenario generation should present **2–3 options** with named tradeoff profiles rather than many variants. Each visible option should have a short name, scenario summary, key assumptions, what it optimizes for, what it gives up, confidence / review warnings, and `Use this` / `Revise` style actions. Internally, each option maps to a candidate graph bundle.

Candidate quality gates should be tiered by latency budget. Synchronous gates before display should be fast: parse validity, schema validity, coarse fixed-premise check, no obvious contradiction, and a present tradeoff summary. Deeper graph review — coverage, checkability gaps, provenance warnings, and repair/refinement — can run asynchronously after the user has something to read.

The existing observer-style async capture mechanism could generalize into an async semantic worker queue for capture / review / refine / repair. The product can show initial candidates while background graph-review proofing and optional repair improve their readiness.

Candidate readiness should distinguish clean acceptance from acceptance with represented problems. Useful statuses include `draft`, `reviewing`, `reviewed_clean`, `reviewed_with_issues`, and `blocked`. `reviewed_clean` can be accepted normally. `reviewed_with_issues` may be accepted if Brunch can durably represent the open problems, for example by opening an immediate follow-on graph-review turn or by creating appropriate problem records / `reconciliation_need` rows in the accepting changeset. `blocked` candidates cannot be accepted without repair or regeneration.

This preserves the reconciliation philosophy: imperfect graph states are allowed if their problems are explicit and durable, not hidden. When a candidate is accepted with open issues, Brunch should open or reuse a graph-review chat with a frontier turn that summarizes the remaining issues and asks what to address first. This keeps scenario comparison separate from problem repair, avoids polluting the primary interview, and reuses a long-lived review workbench.

Broader graph-review issues should start as turn-owned structured artifacts rather than a new table. `reconciliation_need` remains the only first-class problem table for now, scoped to coherence / staleness process debt caused by relation impacts. A generalized `graph_issue` or `problem` table is a future option if review findings need cross-chat querying, filtering, assignment, badges, or lifecycle independent of a turn.

## Why FE-705 matters to this direction

The `brunch agent` JSONL seam is a strategy test harness, not just a CLI.

It lets external probes:

- drive the current drilldown path headlessly,
- produce realistic completed-spec fixture candidates,
- preserve workspace state for curation,
- compare alternative generation / review strategies against known-good or semi-golden graphs,
- exercise Brunch-owned mutation authority rather than direct DB shortcuts.

This gives Brunch a way to evaluate strategy outputs before exposing them as product modes.

## Open questions for grilling

1. **Strategy selection** — Who chooses the strategy: user, system, or both? Can Brunch switch strategies midstream?
2. **User-facing mode names** — What does the user see: step-by-step interview, scenario options, targeted design cases, review for gaps? Or something else?
3. **Commit authority** — Which strategy outputs become canonical truth immediately, which become proposals, and which become candidate bundles?
4. **Candidate bundle boundary** — What makes a generated scenario bundle coherent enough to present? What makes it coherent enough to commit?
5. **Partial acceptance** — Do we ever allow item-level acceptance from a candidate graph? If so, how do we prove or maintain semantic closure?
6. **Graph review authority** — Does graph review only produce findings, or can it propose candidate changesets / revised bundles?
7. **Graph review bar** — What qualities matter beyond structural validity and absence of conflict?
8. **Reconciliation vs review boundary** — What exactly belongs to reconciliation, and what must stay in critique/review?
9. **Maturity model** — What evidence should count toward phase advancement for drilldown, kernel-driven, and scenario-generated specs?
10. **Kernel implementation boundary** — Are kernel cards configuration, prompts, code modules, or all three? What is the smallest useful kernel-card contract?
11. **Kernel ordering and composition** — When multiple kernels are active, who decides ordering and how are overlapping emitted artifacts deduplicated?
12. **Fixture evaluation** — What rubric determines whether a drilldown-produced spec is good enough to become a golden fixture?
13. **Strategy comparison** — What metrics or review process compare drilldown, kernel, and scenario outputs fairly?
14. **Changeset dependency** — Does `scenarios-with-tradeoffs` require a durable changeset / candidate graph model before productization, or can probes run with artifact-only bundles first?
15. **UI sequencing** — Should the first product surface be strategy choice at spec creation, a mid-interview assist, a graph-review button, or something else?
