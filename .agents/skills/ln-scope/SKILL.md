---
name: ln-scope
description: "Define one buildable scope file: a vertical slice, a short sequence of slices, or a sweep ledger for a coverage frontier. Use when the next piece of work needs precise boundaries before building."
argument-hint: "[behavior, closure target, or sweep to scope]"
---

# Ln Scope

Define one buildable **scope file** under `memory/cards/`. A scope file is one of three execution shapes: one vertical slice, a short sequence of vertical slices, or a sweep ledger for a coverage frontier.

A card carries one of two weights:

- a **full scope card** for structural work
- a **light scope card** for bounded feature or hardening work inside settled seams

If a single vertical card's target behavior needs "and", split it into separate cards (which may live in the same file). If the work is horizontal, do not force it into card form — use `Mode: sweep` only when `ln-plan` has admitted a coverage frontier.

Apply the repo's pre-release posture while scoping: prefer correcting the model and regenerating fixtures over preserving accidental compatibility, unless live docs or the user require migration support. Include deletion/retirement work in the slice when obsolete code, data, or terminology would otherwise linger.

Before slicing, apply the first ladder rung: does each piece of the requested behavior need to exist at all? The cheapest slice is the one you never build — challenge a speculative or already-covered requirement (route back to `ln-grill` / `ln-spec`) rather than scoping it. The implementation ladder (stdlib → native → installed dependency → one line) is `ln-build`'s job, not scope's.

## Input

The behavior to deliver: $ARGUMENTS

Orient before weighting.

If `memory/SPEC.md` exists, use its lexicon and respect its live invariants.

If `memory/PLAN.md` exists, check whether the named work is already represented as a frontier item in `Sequencing` (`Active`, `Next`, `Parallel / Low-conflict`, or `Horizon`) and `Frontier Definitions`.

Treat the containing `memory/PLAN.md` frontier item as the Linear-issue / branch boundary. Here, a frontier item means the canonical plan item, preferably keyed by a stable frontier id in `Frontier Definitions`, not the scope file you are about to write. Your scope file may narrow that frontier item into the next buildable slice, slice sequence, or sweep, but scope-file granularity alone does **not** imply a new issue or branch. Only route to `ln-plan` for new frontier items when the frontier itself must be split or reordered.

If this is a fresh thread or an unfamiliar area, also read `HANDOFF.md` if present. Read `docs/archive/PLAN_HISTORY.md` only if the frontier rationale or touched area is still unclear.

Write a 2-4 bullet orientation note naming the containing seam, the relevant frontier item, volatile handoff state, and the main open risk.
Also name any frontier-level cross-cutting obligations that this slice must preserve or establish (for example a shared command-layer invariant, a side-task/event-substrate rule, or a replay/property/adversarial verification layer).

Name the inherited **certainty posture** explicitly: `Posture: proving (inherited from <frontier-id>)` or `Posture: earned (inherited from <frontier-id>)`. If scoping reveals the posture is wrong for this slice (most commonly: an earned frontier surfaces a real unknown), downgrade to `proving` and route back through `ln-plan` if the frontier definition itself must shift. Do not silently scope earned-mode slices over fog.

Do not create new planning documents or scratch scope stores without explicit permission: canonical state stays `memory/SPEC.md` + `memory/PLAN.md`; scope files live under `memory/cards/` (below).

## Scope file storage

All scoped execution artifacts — single cards, slice sequences, and sweep ledgers — live in a **scope file** under `memory/cards/`.

### File naming

```
memory/cards/<frontier-id>--<slug>.md
```

- `<frontier-id>` is the stable id from `memory/PLAN.md` §Frontier Definitions when one applies (for example `live-graph-observer--observer-loop.md`).
- When the work is not a `memory/PLAN.md` frontier item (dev-workflow rework, tooling, repo hygiene), use a category prefix instead: `dev--<slug>.md`, `tooling--<slug>.md`, `docs--<slug>.md`. Pick whichever reads true; do not invent narrow ad-hoc categories.
- `<slug>` is short kebab-case (≤ ~5 words) capturing the concern. Discretion is fine — files are deleted when exhausted, so slug names need not be permanent.
- Double-dash `--` separates frontier from slug for readability.

### File metadata header

Every scope file starts with this header:

```md
# <human-readable title>

Frontier: <frontier-id> | n/a
Status:   active | superseded | done
Mode:     single | slices | sweep
Created:  YYYY-MM-DD
```

