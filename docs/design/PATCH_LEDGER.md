# Patch Ledger and Reconciliation

> Status: **historical design pressure** — retained for semantic mutation history, reconciliation bases, target ordering, and phase-two ledger rationale. Future-facing schema and operation vocabulary is **changeset/change**, not patch/patch_change; the consolidated runtime concept lives in [CONVERSATIONAL_WORKSPACE_RUNTIME.md](./CONVERSATIONAL_WORKSPACE_RUNTIME.md).
> Date: 2026-05-05.
> Scope: Brunch runtime product persistence, not the file-backed development registry explored elsewhere.

## How to read this after the changeset vocabulary shift

This document predates the final vocabulary choice. Treat it as an algorithm and rationale source, not as a naming authority.

| Historical wording here | Current wording / authority |
|---|---|
| `patch` | `changeset` — one atomic semantic mutation bundle. |
| `patch_change` | `change` — one atomic operation inside a changeset. |
| `caused_by_patch_id`, `resolved_by_patch_id` | Future changeset-backed cause/resolution fields; final column names should be chosen by the FE-701 changeset-ledger design. |
| Patch list / reconciliation review set | Historical review-surface framing. Current runtime synthesis routes proposals through proposal turns and accepted changesets. |
| Target ordering and reconciliation bases | Still useful algorithmic pressure. Preserve these concepts when implementing reconciliation threads or graph-review repairs. |

Do not introduce new schema, capability contracts, or operation ids with `patch` / `patch_change` unless deliberately referring to this historical design.

## Why this note exists

Brunch is moving from a single interview transcript toward an intent-graph workspace. A specification can now plausibly include:

- a primary guided interview
- side chats focused on one item or graph neighborhood
- observer captures from answered turns
- user-directed graph edits
- review-set accept / request-changes flows
- verifier or implementation feedback
- reconciliation passes after upstream meaning changes

The current persistence model still treats `turn` as the main historical spine: turns belong directly to a `specification`, and knowledge items are linked back to turns through `turn_knowledge_item`.

That works for an interview-led product, but it becomes strained once semantic changes can originate outside the primary conversation. The proposal here is to separate three authorities. The original wording used `patch`; current canonical vocabulary uses `changeset` / `change` for that middle authority:

```text
chat / turn:
  conversational provenance and replay

changeset / change:
  semantic mutation history for the intent graph

reconciliation_need:
  semantic debt created when a change may affect existing graph truth
```

The intent graph remains the current semantic truth. The changeset ledger records how that truth changed. Reconciliation records what may now need renewed judgment.

## Current Shape

The current schema has these relevant tables:

```text
specification
  id
  active_turn_id

turn
  id
  specification_id
  parent_turn_id
  phase
  turn_kind
  user_parts
  assistant_parts

knowledge_item
  id
  specification_id
  kind
  content
  rationale

turn_knowledge_item
  turn_id
  item_id
  relation

knowledge_edge
  from_item_id
  to_item_id
  relation
```

This means:

- one specification can have many turns, but no durable chat container
- turn ancestry is global inside a specification rather than scoped to a chat
- knowledge provenance is turn-centered
- semantic dependencies live in `knowledge_edge`
- there is no durable representation of semantic mutations as first-class events
- there is no durable representation of pending semantic reconciliation

## Proposed Concepts

`docs/design/MULTI_CHAT.md` is now the concrete phase-one substrate reference for chat containers and reconciliation needs. This document remains the deeper design pressure for future semantic mutation history, richer reconciliation targeting, ordering, and changeset-backed provenance.

### Chat

A `chat` is a conversation container inside a specification.

It should not own semantic truth. It owns conversational context, transcript replay, and local interaction focus.

Examples:

- the primary interview chat
- a side chat about one knowledge item
- a side chat about a graph neighborhood
- a reconciliation chat for an open set of reconciliation needs
- a verifier or implementation feedback chat

Proposed table:

```text
chat
  id
  specification_id
  kind
  title
  status
  created_at
  updated_at
```

