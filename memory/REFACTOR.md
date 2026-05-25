<!-- REFACTOR.md — temporary derivative aid for one refactor pass.
     Delete this file when the commits below have landed and verified. -->

## Problem Statement

Two cosmetic issues surfaced in `/ln-review` of the FE-747 declarative-routing slice. Neither is load-bearing, but both make the topology layer slightly harder to read or to trust:

1. **The typed `Guard` predicate added in FE-747 collides with `TransitionContract.guard`, a pre-existing human-readable note string on the same record.** Same word, two meanings, both in `net-blueprint.ts`. Future readers will conflate.
2. **The `enumerateCandidateOutputs` tests for branching descriptors compute their expected set from the same descriptor fields the function consumes** (`handler.onTrue ∪ handler.onFalse ∪ ...`). This catches typos but would silently pass if both the descriptor emitter and the enumerator dropped a branch in lockstep — there is no behavioral anchor pinning what the function should actually return for a known fixture.

## Solution

After the refactor:

1. The typed routing predicate is named `RouteGuard` (with interpreter `evalRouteGuard`). The string note on `TransitionContract` keeps its `guard` field. No more name collision.
2. `topology.test.ts` carries at least one golden-style assertion that pins the expected output set of a specific transition (e.g. `slice-1:evaluate` in the simplePlan fixture) against hand-written, literal place names — independent of descriptor field shape.

## Commits

Each commit leaves the codebase working (full `npm run verify` green).

1. **Rename `Guard` → `RouteGuard` and `evalGuard` → `evalRouteGuard` throughout** — pure mechanical rename in `net-blueprint.ts` (type + interpreter + every descriptor field that references the type), `net-compiler.ts` (import + every consumer), and `topology.test.ts` (import + every call site). No behavior change. Run the orchestrator suite to confirm equivalence.
2. **Add golden-fixture assertions to `topology.test.ts` that pin literal expected output sets for representative branching transitions** — at minimum the action transition (`slice-1:evaluate`) and the run-tests transition. Expected sets are written as string literals, not computed from descriptor fields, so future drift in either the descriptor emitter or the enumerator surfaces immediately. Existing union-equality tests stay (they prove pairwise consistency); the goldens add the anchor.

## Decisions

- **No new module extraction.** `RouteGuard`, `evalRouteGuard`, and `enumerateCandidateOutputs` stay in `net-blueprint.ts`. The seam is settled.
- **No change to `TransitionContract.guard`.** It remains a human-readable string note. Renaming it would touch every transition emission site in `net-compiler.ts` for cosmetic gain; not worth the diff.
- **Golden fixtures live inline in `topology.test.ts`**, not in a separate snapshot file. Two or three literal-string assertions are not enough to justify a snapshot system.
- **No update to SPEC.md `I125-K`.** The invariant text already correctly describes the property; only the symbol names change.

## Testing Decisions

- Behavior under audit is "given this topology, the enumerator returns these places". The good test asserts the result for a known input — not the relationship between two implementation details.
- Module under test is `enumerateCandidateOutputs` (and `evalRouteGuard` after rename), through their public exports.
- Prior art: `engine-contract.test.ts` "Adapter: compiled net shape" section pins transition counts and contract metadata against the same `simplePlan` / `depPlan` fixtures with literal expected values. Topology tests should mirror that style for output-place enumeration.

## Out of Scope

- The other `/ln-review` findings (model tightening for `RouteGuard.always` + empty `onFalse`, verify-epic guard parity, halt-arc declarativity, file-comment tightening) — all deferred or below the action threshold.
- Any change to `wireHandlers` runtime behavior.
- Any change to existing engine-contract tests.
- Documentation generation or design-doc updates.
