# Petrinaut live parity closure

Frontier: petri-execution-parity
Status:   done
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

Status: done

### Target Behavior

Passed and failed verification follow different Petri transitions and only passing verification enables integration.

### Acceptance Criteria

✓ verify-pass and verify-fail transitions/places are explicit in frozen topology.
✓ failed S3/S4 cannot mark integration-ready places; successful S5 can integrate.
✓ restart reconstruction preserves the chosen verdict branch.
✓ terminal marking/run summary clear stale active-slice identity and retain complete failed-slice evidence.

### Evidence

- `src/executor/__tests__/petri.test.ts` pins the frozen ingestion/pass/fail topology, removes the legacy transition, and proves a failed verdict cannot replay through integration.
- `src/executor/__tests__/orchestrate.test.ts` proves verdict-bearing restart reconstruction with no active-slice identity and direct parallel ingestion/verdict firings.
- `src/rpc/__tests__/web-host.test.ts` drives failed S3/S4 verdicts with passed/integrated S5 and checks complete terminal/run-summary failure evidence plus exact live/journal order.

## Slice 3 — Legible Petrinaut projection

Status: done

### Target Behavior

Petrinaut receives a compact deterministic execution-oriented projection while raw executor topology remains unchanged.

### Acceptance Criteria

✓ projection mechanically omits zero-degree, initially-unmarked places.
✓ every streamed place/transition has finite deterministic coordinates and human-readable names.
✓ slice/attempt/epic rows remain compact and stable regardless of input array order.
✓ raw `net.json`, executor marking, transition IDs, and SSE frame order remain unchanged.
✓ replay of `run-mrkj5qqo`-shaped evidence renders all firings, failed branches, and terminal state.

### Evidence

- `src/executor/__tests__/petri.test.ts` proves mechanical zero-degree pruning, connected empty-plan retention, unchanged raw topology, finite deterministic coordinates, reorder-stable sorted bands, attempt containment, contextual identity labels, compact `run-mrkj5qqo`-shaped bounds, and unchanged ordered firing payloads.
- `src/rpc/methods/__tests__/execute.test.ts` and `src/rpc/__tests__/web-host.test.ts` prove names and coordinates survive replay definition, RPC, and SSE while the established frame/firing order remains unchanged.
- `src/executor/petrinaut/sdcpn.ts` owns the view-only projection; `net.json`, runtime markings, connected IDs/arcs, and transition firing IDs remain executor truth unchanged.

### Completion Report

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| omit zero-degree, initially-unmarked places | met | `projects only connected or initially marked places without changing raw topology` |
| finite deterministic coordinates + contextual names | met | `retains the connected empty-plan frontier...`; `uses stable semantic columns...` |
| compact reorder-stable slice/attempt/epic bands | met | `uses stable semantic columns and sorted compact bands regardless of plan array order` |
| raw net, marking, IDs, and SSE order unchanged | met | raw-topology differential + focused web-host stream suites |
| replay run-shaped failed branches and terminal | met | `preserves projected coordinates and names while replaying run-mrkj5qqo-shaped failed branches` |

Skipped-test delta versus parent: `0`.

## Slice 4 — Parallel runtime-state parity

Status: done

### Target Behavior

Parallel admission retires stale serial slice identity before effects, and mixed terminal state remains identical across authoritative artifacts, restart, and reconnect.

### Acceptance Criteria

✓ admission clears serial active slice/epic, workspace/base, request, and result fields before parallel effects.
✓ summary and marking provenance advance in authority order without clearing failure-place tokens.
✓ failed slice ids are deduplicated in claim order.
✓ mixed S3/S4 verification failures plus S5 success agree across `run.json`, marking, `PetriProjection`, live terminal frames, restart, and reconnect.

### Evidence

- `src/rpc/__tests__/web-host.test.ts` drives serial S2 into parallel S3/S4/S5, asserts the exact cleared summary, completed and failed ids, authoritative marking/provenance and failure tokens, then proves restart adds no journal event and reconnect preserves firings plus terminal evidence.
- Focused executor Petri/orchestrate/observer and RPC execute/web-host suites pass.

### Completion Report

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| clear stale serial fields before effects | met | mixed S2 → S3/S4/S5 web-host regression |
| preserve authority order and failure tokens | met | exact marking/provenance and failure-place assertions |
| deduplicate failures in claim order | met | exact `['S3', 'S4']` summary, snapshot, projection, and frame assertions |
| restart/reconnect consistency | met | unchanged journal/detail after restart; reconnect firing/terminal equality |

Skipped-test delta versus parent: `0`.

