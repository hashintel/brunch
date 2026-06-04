# Create-node basis validation

Frontier: graph-tool-resilience
Status:   done
Mode:     single
Created:  2026-06-04

## Orientation

- Seam: `CommandExecutor` graph mutation boundary, specifically the single-node `createNode` path that FE-807 capture may reuse.
- Frontier: `graph-tool-resilience` / FE-808; this closes review finding #3 after `commitGraph` already rejects retired basis values.
- Main risk: `createNode` silently accepts invalid basis strings while FE-808 claims accepted nodes/edges use only `explicit | implicit`.
- Cross-cutting obligations: preserve D20-L command-result semantics, D63-L basis meaning, and I34-L no-write/no-LSN on structural-illegal input.

Posture: proving (inherited from graph-tool-resilience)

## Light scope card — validate createNode basis

### Objective

`CommandExecutor.createNode()` rejects any graph basis outside `explicit | implicit` before allocating an LSN or writing graph rows.

### Acceptance Criteria

✓ `createNode({ basis: "accepted_review_set" })` returns `structural_illegal` with a `basis` diagnostic.
✓ Invalid `createNode` basis writes no node, no change-log row, no node-kind counter row, and does not increment `graph_clock`.
✓ Valid explicit and implicit basis values still persist unchanged.
✓ Existing `commitGraph` basis validation remains unchanged.
✓ `npm run verify` passes.

### Verification Approach

- Inner: targeted `CommandExecutor` tests for createNode invalid/valid basis behavior.
- Gate: `npm run verify`.

### Cross-cutting obligations

- Preserve D63-L: basis is approval strength only, not mutation path.
- Preserve D20-L: callers see structured command results, not thrown validation errors.

### Assumption dependency

None — this directly enforces an existing SPEC decision and FE-808 acceptance claim.

### Expected touched paths (tentative)

```text
src/graph/
├── command-executor.ts        ~
└── command-executor.test.ts   ~
```

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

All checklist answers are no; keep this as a light closeout cleanup.
