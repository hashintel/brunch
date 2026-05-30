---
name: pseudo
description: "Sketch structures, flows, schemas, and decisions in minimal ASCII/YAML notation that humans and agents can co-edit. Use when planning before code — describing hierarchies, call flows, graphs, decision tables, state machines, data shapes, or actor sequences — and when a shared diagram would carry the design discussion better than prose."
argument-hint: "[family name (tree|chain|graph|matrix|state-machine|data-shape|lanes) or free-form relation to capture]"
---

# Pseudo

A small typology of minimal notations for **shared design between humans and agents**. Each family captures one kind of structural relation, in a form that is cheap to type, cheap to diff, and cheap for either party to mutate. Pseudo is a *notation primitive* — `ln-spec`, `ln-design`, `ln-scope`, `ln-refactor`, and `ln-review` should reach for it whenever a sketch would beat prose.

## Input

Family name or free-form relation to capture: $ARGUMENTS

## Family map

| Family | Captures | Reference |
|---|---|---|
| **tree** | containment, hierarchy, decomposition | [references/tree.md](references/tree.md) |
| **chain** | linear flow, call stack, mainline reasoning | [references/chain.md](references/chain.md) |
| **graph** | fan-in / fan-out, cycles, dependencies | [references/graph.md](references/graph.md) |
| **matrix** | n×m comparison, decision tables, responsibility | [references/matrix.md](references/matrix.md) |
| **state-machine** | durable states + transitions | [references/state-machine.md](references/state-machine.md) |
| **data-shape** | schemas, types, instance shape | [references/data-shape.md](references/data-shape.md) |
| **lanes** | actors over time, request/response, async handoff | [references/lanes.md](references/lanes.md) |

## Routing

Three modes by `$ARGUMENTS`:

1. **Empty** — emit the family map plus a one-line "what relation are you capturing?" prompt; route from the answer.
2. **Named family** (`tree`, `graph`, …) — load that reference and apply it to current context.
3. **Free-form intent** (`"before/after of the auth flow"`, `"how the worker retries"`) — route from intent → family using the chain below, then load the reference.

### Routing chain (from intent to family)

```
What relation am I capturing?
  -> "containment, hierarchy, decomposition (incl. obligations)"
    -> tree
  -> "linear flow with at most shallow branching"
    -> chain
  -> "actors over time, request/response, handoff"
    -> lanes
  -> "fan-in, fan-out, cycles, typed or static dependencies"
    -> graph
  -> "n×m comparison, conditions → actions, responsibility, coverage"
    -> matrix
  -> "durable named states with transitions between them"
    -> state-machine
  -> "schema, type, instance shape"
    -> data-shape
  x> none fit cleanly
    -> ask the user; the relation may need two paired artifacts (e.g. graph + state-machine)
```

If two families both fit, prefer the one with the smaller artifact. If the artifact then strains, the smell-to-switch rules below catch it.

## Shared overlay grammar

Every family inherits the same small sigil set. Do not invent per-family alternatives.

```
+  -  ~          added / removed / changed
?                uncertain / proposal / needs confirmation     (line-marker only)
!                risk / blocker / hotspot
#id              stable anchor — cross-references between artifacts
@owner           owner / reviewer
[tags]           compact metadata
->   ~>   x>     sync edge / async edge / error or fallback edge
<-               return / response
...              elided region (give a count if known)
```

**`?` collision rule.** In `data-shape`, suffix `?` means *optional type* (`avatarUrl: string?`). In every other family, `?` is the line-marker for *uncertain / proposal*. Never both in one block.

## Authoring discipline

- **One semantic fact per line** in source form. Comma-compressed versions are display sugar, not the canonical artifact.
- **ASCII is canonical; Unicode is rendering.** `->` and `└──` are aliases for `→` and `└──`; pick one per artifact and stay consistent.
- **Indentation = structure only.** Do not let column alignment carry meaning — alignment may aid reading, but the artifact must survive reformatting.
- **Anchors `#id` link artifacts.** A tree node can reference a graph edge can reference a matrix rule can reference a state transition.
- **Legend at top** when sigils multiply past ~5. Cheaper than glossing each use.

## Cross-cutting moves

These work across families. Reach for them before adding new notation:

- **Before/after pairing** — two blocks under `## Current` / `## Desired`. The single most generic design move.
- **Delta inline** — `+`/`-`/`~` markers inside one block when the diff is small enough that two blocks would be wasteful.
- **Annotation column** — whitespace-aligned `[tag]` to the right of each line.
- **Anchor-attachment-after** — sketch the structure first; attach file/function/test anchors only once shape is settled.
- **Focus + elision** — show the touched area plus parent context, not the whole artifact. Use `... (N omitted)`.
- **`notes:` / `open:` footer keyed by anchors** — the non-YAML equivalent of "comments as channel." Keeps the left side stable and diffable.
- **Promote repeated notes into rules** — if the same annotation appears 3+ times, add a `legend:` or `_rules:` block.
- **Pairing variations** — current/desired, prod/test, happy/adversarial, steady-state/failure, schema/instance, rules/worked-examples.

## Smell-to-switch rules

When a sketch starts working against you, the family is usually wrong. Each reference includes a fuller list; the universal version:

> **If a side note changes control flow, concurrency, ownership, or error semantics, it is not a footnote anymore — switch families.**

Quick map of common smells:

- Same conceptual child under two parents (tree) → **graph**
- Step has >1 meaningful branch, or branches rejoin (chain) → **graph** or **lanes**
- More than one actor matters, or request/response order is the point (chain or graph) → **lanes**
- Cells need sentences, not tokens (matrix) → prose, or split into smaller matrices
- "State" names are actually actions (`submit`, `approve`) (state-machine) → **chain** or **lanes**
- Cross-field rules dominate the schema (data-shape) → add `_rules:` block, or split into shape + state-machine
- Spatial layout itself carries meaning (graph) → escape to Mermaid

## Escape hatches

- **Mermaid / rendered diagram** — only when spatial layout itself carries meaning, or edge crossings actively slow reading. Try ASCII first; if it fights you, offer the user a Mermaid version or ask whether to start there.
- **Prose** — when the relation is genuinely narrative (rationale, motivation, decision history). Don't force structure on it.
- **Multiple small artifacts linked by `#id`** — beats one overloaded artifact almost every time.

## Procedure when invoked

1. Resolve the family (from `$ARGUMENTS` or by routing from intent).
2. Load the corresponding `references/<family>.md`.
3. Apply its canonical form first; reach for variants only when canonical fails.
4. Use overlay grammar consistently with the rest of the document.
5. If a smell-to-switch tripwire fires, surface it explicitly and propose the new family rather than silently mutating the form.
