# Multi-Chat Substrate — Design Spec

> Output of brainstorm session 2026-05-05 with Lu. First phase of the larger intent-graph evolution synthesised in `memory/SPEC.md` (turn-spine vs patch-ledger). Substrate-only: data model, relationships, migrations. Reconciliation-agent loop, side-chat UI changes, and the full patch ledger (A71) are deliberately out of scope.
>
> Status: **proposed** — pending review before transitioning to an implementation plan.

## 1. Concept & problem

Today every turn anchors directly to a `specification`, and a single linear turn chain *is* the spec's history spine:

- `turn.specification_id` is the only home for a turn.
- `turn.parent_turn_id` chains turns into one rope.
- `specification.active_turn_id` names the head of that rope.

This was correct when there was one interview thread per spec. It is no longer correct:

- **Side-chat** (`SIDE_CHAT.md`) needs a parallel conversation surface anchored to graph items, not to the interview frontier. V1.1/V1.2 ship this as an in-memory `PatchListProvider` because the durable substrate doesn't accommodate a second thread.
- **Direct user edits** from graph view (and, later, the architect loop) produce mutations that don't originate from any turn at all — they need a place to live and a way to advertise their downstream impact.
- **Reconciliation** of those mutations needs a typed signal: "this item changed, that item now needs confirmation". `knowledge_edge` carries semantic relations between items; it is the wrong place to record an open question between them.

This RFC introduces the smallest substrate change that unblocks both: a `chat` table that turns relate to (instead of relating to spec directly), and a `reconciliation_edge` table that records open issues between knowledge items.

It is **Phase 1** of the substrate evolution leading toward the patch ledger (A71) and ontology sharpening discussed in `memory/SPEC.md` §11. Subsequent substrate phases are listed in §10. Adjacent moves not part of this evolution — phase-route de-emphasis, typed patches with `prev_value` provenance, ontology additions (`invariant`, `example`) — are tracked separately.

### At a glance — the relational shift

```mermaid
flowchart LR
    subgraph Today
        S1[specification] -- "1..*" --> T1[turn]
        T1 -.->|parent_turn_id| T1
        S1 -- "active_turn_id" --> T1
        S1 -- "1..*" --> KI1[knowledge_item]
        KI1 <-- "from / to" --> KE1[knowledge_edge]
        T1 <-- "turn_knowledge_item" --> KI1
    end

    subgraph Proposed
        S2[specification] -- "1..*" --> C2[chat]
        S2 -- "primary_chat_id" --> C2
        C2 -- "1..*" --> T2[turn]
        T2 -.->|parent_turn_id| T2
        C2 -- "active_turn_id" --> T2
        S2 -- "1..*" --> KI2[knowledge_item]
        KI2 <-- "from / to" --> KE2[knowledge_edge]
        KI2 <-- "source / target" --> RE2[reconciliation_edge]
        T2 <-- "turn_knowledge_item" --> KI2
    end
```

Two new tables (`chat`, `reconciliation_edge`); one re-pointed FK on `turn`; one moved column (`active_turn_id` from spec to chat); one new column on spec (`primary_chat_id`). Everything else is preserved.

## 2. Current model (annotated)

