# Ignore malformed message-bearing stream events

Frontier: pi-084-upgrade
Status:   done
Mode:     single
Created:  2026-08-19

Card weight: light

## Orientation

- The containing seam is the dev-only `web-driver-streaming` diagnostic assembler, which reconstructs cumulative assistant text from Pi `AgentSessionEvent` frames for the stream↔JSONL differential.
- This is one bounded PR #428 review correction on completed FE-1352 `pi-084-upgrade`; the existing branch and issue remain the execution boundary, and current PLAN sequencing must not reopen.
- No `HANDOFF.md` exists. The other FE-1352 review card owns disjoint compaction paths, so this card overlaps no active scope manifest.
- The main risk is letting a structurally cast or incompletely decoded `message_update` / `message_end` frame crash the diagnostic helper instead of leaving valid surrounding assistant text available to the oracle.

Posture: proving (inherited from `pi-084-upgrade`).

## Objective

`assembleAssistantTextFromStream` ignores incomplete message-bearing events while preserving valid assistant-text assembly.

## Light-card cold-start reads

- `memory/SPEC.md` — D67-L, D68-L, I42-L, and Verification Design’s `web-driver-streaming` battery
- `memory/PLAN.md` — Context / Recently Completed: `pi-084-upgrade`; do not change current sequencing
- `docs/archive/PLAN_HISTORY.md` — FE-1352 Pi 0.84.x upgrade closeout and its typed event-seam rationale
- `src/dev/TOPOLOGY.md` — dev-loop and Tier-2 ownership boundaries
- `docs/praxis/pi-types.md` — installed Pi declarations are executable truth; keep defensive local narrowing visibly local
- PR #428 review comment `3795348792` — malformed `message_update` / `message_end` structural-cast rival

## Acceptance Criteria

✓ `src/dev/__tests__/web-driver-streaming-support.test.ts` — a direct malformed-event regression proves that `message_update` / `message_end` events with no runtime `message`, or with non-array `message.content`, are ignored without throwing or erasing valid surrounding assistant text.

✓ `src/dev/__tests__/web-driver-streaming-support.test.ts` — valid assistant updates/end messages still assemble text blocks with the helper’s existing cumulative longest-text behavior, while non-assistant messages remain ignored.

✓ `npm test -- src/dev/__tests__/web-driver-streaming-support.test.ts` — the focused helper suite passes.

✓ `npm run verify` — the fast repository checkpoint passes with the guarded diagnostic seam.

## Verification Approach

- Inner: add a direct unit oracle with structurally malformed runtime rivals plus valid assistant and non-assistant controls, then run the focused helper suite.
- Middle: `npm run verify` proves the local narrowing type-checks, builds, and preserves the default streaming regression suite.
- Outer: not applicable; this is deterministic dev-test hardening with no user-facing or qualitative surface.

## Cross-cutting obligations

- Preserve D67-L’s typed Pi seam posture: keep `AgentSessionEvent` as the public helper input and make only the runtime narrowing needed at this local diagnostic boundary; do not introduce a broad replacement event type or deep Pi import.
- Preserve the streaming battery’s valid-frame semantics and stream↔JSONL differential; malformed frames are skipped by the assembler, not declared valid or repaired.
- Keep the change inside `src/dev/**` / test code per I42-L; do not modify production relay, RPC, projection, or session-host contracts.
- Do not absorb the separate PR #428 provider-header or subagent-preview review defects, and do not advance the planned raw-relay retirement owned by `shared-session-host-cutover`.

## Assumption dependency

None — the crash and expected skip behavior are directly observable with a focused malformed-event fixture.

## Expected touched paths (tentative)

```text
src/dev/__tests__/
├── web-driver-streaming-support.ts      ~
└── web-driver-streaming-support.test.ts +
```
