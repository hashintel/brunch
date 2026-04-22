# CARDS — Track A / Query ownership remediation

## Orientation
- **Containing seam:** specification-scoped client query ownership across `src/client/routes/specification/$id`, especially the boundary between the specification-owned read model (`workflow`, `landing`, `turns`) and the entities-owned read model.
- **Frontier item:** `memory/PLAN.md` → **Active / Track A — Query ownership remediation**.
- **Volatile state:** `memory/REFACTOR.md` remains the temporary execution decomposition; the transcript/entity boundary slice is partially landed, but bundle ownership and entry-path consolidation are still open.
- **Main open risk:** the current fake `core` / `turns` split still implies ownership that the server does not actually provide, so later fixes could accidentally preserve misleading invalidation behavior unless the bundle seam is made explicit first.

---

## Card 1 — next
**Title:** Replace the fake `core` / `turns` split with one authoritative specification bundle domain
**Weight:** full
**Status:** next

### Target Behavior
Workflow state, landing state, and turns load and invalidate through one authoritative specification bundle query domain instead of a fake `core` / `turns` split over the same `/api/specifications/:id` payload.

### Boundary Crossings
```text
→ specification data hooks / query keys (`src/client/routes/specification/$id/-specification-data.ts`)
→ route loader priming for `/specification/$id`
→ phase sidebar + interview controller consumers
→ mutation/runtime refresh path after turn and phase actions
```

### Risks and Assumptions
```text
- RISK: consumers currently expect separate `core` and `turns` hooks, so collapsing the ownership seam could create broad churn. → MITIGATION: preserve consumer-facing ergonomics only where they still reflect the real owned bundle, and remove misleading invalidation helpers in the same slice.
- RISK: incomplete removal of fake split helpers could leave the codebase with two contradictory ownership stories. → MITIGATION: change query keys, hooks, and invalidators together in one slice.
- ASSUMPTION: until the server exposes truly separate endpoints, one specification bundle domain is the correct owned seam. → VALIDATE: targeted hook/consumer tests plus mutation refresh checks. → `memory/SPEC.md` A64 / D121
```

### Acceptance Criteria
```text
✓ Bundle-domain oracle — one specification query domain owns `workflow`, `landing`, and `turns`, and the code no longer presents fake independent `core` / `turns` ownership over the same payload.
✓ Refresh-path oracle — turn/phase refresh logic targets the specification bundle domain plus entities domain, not a fan-out across fake split invalidators.
✓ Consumer oracle — phase sidebar and interview controller still render correctly from the authoritative specification bundle seam.
```

### Verification Approach
```text
- Inner: targeted vitest coverage for specification data hooks and affected consumers.
- Middle: ownership assertions around mutation refresh behavior for bundle + entities domains.
```

---

## Card 2 — queued
**Title:** Consolidate `/specification/$id/` redirect and loader priming onto the same bundle-owned path
**Weight:** full
**Status:** queued

### Target Behavior
Direct `/specification/$id/` navigation, redirect decisions, and route-loader priming all flow through the same specification bundle ownership path instead of using a raw independent fetch.

### Boundary Crossings
```text
→ `/specification/$id/` index loader
→ shared specification bundle fetch / prime helper
→ `/specification/$id` route loader
→ redirect decision to phase route or export route
```

### Risks and Assumptions
```text
- RISK: redirect logic may accidentally duplicate fetch work or bypass cache priming again under a new helper shape. → MITIGATION: make one shared bundle-owned helper the only read path for both redirect and loader priming.
- RISK: redirect behavior for missing or closed specifications could regress during consolidation. → MITIGATION: keep redirect outcomes covered while removing the raw fetch seam.
- ASSUMPTION: bundle priming can serve both route-entry and redirect needs without introducing a second source of truth. → VALIDATE: direct-navigation tests around phase/export redirects and loader priming.
```

### Acceptance Criteria
```text
✓ Entry-path oracle — direct `/specification/$id/` navigation derives its redirect from the same bundle-owned read path used by route priming.
✓ Loader oracle — the parent specification route primes or guards the authoritative bundle domain without bespoke singleton cache writes that bypass ownership.
✓ Duplication oracle — the raw index-route fetch path is removed as an independent source of truth.
```

### Verification Approach
```text
- Inner: route-loader and data-helper tests for redirect and priming behavior.
- Middle: direct-navigation route/query integration test proving one authoritative bundle path.
```

---

## Card 3 — queued
**Title:** Add route/query ownership integration oracles for observer, mutation, and direct-navigation behavior
**Weight:** full
**Status:** queued

### Target Behavior
Automated ownership tests prove that observer updates refresh only entities while turn/phase mutations and direct navigation refresh the specification bundle without tearing down transcript continuity.

### Boundary Crossings
```text
→ route/query integration test harness
→ observer-result handling (`data-observer-result`)
→ turn-response and phase-intent mutation refresh paths
→ `/specification/$id/` direct-navigation entry route
```

### Risks and Assumptions
```text
- RISK: current tests are too mocked to prove route/query ownership, so new oracles may require harness reshaping. → MITIGATION: add the thinnest integration tests that still observe refetch/remount behavior at the route/query boundary.
- RISK: bundle consolidation could change helper names and make overly specific tests brittle. → MITIGATION: assert ownership behavior and refresh outcomes, not incidental implementation details.
- ASSUMPTION: existing vitest route coverage can host these ownership oracles without needing a new browser harness. → VALIDATE: land one observer oracle, one mutation oracle, and one direct-navigation oracle in the same suite family.
```

### Acceptance Criteria
```text
✓ Observer ownership oracle — observer-result events refresh only the entities-owned path and do not remount or refetch the transcript-owned specification bundle path.
✓ Mutation ownership oracle — turn-response and/or phase-intent mutations refresh the specification bundle path while preserving chat continuity.
✓ Entry-path oracle — direct `/specification/$id/` navigation proves one authoritative bundle fetch/prime path rather than a bypass seam.
```

### Verification Approach
```text
- Inner: vitest route/query integration tests above mocked invalidator-only assertions.
- Middle: targeted manual sanity check on a seeded scenario if the automated oracle still leaves transcript-continuity doubt.
```
