# Pseudo: Tree

Captures **containment, hierarchy, decomposition** — parent/child relations where each child belongs to exactly one parent. Files in folders, components in components, sections in documents, decompositions of a problem space.

## When to use

- Pure containment: child cannot exist outside its parent.
- Decomposition: breaking one thing into ordered or unordered parts.
- Outline of a document, codebase, UI, decision space.
- **Obligation decomposition** — breaking a paragraph-length contract or acceptance criterion into categories with individually testable leaves.
- Before/after of any of the above (the most common pairing).

## When NOT to use

- Same conceptual child appears under two parents → **graph**.
- Sibling order or sibling interaction is the point → ordered-tree variant if order only; **chain** / **lanes** / **graph** if interaction.
- Parent/child looks like flow, not containment → **chain** or **graph**.

## Canonical form

ASCII box-drawing (or Unicode equivalent — pick one per artifact). Indentation is structural; box characters are visual aids that survive copy/paste.

```
auth/
├── login.ts
├── session.ts
└── providers/
    ├── oauth.ts
    └── credentials.ts
```

Rule of thumb: if you can answer *"can this node exist without its parent?"* with **yes**, you have the wrong family — it's probably a graph.

## Variants

### Annotated tree (metadata column)

```
auth/
├── login.ts            [entry; rate-limited]      @auth-team
├── session.ts          [token mint + verify]
└── providers/
    ├── oauth.ts        [external; cached 5m]      @auth-team
    └── credentials.ts  [bcrypt; pepper from env]  @auth-team
```

Column alignment is reader-friendly but not load-bearing.

### Delta tree (inline diff)

`+`/`-`/`~` line markers when before/after is small enough to fit in one block — often cheaper than two stacked blocks.

```
auth/
  ├── login.ts            [split handler + service]   ~
  ├── session.ts
  └── providers/
      ├── oauth.ts
      ├── credentials.ts
      └── magic-link.ts                               +
risk.ts                                               +
legacy-auth.ts                                        -
```

### Ordered tree (sibling order matters)

Number the children explicitly:

```
pipeline/
├── 1_parse
├── 2_normalize
├── 3_validate
└── 4_emit
```

### Cross-ref tree (mostly hierarchy, a few non-tree edges)

When 80% of relations are containment and 20% are references, use `->#anchor` on the lines that need it. Beats switching to graph for one or two edges.

```
auth/                                    #auth
├── login.ts
└── session.ts          -> #token-store

cache/                                   #token-store
└── redis.ts
```

### Cardinality / multiplicity

```
providers/   [1..n]
sessions/    [0..*]   per user
```

### Focused tree with elision

Show the touched area plus parent context, not the whole tree.

```
auth/
└── providers/
    ├── oauth.ts
    └── ... (3 omitted)
```

## Annotation patterns

- **`[tag]` column** for compact metadata, whitespace-aligned.
- **`#id` anchors** on nodes for cross-references from other artifacts.
- **`@owner`** for ownership when it varies across the tree.
- **`notes:` / `open:` footer** keyed by anchors for discussion that doesn't belong inline.
- **Diff markers `+` / `-` / `~`** as line prefixes or trailing markers.
- **`?` line-marker** for uncertain branches, **`!`** for risky/hotspot nodes.

```
notes:
  - #token-store: Redis or in-memory for tests?
  - #auth:        all rate limits enforced at this boundary
```

## Smell-to-switch tripwires

- **The same conceptual child appears under two parents.** Tree is lying. → **graph**.
- **Sibling A depends on sibling B.** → **graph** for the dependency, or **chain** if linear.
- **Order or timing between siblings matters beyond "list order."** → ordered tree if order only; **chain** / **state-machine** if timing.
- **Parent/child relation reads as "calls" or "becomes" rather than "contains."** → wrong family entirely.
- **You start drawing extra connectors between nodes at the same level.** → **graph**.

## Anti-patterns

- **Tree-shaped diagram of a flow.** Tree looks clean even when lying. Reach for chain or graph instead.
- **Mixing containment levels** (file → function → variable in one tree). Pick one level per tree; link levels via anchors.
- **Inventing extra connectors** between sibling or distant nodes. That's the smell; switch family.
- **One mega-tree.** Split by subsystem; link via `#id`.
- **Comments doing what the structure should** (the same "see X" note attached to many nodes). Use a `_rules:`-style footer or split the tree.

## Escape hatches

- **Tree + cross-refs** for 1-2 non-tree edges.
- **Multiple small trees linked by `#id`** beats one large tree almost always.
- **Graph** when containment isn't the primary relation.
- **Stacked before/after blocks** when delta-tree gets unreadable (more than ~5 markers).

## Worked example: current vs desired UX flow

The pattern your UX Flow Plan codifies — two trees under `## Current` and `## Desired`, with anchors attached *after* the structure is settled.

```
## Current

User action: click "Forgot password"
└── System behavior: redirect to /reset
    └── Existing layer: pages/reset.tsx
        └── Anchor: components/ResetForm.tsx
```

```
## Desired

User action: click "Forgot password"
└── System behavior: modal opens in place
    ├── New layer: useResetFlow hook
    │   └── Anchor: hooks/useResetFlow.ts
    └── Reused layer: components/Modal.tsx
        └── Anchor: components/ResetForm.tsx (extracted as ResetModalContent)
```

## Worked example: obligation decomposition

A high-value use of `tree` in this codebase is breaking a paragraph-length acceptance criterion or contract obligation into a scannable hierarchy. The tree captures *categories of what must hold*, with each leaf an individually testable obligation.

Source: a single sentence with ~12 semicolon-separated acceptance clauses for a milestone integration.

```
agent-graph-integration acceptance:
├── command-routing
│   ├── agent CRUD → CommandExecutor
│   ├── elicitor capture → CommandExecutor
│   ├── reviewer writes → CommandExecutor   (target: #reconciliation_need only)
│   └── acceptReviewSet: batch atomic       (one LSN, one change-log entry)
├── exchange entries (custom)
│   ├── brunch.establishment_offer          [must carry: lens]
│   └── brunch.elicitor_intent_hint         [must carry: lens]
├── capture rules
│   ├── high-confidence extractive facts    → commit
│   ├── readiness/posture updates           → commit
│   └── low-confidence implications         → stay in preface
├── proposal rules
│   ├── carry support/grounding coverage
│   ├── carry epistemic_status
│   └── only dry-run-valid → reviewable review-set
├── reviewer policy
│   ├── advisory only (writes only #reconciliation_need)
│   └── initial POC trigger/scope recorded in docs/tests   (not implicit)
├── architectural invariants
│   ├── no direct DB access
│   ├── no caller-side authority bypass outside command layer
│   └── reviewer write-target boundary enforced
├── cross-surface
│   └── same change observed across TUI and web
└── async substrate (conditional)
    └── if observer/auditor queues land → backstops only, not primary capture
```

Each leaf is small enough to become one test or one assertion. The categories let a reviewer scan for missing dimensions (e.g. "did we cover the cross-surface obligation?") rather than re-parsing a sentence.

## Worked example: delta tree for a small refactor

```
auth/
  ├── login.ts                                     ~  # split into handler + service
  │   ├── handler.ts                               +
  │   └── service.ts                               +
  ├── session.ts
  ├── providers/
  │   ├── oauth.ts
  │   └── credentials.ts
  └── magic-link.ts                                +

legacy-auth.ts                                     -

open:
  - confirm session.ts stays a single module after split
```