`Mode: single` means one vertical card in this file. `Mode: slices` means several vertical cards intended as a sequential mini-queue. `Mode: sweep` means the file holds a **closed enumerated ledger** for a coverage frontier (see [§Sweep scope files](#sweep-scope-files-mode-sweep)). Independent concerns belong in **separate files**, not separate sections within one file.

### Why one file per concern, not one file for everything

The `memory/cards/` directory is a scoping inbox where multiple agents can deposit independent scope files in parallel without colliding on a single shared file. Each file is the unit of work one `ln-build` invocation consumes.

The card does **not** inline canonical context — it points to the Cold-start reads block in whichever card template it uses. The full execution context is the card *plus* the canonical docs its Cold-start reads enumerate, which `ln-build` reloads on a fresh thread. A card therefore need not be self-contained to be cold-buildable; it must make its required reads explicit. "Free-standing enough for a separate builder thread" means *its Cold-start reads are complete*, not *its content is duplicated* — inlining SPEC/PLAN text into the card duplicates canonical truth and invites drift.

Multiple scope files per frontier are permitted — independent concerns that land on the same branch, not separate issues/branches (the frontier item stays the tracker/branch boundary, per the orientation rule above).

## Sliced scope files (`Mode: slices`)

When the containing seam is settled and the next 2–5 commit-sized steps are obvious, write them as a `Mode: slices` scope file. Load [`references/slices.md`](references/slices.md) first — the hard anti-speculation gate, the all-must-be-true conditions, and sequence discipline live there.

## Sweep scope files (`Mode: sweep`)

A `Mode: sweep` scope file is the execution artifact for a **coverage frontier** admitted by `ln-plan` — a closed enumerated ledger of one capability layer whose DoD is aggregate (every required row closed). Load [`references/sweep.md`](references/sweep.md) before writing the ledger, and [`../ln-plan/references/coverage.md`](../ln-plan/references/coverage.md) for the admission gate and anti-patterns.

## Overlap-as-independence-test

When considering whether to write *another* scope file for the same frontier alongside an existing one, apply the overlap test: compare declared **Expected touched paths** across the two proposed files.

If their primary write paths overlap, the concerns are not independent. Resolve before writing:

- **merge** them into one file (`Mode: slices`) if the work is naturally sequential, or
- **reshape** the boundary so the two files own disjoint write paths

Shared read-only paths or shared test-fixture paths are not overlap. The test applies to files the cards will create, modify, or delete as primary write targets.

Path overlap declared at scope time = collision at build time. The touched-paths section is a manifest, not just navigation.

## Scope-weight decision

For vertical `single` / `slices` files, choose one before writing each scope card. Sweep ledgers use row discipline instead.

### Full scope card

Use this when the work:

- establishes or changes a seam / boundary
- changes a requirement, assumption, decision, or invariant
- crosses more than two major boundaries
- would alter future planning if it landed differently
- is the first touch in an unfamiliar seam from a fresh thread

### Light scope card

Use this when the work is a bounded feature, hardening task, or bugfix inside settled seams you can already name.

If a light scope card later trips the promotion checklist below, stop and explicitly promote it to a full scope card.

If you cannot name the containing seam, the governing decision, or the live invariant family that contains the work, it is not settled enough for light mode.

## Full scope card

### Target Behavior

What is true when this slice is done? Single declarative sentence — observable, testable, no conjunctions.

### Full-card cold-start reads

The canonical context a fresh builder thread must resolve **before** building this card. Pointers, not copies — name the exact ids/paths to load; never restate their content here (that duplicates canonical truth and invites drift).

```
- memory/SPEC.md   — decisions / invariants / assumptions: <ids>  (e.g. D53-L, A4-L)
- memory/PLAN.md    — frontier: <frontier-id>
- HANDOFF.md        — <live state this card depends on>            (omit if none)
- <`TOPOLOGY.md` / other canonical doc> — <what to read there>  (omit if none)
```

This block is the answer to "could a separate builder thread work this card cold?" If you cannot enumerate the reads that make the card resolvable, the card is under-scoped — not the reader under-briefed.

### Boundary Crossings

Every boundary the slice passes through, entry to exit:

```
→ [entry point]
→ [layer / boundary]
→ [exit point]
```

### Risks and Assumptions

```
- RISK: [what might not work] → MITIGATION: [how to handle it]
- ASSUMPTION: [what we're assuming]
    → IMPACT IF FALSE: [what breaks / rework cost / blast radius across queued cards or other frontiers]
    → VALIDATE: [cheapest proof — spike, fixture, contract test, prototype]
    → [→ memory/SPEC.md §Assumptions id]
```

### Posture check

Apply the check matching the inherited certainty posture. See [`ln-plan/references/proving.md`](../ln-plan/references/proving.md) and [`ln-plan/references/earned.md`](../ln-plan/references/earned.md) for the full posture doctrine.

**Proving posture.** A good tracer-bullet slice scores on at least one of three convergent axes: **proof of life** (lights up a new end-to-end path), **invariants** (locates or stabilizes a seam), **uncertainty** (retires a load-bearing assumption from `memory/SPEC.md` §Assumptions). The best slices score on more than one.

If the slice depends on a high-impact assumption that landing it will not retire:

1. **Reshape, don't defer.** Rework the slice so landing it *is* the proof — a tracer bullet that breaks if the assumption is wrong almost always beats a study step in this codebase.
2. **Spike exception.** Route to `ln-spike` only when no vertical slice would be cheaper than a pure probe (third-party API contract, vendor perf characteristic, research-grade unknown).

"High-impact" means the assumption being false would force rework across more than this slice — invalidating queued cards, changing the chosen module shape from `ln-design`, or forcing a different frontier-level sequencing decision.

A tracer bullet should *tell you something*. Build it.

**Earned posture.** A good closure slice answers at least one of:

- What dual shape, ambiguity, or open decision does landing this **close**?
- What settled decision does it **materialize** into topology (file/directory placement, sub-tree split, topology file)?
- What term, API, or location does it **canonicalize**?
- What obsolete code path, fixture, doc, or bridge does it **delete / retire**?
- What invariant, contract, or shape does it **lock in** as the completion test?

If the answer is "none of these — it just incrementally proves something already proved," you are circling. Either reshape the slice into a closure move, or recognize that the frontier itself has become an earned closure that the proving slices have been deferring.

Earned slices may legitimately span multiple files or layers — "take the bigger step" is licensed under earned posture — but the guardrails in `references/earned.md` still bind: one named seam, named closure target, declared touched paths, no auto-implementation of adjacent work.

If scoping surfaces a real unknown that closure depended on, downgrade the slice to proving and re-run the proving branch above.

### Acceptance Criteria

```
✓ [test name] — [observable assertion]
✓ [test name] — [observable assertion]
```

**Every leaf names its oracle.** The `[test name]` half is not decoration: bind each leaf to the test file/name, command, or named check that proves it. An unbound assertion is satisfiable by vibes — a builder can report "done" against prose that nothing enforces. If you cannot name the oracle for a leaf, either the verification approach is under-designed (route to `ln-oracles`) or the leaf is not actually observable (rewrite it). For leaves that must hold on *existing* tests, name the suite explicitly — "X stays green" binds only if X is named and running (a skipped suite satisfies an unnamed leaf silently).

**Notation aid.** When acceptance is more than a handful of leaves, decompose it with `pseudo tree` (obligation decomposition variant) so each leaf maps to one assertion. Use `pseudo lanes` when the slice crosses actor boundaries; `pseudo state-machine` when it changes a lifecycle.

### Invariants preserved (conditional)

Include this section when the card is fix-, refactor-, cutover-, or migration-shaped — any slice whose danger is *losing* existing behavior rather than failing to add new behavior. Acceptance states what becomes true; this section states what must **remain** true, each with the oracle that guards it:

```
- [invariant that must survive] — guarded by: [test/suite/probe, or "ambient — name it in a comment"]
- [invariant that must survive] — guarded by: [...]
```

Ambient contracts are the ones that die silently in rewrites — fallback ladders, precedence orders, degraded-context behavior, capability guards. If an invariant's only guard is "the old code happened to do it," the card must either name a test to pin it or direct the builder to move (not rewrite) the carrying code. Mark stop-the-line invariants explicitly: a red there is a respec signal, not a fixture to update.

### Verification Approach

Name the oracle strategy for this slice.

```
- Inner: [oracle family] — [what it proves]
- Middle: [oracle family] — [what it proves] (if applicable)
- Outer: [oracle family] — [what it proves] (if applicable)
```

**Outer verification is owned, never ambient.** "(if applicable)" means the slice has no user-facing or qualitative surface — it does not license deferral. When the slice's motivation includes user-facing behavior (and always when the card defers manual verification), the outer line must either bind to an acceptance leaf of this card or name the owning frontier, Horizon row, or findings-ledger entry (with a re-entry trigger) that carries the deferred evidence — see `docs/praxis/manual-testing.md` §Findings ledger discipline. "Outer beats ride a later lane" without a named owning frontier is a scope defect, not a disposition. The same rule applies to light cards.

### Cross-cutting obligations

List any shared subsystem, invariant, or verification-layer obligations inherited from the containing frontier that this slice must preserve or advance.

```
- [obligation]
- [obligation]
```

### Expected touched paths (tentative)

Required. Declare the directories and files this card will create, modify, or delete, using `pseudo tree` notation with overlay markers (`+` add, `~` modify, `-` delete, `?` uncertain).

Scope to directory/file level — not function-level. Show the focused subtree, not the whole repo. The paths are **tentative** — `ln-build` may diverge during red/green, but the declared set is the manifest used by the overlap-as-independence-test and by parallel agents to detect collision.

Example:

```
src/observer/
├── loop.ts            ~
├── loop.test.ts       ~
└── handlers/
    ├── tool.ts        +
    └── tool.test.ts   +
src/legacy/observer.ts ?
```

## Light scope card

### Objective

Single sentence: what this work changes for the user, operator, or codebase.

### Light-card cold-start reads

The canonical pointers a fresh builder must resolve before building — ids/paths, not copies.

```
- memory/SPEC.md   — <decision / invariant ids>          (or None)
- memory/PLAN.md    — frontier: <frontier-id> | category concern
- HANDOFF.md        — <live state>                        (if any)
```

If you cannot name what makes this card resolvable cold, it is not settled enough for light mode.

### Acceptance Criteria

```
✓ [observable result]
✓ [observable result]
```

Bind behavioral leaves to a named oracle (test, command, or check) just as in full cards; light cards may leave genuinely trivial leaves (doc edits, config values) oracle-free.

### Verification Approach

```
- Inner: [command / test family]
- Middle: [if needed]
- Outer: [if needed]
```

### Cross-cutting obligations

For light cards, include this section whenever the containing frontier definition or `memory/SPEC.md` names shared obligations that would be easy to miss during implementation.

```
- [obligation]
```

### Assumption dependency

State one of:

- `None` — this slice's correctness does not hinge on any live `memory/SPEC.md` §Assumptions
- `Depends on: <SPEC assumption id(s)>` — and a one-line note on why those assumptions are validated enough to build against

If a light card would have to mark `Depends on:` a high-impact unvalidated assumption, promote to a full scope card and apply the **Posture check** (the proving-posture branch in particular).

### Expected touched paths (tentative)

Required when the card creates or deletes files, crosses a seam, or expects to touch more than ~3 paths. Optional for genuinely tiny edits (one or two files inside a settled module).

Use the same `pseudo tree` form as full scope cards.

### Promotion checklist

If any answer is yes, stop treating the work as light and promote it to a full scope card before routing to `ln-build`. Do not quietly carry durable change under a light card.

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Traceability

Canonical reconciliation is **mandatory**; durable updates are **conditional**.

- Full scope card: update `memory/SPEC.md` / `memory/PLAN.md` as needed during or after scoping.
- Light scope card: run the promotion checklist explicitly. If it stays light, canonical reconciliation may be a no-op; if it promotes, reconcile the durable change before build.
- Multi-card scope file: keep the cards inside the scope file itself; do not mirror them into `memory/PLAN.md` unless the frontier item itself changes. At most, add a lightweight `Current execution pointer` in the frontier definition listing the active scope file path(s).

Do not let the scope card strip away cross-cutting obligations just because the implementation slice is narrow. The card should make visible any shared architecture or verification rule the builder must carry while working locally.

When adding or updating an assumption, apply the same-item test first:

- **Same assumption** = same boundary/component + same unresolved claim

## Routing

After the scope file is complete, present these options to the user (use `tool-ask-question`):

| #   | Label          | Target       | Why |
| --- | -------------- | ------------ | --- |
| 1   | Build it       | `ln-build`   | The scope file is defined and verified enough to implement |
| 2   | Design oracles | `ln-oracles` | The verification strategy still needs explicit design |
| 3   | Spike first    | `ln-spike`   | Technical uncertainty should be retired before coding |
| 4   | Revise spec    | `ln-spec`    | Scoping revealed a durable architectural change |
| 5   | Revise plan    | `ln-plan`    | The work no longer fits the current frontier |
| 6   | Back to triage | `ln-consult` | Scope revealed unclear state |

Recommended: **1** in nearly all cases — including when the **Posture check** fires under proving posture, because the preferred resolution is to reshape, not defer. Under earned posture, recommend **1** when the closure target is named and the slice answers at least one closure question; recommend **5 (Revise plan)** when the slice exposes that the frontier itself has become a different closure than the plan describes. Recommend **3 (Spike first)** only when no vertical slice would be cheaper than a pure probe. Recommend **2 (Design oracles)** only when verification for the reshaped slice is still genuinely unclear.

When routing to `ln-build`, name the scope file path explicitly (for example: "build `memory/cards/<frontier-id>--<slug>.md`"). `ln-build` uses a hybrid selection policy and prefers an explicit path argument.