The concrete phase-one `chat` shape is intentionally narrower in [Multi-Chat Substrate](./MULTI_CHAT.md): add `chat`, nullable `turn.chat_id`, `specification.primary_chat_id`, and mirrored `chat.active_turn_id` while keeping legacy `turn.specification_id` and `specification.active_turn_id` during transition. The richer fields above are possible later extensions, not requirements for the first slice.

Suggested enums:

```text
kind:
  primary
  side
  reconciliation
  review
  verifier

status:
  active
  archived
```

The schema should support a primary chat, but should not require the product model to have exactly one primary chat. A specification can have many chats, and those chats can all produce semantic mutations. "Primary" is a useful label for today's interview-led flow, not a permanent ontology constraint.

`turn.chat_id` should become the canonical ownership pointer. `turn.specification_id` can either be removed eventually or retained as a denormalized convenience with an invariant that it matches `chat.specification_id`.

Focus fields should be deferred. A chat may eventually focus on one item, one relation, several reconciliation needs, or a graph neighborhood. That likely wants a later `chat_focus` table rather than early nullable columns on `chat`.

### Turn semantic-state anchor

A turn should know the semantic state that preceded it. Historical examples below say `patch`; current implementations should read this as a changeset or semantic-revision anchor.

Proposed addition, in this document's historical vocabulary:

```text
turn
  chat_id
  preceding_patch_id
```

Read `preceding_patch_id` as `preceding_changeset_id` if the FE-701 schema adopts changeset naming. The field points to the latest applied semantic mutation bundle known to the chat at the moment the turn was created. This gives Brunch a durable historical anchor for reviving old chat threads.

Example:

```text
Chat C7 last had a turn after Changeset C12.
Elsewhere, C13-C18 changed the intent graph.
The user returns to C7.
The new turn can inject context:
  "Since the last turn in this chat, these semantic changes happened elsewhere..."
```

This is especially important once multiple chats can mutate one specification. Without a semantic-state anchor, a dormant side chat can accidentally continue from an obsolete semantic worldview.

If the changeset ledger is deferred, this field should also be deferred unless Brunch introduces a lightweight semantic revision/checkpoint first. Avoid adding a dangling nullable semantic-history pointer before there is a real changeset or revision concept to point at.

### Patch *(historical name; now changeset)*

A `patch` in this document means what current docs call a `changeset`: a semantic mutation set against the intent graph.

It is not a workflow event and should not answer questions like "what phase is the user in?" It answers questions like:

- what changed?
- why did it change?
- what produced the change?
- what previous semantic state did it replace?
- what downstream graph truth may now be stale?

Proposed table, in historical naming:

```text
patch                # current name: changeset
  id
  specification_id
  provenance_json
  initiator_chat_id
  initiator_turn_id
  status
  summary
  created_at
  applied_at
  superseded_at
```

Suggested enums:

```text
status:
  proposed
  applied
  superseded
  reverted
```

Provenance may want to be a discriminated JSON value rather than only an enum plus nullable foreign keys:

```typescript
type ChangesetProvenance = // historical draft name: PatchProvenance
  | { kind: 'turn'; turn_id: number; chat_id: number; capture_kind?: 'observer_capture' | 'review_acceptance' }
  | { kind: 'user_direct_edit'; chat_id?: number; actor_id?: string }
  | { kind: 'reconciliation_acceptance'; chat_id?: number; review_set_id?: number }
  | { kind: 'verifier_result'; verifier_run_id: string }
  | { kind: 'import'; source: string }
  | { kind: 'migration'; migration_id: string };
```

This keeps provenance extensible without adding nullable columns for every initiator shape. The relational columns `initiator_chat_id` and `initiator_turn_id` may still be useful as indexed convenience fields, but they should mirror `provenance_json`, not become a second provenance truth.

`observer_capture` is usually initiated by a chat turn, but changeset provenance should not collapse to "chat turn." A turn can initiate a changeset; it is not the changeset.

### Patch vs Change Naming *(resolved)*

The proposed model has two levels:

```text
semantic mutation set:
  one user/agent/verifier action as an atomic unit

atomic mutation:
  one add/update/link/unlink/retire operation inside that unit
```

