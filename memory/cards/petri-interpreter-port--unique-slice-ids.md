# Unique Slice IDs Before Petri Compilation

Frontier: petri-interpreter-port
Status:   active
Mode:     single
Created:  2026-07-09

## Orientation

- Seam: execute plan projection / plan preview -> Petri topology compilation -> runtime/replay artifact identity.
- Frontier: `petri-interpreter-port`; this is a compiler-boundary hardening slice inside the landed Petri tracer.
- Posture: proving (inherited from `petri-interpreter-port`).
- Main risk: duplicate slice IDs currently collapse into colliding subnet, place, and transition IDs, so the runtime and replay can silently lie instead of failing loud at the compiler boundary.

## Target Behavior

Executor Petri topology compilation rejects duplicate slice IDs before emitting any subnet or transition identities.

## Full-card cold-start reads

- `memory/SPEC.md` — D111-L, D112-L, I58-L; §Future Direction “Plan execution & Petri-net compatibility”.
- `memory/PLAN.md` — frontier: `petri-interpreter-port`.
- `src/executor/TOPOLOGY.md` — `orchestrate-topology.ts`, `petri-runtime.ts`, `petri-replay.ts`, and the ownership split between raw net export, runtime facts, and replay.

## Boundary Crossings

```text
execute plan / scheduler plan slice ids
-> executor topology compiler
-> runtime transition identity / replay identity
-> raw petri export and read-side replay
```

## Risks and Assumptions

- RISK: rejecting duplicates too late still lets internal maps or exports see colliding IDs before the throw. -> MITIGATION: enforce uniqueness at the start of topology compilation, before subnet/place/transition arrays are materialized.
- RISK: only guarding the compiler leaves another silent last-wins path in replay tests or runtime helpers. -> MITIGATION: acceptance proves the compiler is the single loud boundary and that downstream callers receive the same failure through their public surface.
- ASSUMPTION: duplicate slice IDs are invalid plan input everywhere in this seam, not something any caller should preserve or auto-rewrite.
  -> IMPACT IF FALSE: the correct fix would be a higher-level normalization rule in plan projection, which is broader than this card.
  -> VALIDATE: targeted topology/runtime tests fail on duplicate IDs and no existing test requires duplicate preservation.

## Posture Check

This is a proving slice: it converts a silent collision risk into a loud boundary contract at the first topology-emitting seam. If the compiler cannot reject duplicates without breaking legitimate input, that proves the real ownership boundary is higher up in plan projection.

## Acceptance Criteria

✓ `src/executor/__tests__/orchestrate.test.ts` or a new focused topology/runtime test — compiling/materializing Petri runtime with duplicate slice IDs throws a clear duplicate-slice-id failure instead of emitting colliding transition identities.
✓ `src/executor/__tests__/petri.test.ts` or equivalent export-facing test — Petri export refuses duplicate slice IDs through the public export path rather than writing a colliding raw net artifact.
✓ Existing runtime/replay tests stay green, proving unique IDs still compile and replay exactly as before.

## Invariants Preserved

- `run.json` remains lifecycle authority; this slice only hardens plan/topology input validity — guarded by: existing executor `orchestrate`, `observer-read`, and RPC execute suites.
- Raw `petrinaut/net.json` remains an export/projection surface, not runtime truth — guarded by: `src/executor/__tests__/petri.test.ts` and read-side suites.
- Replay/runtime identity stays aligned on one topology compiler; do not add a second duplicate guard with divergent semantics downstream — guarded by: existing `petri-runtime` / `petri-replay` behavior tests staying green.

## Verification Approach

- Inner: targeted Vitest over executor topology/runtime/export tests.
- Middle: targeted Vitest over `src/executor/__tests__/orchestrate.test.ts` and `src/executor/__tests__/petri.test.ts`.
- Gate: `npm run verify`.

## Cross-cutting Obligations

- Keep the compiler as the identity owner for run/slice subnet and transition IDs.
- Fail loud instead of silently deduping, rekeying, or preserving colliding slice IDs.
- Do not add compatibility shims for duplicate IDs; this is invalid input in the current pre-release posture.

## Expected Touched Paths (Tentative)

```text
src/executor/
├── orchestrate-topology.ts         ~
├── petri-runtime.ts                ?
├── petri.ts                        ?
└── __tests__/
    ├── orchestrate.test.ts         ~
    └── petri.test.ts               ~
memory/cards/
└── petri-interpreter-port--unique-slice-ids.md +
```