```
specification
  id
  name
  mode                'greenfield' | 'brownfield'
  active_turn_id      head of the single turn chain          ← moves to chat
  created_at, updated_at

turn
  id
  specification_id    every turn anchors here                ← becomes chat_id
  parent_turn_id      chains turns
  phase               'grounding' | 'design' | 'requirements' | 'criteria'
  turn_kind           'question' | 'kickoff' | 'recovery'
  question, why, impact, answer, ...
  is_resolution
  user_parts, assistant_parts
  created_at

option
  id
  turn_id             1:N from turn                          (unchanged in V1; see §9)
  position, content, is_recommended, is_selected

phase_outcome
  id
  specification_id    spec-level                             (unchanged)
  phase
  proposal_turn_id    turns still own the moments
  confirmation_turn_id
  status, summary, closure_basis, confirmed_at, superseded_at
  created_at

knowledge_item
  id
  specification_id                                           (unchanged)
  kind                'goal' | 'term' | 'context' | 'constraint'
                    | 'decision' | 'assumption' | 'requirement' | 'criterion'
  subtype, content, rationale, kind_ordinal

turn_knowledge_item                                          (unchanged)
  turn_id, item_id
  relation            'captured' | 'confirmed' | 'edited'
                    | 'invalidated' | 'reviewed' | 'rejected'

knowledge_edge                                               (unchanged)
  from_item_id, to_item_id
  relation            'depends_on' | 'derived_from'
                    | 'constrains' | 'verifies' | 'refines'

annotation                                                   (unchanged)
  id, specification_id, knowledge_item_id
  summary, body, selection_start, selection_end, created_at
```

The fragility: `turn.specification_id` plus `specification.active_turn_id` plus `parent_turn_id` collectively encode "one rope per spec". Any new conversation surface bumps into this triple.

## 3. Proposed model — minimum changes

Two new tables, one repointed FK, one column moved, one column added on spec. Names are placeholders; the conventions match the existing schema.

### 3.1 `chat` (new)

```ts
export const chat = sqliteTable('chat', {
  id: integer().primaryKey({ autoIncrement: true }),
  specification_id: integer()
    .notNull()
    .references(() => specification.id),
  kind: text({ enum: ['interview', 'side_chat'] }).notNull(),
  active_turn_id: integer().references((): any => turn.id),
  created_at: text().notNull().default(sql`(datetime('now'))`),
});
```

- `kind` distinguishes the canonical interview chat (one per spec, today) from side-chats (zero or more per spec). Future kinds (`architect`, `revisit`, …) extend this enum.
- `active_turn_id` moves off `specification` and onto `chat`. Each chat has its own head.
- A spec invariant emerges: every spec has exactly one `chat` with `kind = 'interview'`. See §3.4.

### 3.2 `turn` (changed)

```ts
export const turn = sqliteTable('turn', {
  id: integer().primaryKey({ autoIncrement: true }),
  chat_id: integer()                              // ← was specification_id
    .notNull()
    .references(() => chat.id),
  parent_turn_id: integer().references((): any => turn.id),
  phase: text({ enum: ['grounding', 'design', 'requirements', 'criteria'] }).notNull(),
  turn_kind: text({ enum: ['question', 'kickoff', 'recovery'] })
    .notNull()
    .default('question'),
  // ... rest unchanged
});
```

- `specification_id` is gone; spec is reachable via `chat.specification_id`.
- `phase` stays on turn. Per the second meeting: phase remains a background signal that shapes agent prompting; only the *UI primacy* of phase is being de-emphasised, and that's a separate RFC.
- `parent_turn_id` keeps its current semantics. It is still scoped to a single chat (parent and child must share `chat_id`); side-chat turns chain inside the side-chat, interview turns chain inside the interview chat.

### 3.3 `specification` (changed)

```ts
export const specification = sqliteTable('specification', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  mode: text('mode', { enum: ['greenfield', 'brownfield'] }).notNull().default('greenfield'),
  primary_chat_id: integer().references(() => chat.id),   // ← new
  // active_turn_id removed (lives on chat now)
  created_at: text().notNull().default(sql`(datetime('now'))`),
  updated_at: text().notNull().default(sql`(datetime('now'))`),
});
```

- `primary_chat_id` names the canonical interview chat. Today this is "the chat", tomorrow it's "the rope alongside which side-chats hang". Code that wants the interview frontier reads `specification → primary_chat_id → active_turn_id`.
- `active_turn_id` on the spec is removed in favour of the chat-level field. (Migration: see §6.)

### 3.4 `reconciliation_edge` (new)

