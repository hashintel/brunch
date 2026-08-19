# Validate provider headers at the native compaction boundary

Frontier: pi-084-upgrade
Status:   done
Mode:     single
Created:  2026-08-19

Card weight: light

## Orientation

- The containing seam is the Pi-facing compaction registrar: auth material from `ModelRegistry.getApiKeyAndHeaders()` is adapted into native `compact(...)`'s `Record<string, string>` header input.
- This is a bounded review correction on completed FE-1352 `pi-084-upgrade`, whose branch and PR #428 remain the execution boundary; it does not reopen or revise the closed upgrade inventory.
- No `HANDOFF.md` exists. The consumed `shared-session-host-tracer--tui-teardown-authority.md` card is absent, and no active scope file declares either expected write path below.
- The main risk is a structurally cast or otherwise malformed SDK/auth value crossing at runtime while `materializeProviderHeaders` claims it has produced only strings.

Posture: proving (inherited from `pi-084-upgrade`).

## Objective

`materializeProviderHeaders` forwards only runtime string values into native compaction's `Record<string, string>` header input.

## Light-card cold-start reads

- `memory/SPEC.md` — D43-L, D67-L, and I28-L
- `memory/PLAN.md` — Recently Completed: `pi-084-upgrade`; do not change current sequencing
- `docs/archive/PLAN_HISTORY.md` — FE-1352 Pi 0.84.x upgrade closeout and the provider-header adaptation row's historical context
- `src/.pi/extensions/TOPOLOGY.md` — compaction ownership and boundary-failure behavior
- `docs/praxis/pi-types.md` — installed Pi declarations are executable truth; keep Pi-owned types public and local narrowing explicit
- PR #428 review comment `discussion_r3795348717` — the malformed non-string header rival

## Acceptance Criteria

✓ `src/.pi/extensions/__tests__/compaction-native-result.test.ts` — the provider-header materialization test injects malformed non-string runtime values alongside a valid string and proves that only the string is returned; the existing `null` deletion marker remains omitted.

✓ `npm test -- src/.pi/extensions/__tests__/compaction-native-result.test.ts` — the focused compaction suite remains green, including native compaction result and cancellation behavior.

✓ `npm run verify` — the fast repository checkpoint passes with the narrowed boundary.

## Verification Approach

- Inner: extend the existing direct materialization unit oracle with runtime malformed-value rivals, then run the focused compaction suite.
- Middle: `npm run verify` proves the narrowing still type-checks, builds, and preserves the default regression suite.
- Outer: not applicable; this is a non-user-facing trust-boundary correction with deterministic inner/middle oracles.

## Cross-cutting obligations

- Preserve D43-L/I28-L compaction behavior: valid string headers still reach native `compact(...)`, `null` remains a consumed deletion marker, and this slice does not change continuity anchors, native narrative, or cancellation semantics.
- Validate actual runtime values at the SDK/auth boundary; do not use a type predicate that asserts a stronger shape than it checks.
- Do not modify committed PR #416 work or absorb the separate malformed stream-helper and subagent-preview defects.
- Do not broaden this slice into upstream helper adoption, auth API redesign, or a new requirement for whether an all-invalid header map normalizes to `{}` or `undefined`.

## Assumption dependency

None — the defect and target contract are directly observable at the existing adapter boundary.

## Expected touched paths (tentative)

```text
src/.pi/extensions/
├── compaction/registrar.ts                    ~
└── __tests__/compaction-native-result.test.ts ~
```
