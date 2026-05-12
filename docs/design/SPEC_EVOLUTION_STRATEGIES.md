# Spec Evolution Strategies

> Status: **design RFC — graduated into `memory/SPEC.md` / `memory/PLAN.md`**.
> Date: 2026-05-12.
> Scope: chat-local strategies for advancing a Brunch specification's intent graph from vague user intent toward phase-mature, reviewable semantic truth.
>
> Related docs: [`AGENT_MUTATION_SURFACE.md`](./AGENT_MUTATION_SURFACE.md), [`BEHAVIORAL_KERNELS.md`](./BEHAVIORAL_KERNELS.md), [`INTENT_GRAPH_SEMANTICS.md`](./INTENT_GRAPH_SEMANTICS.md), [`MULTI_CHAT.md`](./MULTI_CHAT.md), [`PATCH_LEDGER.md`](./PATCH_LEDGER.md).

## Problem

The current interviewer is grounded but slow. It uses a design-decision-tree drilldown strategy: ask phase-shaped questions, walk down the user's design tree, and gradually accumulate enough shared understanding for requirements and criteria. That produces high-provenance intent graph truth, but early users notice the question burden quickly.

Brunch needs alternative spec-evolution strategies that reduce user burden without weakening the graph into plausible but incoherent generated prose. The FE-705 `brunch agent` / probe-harness branch is therefore not only a CLI feature; it is the first practical strategy test harness. It lets external probes drive the real Brunch lifecycle, generate drilldown-based completed-spec fixtures, and compare alternative strategy outputs before committing product UI.

## Core model

A **strategy** is a chat-local policy for advancing semantic state. It decides:

- what context it reads,
- what question / offer / candidate artifact it produces,
- what output unit it treats as coherent,
- what authority it has to commit graph truth,
- what review or validation must happen before commit,
- what evidence it contributes toward semantic maturity / phase advancement.

A strategy is not specification-level semantic truth. In the multi-chat model, one specification can have many chats, each with its own strategy and resumable context.

A Brunch `turn` is assistant/system-first: the assistant/system asks, offers, proposes, or reports something; the user response completes the bundle. Observer/runtime assessment reads the whole bundle, because the assistant/system part gives the user's response its meaning.

A chat should have at most one open frontier turn. In normal operation, every active/resumable chat should have one open frontier turn, even if it is a scripted frontier such as the first offer in a side-chat. If a chat has no open turn, focusing it may generate a continuation frontier based on chat strategy, chat kind, latest semantic maturity / `phase`, and staleness.

## Strategy taxonomy

### Step-by-step drilldown

Current default. The interviewer asks phase-shaped questions at increasing detail until shared understanding is sufficient.

- **Strength:** high provenance; each claim is supported by user answers.
- **Weakness:** long and user-burdensome.
- **Commit shape:** incremental canonical changesets after ordinary turn observation / review.

### Scenario options

Low-friction strategy for impatient, under-informed, or underspecified users. Brunch asks enough to identify the product/use-case typology, then generates 2–3 coherent candidate graph bundles with named tradeoff profiles.

- **Strength:** users react to concrete options rather than authoring the whole design.
- **Weakness:** one-shot generation can produce plausible but generic, contradictory, or unsupported graph structure.
- **Commit shape:** candidate graph bundles, accepted cleanly or accepted with explicit open issues.

### Targeted cases

Kernel-driven contrastive elicitation from [`BEHAVIORAL_KERNELS.md`](./BEHAVIORAL_KERNELS.md). The interviewer detects active behavioral kernels and asks concrete divergent cases whose classifications emit typed artifacts directly.

- **Strength:** lower-friction than drilldown, more grounded than whole-spec generation.
- **Weakness:** needs kernel cards, artifact schemas, validators, ordering, and cross-kernel deduplication.
- **Commit shape:** validated kernel artifacts such as decisions, invariants, examples/counterexamples, criteria, and typed edges.

### Graph review

Quality-oriented critique that can run over any graph, whether drilldown-created, scenario-generated, imported, or edited.

- **Question:** where is this graph weak, thin, overconfident, unsupported, ambiguous, generic, uncheckable, or missing structure?
- **Commit shape:** findings start as turn-owned structured artifacts; accepted repairs may later apply changesets.

### Graph reconciliation

Repair-oriented process over known disturbance or process debt such as open `reconciliation_need` rows.

- **Question:** given this specific change/conflict, what existing graph truth must be repaired, confirmed, dismissed, or escalated?
- **Commit shape:** changesets that edit items/edges and/or resolve/open reconciliation needs.

### Topology-driven targeting

Internal targeting machinery, not a user-facing strategy for now. Once a graph exists, Brunch can rank next questions, reviews, or repairs by topology: high-fanout low-confidence assumptions, decisions without rejected alternatives, criteria without targets, conflicting constraints, etc.

## Semantic history and proposal turns

Turns are conversational provenance and replay. They should not remain the only historical spine once multiple chats, direct edits, review passes, verifier feedback, and candidate bundles can mutate graph truth.

The future semantic spine is the **changeset ledger**:

```text
changeset:
  one atomic semantic mutation set

change:
  one atomic add/update/link/unlink/retire/etc. inside the changeset
```

A changeset mutates a specification from one semantically / structurally valid graph state to another, including any `reconciliation_need` rows opened or resolved by that mutation. The data changes and changeset record must succeed or fail together. The changeset boundary is the smallest atomic unit that preserves semantic coherence: if applying only half the mutation would leave the graph incoherent, it belongs in one changeset.

A graph-review finding, candidate proposal, or reconciliation suggestion is not itself a changeset until accepted or acted on. It is the assistant/system half of an open frontier turn. The turn completes when the user responds, and only then may the runtime apply a changeset.

Proposal turns should share a small normalized completion vocabulary:

- `accept` — authorize the proposal; may apply a changeset.
- `reject` — decline without semantic mutation; narrow because rejection can leave or create process debt.
- `revise` — request a new coherent proposal; maps to labels like "Request changes".
- `ask_followup` — ask for explanation before deciding.
- `defer` — intentionally park the matter.
- `regenerate` — recreate the offer, especially when stale or low-quality.

Only `accept` applies a proposal turn's semantic changeset. Other proposal actions may create process metadata or successor turns, but should not directly mutate intent graph truth. If a no-edit outcome resolves process debt, model it as accepting a proposal whose changeset resolves the relevant need.

Proposal/finding artifacts should start as turn-owned structured assistant parts. A standalone proposal or proposed-changeset model should wait until batch review, assignment, expiry, cross-chat surfacing, or independent proposal lifecycle demands it.

When a turn opens, it should stamp the latest applied changeset id for the specification — for example `turn.opened_at_changeset_id` or `turn.base_changeset_id`. This is not provenance; it is the graph revision the assistant/system offer was based on. First-cut staleness is conservative: if a turn remains open while `specification.latest_changeset_id` advances, the open offer is considered stale and the product offers regeneration / refresh rather than neighborhood-level diffing.

## Direct editing

Direct editing is a sibling mutation path, not proposal revision.

In explicit edit mode, the user may make pending direct changes to one or more intent items. When they exit/apply edit mode, Brunch computes affected incident edges and opens required `reconciliation_need` rows under relation policy; direct item changes and reconciliation needs commit together in one changeset. Direct editing is safe because incoherence risk becomes explicit process debt, not because arbitrary edits are forbidden.

Review-set direct edits have a special consequence. If the user directly edits proposed review-set items, accepting the review set as-is is no longer valid. `accept` should be disabled; `request changes` becomes a reconciliation-oriented action such as `request reconciliation`. The edited candidate/review set must be reconciled before it can become canonical truth.

## Relation directionality

The current `knowledge_edge` relation names mix directionality. `depends_on` and `derived_from` naturally read downstream-to-upstream; `constrains` and `verifies` often read upstream-to-downstream or evidence-to-claim. That becomes risky once edges drive reconciliation.

FE-700 may break existing relation names/records while expanding the ontology, but forcing every useful edge verb into one dependency direction risks distorting the graph around one operation. The graph must serve display, prompt context, export trace, requirements projection, reconciliation, critique, verification, candidate generation, and explanation.

Rule:

> Edge verbs should be semantically clear; operational direction belongs in relation policy.

Every relation kind should declare:

- canonical sentence, e.g. `{source} verifies {target}`,
- inverse display sentence,
- graph-display / export / staleness / reconciliation / criteria-help / weak-suggestion participation,
- what happens when source changes,
- what happens when target changes.

Code should not infer reconciliation behavior from raw edge direction. Direct edit and hard-impact cascade should enumerate incident accepted edges and ask relation policy which endpoint, if any, receives a `reconciliation_need`.

Contrastive kernels may pressure a further ontology expansion. Kernel questions naturally surface artifacts such as `alternative`, `question`, `ambiguity`, `candidate`, and rejected options. FE-700 should leave room for these artifacts, but the first implementation can represent them as examples, decisions, constraints, or proposal-local structures until durable top-level kinds prove necessary.

## Candidate graph bundles

`scenario_options` produces speculative but coherent candidate worlds, not loose item lists. A candidate bundle should contain:

- short name and scenario summary,
- intended maturity stage,
- tradeoff profile,
- generated items and edges,
- required core items,
- optional/swappable items,
- known risks,
- graph-review findings,
- provenance / epistemic labels,
- commit preconditions.

User review should be bundle-level by default: `Use this`, `Revise`, `Regenerate`, or ask follow-up. Arbitrary item-level pick-and-choose risks incoherence. Partial acceptance is only safe when the accepted subset is semantically closed or the system brings along required supporting items/edges.

Candidate readiness should distinguish clean acceptance from acceptance with represented problems:

- `draft` — generated but not checked,
- `reviewing` — background review running,
- `reviewed_clean` — acceptable normally,
- `reviewed_with_issues` — acceptable only if open issues become durable,
- `blocked` — cannot be accepted without repair/regeneration.