The naming choice was still open when this document was written:

```text
Option A:
  patch
  patch_change

Option B:
  changeset
  change
```

That choice is now resolved in favor of `changeset` / `change` because it avoids overloading "patch" with source-control connotations and because "change" naturally names the atomic unit. Under that naming:

```text
changeset:
  id, specification_id, provenance_json, status, summary, timestamps

change:
  id, changeset_id, operation, target_kind, target_id, before_json, after_json
```

The design question is not the word. The invariant is that Brunch needs an atomic semantic mutation set containing one or more atomic changes. The current canonical naming is `changeset` / `change`.

### Patch Change *(historical name; now change)*

A `patch_change` in this document means what current docs call a `change`: one operation inside a changeset.

Proposed table, in historical naming:

```text
patch_change         # current name: change
  id
  patch_id           # current name: changeset_id
  operation
  target_kind
  target_id
  before_json
  after_json
```

Suggested enums:

```text
operation:
  add
  update
  split
  merge
  retire
  link
  unlink
  verify
  invalidate

target_kind:
  knowledge_item
  knowledge_edge
  property
  example
  criterion
  reconciliation_need
```

`before_json` and `after_json` keep the first implementation practical. Later, high-volume or high-value targets can move to more normalized shape if needed.

### Reconciliation Need

A `reconciliation_need` is a durable mark that existing semantic truth may require renewed judgment because something changed.

It is intentionally separate from `knowledge_edge`.

`knowledge_edge` says something about intent semantics:

```text
item A depends_on item B
criterion C verifies requirement R
decision D constrains requirement R
```

`reconciliation_need` says something about process debt:

```text
item B changed, so item A may need review
changeset C changed an older premise, so later descendants may need coherence review
verifier V invalidated criterion C, so requirement R may need review
```

Proposed table:

```text
reconciliation_need
  id
  specification_id
  source_item_id
  target_item_id
  kind
  status
  reason
  caused_by_turn_id
  caused_by_patch_id    # historical placeholder; current concept: caused_by_changeset_id
  created_at
  resolved_at
```

Suggested enums:

```text
kind:
  supersedes
  needs_confirmation

status:
  open
  resolved
```

This deliberately keeps phase one smaller than the fully expressive model. The first table should represent one directed process obligation from a changed source item to an affected target item, dedupe simultaneously open needs by `(source_item_id, target_item_id, kind)`, and carry enough nullable provenance to be changeset-compatible later.

Future extensions can add:

```text
basis / strength
source_patch_id        # current concept: source_changeset_id
affected_relation_from_item_id
affected_relation_to_item_id
affected_relation
resolved_by_patch_id    # current concept: resolved_by_changeset_id
structured reason payload
```

The `affected_relation_*` fields avoid requiring a separate `knowledge_edge.id` migration before this work can start. If `knowledge_edge` later receives a surrogate `id`, `reconciliation_need` can switch to `affected_edge_id`.

`resolved_at` exists in phase one because no-op dismissal and non-changeset resolution are useful before the changeset ledger exists. Once changeset-backed resolution is available, the timestamp may remain denormalized convenience rather than the only resolution source of truth.

## Reconciliation Bases

### Semantic Dependency

Semantic dependency is graph-based.

Example:

```text
Assumption A12 changes.
Relation traversal finds Requirement R4, Decision D7, Invariant I3, and Criterion C9.
Reconciliation needs are created for those affected items.
```

The warrant is an existing semantic relation such as `depends_on`, `derived_from`, `constrains`, `verifies`, or `refines`.

These needs should usually be strong:

```text
strength = needs_reconciliation
```

### Historical Descendance

Historical descendance is chronology-based.

Example:

```text
The user directly edits Knowledge Item K4.
K4 was last updated by Changeset C12.
Later changesets C13-C31 created or updated nearby items from a context that may no longer hold.
Those later descendants receive soft reconciliation needs.
```

The warrant is not a known semantic dependency. It is a coherence suspicion caused by editing an older premise after later work already built on the previous state.