```ts
export const reconciliationEdge = sqliteTable(
  'reconciliation_edge',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    specification_id: integer()
      .notNull()
      .references(() => specification.id),
    source_item_id: integer()
      .notNull()
      .references(() => knowledgeItem.id, { onDelete: 'cascade' }),
    target_item_id: integer()
      .notNull()
      .references(() => knowledgeItem.id, { onDelete: 'cascade' }),
    kind: text({ enum: ['supersedes', 'needs_confirmation'] }).notNull(),
    status: text({ enum: ['open', 'resolved'] }).notNull().default('open'),
    reason: text(),
    created_at: text().notNull().default(sql`(datetime('now'))`),
    resolved_at: text(),
  },
  (table) => [
    // Multiple edges between the same items are allowed, but only one OPEN edge
    // per (source, target, kind) — re-firing on an already-open issue is a no-op.
    uniqueIndex('reconciliation_edge_open_unique')
      .on(table.source_item_id, table.target_item_id, table.kind)
      .where(sql`status = 'open'`),
  ],
);
```

- **Directional.** `source` is the item whose change *triggered* the issue; `target` is the item that may now need attention. The pair (`source`, `target`, `kind`) is the issue identity.
- **Kinds.** Two ship at Phase 1:
  - `supersedes` — the source change replaces or invalidates information the target depends on; target needs to be re-derived or marked stale.
  - `needs_confirmation` — the source change *might* affect target but the system can't decide deterministically; a human or agent has to look.
  - The enum is intentionally narrow. New kinds are added when we have a concrete reconciliation move that doesn't fit either; we don't pre-invent them.
- **Status lifecycle.** `open` on creation; `resolved` on agent / user action. Resolved edges are kept for audit but do not participate in the reconciliation queue.
- **Multiple edges per pair.** The unique index gates only `open` edges. Two successive edits to the same source can fire two `needs_confirmation` edges, the first being closed before the second is opened; what we forbid is *two simultaneously-open issues of the same kind for the same pair*.
- **Provenance.** Phase 1 carries only `reason` (free-text) plus `created_at`. Linking the issue to the turn or patch that spawned it is deferred to A71 (patch ledger), where every mutation has a stable id.

### 3.5 Everything else

`option`, `phase_outcome`, `knowledge_item`, `turn_knowledge_item`, `knowledge_edge`, `annotation` are **untouched**. Their relationships continue to work because turn ids remain stable across the migration; only what `turn` references upward changes. See §6.

## 4. Context model for new chats

Substrate-only note: this RFC does **not** specify the assembly logic, the prompt format, or who orchestrates it. It only specifies what data is reachable to a new chat at creation time.

A side-chat (or any non-interview chat) is created with:

- `chat.specification_id` — handle on the spec it lives in.
- `chat.kind` — distinguishes side-chat from interview.
- *No* link to a "parent" chat. Chats are siblings under a spec, not a tree.
- *No* automatic snapshot of the interview transcript. The data the side-chat consumes is the **current state of the spec**:
  - all `knowledge_item` rows for the spec,
  - all `knowledge_edge` rows between them,
  - all open `reconciliation_edge` rows,
  - `phase_outcome` history (which phases are open / confirmed),
  - spec metadata (`name`, `mode`).

This is the second meeting's explicit decision: *new chats take in the current knowledge graph rather than previous conversation turns*. The interview transcript is provenance, not context.

How that gets formatted into a prompt and which agent owns the assembly is a follow-up RFC.

## 5. Reconciliation primitive

Substrate-only note: this RFC describes the **edge model and lifecycle**. The reconciliation agent (which reads the queue, decides severity, presents review sets) is a follow-up RFC.

### 5.1 Two production paths

