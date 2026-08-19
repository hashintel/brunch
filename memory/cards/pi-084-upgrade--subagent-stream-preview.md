# Reconstruct readable subagent stream previews

Frontier: pi-084-upgrade
Status:   done
Mode:     single
Created:  2026-08-19

Card weight: light

## Orientation

- The containing seam is the sealed subagent session stream adapter: Pi-owned typed `assistantMessageEvent.text_delta` events become bounded `SubagentStreamUpdate` progress consumed by executor workers.
- This is one bounded PR #428 review correction on completed FE-1352 `pi-084-upgrade`; the existing issue and branch remain the execution boundary, and current PLAN sequencing must not reopen.
- No `HANDOFF.md` exists. The other FE-1352 review cards are done and own disjoint compaction and dev-stream paths, so no active scope manifest overlaps this card.
- The main risk is restoring readable snapshots by reintroducing the structural-cast/cumulative-message path that D67-L and FE-1352 deliberately retired, rather than accumulating only the public typed deltas inside one subscription.

Posture: proving (inherited from `pi-084-upgrade`).

## Objective

Subagent assistant progress emits bounded cumulative previews that preserve text-delta whitespace and context.

## Light-card cold-start reads

- `memory/SPEC.md` — D44-L, D67-L, D91-L, and I29-L
- `memory/PLAN.md` — Context / Recently Completed: `pi-084-upgrade`; do not change current sequencing
- `docs/archive/PLAN_HISTORY.md` — FE-1352 typed-event closeout and direct-delta rationale
- `src/.pi/extensions/subagents/TOPOLOGY.md` — sealed child-session ownership and stream-update consumers
- `docs/praxis/pi-types.md` — installed public Pi event declarations are executable truth
- PR #428 review comment `discussion_r3811654811` — standalone trimmed delta fragments

## Acceptance Criteria

✓ `src/.pi/extensions/subagents/__tests__/session-output.test.ts` — split typed text deltas, including a leading inter-fragment space and newline/indentation, produce successive readable snapshots of the accumulated assistant text rather than trimmed token fragments.

✓ `src/.pi/extensions/subagents/__tests__/session-output.test.ts` — the cumulative preview remains capped by the existing 800-character ellipsis contract, while thinking deltas, malformed rivals, and tool/status updates retain their existing behavior.

✓ `npm test -- src/.pi/extensions/subagents/__tests__/session-output.test.ts` — the focused sealed-session output suite passes.

✓ `npm run verify` — the fast repository checkpoint passes with the corrected preview adapter.

## Invariants preserved

- Pi's public typed `assistantMessageEvent.text_delta` remains the assistant-text source; do not restore structural extraction from cumulative `event.message` or deep Pi imports — guarded by: `src/.pi/extensions/subagents/__tests__/session-output.test.ts` and `npm run verify`.
- Preview accumulation is private to one session subscription and remains bounded by the existing 800-character presentation limit — guarded by: the focused split-delta/truncation regression.
- Final `runSubagent` result text, tool lifecycle updates, abort/disposal behavior, structured output, and the sealed child-session boundary remain unchanged — guarded by: the focused subagent suite and `npm run verify`.

## Verification Approach

- Inner: extend the existing typed stream-preview unit oracle with whitespace-bearing split deltas and a split truncation-boundary rival.
- Middle: `npm run verify` proves the local stateful adapter type-checks, builds, and preserves the default regression suite.
- Outer: not applicable; this deterministic progress-projection defect has direct inner/middle oracles and no qualitative UI claim.

## Cross-cutting obligations

- Preserve D67-L's typed Pi seam: accumulate only validated public text deltas needed for preview presentation; do not revive prefix-diffing, cumulative assistant-message structural casts, or `message_end` content scraping.
- Keep the correction local to the subagent subscription/preview seam; do not change `SubagentStreamUpdate`, `AgentRunUpdate`, persisted executor stream schemas, or consumer semantics.
- Do not absorb the separate PR #428 provider-header or dev-stream malformed-event defects, and do not revise canonical state for this bounded review fix.

## Assumption dependency

None — the fragment loss and expected cumulative snapshots are directly observable through the existing injected-session stream test.

## Expected touched paths (tentative)

```text
src/.pi/extensions/subagents/
├── session.ts                           ~
└── __tests__/session-output.test.ts     ~
```