These needs should usually be soft:

```text
strength = may_need_reconciliation
```

Historical descendance should be grouped carefully in the UI. It can get noisy if Brunch turns every later item into an urgent individual task.

### Verification Dependency

Verification dependency is evidence-based.

Example:

```text
A verifier result invalidates Criterion C5.
Requirement R2 is linked to C5 through verifies.
R2 receives a reconciliation need because its evidence no longer holds.
```

This may be strong or soft depending on whether the invalidated artifact was the only witness for the affected claim.

## Reconciliation Flow

Reconciliation should enter the product as an agent-managed review process.

The user experience should resemble the existing review-set flow:

```text
agent attempts reconciliation
  -> if changes are low-conflict, prepare proposed changes
  -> if semantic conflict or contradiction is detected, ask the user to resolve it
  -> present a reviewable set of reconciliation changes
  -> user accepts or comments / requests changes
  -> agent revises and presents the set again
  -> accepted changes are applied as a changeset
```

The important difference from ordinary review sets is the agent's first move. Reconciliation should not immediately push every stale item to the user. The agent should attempt to repair, dismiss, or consolidate needs itself when the graph context is sufficient.

Human review is required when reconciliation crosses a semantic decision boundary:

- two accepted claims now contradict each other
- an upstream edit invalidates a downstream commitment rather than merely requiring wording updates
- multiple plausible repairs imply different product intent
- a requirement, criterion, invariant, or example would need to be weakened
- the agent cannot distinguish "update this item" from "retire this branch of intent"

In those cases, the reconciliation turn should ask for the smallest disambiguating judgment needed, then return to the review-set loop.

Proposed flow:

```text
1. A semantic change is applied or proposed.
2. Deterministic traversal creates reconciliation needs.
3. Brunch collects unresolved reconciliation needs.
4. Brunch groups needs by affected target.
5. Brunch sorts needs within each target by source, basis, and strength.
6. Brunch sorts affected targets topologically so upstream repairs happen before downstream repairs.
7. Brunch groups the ordered targets into a reconciliation review set.
8. An agent proposes one of:
   - no change needed
   - update affected item
   - retire affected item
   - split affected item
   - add clarifying edge or example
   - ask the user a disambiguating question
9. The user accepts or requests changes.
10. Accepted reconciliation emits a new changeset.
11. The accepted changeset resolves, dismisses, or supersedes the needs.
```

This mirrors review-set ergonomics without pretending reconciliation is the same as requirements or criteria review.

The loop should support revision:

```text
reconciliation review set v1
  -> user requests changes with comments
  -> agent creates revised review set v2
  -> user accepts
  -> accepted reconciliation changeset is applied
```

Rejected or superseded reconciliation proposals should remain explainable provenance, but only accepted reconciliation should mutate the intent graph.

### Target Ordering

Reconciliation should operate on targets, not individual needs. A target can be a knowledge item, a knowledge relation, or eventually another semantic record such as an example or property.

The target planner should:

```text
collect unresolved needs
group by affected target
sort needs within target by:
  1. strength
  2. basis
  3. source item / source changeset
  4. creation time
build an affected-target graph from semantic relations
collapse cycles into strongly connected components
topologically sort components from upstream cause toward downstream dependents
process each component as one reconciliation unit
```

Direction matters. If `Requirement R` depends on `Assumption A`, and `A` changes, reconciliation should process `A`'s direct dependents before items that depend on those dependents. In other words, work down the dependency tree from changed source toward derived consequences.

Cycles should not block reconciliation. They should be collapsed into a single unit and presented as a coupled coherence problem.

If an accepted reconciliation changeset changes an upstream target, downstream needs may become superseded or may need to be regenerated from the new changeset. The reconciliation loop should therefore treat topological ordering as a work plan, not as a guarantee that one pass resolves every downstream target.

## Can This Be Split Into Two Phases?

Yes, with one caveat: phase one should make `reconciliation_need` future-compatible with changesets even if the `changeset` table does not exist yet.

The split is plausible because `chat` and `reconciliation_need` each relieve a current architectural pressure independently:

- `chat` creates the missing conversation container below `specification`
- `reconciliation_need` creates a product-visible place for staleness and coherence work
- `changeset` later upgrades provenance from turn-centered or event-centered records into a true semantic mutation ledger

The caveat is that historical descendance is only approximate before changesets exist. Brunch can detect graph-based semantic dependency in phase one. It cannot precisely answer "which later semantic mutations descend from this older state?" until changeset history exists.

## Phase 1: Multi-Chat Substrate and Reconciliation Need

Goal:

```text
Allow multiple chats per specification and introduce durable reconciliation needs without requiring the full changeset ledger.
```

Schema work:

- follow [Multi-Chat Substrate](./MULTI_CHAT.md) for the concrete migration sequence
- add `chat`
- backfill one interview chat per existing specification
- add nullable `turn.chat_id`
- backfill all existing turns to the interview chat for their specification
- add `specification.primary_chat_id`
- mirror `specification.active_turn_id` into `chat.active_turn_id`
- update application writes so new turns populate both `specification_id` and `chat_id`
- add minimal `reconciliation_need`

Compatibility rules:

- keep `turn.specification_id` during phase one to reduce blast radius
- enforce in application code that `turn.specification_id === chat.specification_id`
- keep `specification.active_turn_id` during phase one
- scope `parent_turn_id` to the same chat in application logic
- create reconciliation needs from semantic dependency traversal first
- defer dropping legacy pointers until read/write paths are stable through chat ownership

Phase-one reconciliation causes:

```text
caused_by_turn_id = the turn whose observer capture or review action caused the need
caused_by_patch_id = null  # historical placeholder for future changeset-backed provenance
```

`caused_by_kind` is intentionally omitted in the concrete phase-one schema while changesets do not exist: `caused_by_turn_id` names turn-caused needs, and the historical `caused_by_patch_id` placeholder should be read as future changeset-backed provenance.

Phase-one limitations:

- no exact before / after semantic diff
- no exact changeset chronology
- no reliable historical descendance beyond turn-linked provenance heuristics
- reconciliation can identify affected items, but cannot yet provide a full mutation audit

This is acceptable if phase one frames reconciliation as "needs review" rather than as a complete semantic ledger.

Phase-one implementation slices:

1. Add schema and migration for `chat`.
2. Backfill interview chats and wire `turn.chat_id` on reads and writes.
3. Add invariants/tests for chat-scoped turn ancestry.
4. Add `reconciliation_need` schema and shared types.
5. Add deterministic helper to create needs from changed item plus `knowledge_edge` traversal.
6. Surface a minimal reconciliation queue in data loaders or development fixtures.

## Phase 2: Changeset Ledger *(formerly Patch Ledger)*

Goal:

```text
Make semantic mutations first-class and use changesets as the source of reconciliation cause, audit, and historical descendance.
```

Schema work, translated to current vocabulary:

- add `changeset`
- add `change`
- add changeset-backed cause/resolution foreign keys if they were not enforced in phase one
- optionally add `knowledge_item.last_changeset_id`
- optionally add `knowledge_edge.last_changeset_id` or give edges surrogate ids

Application work:

- route observer capture through changeset creation
- route accepted review outputs through changeset creation
- route direct user edits through changeset creation
- route reconciliation acceptance through changeset creation
- derive `turn_knowledge_item` as provenance compatibility or keep it as a secondary projection
- use changeset chronology for historical descendance

Changeset application invariant:

```text
Every semantic change to knowledge graph truth is represented by exactly one applied change inside one applied changeset.
```

That invariant should eventually replace "every knowledge item traces to a turn" as the semantic-history rule.

Changeset history should make revision counts and previous values straightforward:

```text
revision count for item K:
  count applied change rows where target_kind = knowledge_item and target_id = K

change history for item K:
  applied change rows for K ordered by changeset.applied_at, including before_json and after_json
```

The same should hold for knowledge relations. That creates an important schema pressure: `knowledge_edge` needs stable identity if edge revision history is first-class. A composite key can identify the current relation, but it is awkward for history when a relation's source, target, or type changes. Before changeset history becomes authoritative for edges, Brunch should either:

- add a surrogate `knowledge_edge.id`
- or replace `knowledge_edge` with a stable relation record table

Until then, relation reconciliation can target composite relation coordinates, but relation revision history will be less clean than item revision history.

## Migration Strategy

### Existing Turns

Backfill:

```text
for each specification:
  create chat(kind = primary, title = "Primary interview")
  assign all existing turns for that specification to the new chat
```

The existing `turn.parent_turn_id` chain remains valid if all current turns in a specification belong to the primary chat.

### Existing Knowledge Provenance

In phase one, keep `turn_knowledge_item` unchanged.

In phase two, create migration changesets only if the audit value is worth the complexity. A low-risk path is:

```text
one migration changeset per specification:
  provenance_json = { kind: "migration", migration_id: "changeset-ledger-backfill" }
  summary = "Backfilled existing knowledge graph before changeset ledger introduction"
```

This avoids inventing fake historical changesets for every old observer capture.

### Existing Knowledge Edges

Keep composite primary keys for phase one.

If reconciliation needs frequently target relations, phase two should consider adding a surrogate `knowledge_edge.id`. Until then, relation targets can be represented by:

```text
affected_relation_from_item_id
affected_relation_to_item_id
affected_relation
```

### Existing Active Turn Pointer

`specification.active_turn_id` can survive phase one.

Phase one adds:

```text
specification.primary_chat_id
chat.active_turn_id
```

`primary_chat_id` names the canonical interview chat; `chat.active_turn_id` mirrors the existing specification head before it becomes canonical. A separate `active_chat_id` should wait until the product has multiple active chat surfaces. Adding it too early may create unnecessary state synchronization work.

## Invariants

Phase one invariants:

- every turn belongs to exactly one chat
- every chat belongs to exactly one specification
- a turn's chat belongs to the same specification as the turn
- `parent_turn_id`, when present, points to a turn in the same chat
- every reconciliation need belongs to one specification
- a reconciliation need's affected item or affected relation belongs to the same specification
- `caused_by_turn_id`, when present, points to a turn in the same specification
- the changeset-backed cause field remains null until changeset tables exist

Phase two invariants:

- every semantic graph mutation is represented by an applied change
- every changeset belongs to one specification
- every change belongs to one changeset
- every changeset target belongs to the same specification as the changeset
- every changeset has exactly one provenance kind
- a changeset may have chat or turn provenance, but does not require it
- hard reconciliation needs must name a concrete affected item or relation
- resolved reconciliation needs should name the changeset that resolved or dismissed them when resolution changes graph state

## Practical Recommendation

Do phase one first.

The split is worthwhile because `chat` is a clear foundation for multi-conversation workspaces, and `reconciliation_need` is a useful product concept even before full semantic changeset history exists.

But phase one should be honest about its limits:

- it can support graph-based reconciliation well
- it can support soft, heuristic coherence review
- it cannot fully support historical descendance until changesets exist
- it should not imply a complete audit trail

The safest phase-one framing is:

```text
Introduce chat containers and reconciliation queues.
Keep turn-centered provenance for now.
Design reconciliation causes so changeset-backed provenance can replace turn-backed provenance later.
```

Then phase two becomes an upgrade of semantic provenance, not a rewrite of the reconciliation product model.

## Open Questions

- Should `turn.specification_id` be removed eventually, or kept as a denormalized convenience?
- Should `specification.active_turn_id` be removed as soon as `chat.active_turn_id` is stable, or kept as a temporary compatibility mirror?
- Should `chat.kind = reconciliation` own one reconciliation review set, or can one reconciliation chat cover multiple sets?
- Should direct user edits create proposed changesets first, or applied changesets with later reconciliation?
- Should `knowledge_edge` receive a surrogate `id` before reconciliation targets relations heavily?
- What is the first deterministic relation policy for creating reconciliation needs from `knowledge_edge` traversal?
- How noisy is historical descendance in realistic workspaces, and should it be grouped by changeset rather than item?
