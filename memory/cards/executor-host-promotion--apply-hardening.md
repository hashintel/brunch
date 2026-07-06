# executor-host-promotion — host apply hardening slice

## Orientation

- Containing seam: `executor-host-promotion` (FE-1118), after helper/app/Pi host promotion surfaces are built.
- Frontier item: `executor-host-promotion` on `ka/fe-1118-executor-host-promotion`, stacked on `ka/fe-1112-executor-promotion`.
- Review trigger: `ln-review` found the real `git apply` stdin boundary lacks an integration oracle, the apply result type admits an impossible state, and a dead path alias remains.

## Scope Weight

Light scope card. This is bounded hardening inside the established FE-1118 host-promotion seam.

## Objective

Harden host apply by proving the real git patch path and tightening the public apply result shape.

## Acceptance Criteria

✓ `src/app/__tests__/git-host-promotion-port.test.ts` uses real temp git repositories to prove a promoted commit patch applies to host files without changing host HEAD or staging the index.

✓ `src/app/__tests__/git-host-promotion-port.test.ts` uses real temp git repositories to prove conflicting host edits fail at `git apply --check` without mutating host files.

✓ `HostPromotionApplyResult` excludes the impossible `preflight_ready` pass-through state.

✓ The unused `hostPromotionReportPath` alias is deleted unless a real caller exists.

## Verification Approach

- Inner: focused Vitest tests for `git-host-promotion-port` and `host-promotion` type/behavior coverage.
- Gate: `npm run verify`.

## Build Result

- Done: real temp-git success and conflict tests cover the app-layer patch path.
- Done: `HostPromotionApplyResult` excludes `preflight_ready`.
- Done: unused `hostPromotionReportPath` alias deleted.
- Verification: focused host-promotion tests pass; full gate pending at the time this card was reconciled.

## Promotion Checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Recommended Next Route

Build it with `ln-build`.