```mermaid
flowchart TD
    M[Knowledge item changes<br/>(direct edit, patch apply,<br/>review acceptance)] --> P1[Path 1: deterministic]
    M --> P2[Path 2: observer pass]
    P1 --> KE[Look up existing<br/>knowledge_edges<br/>(depends_on, derived_from,<br/>constrains, refines, verifies)]
    KE --> RE1[Insert reconciliation_edge<br/>per affected pair<br/>kind = 'supersedes' / 'needs_confirmation']
    P2 --> OB[Observer reads<br/>changed item + neighbourhood]
    OB --> NEW[Discovers new connection<br/>not previously in graph]
    NEW --> RE2[Insert reconciliation_edge<br/>(may also insert new<br/>knowledge_edge)]

    classDef change fill:#fef3c7,stroke:#d97706
    classDef path fill:#dbeafe,stroke:#2563eb
    classDef out fill:#fed7aa,stroke:#ea580c
    class M change
    class P1,P2,KE,OB,NEW path
    class RE1,RE2 out
```

- **Path 1 (deterministic).** When an item changes, the system enumerates outgoing `knowledge_edge`s where it is the source (or incoming, depending on relation semantics — owned by the reconciliation agent's policy, not this RFC). For each, it opens a `reconciliation_edge`. This is the only path Phase 1 needs to ship.
- **Path 2 (observer pass).** Asynchronous. The observer surveys the change in context of the current graph and may notice that two items now look related where they weren't before. It can insert both a new `knowledge_edge` (the discovered relation) and an `open` `reconciliation_edge` (the issue raised by the discovery). This path is the one that handles the case from the meeting: *"now I'm rewriting the decision in a way that now sounds like I'm assuming the other decision as well"*. Substrate is ready for it; the observer prompt isn't.

### 5.2 Resolution

When the queue is resolved (by user, agent, or both), the matching `reconciliation_edge` rows transition `open → resolved` and pick up a `resolved_at` timestamp. The actual resolution moves — accept a proposed change set, edit the target item, mark the issue irrelevant — produce knowledge-item mutations and (in time) patches. Those are not modelled here; they go through the same paths everything else does.

### 5.3 What this is *not*

- Not a workflow state. Reconciliation is a graph signal, not a phase. `phase_outcome` is the workflow state primitive and is unchanged.
- Not a patch. `reconciliation_edge` records *that* an issue exists; it does not describe *what* should change. The proposed change is a separate artefact: today in-memory in `PatchListProvider`, durable in the patch ledger when A71 lands (Phase 4).
- Not an audit log of edits. `turn_knowledge_item` and (later) the patch ledger own that.

## 6. Migration

Drizzle / SQLite. One ordered migration, columns added before the dependent columns are dropped:

1. **0014_chat_table.sql**
   - Create `chat` table (id, specification_id, kind, active_turn_id nullable, created_at).
   - For each existing spec, insert one row: `kind = 'interview'`, `active_turn_id = specification.active_turn_id`.
2. **0015_turn_chat_id.sql**
   - Add `turn.chat_id` (nullable).
   - Backfill: for each turn, set `chat_id` to the interview chat of its current `specification_id`.
   - Make `chat.active_turn_id` `NOT NULL` for `kind = 'interview'` rows (handled in code; SQLite doesn't enforce partial NOT NULL).
3. **0016_specification_primary_chat.sql**
   - Add `specification.primary_chat_id`.
   - Backfill: for each spec, set `primary_chat_id` to the interview chat created in step 1.
4. **0017_drop_legacy_turn_columns.sql** *(SQLite recreate-and-copy)*
   - Drop `turn.specification_id`. (`chat.specification_id` is the path now.)
   - Make `turn.chat_id` `NOT NULL`.
5. **0018_drop_specification_active_turn_id.sql** *(SQLite recreate-and-copy)*
   - Drop `specification.active_turn_id`. The chat owns the head.
6. **0019_reconciliation_edge.sql**
   - Create `reconciliation_edge` table with the partial unique index from §3.4.

Code changes paired with migrations:

- Reads of `turn.specification_id` become `turn → chat → specification_id`. There are roughly a handful of these; a sweep is straightforward.
- Reads of `specification.active_turn_id` become `specification → primary_chat_id → active_turn_id`.
- Writes that previously inserted a turn with `specification_id` now insert with `chat_id` (the interview chat for the spec, or whichever chat the caller owns).
- Spec creation today inserts a spec; tomorrow it inserts a spec **and** an interview chat as one transactional unit. `bin/brunch new-spec` and the equivalent route handler are the only entry points.

Migration steps 4 and 5 use SQLite's table-recreate dance because column drops aren't direct. We can collapse these with the earlier migrations once their data has been verified in production; preserving them as separate steps keeps each migration small enough to roll back.

No data loss. Every existing turn lands inside the interview chat of its spec; every existing `specification.active_turn_id` becomes the interview chat's `active_turn_id`. `phase_outcome`, `option`, `knowledge_item`, `turn_knowledge_item`, `knowledge_edge`, `annotation` are untouched.

## 7. Out of scope (acknowledged adjacents)

- **Patch ledger (A71).** Typed semantic patches with `prev_value` / `value` and explicit provenance, replacing the in-memory `PatchListProvider` model. This RFC creates room for the ledger by separating chat from spec, but does not introduce the ledger itself.
- **Phase routes / phase as primary UI concept.** The second meeting agreed phase should de-emphasise as UI but stay as a background signal for prompting. UI work is its own RFC; the data model here keeps `turn.phase` exactly as-is.
- **Ontology sharpening (`invariant`, `example` as `knowledge_item.kind`).** Discussed in `memory/SPEC.md` §11. Pure ontology change; no impact on the chat / reconciliation substrate.
- **Decision shape rework.** The meeting concluded a decision should capture both *chosen* and *not chosen*, and that the `option` table can probably go away in favour of in-turn data. Both moves belong with the patch-ledger work; today's `option` table stays.
- **Phase outcome enum redesign.** The meeting flagged the `proposed | confirmed | superseded` enum as "find a better idea". Out of scope; `phase_outcome` is unchanged.
- **Reconciliation agent loop.** Who reads `reconciliation_edge` rows, in what order, how it presents review sets. Substrate is ready; the agent design is a separate RFC.
- **Side-chat UI changes for multi-thread.** Today ships single side-chat-per-spec; the `chat` table accommodates many but the UI continues to render one until side-chat V4 ships (`SIDE_CHAT.md` §9). Side-chat V1 / V2 / V3 / V4 labels are independent of substrate Phase 1 / 2 / 3 / 4 — see §10 for the mapping.

## 8. Verification stance

Substrate change. Coverage is migration-and-FK shaped, not user-flow shaped:

| Loop | Coverage |
|---|---|
| **Schema migration tests** | Forward migration produces one `chat` per spec; every existing turn has a matching `chat_id`; every spec has a matching `primary_chat_id`; chat's `active_turn_id` matches old spec's. Idempotent on re-run. |
| **FK integrity tests** | Inserting a turn with a `chat_id` whose chat belongs to a different spec is rejected at the application layer (DB enforces only direct FK). Parent / child turns must share `chat_id` (application-layer assertion). |
| **Reconciliation lifecycle tests** | Opening a duplicate `(source, target, kind)` while one is `open` is rejected. Resolving and re-opening with the same triple is allowed. Cascade-delete on `knowledge_item.id` removes both knowledge edges and reconciliation edges. |
| **Read-path regression** | `specification → primary_chat_id → active_turn_id` returns the same turn id that `specification.active_turn_id` did pre-migration on a fixture set. |
| **Existing turn-knowledge-item provenance** | Survives migration unchanged. Every `turn_knowledge_item` row continues to point to a valid turn. |

Manual: spin up an existing spec database (a current `.brunch/` fixture), run migrations, exercise the existing interview flow, confirm no behavioural change.

## 9. Open questions

- **`turn.specification_id` retention.** Drop it (clean) or keep it as a denormalised convenience for queries that don't want to join through chat (cheap)? Default proposal: drop it; force the join. Reverse if hot-path queries suffer.
- **Side-chat `chat.parent_turn_id` or anchor item.** A side-chat is started *from* a graph item. Should the `chat` row record the anchor item id? Today's `SIDE_CHAT.md` treats anchoring as a UI/runtime concern. Default proposal: don't model it on `chat`; let the side-chat runtime carry it. Revisit when persistence is wanted.
- **Reconciliation `reason` shape.** Free text in V1. Once the reconciliation agent ships, `reason` may want to be structured (template id + slots). Default proposal: stay free-text until the agent design forces a shape.
- **Reconciliation cascade-on-resolve.** When a `supersedes` edge resolves, does that ever fan out into new reconciliation edges (because the resolution itself is a mutation)? Yes — and that is exactly the reentrancy point Lu flagged in the second meeting. Substrate already handles it: any mutation re-runs path 1 + path 2. The agent decides whether to bundle resolution into one review set or accept a follow-up cycle. No substrate change needed.
- **`option` table fate.** Meeting tentatively concluded the table can go away in favour of in-turn data. Out of scope here; tracked alongside the patch-ledger / decision-shape work.
- **`phase_outcome` enum redesign.** Tracked alongside the de-emphasise-phase-as-UI RFC.
- **Multiple `reconciliation_edge.kind`s for one pair.** The partial unique index gates only same-kind same-direction. A single source change could legitimately produce both `supersedes` *and* `needs_confirmation` against the same target; allowed by design. Confirm this is intended.

## 10. Phasing

`Phase N` labels here describe the *substrate* evolution and are independent of `SIDE_CHAT.md` §9's V1 / V2 / V3 / V4 labels for the *user surface*. The `Enables` column maps between them where they connect.

| Phase | Substrate state | Enables (user-surface mapping) |
|---|---|---|
| **Phase 1** *(this RFC)* | `chat` table; `turn.chat_id`; `specification.primary_chat_id`; `chat.active_turn_id`; `reconciliation_edge` table. Backfill migrations. Read/write code paths repointed. No user-visible change: still one chat per spec, still one rope per chat, side-chat continues to use in-memory `PatchListProvider`. | Foundation. Side-chat V1 (Explore + Annotate) and V2 (Edit / Drill-down / Propose-edge, soft tier) are unaffected — both ship against today's mutation paths regardless of order. Side-chat V3's hard-edit cascade gets a clean reshape (cascade reads from `reconciliation_edge` rather than ad-hoc REVISIT state). Side-chat V4 (multiple persistent threads) becomes shippable without waiting on A71. Architect loop's first version becomes shippable without A71. |
| **Phase 2** | Side-chat persistence: side-chat threads write `chat` rows with `kind = 'side_chat'` and persist their turns. Multiple side-chats per spec become possible at the data layer. | Side-chat V4 (`SIDE_CHAT.md` §9 — `Old chat` tab strip activates). |
| **Phase 3** | Reconciliation agent loop reads `reconciliation_edge` queue, presents review sets through the same patch list as the side-chat. | Side-chat V3 hard-edit cascade ships against the reconciliation agent (replaces the REVISIT modal). Architect loop's review surface inherits the same machinery. |
| **Phase 4** *(later)* | Patch ledger (A71) lands. `reconciliation_edge` gains a provenance pointer (e.g. `created_patch_id`). Decision-shape rework, option-table removal, and phase-outcome enum redesign happen here. | Architect loop's typed-patch version. Item versioning (A72). Cross-surface undo / time-travel. |

## 11. Traceability

- **Replaces** the implicit "one rope per spec" assumption baked into `turn.specification_id` and `specification.active_turn_id`.
- **Unblocks** A71 (patch ledger), the architect / generator loop horizon item, and side-chat V4 (multiple persistent threads).
- **Bounded by** D113 (no second durable workflow model — `chat` is *not* workflow state, it is a conversation-thread substrate; workflow state stays on `phase_outcome`).
- **Reuses** existing `knowledge_item`, `knowledge_edge`, `turn_knowledge_item`, `option`, `phase_outcome`, `annotation` schemas as-is.
- **References** `memory/SPEC.md` §11 (turn-spine vs patch-ledger synthesis), `docs/design/SIDE_CHAT.md` (V1 in-memory patch list, V4 multi-thread activation).
