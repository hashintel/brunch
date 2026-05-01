# Patch / Event-Stream Data Model

> Output of brainstorm session 2026-05-01. Concretizes assumptions A71 (patch / event-stream model), A72 (item versioning), and A73 (architect loop) from `memory/SPEC.md` into a proposed data structure for branched turns, patch-staged mutations, and event-driven projections.
>
> Status: **proposed (future-facing)** — this is the north-star data model behind side-chat V4 and the architect loop. V1 / V2 / V3 ship on the current store-of-stores; this design describes the substrate they migrate onto in V4. Pending review before transitioning to an implementation plan.
>
> Canonicality: `memory/SPEC.md` and `memory/PLAN.md` remain authoritative for what's true now and what's next. This is a focused design note for one specific data-model evolution and does not by itself reorder the live frontier.

## TL;DR

**The problem.** Today, Brunch saves spec edits by mutating one shared `knowledge_item` table (rows discriminated by `kind`) in place. Provenance per turn is recorded in `turn_knowledge_item` (`captured | confirmed | edited | invalidated | reviewed | rejected`); item relationships live in `knowledge_edge`; the interview chain is linear via `turn.parent_turn_id`. That setup carries an audit trail of *which turn touched which item*, but it lacks three things: (a) **staging** — side-chat patches need to sit in a review list before applying; (b) **per-item content history** — when a turn edits an item, the prior content is overwritten; (c) **first-class branching** — `parent_turn_id` exists schematically but D80 keeps the chain linear, so edits to past turns, drill-downs, architect proposals, and revisits have no shape they can take.

**The idea.** Replace direct mutation with four concepts:

1. **Branches** — every line of conversation is a named branch with a status (`live`, `speculative`, `stale`, etc.). The interview lives on `main`; side-chats, drill-downs, edits, architect proposals all become branches. Stale branches get filtered out of view but stay in the database — recoverable.
2. **Events** — an append-only log of everything that happens (turns, applies, proposals, merges). The log is the truth.
3. **Patches** — individual proposed changes (rename this, add that edge). Patches can be staged (sitting in the side-chat patch list) or applied (linked to an event). The architect produces patches the same way the user does — one review surface for both.
4. **Item versions** — a cache that says "what does requirement C1 look like on branch X right now?" so reads don't have to replay history. If the cache breaks, rebuild from the event log.

**Branching, the short version.**

- **Side-chat?** It's a branch. Apply = merge it into main.
- **Drill-down?** Branch. Both stay live forever (or until you merge).
- **Architect proposes 3 changes?** Each proposal is a speculative branch. Accept = merge. Reject = discard.
- **User edits an old answer?** Fork from that point; the original "what would have happened" chain is hidden but recoverable.
- **Revisit a closed phase?** Same as edit, but the original is "archived" instead of "stale" (just a UI tag).

**When does this ship?** Not in V1, V2, or V3 of side-chat — those still use today's stores. **V4** is the swap. The earlier versions are designed *as if* this substrate already existed, so V4 is a substrate change rather than a redesign.

**What this changes in `SPEC.md`.**

- D80 ("no turn branching") gets relaxed: branching is fine, but only via tracked `Branch` entities with a stated reason — no chaos.
- D113 ("one durable workflow model") still holds, just at the event-log layer instead of the per-store layer.
- A71, A72, A73 (patch model, item versioning, architect loop) graduate from "low-confidence future" assumptions to real decisions when V4 ships.

**The one rule to remember.** The event log is the truth; everything else is a cache. If the cache disagrees with the log, the cache is wrong. That's what makes audit, recovery, and migration tractable.

## 1. Decisions snapshot

