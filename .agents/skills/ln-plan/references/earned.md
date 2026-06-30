# Planning posture: earned

Load this reference when the active frontier item declares `Certainty: earned`, or when the project's `.pi/POSTURE.md` declares `certainty: earned` and the frontier inherits.

## Objective function

Optimize for **closure gain**. The next frontier should *land and lock in* something the codebase has already proved out. Landing is valuable when it eliminates a dual shape, hardens a settled decision into topology, consolidates the lexicon, or retires an obsolete carrier.

This is not "proving-posture sequencing with bigger steps." The decision kernel changes. The planner is no longer asking *"what does landing this tell us?"* — it is asking *"what does landing this close?"*

## Closure move-set

- **Materialize** — make a settled architectural decision visible in topology: file or directory placement, sub-tree split per [AGENTS.md](../../../../AGENTS.md) §fractal sub-tree pattern, or a `TOPOLOGY.md` file that locks a SPEC decision to a directory.
- **Consolidate** — bring scattered cognates of the same concept into one canonical site.
- **Name canonically** — collapse aliases, near-synonyms, or drift terms to one term; update callers, docs, and tests in the same slice.
- **Delete-as-progress** — retire obsolete code paths, fixtures, dummy data, compatibility shims, and superseded docs. Deletion is a first-class closure outcome, not janitorial overflow. Comment-rich `export {}` source files are not deletion candidates on unusedness alone; apply `AGENTS.md` §intentional topology stubs and prove the documented seam is obsolete or absorbed.
- **Retire bridges / aliases / dual paths** — under `migration: free-rewrite`, eliminate adapters, shims, and expand/contract scaffolds that have outlived their crossing. The migration scheme is not the system. (See `~/.pi/agent/APPEND_SYSTEM.md` §bridge-as-permanence.)
- **Take the bigger step** — landing a multi-file or multi-layer closure in one slice when the thinness instinct is producing redundant proof rather than closure.

## Required annotation fields

Every `Active` / `Next` frontier under earned posture must carry at least one of:

- `Closes: <ambiguity / dual shape / open decision>` — what becomes no-longer-open after landing
- `Materializes: <decision id / invariant / sub-tree>` — what gets embedded into topology
- `Canonicalizes: <term / API / location>` — what becomes the single canonical site
- `Deletes / retires: <code path / fixture / doc / bridge>` — what goes away
- `Locks in: <invariant / contract / shape>` — completion test for the closure

`Locks in` is the completion test, not the action: it answers *"what is true after this lands that was previously open?"*

## Recognition heuristic: circling

You are circling, not landing, when:

- Each new slice attaches an incremental proof to changes whose meaning is already established.
- The slice's tests rephrase what previous slices already showed.
- The planner is still maximizing tracer axes (`Lights up`, `Stabilizes`, `Retires`) on a seam where nothing material is unknown.
- "Caution" is the planner's stated reason, but no specific risk can be named that would shift the next move.

When this pattern appears, switch posture on the frontier and plan the closure move that the proving slices have been deferring.

## Guardrails

The earned posture is not a license for sprawl. Closure expands the slice *within* a defined scope; it does not expand the scope.

- **Stay inside one named seam or frontier.** "Take the bigger step" widens the work within a defined boundary; it does not redraw the boundary.
- **Name the specific closure target** in the frontier definition. "Tidy up X" is not a closure target; "collapse the dual `Foo` shapes to the `Foo` defined at `src/.../foo.ts`" is.
- **Declare touched paths** at the scope-card layer with the same discipline as proving-mode slices. Bigger does not mean undeclared.
- **Do not auto-implement adjacent work** because it would be "symmetric." Name adjacent work in the plan; let it earn its own frontier.
- **Materialization is not ritual.** Topology files and fractal sub-tree splits only fire when (a) the seam is already understood, (b) the structure carries real architectural meaning, and (c) the change reduces ambiguity or drift. Otherwise it is structural theatre.

## Regression: earned → proving

When implementation reveals a real unknown that the closure depended on, do **not** invent a third posture mode. Transition the frontier:

1. Downgrade the frontier (or the active slice within it) to `Certainty: proving`.
2. Reshape the slice as a tracer that retires the new unknown.
3. If the unknown forces the frontier itself to split or reorder, route back through `ln-plan`.

The transition is the honest move; carrying earned posture over fog is the dishonest one.

## Boundary with adjacent skills

`ln-plan` owns closure as **intent**: what must be closed, which dual shapes must disappear, where topology and lexicon must harden, which bridges retire.

`ln-refactor` owns closure as **safe mechanics**: when an earned frontier's execution is principally restructuring, the refactor plan sequences tiny behavior-preserving commits to land it.

`ln-sync` owns closure as **canonical garbage collection**: stale docs, exhausted scope cards, derivative artifacts the planner is already done with. Closure work that is part of a frontier's definition of done belongs in `ln-plan`; cleanup of finished artifacts belongs in `ln-sync`.