## Slice 5 — Strict-review terminal and replay closure

Status: done

### Target Behavior

One durable journal terminal remains final across crash recovery and later metadata abandonment, while Petrinaut export exists only for causally replayable topology history.

### Acceptance Criteria

✓ every terminal caller inspects the complete journal through one append-once authority before appending.
✓ restart after journal append but before terminal snapshot persistence reuses the exact durable event and timestamp, catches up the snapshot, and appends nothing.
✓ multiple durable terminals fail closed; later abandonment cannot replace a prior terminal's firing, status, reason, timestamp, or failed-slice ids.
✓ Petrinaut export/stream requires successful raw-topology replay; verdict-fail followed by integration yields neither.
✓ run-shaped projection evidence uses a complete causally valid firing prefix and keeps the old-main firing wire unchanged.

### Evidence

- `src/executor/__tests__/orchestrate.test.ts` covers journal-ahead terminal recovery, snapshot catch-up, duplicate prevention, conflict closure, and durable-terminal finality.
- `src/executor/__tests__/observer-read.test.ts` rejects the impossible verdict-fail/integrate sequence before Petrinaut export.
- `src/rpc/__tests__/web-host.test.ts` proves failed-terminal live/reconnect equivalence after later abandonment, including original `failedSliceIds` and reason.
- `src/executor/__tests__/petri.test.ts` now drives the run-shaped viewer fixture from a complete causal prefix and retains `{transitionId,input,output,ts}`.

### Completion Report

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| append terminal once from complete journal | met | journal-ahead restart and multiple-terminal orchestrator regressions |
| preserve exact terminal and catch up snapshot | met | terminal timestamp equality plus unchanged event journal |
| durable terminal beats abandonment | met | failed-run-then-abandon live/reconnect SSE regression |
| gate export on topology causality | met | impossible verdict-fail/integrate observer regression |
| preserve old-main wire with valid fixture | met | complete run-shaped prefix and origin/main contract tests |

Skipped-test delta versus parent: `0`.

## Verification

- Focused: executor Petri/replay/orchestrate + web-host live/reconnect + RPC schema suites.
- Outer: regenerate a Rust fixture run, connect before first transition, export from Petrinaut, and compare definition/initial/firings/terminal with Brunch artifacts.
- Gate: `npm run verify` and `npm run check`.
- Manual outer comparison remains owned by KA/user; re-enter before PR tie-off when a Rust fixture run and Petrinaut instance are available.

## Review Closure — Projection contract hardening

Status: done

### Acceptance Criteria

✓ every projected node receives a unique deterministic coordinate without changing raw topology, marking, or event order.
✓ coordinate bands and fallback positions use locale-independent code-point/natural ID ordering.
✓ the complete definition stream passes a co-located strict mirror of Petrinaut staging's Brunch schema; root/place/transition unknown keys reject and `x`/`y` are required.
✓ `execute.run` requires finite coordinates, positive integer arc weights, and fixed millisecond-UTC firing timestamps.
✓ the identity-projection scale ceiling is explicit: retain full per-slice attempts now; revisit standardized subnet grouping/folding above roughly 12 slices without claiming color-fold parity.

### Evidence

- `src/executor/__tests__/petri.test.ts` covers run-shaped coordinate uniqueness across dependency, verdict, and epic-member nodes; natural-ID bands/fallbacks; and complete streamed-definition staging-schema validation.
- `src/rpc/__tests__/execute-run-schema.test.ts` table-tests accepted and rejected coordinate, arc-weight, and timestamp shapes.
- `src/executor/petrinaut/sdcpn.ts` carries the code ceiling; `src/executor/TOPOLOGY.md` owns the durable scale boundary.

## Final Medium Review Closure

Status: done

### Acceptance Criteria

✓ strict `execute.runs` and `execute.run` schemas and real responses retain `failedSliceIds`.
✓ metadata-only abandonment retains failed-slice detail, while durable terminal evidence still wins.
✓ raw and Petrinaut replay reject every event after terminal, including attempt and epic-verification facts.
✓ legacy coordinate fallback avoids explicit positions and remains globally unique and deterministic.
✓ SDCPN parsing enforces projected staging basics without rejecting legitimate full root collections.
✓ firing timestamps use TypeBox's default `date-time` format validator, rejecting impossible calendar values.

### Evidence

- RPC schema and method suites validate real failed-slice list/detail responses and calendar-invalid timestamps.
- Executor Petri and observer suites cover terminal finality, abandonment precedence, mixed coordinate fallback, and SDCPN root validation.
- Focused, full, fix, check, and build commands are recorded in the completion report for this review pass.