Made during the brainstorm session 2026-05-01. (Why this design exists: the TL;DR. The substrate it replaces: today's in-place mutation of `knowledge_item`, with provenance in `turn_knowledge_item` and relationships in `knowledge_edge`. A71 in `memory/SPEC.md` flagged the patch / event-stream model as the future direction; this design concretizes it.)

| Decision | Choice | Rationale |
|---|---|---|
| **Branching ambition** | Lift D80 — turns can branch (turn-tree DAG) | Drill-down, edits, revisits, architect proposals all want true branching |
| **Substrate shape** | **Approach 2:** event log + first-class `Branch` entities (vs. pure event-DAG with implicit branches, or patch-only DAG dropping turns) | Branches need UI handles, lifecycle metadata, and per-`originKind` policy; an implicit-branch model makes branch-as-concept ad-hoc |
| **Trigger set** | (i) edit past turn, (iii) side-chat apply, (iv) drill-down, (v) architect, (vi) revisit closed phase | (ii) bare "fork this thread" not needed; all branches are intent-driven |
| **Status taxonomy** | `live` · `speculative` · `stale` · `discarded` · `merged` · `archived` | Stale-recoverable + discard-permanent + speculative pre-review + archived for closed-phase audit |
| **Side-chat shape** | (α) Side-chat session is itself a branch; apply = merge to main | Conversation persists; multi-thread V4 = N side-chat branches |
| **Edit semantics** | (γ) Auto-stale original downstream from the edit point; recoverable via status flip | Clean default; user can resurrect with one click |
| **Materialization** | **M3 + M3c:** event log is durable truth; per-`(item_id, branch_id)` index serves as the read cache | Reads are direct lookups; bugs are recoverable by `DROP cache; REBUILD` from the log |
| **Patch granularity** | **P3:** events are coarse units; patches are first-class rows linked to events | Preserves D113 turn-as-unit at the event layer; gives A71 the addressability it needs |

## 2. Core entities

Four tables. Column types and FKs will tighten during implementation — what matters here is the relationships and invariants.

### 2.1 `branches`

A branch is a named line of conversation/exploration with explicit lifecycle metadata.

```
branches (
  id                  text PK
  spec_id             text FK
  parent_branch_id    text FK NULL          -- NULL only for main
  origin_event_id     text FK NULL          -- the event in parent_branch where the fork happened
  head_event_id       text FK NULL          -- latest event on this branch (NULL until first event)
  status              text                  -- live | speculative | stale | discarded | merged | archived
  origin_kind         text                  -- main | side-chat | drill-down | architect | edit | revisit
  label               text                  -- user-visible name; default derived from origin_kind + ts
  created_at          ts
  created_by          text                  -- user | interviewer | architect | system
  status_changed_at   ts NULL
  status_changed_by   text NULL
)
```

Invariants:

- Exactly one branch per spec has `origin_kind = 'main'` and `parent_branch_id = NULL`.
- All other branches have non-null `parent_branch_id` and `origin_event_id`.
- A branch's lineage is the chain `branch → parent_branch → ... → main`.
- A spec's `current_branch_id` (on `specifications`) names the branch graph view defaults to.

### 2.2 `events`

Append-only durable log. Every meaningful state-changing operation produces an event.

```
events (
  id                       text PK
  branch_id                text FK
  parent_event_id          text FK NULL     -- previous event on same branch; NULL for first event on a branch
  kind                     text             -- see kinds below
  payload                  json             -- kind-specific
  superseded_by_branch_id  text FK NULL     -- set when a sibling branch supersedes this event (edit/revisit case)
  created_at               ts
  created_by               text             -- user | interviewer | observer | architect | system
)
```

**Event kinds:**

| Kind | Meaning | Carries |
|---|---|---|
| `turn` | A normal interview turn (question + answer pair) | prompt, response, intent |
| `side-chat-apply` | User applied a side-chat patch list onto a target branch | merged-patch IDs, source side-chat branch ID |
| `architect-proposal` | Architect generated N candidate patches | proposal context, model used |
| `observer-capture` | Observer extracted entities post-turn | capture metadata, source-turn event ID |
| `branch-create` | A new branch was forked | origin event, origin kind, rationale |
| `branch-status-change` | Branch status flipped (e.g. stale → live, speculative → merged) | from-status, to-status, reason |
| `merge` | Generic merge of patches from another branch | source branch ID, merged patch IDs |

D113 invariant remains: a `turn` event is the unit of durable mutation for the interview proper. The other kinds are explicitly *not* turns — they don't advance the interview itself, even though they may emit patches that change spec state.

### 2.3 `patches`

A first-class row per individual mutation. One event can have N patches.

```
patches (
  id            text PK
  event_id      text FK NULL                -- NULL while staged; NOT NULL after apply
  branch_id     text FK                     -- branch where staged (= side-chat branch for side-chat patches)
  op            text                        -- create | update | delete | add-edge | remove-edge | annotate
  item_kind     text
  item_id       text NULL                   -- NULL on create until item id assigned
  before        json NULL                   -- snapshot for undo/audit (NULL on create)
  after         json NULL                   -- proposed new value (NULL on delete)
  supersedes    text FK NULL                -- prior staged patch this one replaces within the same staging list
  kind          text                        -- edit | edge | drill-down | annotate (the user-facing patch kind from SIDE_CHAT.md §3)
  impact_tier   text NULL                   -- none | soft | hard (refined at apply time)
  meta          json                        -- selectionRange, summary, etc.
  created_at    ts
)
```

Patches with `event_id = NULL` are **staged**. The side-chat patch list is just `WHERE branch_id = sideChatBranchId AND event_id IS NULL`.

Two stability rules govern the FK columns:

- **`branch_id` is set at creation and never moves.** It records *where the patch was first staged*, not *which branch it's been applied to*. Membership of a merged patch in a target branch's view is computed via the merge event's lineage in payload, not by mutating `branch_id`.
- **`event_id` is set when the patch is first associated with a durable event and never moves after.** For side-chat patches, that's at apply (the `side-chat-apply` event becomes their `event_id`). For architect patches, that's at creation (the `architect-proposal` event is their `event_id`). When a `merge` event later references a patch by ID in its payload, it does *not* re-set the patch's `event_id` — the patch is still "introduced by" its original event.

### 2.4 `item_versions`

The M3c read cache. One row per (item, branch-where-the-version-was-created).

```
item_versions (
  id                text PK
  item_kind         text
  item_id           text
  branch_id         text FK                 -- branch on which this version was created
  source_patch_id   text FK
  value             json                    -- fully materialized item state at this version
  supersedes        text FK NULL            -- prior version on the same branch lineage
  created_at        ts
)
```

Read query — *"show item X on branch B"* — selects the latest version reachable from B's lineage, filtered to live/speculative branches:

```sql
SELECT iv.*
FROM item_versions iv
JOIN branches b ON b.id = iv.branch_id
WHERE iv.item_id = $itemId
  AND iv.branch_id IN ($lineage_of_B)
  AND b.status IN ('live', 'speculative')
ORDER BY iv.created_at DESC
LIMIT 1
```

`lineage_of(B)` = `B, parent(B), parent(parent(B)), ..., main`.

If the cache is missing or invalidated, **rebuild = replay all events in lineage order, applying patches in order to compute the latest version per item.** The event log is always the durable truth; `item_versions` is reconstructible from it.

### 2.5 Entity-relationship overview

The four core entities, their relationships, and the key enums on each.

```mermaid
erDiagram
    SPECIFICATION ||--o{ BRANCH : has
    SPECIFICATION ||--|| BRANCH : "current_branch_id"
    BRANCH ||--o{ BRANCH : "parent_branch_id"
    BRANCH ||--o{ EVENT : has
    BRANCH ||--o| EVENT : "head_event_id"
    EVENT ||--o{ EVENT : "parent_event_id"
    EVENT ||--o| BRANCH : "superseded_by_branch_id"
    EVENT ||--o{ PATCH : emits
    PATCH ||--o{ ITEM_VERSION : produces
    BRANCH ||--o{ ITEM_VERSION : owns
    PATCH ||--o| PATCH : supersedes

    SPECIFICATION {
        text current_branch_id "FK to branches"
    }
    BRANCH {
        text origin_kind "main | side-chat | drill-down | architect | edit | revisit"
        text status "live | speculative | stale | discarded | merged | archived"
    }
    EVENT {
        text kind "turn | side-chat-apply | architect-proposal | observer-capture | merge | branch-create | branch-status-change"
    }
    PATCH {
        text op "create | update | delete | add-edge | remove-edge | annotate"
        text kind "edit | edge | drill-down | annotate"
        text impact_tier "none | soft | hard"
        text event_id "NULL while staged"
    }
    ITEM_VERSION {
        text item_kind
        text item_id
        text branch_id "version is scoped to its branch"
    }
```

### 2.6 Where today's vocabulary lands

Today's V1–V3 terms map onto the new substrate as follows.

```mermaid
flowchart TB
    subgraph Today["Today's vocabulary (V1–V3)"]
        T1["Turn<br/>row in turn (chained via parent_turn_id)"]
        T2["Observer capture<br/>writes turn_knowledge_item and knowledge_item"]
        T3["Side-chat apply<br/>direct UPDATE/INSERT on knowledge_item<br/>+ turn_knowledge_item provenance"]
        T4["Spec state<br/>latest answered turn + current knowledge_item rows<br/>+ knowledge_edge relations"]
    end
    subgraph V4["V4 substrate"]
        V1["EVENT (kind=turn)<br/>on the relevant branch"]
        V2["EVENT (kind=observer-capture)<br/>parent_event_id → its turn event"]
        V3["EVENT (kind=side-chat-apply)<br/>+ patches with event_id set"]
        V4n["BRANCH chain → EVENTS → PATCHES<br/>materialized as ITEM_VERSIONS"]
    end
    T1 -.maps to.-> V1
    T2 -.maps to.-> V2
    T3 -.maps to.-> V3
    T4 -.maps to.-> V4n

    classDef today fill:#fef3c7,stroke:#d97706
    classDef v4 fill:#dbeafe,stroke:#2563eb
    class T1,T2,T3,T4 today
    class V1,V2,V3,V4n v4
```

**The shift.** *Old:* "turn = unit of durable mutation." *New:* "event = unit of durable mutation; `kind='turn'` is one event kind among seven." Existing API verbs (`submitTurnResponse`, prepare/resolve/finalize, `turnId`) keep their meaning — they all operate on `kind='turn'` events. Branches, item versions, and four of the seven event kinds (`architect-proposal`, `merge`, `branch-create`, `branch-status-change`) are net-new in V4; they have no V1–V3 analogue.

## 3. Branch lifecycle

### 3.1 Status state machine

```mermaid
stateDiagram-v2
    [*] --> live: create (user/interviewer/drill-down/edit/revisit)
    [*] --> speculative: create (architect)
    speculative --> live: accept (HITL)
    speculative --> discarded: reject
    live --> stale: parent superseded, or user-flagged
    stale --> live: user resurrects
    live --> merged: apply patches into target branch
    live --> archived: closed phase preserved (revisit case)
    archived --> live: user resurrects from archive
    discarded --> [*]
    merged --> [*]
```

`stale` is **recoverable**: filtered out of normal views, but a user can flip the status back to `live` and the branch's events return to the cache. `discarded` is permanent (the row stays for audit, but no UI affords resurrection). `archived` is `stale`'s twin for closed-phase preservation — same filter behavior, but tagged distinctly so audit views can scope to "archived closes" specifically.

### 3.2 Lifecycle policy per `origin_kind`

The `origin_kind` of a new branch determines its default starting status, what happens to its parent and siblings, and what the default `Apply / Resolve` action is.

| Origin kind | Default starting status | Parent / sibling fate at fork | Default Apply / Resolve |
|---|---|---|---|
| `side-chat` (iii) | `live` | parent stays `live` — side-chat is a parallel exploration | Apply = `side-chat-apply` event on parent; side-chat branch → `merged`. Discard = side-chat → `discarded`. |
| `drill-down` (iv) | `live` | parent stays `live` — both live indefinitely (designed-in coexistence) | No auto-merge. Drill-down can later merge back via explicit action, or stay as a sibling sub-spec. |
| `architect` (v) | `speculative` | parent untouched | Accept = `merge` event on parent; architect branch → `merged`. Reject = `discarded`. Multiple speculative siblings can coexist for compare. |
| `edit` (i) | `live` | original downstream-of-fork on parent → `superseded_by_branch_id` set; events filtered from default views, recoverable via status flip | None (live merges happen organically as turns continue on the edit branch). User can resurrect superseded events to restore the original chain. |
| `revisit` (vi) | `live` | original closed-phase chain → `archived` (events filtered from default views; preserved for audit) | Same as edit: resurrect by status flip. |

### 3.3 Supersession (edit and revisit)

Edit and revisit fork from a point T on a parent branch and want to *replace* the parent's chain past T. At fork time, set `events.superseded_by_branch_id = newBranchId` for each parent event past T, and move `specifications.current_branch_id` to the new branch.

Materialization filters out events where `superseded_by_branch_id IS NOT NULL` and the superseding branch is `live` or `speculative`. If that branch later becomes `discarded`, the original events reappear automatically. The user can also clear supersession manually to turn the fork into drill-down-shaped coexistence. Every "stale" effect in this model is a reversible filter, never a destructive update.

## 4. Materialization

### 4.1 Truth vs. cache

- **Durable truth:** `branches`, `events`, `patches`. These tables are the only source of truth.
- **Cache:** `item_versions`, plus any denormalized read-side projections (e.g., per-branch active-path arrays, edge adjacency lists). These are reconstructible from the durable truth.

The discipline: **the log is always right.** If `item_versions` and the event log disagree, the cache is wrong. `DROP cache; REBUILD` from the event log is always safe and produces correct state.

### 4.2 When the cache rebuilds

| Trigger | Rebuild scope | Notes |
|---|---|---|
| `apply` of a side-chat patch list | Affected items on target branch only | New `item_versions` rows inserted; other items untouched |
| `architect-proposal` accepted (full or partial) | Affected items on target branch only | Same shape as side-chat-apply |
| Branch status flip (e.g. `stale` → `live`) | Items modified on the flipped branch | Latest-version SQL re-evaluates; new version winner shown |
| Branch deleted (truly gone — out of scope for V4) | Affected items on parent branch | Not in V4 scope; left as a future operation |
| Cache corruption / schema migration | Full rebuild from log | Acceptable to do in a maintenance window; replay is bounded |

### 4.3 Why M3c

Pure event replay (M1) is too slow at scale — every read folds the entire chain. Per-branch full materialization (M2 / M3a) costs disk proportional to N branches × spec size with expensive stale flips. M3b's canonical-cache + delta complexity isn't earned at our scale. M3c — one row per `(item_id, branch_id)` version, SQL-filtered on lineage + branch status — is the cheapest disk, fastest reads, simplest semantics.

## 5. The main branch and canonical view

Every spec has exactly one `main` branch (created at spec creation, `parent_branch_id = NULL`, `origin_kind = 'main'`); all other branches descend from it.

`specifications.current_branch_id` names the branch graph view, observer, and export use as the default display. It moves only on **edit** and **revisit** forks (the user has explicitly chosen a new chain); side-chat sessions, drill-downs, and architect proposals leave it on the prior branch and surface their forks via the branch picker / Proposals tray instead.

The picker (planned UI; not in V1) lists `live` and `speculative` branches grouped by `origin_kind`. `stale` / `archived` / `discarded` branches are filterable on demand.

## 6. Worked examples

Five walkthroughs, one per origin kind. Pseudo-SQL is illustrative.

### 6.1 Side-chat apply (origin `side-chat`)

```
1. User opens side-chat from C1 in graph view.
   INSERT branches (origin_kind='side-chat', parent=main, status='live',
                    origin_event=main.head_event_id, label='Chat about C1')
   INSERT events  (branch=sideChatBranch, kind='branch-create')
   UPDATE branches SET head_event_id=newEventId WHERE id=sideChatBranch

2. User chats. Each exchange = a turn-shaped event on the side-chat branch.
   INSERT events (branch=sideChatBranch, kind='turn', payload={prompt, response})

3. The chat surfaces a patch proposal: "rename household → family in C1".
   INSERT patches (event_id=NULL, branch=sideChatBranch, op='update',
                   item='C1', kind='edit', impact_tier='soft', after={...})

4. Top-bar shows "1 Edit · Apply".

5. User clicks Apply.
   INSERT events (branch=main, kind='side-chat-apply', parent=main.head_event_id,
                  payload={mergedPatchIds: [P1], sourceBranchId: sideChatBranch})
   UPDATE patches SET event_id=newApplyEventId
                  WHERE branch=sideChatBranch AND event_id IS NULL
   UPDATE branches SET status='merged' WHERE id=sideChatBranch
   UPDATE branches SET head_event_id=newApplyEventId WHERE id=main
   INSERT item_versions (item_id='C1', branch=main, source_patch=P1, value={...})

6. Graph view re-renders main; C1 shows the new value.
```

### 6.2 Drill-down (origin `drill-down`)

```
1. User clicks "deepen this area" intent on C2 in graph view.
   INSERT branches (origin_kind='drill-down', parent=main, status='live',
                    origin_event=main.head_event_id, label='Deepen C2')
   INSERT events  (branch=drillBranch, kind='branch-create')

2. Subsequent interview turns land on the drill-down branch (current_branch_id
   does NOT move; user can switch via picker).

3. Both main and drill-down stay live concurrently.
   Branch picker surfaces "main · Deepen C2".

4. Eventual outcomes:
   a. Merge drill-down → main: INSERT events (branch=main, kind='merge',
      payload={sourceBranchId: drillBranch, mergedPatchIds: [...]});
      drill-down → 'merged'.
   b. Leave as long-running sibling: no further action; both stay live forever.
```

### 6.3 Architect proposal (origin `architect`)

```
1. Architect agent runs against main, produces 3 candidate patches against C5.
   INSERT branches (origin_kind='architect', parent=main, status='speculative',
                    label='Tighten ambiguity in C5')
   INSERT events  (branch=archBranch, kind='architect-proposal',
                   payload={modelUsed, proposalContext})
   INSERT patches × 3 (event_id=proposalEventId, branch=archBranch)

2. Top-bar "Proposals" tray surfaces the 3 patches.

3. User reviews:

   a. Accept all → INSERT events (branch=main, kind='merge',
      payload={sourceBranchId: archBranch, mergedPatchIds: [P1, P2, P3]});
      patches.event_id stays as proposalEventId (the event that introduced them);
      the merge event's payload references them by ID. INSERT item_versions × 3
      on main for the affected items. UPDATE branches SET status='merged'
      WHERE id=archBranch.

   b. Accept 1, reject 2 → INSERT events (branch=main, kind='merge',
      payload={sourceBranchId: archBranch, mergedPatchIds: [P1],
               rejectedPatchIds: [P2, P3]});
      INSERT item_versions × 1 on main. UPDATE branches SET status='merged'
      WHERE id=archBranch (with partial merge recorded in payload audit).
      Alternative shape considered: split archBranch into accepted/rejected
      sub-branches — rejected as overkill for V4.

   c. Reject all → UPDATE branches SET status='discarded' WHERE id=archBranch.
```

### 6.4 Edit a past turn (origin `edit`)

```
1. User scrolls back, clicks "edit" on turn T (10 turns ago) on main.
   Let postT = events on main with parent chain leading from T forward.

   INSERT branches (origin_kind='edit', parent=main, status='live',
                    origin_event=T, label='Edit answer at T')
   INSERT events  (branch=editBranch, kind='branch-create')
   UPDATE events  SET superseded_by_branch_id=editBranch
                  WHERE id IN postT
   UPDATE specifications SET current_branch_id=editBranch

2. The user re-answers at T on the edit branch.
   INSERT events (branch=editBranch, parent=T, kind='turn',
                  payload={prompt=T.prompt, response=newAnswer})

3. Subsequent turns continue on editBranch as new live chain.

4. Graph view defaults to editBranch (current_branch_id moved).
   The original main postT chain is still in the log but filtered out
   by materialization (because superseded_by_branch_id is set and editBranch is live).

5. If the user later resurrects the original:
   UPDATE events SET superseded_by_branch_id=NULL WHERE was previously superseded
   UPDATE branches SET status='stale' WHERE id=editBranch
   (or both branches live in coexistence if the user prefers — depends on UI choice).
```

### 6.5 Revisit a closed phase (origin `revisit`)

Structurally identical to edit (§6.4) — fork at the closed-phase end-point, supersede the original chain. The only difference is a UI tag: the superseded chain shows as `archived` rather than `stale`, surfacable via a distinct "show archived" toggle.

## 7. Mapping to side-chat phases

This data model lights up in V4. V1, V2, V3 stay on the current store-of-stores.

| Side-chat version | Substrate | What changes here |
|---|---|---|
| **V1** (PLAN.md Next 4) | Current stores; patch list in client memory (≤ 1 entry, annotation only) | None — the patch-list seam is shaped *as if* this model were live, but only the simplest path is exercised |
| **V2** (PLAN.md Next 5) | Current stores; in-memory patch list grows | Patch list still in client memory; per-store mutations on apply. Edit-router decisions (none/soft/hard) still mechanical, no branching |
| **V3** (PLAN.md Horizon) | Current stores; cascade preview lives in side-chat panel | Hard-edit cascade visible inline but still mutates per-store at apply; no event-stream yet |
| **V4** | This data model | Migration: existing turns → events on `main`, existing items → `item_versions` on `main`, existing per-store mutations → patches retroactively (or just snapshot the latest as the seed). All new mutations go through events + patches. Side-chat sessions become first-class branches. Architect loop deposits as `architect-proposal` events |

V4 is when:

- Multi-thread side-chats activate (`Old chat` tab strip in `SIDE_CHAT.md` §2 lights up).
- Architect loop ships as a real producer (A73 graduates from "low confidence" to "shipped").
- Item versioning surfaces in the UI: span-anchored annotations stop dangling, soft-edit audit becomes inspectable, drift handling in `SIDE_CHAT.md` §6.4 retires.

## 8. Migration from the current store-of-stores

### 8.1 Seeding `main`

For each existing spec:

1. Insert a `branches` row: `id=main, spec_id=<spec>, status='live', origin_kind='main'`.
2. For each existing turn in `specification_turns`, insert an `events` row of `kind='turn'` on `main`, with `parent_event_id` pointing at the previous turn's event ID and `payload` carrying the existing turn's prompt/response.
3. For each existing item across the per-kind stores, insert one `item_versions` row on `main` with `value` = the current item state. `source_patch_id` is `NULL` for seeded versions (audit-only — these don't have a patch ancestor).
4. For each existing observer capture, insert an `events` row of `kind='observer-capture'` linked to its source turn event.

The seed populates the log such that V4's reads return identical results to V3's reads on day one. The existing per-store tables can either:
- Be **retired** entirely (full migration; `item_versions` becomes the read source).
- Be kept as a **secondary cache** alongside `item_versions` during a parallel-running window (lower-risk migration).

### 8.2 Migration safety

- The seed is a **one-way** transformation; the existing per-store tables can be dropped after the parallel-running window proves the new substrate.
- Any spec data not yet patch-shaped (older specs without rich audit) gets one synthetic seed event per turn, backfilled.
- Event timestamps respect the original turn timestamps; the migration does not invent new history.

### 8.3 Backwards compatibility for in-flight side-chat work

- V1/V2/V3 side-chat patch lists in client memory are **not migrated** — they're transient. After migration, the next time a user opens the side-chat, it creates a real `side-chat` branch.
- Annotations from V1 (per-item rows in the comment store) migrate to `patches` of `op='annotate'` on `main`, with `event_id` set to a synthetic `merge` event seeded at migration time. Span anchors with `selectionRange` survive intact in `meta`.

## 9. Implications for `memory/SPEC.md`

### 9.1 Decisions to revise

- **D80 ("no turn-tree branching")** evolves to: *"turn-tree branching is allowed only via tracked `Branch` entities with explicit `origin_kind`; no ad-hoc forking. Branches have a recoverable lifecycle (`live | speculative | stale | discarded | merged | archived`) and a `current_branch_id` per spec defines the canonical view."* Spirit preserved (no chaos), letter updated (forks now exist).
- **D113 ("one durable workflow model")** reaffirms at the event-log layer: "one event log per spec," with sibling branches carrying parallel workflows.

### 9.2 Decisions reaffirmed without change

D89, D125, D127, D128, D130, D131 describe surfaces that read/write *through* the substrate — unaffected by this design.

### 9.3 Assumptions that retire (graduate to decisions)

- **A71** (patch / event-stream model) → graduates once V4 ships.
- **A72** (item versioning) → graduates; `item_versions` is the substrate.
- **A73** (architect / generator loop) → graduates separately when an architect actually ships, but "deposits into the same patch list" is now structural rather than aspirational.

## 10. Open questions

Deferred to V4 implementation planning.

1. **Branch picker UI shape.** Tabs, tree view, sidebar — likely grows from V1's `Old chat` tab strip.
2. **Per-patch undo granularity.** P3 makes patches addressable, but is per-patch undo *inside* an applied event worth the event-coherence trade-off?
3. **Storage scaling.** `item_versions` grows with patches × branches; deeply branched specs may need delta versions or periodic coalescing.
4. **Cross-branch merging beyond fast-forward.** Linear merges are trivial; true three-way merges with conflicting edits to the same item version need a resolution UX. Likely deferred to post-V4.

---

## Traceability

- **Concretizes** assumptions A71 (patch / event-stream model), A72 (item versioning), A73 (architect loop) from `memory/SPEC.md`.
- **Revises** D80 (no turn-tree branching) to allow tracked branching with explicit `origin_kind`.
- **Reaffirms** D113 (one durable workflow model) at the event-log layer.
- **Underpins** side-chat V4 phasing in `docs/design/SIDE_CHAT.md` §9.
- **Bounded by** D89 (card-owned input), D125 (typed relation policy), D127 (progressive-detail seam), D128 (graph view actionable workspace), D130 (side-chat as unified mutation surface), D131 (patch list in top-bar) — all unchanged by this design.
