# Petrinaut live parity closure

Frontier: petri-execution-parity
Status:   active
Mode:     slices
Created:  2026-07-14

Posture: proving (inherited from `petri-execution-parity`).

## Slice 1 — Timestamped failure-aware wire

Status: done

### Target Behavior

Petrinaut receives every firing with the old-main timestamp contract and terminal evidence naming all failed slices.

### Acceptance Criteria

✓ every durable transition and terminal event has one persisted ISO timestamp reused by live and replay frames.
✓ transition firing wire shape is exactly `{transitionId,input,output,ts}`.
✓ mixed parallel failure emits ordered `failedSliceIds` in status/terminal and replay/snapshot/RPC agree.
✓ a staging-contract-shaped consumer retains all transition firings in its Events timeline.

### Evidence

- `src/executor/__tests__/petri.test.ts` pins one append timestamp/object identity, strict journal parsing, and the origin/main firing differential.
- `src/rpc/__tests__/web-host.test.ts` drives mixed S3/S4 failures with S5 success and compares every streamed firing against journal order while asserting ordered failed ids on status and terminal frames.
- Focused executor, observer, RPC schema, and web-host suites pass.

## Slice 2 — Structural verification verdicts

Status: queued

### Target Behavior

Passed and failed verification follow different Petri transitions and only passing verification enables integration.

### Acceptance Criteria

✓ verify-pass and verify-fail transitions/places are explicit in frozen topology.
✓ failed S3/S4 cannot mark integration-ready places; successful S5 can integrate.
✓ restart reconstruction preserves the chosen verdict branch.
✓ terminal marking/run summary clear stale active-slice identity and retain complete failed-slice evidence.

## Slice 3 — Legible Petrinaut projection

Status: queued

### Target Behavior

Petrinaut receives a compact deterministic execution-oriented projection while raw executor topology remains unchanged.

### Acceptance Criteria

✓ projection mechanically omits zero-degree, initially-unmarked places.
✓ every streamed place/transition has finite deterministic coordinates and human-readable names.
✓ slice/attempt/epic rows remain compact and stable regardless of input array order.
✓ raw `net.json`, executor marking, transition IDs, and SSE frame order remain unchanged.
✓ replay of `run-mrkj5qqo`-shaped evidence renders all firings, failed branches, and terminal state.

## Verification

- Focused: executor Petri/replay/orchestrate + web-host live/reconnect + RPC schema suites.
- Outer: regenerate a Rust fixture run, connect before first transition, export from Petrinaut, and compare definition/initial/firings/terminal with Brunch artifacts.
- Gate: `npm run verify` and `npm run check`.
