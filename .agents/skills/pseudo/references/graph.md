# Pseudo: Graph

Captures **fan-in, fan-out, cycles, and typed dependencies** between nodes. Use when the relations between things are the point — not their containment (`tree`), linear order (`chain`), or interaction across actors (`lanes`).

## When to use

- Multiple inputs feed one node, or one node feeds multiple outputs.
- Cycles or feedback edges exist.
- Edge labels carry meaning (guards, conditions, retry semantics).
- Node *types* matter (service vs queue vs store vs trigger).

## When NOT to use

- The relations are strictly hierarchical → **tree**.
- One actor does one thing at a time in order → **chain**.
- Multiple actors hand off requests/responses → **lanes**.
- Edges are dense enough that adjacency would be clearer → **matrix** (adjacency variant).

## Canonical form

**Paired node-list + edge-list.** ASCII boxes are a rendering; lists are the source. Boxes don't diff cleanly and one rename breaks the layout — lists diff line-by-line and grow gracefully.

This is a bespoke line-grammar, not YAML. Node lines are `name [: type] [[tag]] [#anchor]`. Edge lines are `src <edge> dst [# note]`. Multi-source or multi-target shorthand: `a, b -> c` or `a -> b, c` (commas separate node names; node names are bare words).

When all nodes share the same kind (a dependency graph of frontier items; a tree of React components; a set of lifecycle hooks), **omit the type entirely** — `name` or `name [tag]` is enough. Type is for when node *classes* carry meaning and the reader needs to keep them separate.

```
nodes:
  http:    trigger
  cron:    trigger
  proc:    handler
  log:     sink
  cache:   store
  notify:  worker
  done:    terminal

edges:
  http   -> proc
  cron   -> proc
  proc   -> log
  proc   ~> cache       # async
  proc   ~> notify      # async
  log, cache, notify -> done
```

Column alignment within `nodes:` is reader-friendly but not load-bearing — the colon is the separator.

## Variants

### Typed-node graph

When node classes matter, declare them explicitly so the reader doesn't conflate a service with a state with a table. The type slot is free text — pick a small vocabulary per artifact (`service`, `queue`, `store`, `job`, `trigger`, `sink`, `terminal` is a reasonable starter set).

```
nodes:
  api:    service
  queue:  queue
  worker: job
  db:     store
```

### Labeled / guarded edges

```
proc  -[if cached]-> done
proc  -[if miss]->   fetch
fetch x[on error]->  retry
```

`-[label]->` for conditions and guards; `x[label]->` for error or fallback transitions. The bracketed form is parallel for both; the leading `x` flags the error semantic.

### Subgraph / cluster

Group nodes when topology has obvious regions. Top-level nodes and groups live under separate keys; edges still live in the flat list (groups are organizational, not semantic).

```
nodes:
  proc:  handler
  done:  terminal

groups:
  ingest:
    http: trigger
    cron: trigger
  outputs:
    log:    sink
    cache:  store
    notify: worker
```

### Multiplicity

```
client[*] -> api
proc      -> notify[*]
```

### Cycles / feedback

Allowed in `graph`. Mark explicitly with a label so readers don't read it as a typo.

```
queue  ~> worker
worker -[retry on fail]-> queue
```

### Dependency-graph edges (static, not runtime)

The default edge vocabulary (`->` sync, `~>` async, `x>` error) is tuned for **runtime flow**. For **static dependencies** — "X must precede Y," "Y is an optional successor of X" — use the labeled form so the dependency type stays explicit:

```
edges:
  pi-ui-extension-patterns         -[hard]->         sealed-pi-profile-runtime-state
  sealed-pi-profile-runtime-state  -[hard]->         graph-data-plane
  agent-graph-integration          -[optional]->     subagents-for-proposal-diversity
  graph-data-plane                 -[on promotion]-> oracle-design-plan-graphs
```

A small starter vocabulary: `-[hard]->`, `-[optional]->`, `-[on promotion]->`, `-[blocking]->`. Pick the smallest set the artifact needs and declare it in a legend if it grows past ~4.

Don't overload `~>` for "soft dependency" — it means *async runtime edge* everywhere else and the collision is confusing.

### Adjacency matrix (dense graphs)

When edge-list grows past ~30 edges and the graph is densely connected, escape to **matrix** with rows = source, cols = target. Keep the node list intact above the matrix.

## Annotation patterns

- `#id` on a node makes it linkable from other artifacts: `proc: handler #proc` so a state-machine transition can say `pending -[handled by #proc]-> active`. Anchor follows the type (or the name, when type is omitted).
- Right-gutter `# note` for local context. Promote into the edge label if the note changes routing.
- **Unconnected nodes** (no edges in or out) belong in a named group so readers don't search for missing edges. Common names: `unconnected`, `for-acknowledgment`, `horizon`. Use when a node exists in the picture for completeness — e.g. horizon items in a roadmap dependency graph — but doesn't participate in the active relations.
- `?`, `!`, `+`, `-`, `~` markers on node or edge lines work the same as everywhere else (uncertain, risk, added, removed, changed).
- `notes:` / `open:` footer keyed by anchors for discussion that doesn't belong on the line itself:

  ```
  open:
    - #notify:  confirm delivery guarantee — at-least-once or exactly-once?
    - #cache:   TTL still TBD
  ```

