<!-- REFACTOR.md — temporary execution plan subordinate to memory/PLAN.md.
     Canonical frontier: Track A / Query ownership remediation. -->

## Problem Statement

This document no longer tracks the original wave sequence literally. Recent commits already landed a substantial portion of the intended ownership cleanup, including review-turn improvements and an initial runtime/query-management pass. A focused review of the last four commits showed that the new query-ownership work is only partially aligned with the intended design in `memory/PLAN.md` and `docs/query-domain-design.md`.

The main mismatch is structural: observer updates now target an entities query instead of `router.invalidate()`, but the entities query is still subscribed from components that render the center-pane transcript, so the chat surface remains coupled to entity refresh. The `core` and `turns` query domains are also only split at the cache-key layer while still reading from the same monolithic `/api/specifications/:id` payload, which creates a fake ownership boundary and leaves room for stale or incoherent snapshots. The index redirect route still bypasses query ownership with its own raw fetch path, and the current tests do not yet prove the ownership boundary that the plan intended.

There are also a smaller set of remaining interaction-model concerns from the earlier refactor brief that should now be treated as residual truth checks rather than as the primary plan: confirm there is no lingering observer-owned review-item proposal seam, confirm fixture and walkthrough seeds obey accepted-review authority, and confirm persisted activity-summary replay still matches current product truth after the runtime remediation.

## Baseline Already Landed

These items are no longer the active plan unless remediation work uncovers a regression:

- Review per-item commenting, regeneration context plumbing, versioned revision cards, and compact superseded-review replay landed and are already tracked in `memory/PLAN.md` as recently completed work.
- Review diffing extraction landed (`src/shared/review-diffing.ts`) and should be treated as the current baseline, not a future refactor step.
- The specification-runtime lifecycle seam was extracted into `src/client/routes/specification/$id/_view/-specification-lifecycle.ts`; the remaining question is whether its data ownership is wired correctly, not whether a runtime seam should exist at all.
- Query-client scaffolding, specification data hooks, and targeted invalidation were introduced; the remaining work is remediation and consolidation, not a greenfield query-domain build.
- The earlier naming/ownership cleanup frontier is retired in `memory/PLAN.md`; any remaining naming drift found during remediation should be fixed opportunistically, not treated as its own wave.

## Live Goal

Finish the ownership refactor from the codebase we actually have now.

## Live Design Inputs

- `memory/PLAN.md` is the canonical frontier authority; this file only decomposes execution inside that frontier item.
- `docs/query-domain-design.md` remains live for router/query ownership, loader priming, and targeted invalidation, but its earlier `core` / `turns` split should not be read literally while both are still backed by `/api/specifications/:id`.
- `docs/research/tanstack-loaders-vs-queries.md` remains live for router-as-coordinator, Query-owned freshness, targeted invalidation, and subscription placement.
- `docs/research/async-server-state-to-ui-sync-for-chat-observer-agents.md` remains live for separating chat streaming from observer-owned entity refresh and for using TanStack Query as the client sync seam.
- Not-live inputs from those docs: a separate out-of-band SSE channel, TanStack DB evaluation, or any fake micro-domain split that outruns the real server ownership boundary.

The target state is:

- one authoritative read-model ownership path for specification workflow state, landing state, and turns
- independently invalidable entity refresh that does not rerender or destabilize the center-pane transcript
- one query/runtime seam whose behavior matches the intent in `memory/PLAN.md:25-30`
- one route-loader/index-entry path that primes or reads the same owned data domains instead of bypassing them
- one verification story that proves observer updates and user mutations refresh only their owned surfaces
- one residual truth pass over review authority, fixtures, walkthrough seeds, and persisted activity-summary replay so older interaction-model goals are either explicitly closed or explicitly re-scoped

## Execution Fronts

### Front 1 - Query ownership remediation

Status: **landed on 2026-04-22** — the client now uses one authoritative specification bundle query for workflow + landing + turns; route priming, interview-controller consumption, and mutation/runtime refresh target that bundle seam; and the fake `core` / `turns` invalidation story is removed.

1. Replace the current fake `core`/`turns` split over the shared `/api/specifications/:id` payload with one authoritative interim ownership model.
2. Default remediation strategy: use one specification bundle query for workflow + landing + turns, and keep entities as the separately invalidable domain. Only introduce true split endpoints if that becomes necessary after the bundle path is clean.
3. Remove or collapse transitional invalidation helpers that imply `core` and `turns` are independently safe when they are still backed by the same server payload.
4. Keep the specification-runtime seam, but make it consume the corrected ownership boundary rather than rebuilding a synthetic specification state from fake-separated caches.