`reviewed_with_issues` can still be accepted if Brunch durably represents the problems, for example by opening a follow-on graph-review frontier turn or by creating appropriate problem records / `reconciliation_need` rows in the accepting changeset. Imperfect graph states are allowed if their problems are explicit and durable, not hidden.

Broader graph-review issues should start as turn-owned structured artifacts. `reconciliation_need` remains the only first-class problem table for now, scoped to coherence / staleness process debt caused by relation impacts. A generalized `graph_issue` / `problem` table is a future option if review findings need cross-chat querying, filtering, assignment, badges, or lifecycle independent of turns.

## Product sequencing

The most desired product surfaces are:

1. first-turn strategy choice for a new chat/spec start,
2. a mid-interview "speed this up" / "show me strong options" affordance.

Engineering still needs part of `graph_review` to make scenario generation credible. `scenario_options` can be the first product-facing strategy while graph review remains an internal oracle used to critique, repair, and score generated bundles before they are committed.

For mid-interview acceleration, branch into a new or reused side-chat / strategy chat rather than switching the primary interview chat in place. The side-chat branch receives a context pack — not a raw transcript dump — containing spec identity, maturity/phase, summarized goal/context, accepted graph truth, important edge neighborhoods, current frontier question if relevant, unresolved assumptions, and recent turns only when they explain user style or intent.

The first `speed this up` mode should **complete the current direction**: treat accepted graph truth as fixed premises and fill in plausible missing structure. A more radical "show alternatives that challenge prior assumptions" mode is feasible but deferred.

Scenario generation should present 2–3 options with named tradeoff profiles. Candidate quality gates should be latency-tiered:

- fast synchronous gates before display: parse validity, schema validity, coarse fixed-premise check, no obvious contradiction, and tradeoff summary present;
- async gates after display: deeper graph review, coverage, checkability gaps, provenance warnings, repair/refinement.

The existing observer-style async capture mechanism could generalize into an async semantic worker queue for capture / review / refine / repair. Users can read initial candidates while background review improves readiness. If a candidate is accepted with open issues, Brunch should open or reuse a graph-review chat with a frontier turn summarizing remaining issues and asking what to address first.

## Concern map and dependencies

### Semantic substrate — highest coordination

Owns ontology expansion, relation policy directionality, changeset/change ledger, `turn.opened_at_changeset_id`, `specification.latest_changeset_id`, chat-local strategy metadata, and one-open-frontier-per-chat invariants.

Likely areas: `src/server/schema.ts`, `src/server/db.ts`, `src/server/knowledge-relationship-policy.ts`, future changeset modules, [`INTENT_GRAPH_SEMANTICS.md`](./INTENT_GRAPH_SEMANTICS.md), [`PATCH_LEDGER.md`](./PATCH_LEDGER.md).

Sequential dependencies: relation policy before robust reconciliation/direct-edit cascade; changesets before productized candidate acceptance; turn staleness depends on latest changeset tracking.

### Strategy / proposal artifacts — parallelizable

Owns candidate bundle shapes, graph-review finding shapes, proposal turn artifacts, candidate statuses, and normalized proposal responses.

Likely areas: `src/server/parts.ts`, `src/server/turn-artifacts.ts`, a possible `strategy-artifacts` module, context packs, prompt scenarios.

Can start before durable changesets if artifacts remain turn-owned and do not commit canonical truth.

### Graph-review oracle — supports scenario options

Owns review rubric, graph critique prompt, candidate quality gates, accept-with-issues semantics, and follow-on review turns.

Likely areas: new graph-review prompt/context pack, `src/server/scenario-runner.ts`, `scripts/agent-probes/`.

Can run probe-only before product UI; needs enough FE-700 ontology/relation policy to be meaningful.

### Scenario-options strategy — first product-facing acceleration

Owns 2–3 candidate bundles, tradeoff summaries, fast validation, async review/refine/repair handoff, and clean/with-issues acceptance.

Likely areas: `src/server/prompts/candidate-spec-system.md`, `src/server/context-pack/candidate-spec.ts`, scenario runner/probe harness, later side-chat UI.

Depends on graph-review minimum oracle and, for canonical acceptance, changeset ledger.

### Async semantic workers — staged infrastructure

Own capture / review / refine / repair background work. Can begin as observer-style in-process tasks before durable queue tables exist.

### Reconciliation / direct edit — adjacent but distinct

Owns edit mode, affected-edge enumeration, relation-policy-driven `reconciliation_need` creation, reconciliation chat behavior, and review-set request-reconciliation behavior.

Likely areas: `src/server/edit-impact.ts`, `src/server/edit-route.ts`, `src/server/reconciliation-need.test.ts`, side-chat/patch-list UI.

Depends on relation-policy directionality; eventually depends on changesets for atomic direct-edit history.

## FE-705 implication

The `brunch agent` JSONL seam is a strategy test harness:

- drive current drilldown headlessly,
- produce completed-spec fixture candidates,
- preserve workspace state for curation,
- compare strategy outputs against known-good or semi-golden graphs,
- exercise Brunch-owned mutation authority rather than direct DB shortcuts.

This lets Brunch evaluate strategy outputs before exposing them as product modes.