## Smell-to-switch tripwires

- **Node types mixed arbitrarily.** A service, a state, a DB table, and a file path in one untyped graph — picture looks coherent, isn't. Fix: type the nodes, or split into multiple typed graphs.
- **"When" matters more than "what depends on what."** You keep wanting to say "first this, then that, then later that." → **chain** or **lanes**.
- **Edge labels carry most of the meaning.** The graph degenerates into a wiring diagram for the labels. → **state-machine** or **matrix**.
- **More than one actor.** "API calls worker calls DB" — ownership boundary matters. → **lanes**.
- **The graph keeps gaining edges with new prose.** → split into subgraphs linked by `#id`, or escape to Mermaid.

## Anti-patterns

- **Drawing boxes by hand for >~5 nodes.** Source becomes unmaintainable; one rename breaks the whole layout. Use node/edge lists.
- **Mixing `dag` and graph semantics.** This skill family is `graph` and cycles are allowed. If you mean strictly acyclic, say so in a comment (`# acyclic`); don't rely on ASCII layout to imply it.
- **Implicit edge types.** `->` everywhere when half should be `~>` (async) or `x>` (error). The reader will infer wrong defaults.
- **One mega-graph.** If the legend grows past ~7 node types, you have two graphs, not one.

## Escape hatches

- **Mermaid** — when spatial layout itself carries meaning (e.g. swim arrangement, geographic clustering) or when readers struggle to trace edges in text. Offer the user the option; don't decide unilaterally.
- **Tree + cross-refs** — when 80% of the relations are containment and 20% are non-tree. A tree with a few `->#anchor` cross-refs is easier to read than a graph.
- **Multiple small graphs** linked by `#id` beats one large one almost always.

## Worked example: trigger-and-fanout pipeline

```
nodes:
  http:    trigger
  cron:    trigger
  proc:    handler   #proc
  log:     sink
  cache:   store
  notify:  worker
  done:    terminal

edges:
  http, cron         -> proc
  proc               -> log
  proc               ~> cache         # async, fire-and-forget
  proc               ~> notify        # async, at-least-once
  log, cache, notify -> done

open:
  - #proc: idempotency key shape still TBD
```

## Worked example: roadmap dependency graph (untyped nodes, static edges)

Exercises three patterns: type omitted (all nodes are frontier items), dependency-graph edge labels, and the `unconnected` group for horizon items.

```
nodes:
  pi-ui-extension-patterns          [in-progress]
  sealed-pi-profile-runtime-state   [not-started]
  graph-data-plane                  [paused]
  agent-graph-integration           [not-started]
  subagents-for-proposal-diversity  [deferred]
  authority-model                   [not-started]
  turn-boundary-reconciliation      [not-started]
  coherence-first-class             [not-started]
  compaction-and-conflict-widening  [not-started]
  probes-and-transcripts-evolution  [continuous, parallel]

edges:
  pi-ui-extension-patterns         -[hard]->         sealed-pi-profile-runtime-state
  sealed-pi-profile-runtime-state  -[hard]->         graph-data-plane
  graph-data-plane                 -[hard]->         agent-graph-integration
  agent-graph-integration          -[hard]->         authority-model
  agent-graph-integration          -[hard]->         turn-boundary-reconciliation
  agent-graph-integration          -[optional]->     subagents-for-proposal-diversity
  turn-boundary-reconciliation     -[hard]->         coherence-first-class
  coherence-first-class            -[hard]->         compaction-and-conflict-widening
  graph-data-plane                 -[on promotion]-> oracle-design-plan-graphs

groups:
  unconnected:
    flue-pattern-adoption
    oracle-design-plan-graphs
    framework-direction-stubs
    geolog-and-petri-execution

notes:
  - probes-and-transcripts-evolution runs in parallel across all frontiers; not a spine edge.
  - unconnected items are surfaced for acknowledgment, not active dependency.

open:
  - confirm whether sealed-pi-profile-runtime-state -[optional]-> subagents matters
    (sandbox sealing precedes subprocess fan-out, even if m5 is the primary gate).
```

## Worked example: retry loop with typed nodes

```
nodes:
  api:    service
  queue:  queue       #q
  worker: job
  dlq:    queue
  store:  store

edges:
  api    -> queue
  queue  ~> worker
  worker -> store
  worker x[after 3 retries]-> dlq
  worker -[on retry]->        queue   # explicit cycle

notes:
  - #q: visibility timeout = 30s
```
