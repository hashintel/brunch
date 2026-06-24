# Build execution: sliced mode (`Mode: slices`)

Disclosed reference for [`ln-build`](../SKILL.md). Load when the selected scope file is `Mode: slices` and you intend to run its cards in sequence.

When a scope file is `Mode: slices` and holds several prepared cards, `ln-build` may execute them in sequence within that one file instead of routing back through the user after every commit.

Loop shape:

1. take the next ready card in the active scope file
2. **re-orient checkpoint** — before starting, verify the card's premise still holds in light of what the previous card just taught you (see Stale-downstream invalidation below)
3. decide whether it is still a real build target or is already satisfied / stale on the current branch
4. if it is real work, run red → green → refactor
5. run the verification harness
6. reconcile canonical state and update the card's status in the scope file
7. commit only if the card produced a real card-sized change
8. continue only if no stop condition fires

Stop the sliced loop immediately when any of these becomes true:

- verification fails
- the active card needs promotion to structural work
- the containing seam no longer feels settled
- a manual outer-loop verification step is now required before proceeding
- `memory/SPEC.md` or `memory/PLAN.md` needs non-trivial revision before the next card
- the remaining cards in the file are no longer obviously valid (see below)
- the user asked to pause or review between cards
- context is getting fragile enough that handoff is safer than continuing

### Stale-downstream invalidation

Even when `ln-scope` honored the hard anti-speculation gate (no card's scope was *expected* to depend on earlier-card findings), implementation can still surprise you. Between each card in a sequence, perform this explicit re-orient:

- read the next card's Target Behavior, Acceptance Criteria, and Expected touched paths
- ask: **does this card's premise still hold after what I just learned in the previous card?**
  - Did the previous build change a path, name, or interface that this card references?
  - Did the previous build retire or invalidate an assumption this card relies on?
  - Did the previous build shift the seam such that this card's boundary crossings no longer match reality?
- if any answer is yes, mark this card and every remaining card in the file as `stale` and stop the sliced loop. Route back to `ln-scope` for the rest of the sequence.

Never silently continue past a stale-downstream signal. Never silently delete a stale sequence before a replacement exists.
