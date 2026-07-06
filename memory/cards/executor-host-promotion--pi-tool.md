# executor-host-promotion — Pi tool exposure slice

## Orientation

- Containing seam: `executor-host-promotion` (FE-1118), after helper-level preflight and accepted host-file apply are built.
- Frontier item: `executor-host-promotion` on `ka/fe-1118-executor-host-promotion`, stacked on `ka/fe-1112-executor-promotion`.
- Main risk: exposing host mutation to CODE mode must preserve explicit acceptance and make side effects inspectable at the Pi tool boundary.

## Scope Weight

Full scope card. This exposes the host-mutation helper through the user/agent tool surface and crosses the Pi adapter boundary.

## Target Behavior

CODE mode can run host-promotion preflight and accepted host apply through explicit Pi tools.

## Boundary Crossings

```text
CODE-mode Pi tool call
→ .pi agent-runtime registrar
→ executor host-promotion helper
→ GitHostPromotionPort
→ tool result details / side-effect report
```

## Risks and Assumptions

- RISK: host apply becomes callable without explicit acceptance. → MITIGATION: the apply tool must require `acceptedCommitSha` and return `needs_acceptance` / `acceptance_mismatch` without mutation when absent or stale.
- RISK: tool result hides host mutation side effects. → MITIGATION: details must preserve the helper result and sideEffects array exactly, and content must summarize changed files and side effects.
- RISK: default app composition forgets the new port/tool wiring. → MITIGATION: registry tests inject a fake `GitHostPromotionPort` and prove both tools register and call it.
- ASSUMPTION: two explicit tools (`execute_host_promotion_preflight`, `execute_host_promotion_apply`) are clearer than overloading `execute_promotion_prepare`. → VALIDATE: focused registry tests prove separate no-mutation and mutation surfaces with distinct parameter shapes.

## Acceptance Criteria

✓ Pi registry exposes `execute_host_promotion_preflight` when `GitHostPromotionPort` is injected and returns the preflight helper result with `sideEffects: []`.

✓ Pi registry exposes `execute_host_promotion_apply` when `GitHostPromotionPort` is injected and requires `acceptedCommitSha` before host mutation.

✓ Apply tool result preserves `host_worktree_apply` side effects and changed files in machine-readable details.

✓ Default extension composition wires the concrete app `GitHostPromotionPort` alongside existing execution ports without changing existing execute tool behavior.

## Verification Approach

- Inner: focused Vitest registry tests for tool registration, parameter handling, result details, and explicit-acceptance failure.
- Gate: `npm run verify`.

## Promotion Checklist

- [x] Does this change a requirement? It makes FE-1118 host promotion user-drivable from CODE mode.
- [x] Does this create, retire, or invalidate an assumption? It validates that separate preflight/apply tools are clearer than overloading run-local promotion prepare.
- [x] Does this make or reverse a non-trivial design decision? It exposes accepted host-file mutation at the Pi adapter boundary while preserving the helper seam.
- [x] Does this establish a new seam-level invariant? Host apply remains explicit-acceptance gated at the tool boundary and reports side effects in details.
- [x] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Recommended Next Route

Review or tie off FE-1118.