### Front 2 - Transcript/entity boundary repair

Status: **partially landed on 2026-04-22** — `InterviewView` / `useInterviewController` no longer subscribe to the entities query directly, and capture-sync progression now clears from the entity invalidation promise rather than from transcript-side `entityState` observation.

1. Move entity-query subscription out of any component that also owns or renders the center-pane transcript subtree.
2. Ensure observer-result invalidation refreshes entity-owned surfaces only: entity sidebar, graph view, and any entity-only consumers.
3. Ensure the transcript path keeps its current chat/runtime state, message continuity, and scroll stability when entities refresh.
4. Treat the desired result as stricter than "no `useChat.setMessages()` call": the transcript surface itself should stay outside the entity refresh ownership path.

### Front 3 - Loader and entry-path consolidation

Status: **landed on 2026-04-22** — `/specification/$id/` redirect decisions and `/specification/$id` route priming now both flow through `primeSpecificationBundle`, and the helper primes through one query-owned path instead of a raw redirect fetch plus bespoke cache writes.

1. Remove the raw `/specification/$id/` redirect fetch as an independent source of truth.
2. Make route loaders, redirect decisions, and cache priming all flow through the same owned specification data path.
3. Prefer loader/query priming that matches the design intent in `docs/query-domain-design.md` instead of singleton cache writes that bypass the active route/query ownership model.
4. Delete any now-obsolete transitional fetch/prime logic once one path is clearly authoritative.

### Front 4 - Ownership oracles and verification repair

1. Add route/query ownership integration tests that prove observer updates do not refetch or remount the transcript-owned bundle path.
2. Add tests that prove turn responses and phase-intent mutations refresh the specification-owned bundle path while preserving chat continuity.
3. Add an entry-path test that proves direct `/specification/$id/` navigation uses one authoritative owned fetch/prime path.
4. Treat the existing mocked-invalidator assertions as insufficient by themselves; keep them only as inner-loop unit checks under stronger integration oracles.

### Front 5 - Residual interaction-model truth pass

1. Audit for any remaining observer-owned draft requirement / criterion proposal seam. If none remains, explicitly retire that concern from this refactor.
2. Audit fixture helpers, corpus fixtures, and walkthrough seeds against current accepted-review authority. Keep only actual drift as live work.
3. Audit persisted activity-summary replay against the current runtime ownership path so hydration/replay truth is not accidentally regressed during remediation.
4. If the audit is clean, close this front with notes instead of inventing cleanup work.

### Front 6 - Cleanup and outer-loop validation

1. Delete transitional query-domain code that only existed to bridge the naive first pass.
2. Re-run walkthrough scenarios that are most sensitive to ownership and replay boundaries: `brownfield-grounding-replay`, `issue-tracker-requirements-ready`, `issue-tracker-criteria-ready`, and `issue-tracker-all-phases-closed`.
3. Record whether the remediation fully satisfies the `Track A - Query ownership` intent in `memory/PLAN.md`; if it does, retire that frontier item and shrink this document again.

## Decisions

- The original wave plan is superseded by the code that already landed. Do not continue implementing the old sequence mechanically.
- The recent runtime/query commits are treated as a provisional baseline, not as the final ownership design.
- Until the server truly exposes separate endpoints, specification workflow state, landing state, and turns should be treated as one authoritative bundle-owned seam.
- Entities remain the only separately invalidable client data domain in the near term.
- An entity query is not considered independently owned if a component subscribing to it also renders the center-pane transcript subtree.
- Keep the specification-runtime lifecycle seam, but simplify its inputs once the read-model ownership boundary is corrected.
- Residual interaction-model cleanup should be evidence-driven. If a previously suspected seam is already gone, close it instead of preserving it as ceremonial plan work.
- Do not widen this refactor into continuous workspace, layout redesign, revisit/cascade work, or new product features.

## Testing Decisions

- The key oracle comes from `memory/SPEC.md`: observer updates and user mutations must refresh only their owned surfaces.
- The primary automated proof must sit above mocked hook boundaries, at the route/query integration level.
- Manual walkthroughs remain important for scroll stability, transcript continuity, and hydration/replay legibility after remediation.
- Existing unit tests around lifecycle state, controller behavior, and review diffing remain valuable, but they are not sufficient evidence that query ownership is correct.

## Out of Scope

- Continuous workspace / phase-addressable interview surface work.
- New review features beyond preserving current semantics.
- Revisiting accepted-review UX beyond truth-preserving cleanup.
- Server endpoint proliferation unless the bundle-remediation path proves insufficient.
- Legacy compatibility shims, alias layers, or migration work for unstable local data.
