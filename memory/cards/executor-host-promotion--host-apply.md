# executor-host-promotion — explicit host apply slice

## Orientation

- Containing seam: `executor-host-promotion` (FE-1118), after preflight established read-only diff inspection.
- Frontier item: `executor-host-promotion` on `ka/fe-1118-executor-host-promotion`, stacked on `ka/fe-1112-executor-promotion`.
- Main risk: this is the first deliberate host-file mutation; branch/ref/index mutation must still stay out of scope.

## Scope Weight

Full scope card. This crosses the hard host-mutation boundary and establishes the explicit-acceptance apply seam.

## Target Behavior

Host apply mutates the host worktree to match a validated promoted run diff after explicit acceptance.

## Boundary Crossings

```text
future host-promotion Pi tool or core helper
→ run metadata / promotion.json
→ host-promotion preflight
→ run worktree promoted commit patch
→ host worktree file mutation report
```

## Risks and Assumptions

- RISK: apply mutates the wrong host state or stale promotion. → MITIGATION: rerun preflight inside apply and require the accepted commit SHA to match the current promoted SHA before mutation.
- RISK: apply clobbers local host edits. → MITIGATION: app-layer apply must run a no-write check first and fail closed when the patch cannot apply cleanly.
- RISK: apply accidentally creates a commit, branch, ref, or staged index state. → MITIGATION: tests assert host HEAD/ref and index remain unchanged; only host worktree files may change.
- ASSUMPTION: applying the promoted commit patch to the host worktree without committing is the right first host-mutation layer. → VALIDATE: focused tests prove accepted apply changes files and leaves branch/ref/index unchanged.

## Acceptance Criteria

✓ Core apply returns `needs_acceptance` without side effects when no accepted commit SHA is supplied.

✓ Core apply reruns preflight and refuses stale or mismatched accepted commit SHA before mutation.

✓ App/core apply checks the promoted patch before writing and reports `apply_failed` without host file/index/ref mutation on conflicts.

✓ App/core apply changes only host worktree files for the promoted diff; it does not commit, create refs, switch branches, or stage the host index.

## Verification Approach

- Inner: focused Vitest tests for explicit acceptance, stale metadata, conflict/no-write failure, and successful host file mutation with unchanged HEAD/ref/index.
- Gate: `npm run verify`.

## Promotion Checklist

- [x] Does this change a requirement? It materializes FE-1118's first accepted host-file mutation layer.
- [x] Does this create, retire, or invalidate an assumption? It validates that patch-to-worktree without commit/ref/index mutation is the right first host apply layer.
- [x] Does this make or reverse a non-trivial design decision? It chooses host worktree patch application before any host commit/ref operation.
- [x] Does this establish a new seam-level invariant? Host apply requires accepted commit SHA confirmation and reruns preflight before mutation.
- [x] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Recommended Next Route

Scope Pi tool exposure if FE-1118 needs user-drivable CODE-mode host apply before tie-off.
