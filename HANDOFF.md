# Handoff

> Updated 2026-06-10 after `ln-sync`. Volatile transfer state only. Delete or overwrite once the FE-847 scaffold is laid, or if `memory/SPEC.md` / `memory/PLAN.md` remain sufficient for re-entry.

## Canonical state

- `memory/SPEC.md` now owns D76-L–D78-L and I45-L–I47-L for the turn-boundary choreography layer.
- `memory/PLAN.md` now owns the frontier split:
  - `dx-tier-2-harness` (FE-847, active): thin Tier-2 DX chassis + coverage-first scaffold only.
  - `turn-boundary-reconciliation` (M7, next): assistant-visible watermark projection, `prepareNextTurn` reconciler / `worldUpdate`, submit-time mention ledger + staleness.
  - `kick-and-context-seeding` (next): honest assistant origination via `session.triggerExchange` plus boot/resume context seeding.
- **Branch decision (user, 2026-06-10): all of S0–S5 build on the single `ln/fe-847-dx-introspection-tier-2` branch under FE-847.** The three groupings stay distinct planning units (seams + traceability) but execute as sequential slices — no separate Linear issues / Graphite branches. PLAN reconciled to match (Linear/Branch lines, sequencing, dependency-edge notes).

## Sync notes

- Approved the PLAN split: keep FE-847 to S0 chassis/scaffold; keep kick+seeding a distinct planning unit from M7 reconciliation (but same FE-847 branch per the decision above).
- Tightened topology sync in `src/session/README.md`: the write-side is planned, not already implemented.
- Removed stale dependency-graph horizon residue for `turn-boundary-reconciliation` after it moved to Next.

## Oracle pre-build review (2026-06-10)

Endorsed the architecture; four hazards folded into SPEC (D76–D78, I45–I47, coverage rows, lexicon):

1. **same-session capture** — `worldUpdate` covers any not-yet-visible write incl. submit-time/freestyle capture (D18-L/D66-L), not only foreign writes.
2. **kick = conversational-debt classification** (ignore trailing continuity-only entries) → idempotent reboot-after-notice.
3. **compaction preserves the watermark carrier** so projection never regresses.
4. **guard-as-retry** — `before_provider_request` re-runs prepare once on drift, never writes; reconciler runs before prompt composition.

Plus: S1 = separate watermark projection (not `runtimeState.world.latestLsn` overload). Optional S2 split (S2a watermark+reconciler+worldUpdate / S2b adapter stamping + drains) deferred to `ln-scope`.

## Oracle final pre-scope review (2026-06-10)

Verdict: **ready to scope**, S0→S1→S2→S3→S4 sequencing on one branch sound, no reorder forced. One seam tightening + two scaffold-authoring guards folded in:

- **D78-L / I46-L** — resume-debt ignore set now explicitly includes reconciler-inserted **side-task & reviewer drains** (D15-L), not just seed / `worldUpdate` / `brunch.mention*` / `brunch.session_lifecycle`. Generalized to "any reconciler-inserted notice owing no assistant continuation." Closes an I46 fixture ambiguity where a persisted side-task notice could be misread as tail debt.
- **S0 scaffold (PLAN)** — stub **one shared continuity-entry classifier** (`isWatermarkCarrier` / `isContinuityOnlyNonDebtEntry`) so S1/S2 and S4 share one carrier/continuity-only/debt taxonomy instead of duplicating lists.
- **S0 scaffold (PLAN)** — assert `worldUpdate.items` / watermark / kick as **sets and `{specId, lsn}` properties, not payload-order goldens** (no canonical item sort specified) to keep the suite deterministic.

## Next step

Run `ln-scope` for `dx-tier-2-harness` (FE-847): real `runBrunchTui` boot + one faux turn + provider-payload/transcript oracle + fixture resume, then lay skipped scaffold tests and intentional topology stubs.

Scaffold must preserve these edge cases (now 7, post-oracle):

1. seed/full-overview snapshots advance the watermark; narrow `getNodes` / `queryNodes` reads do not
2. no redundant `worldUpdate` immediately after a seed that named the current snapshot LSN
3. resume kick uses latest-conversational-debt (ignoring trailing continuity entries), so a user tail still earns a kick after reconciler-inserted notices
4. crash-after-notice-before-provider reboot still kicks when debt is unanswered (idempotent)
5. same-session capture bumps `current_lsn` and is surfaced by next `worldUpdate` (not swallowed)
6. foreign write between snapshot read and seed insertion is not masked by the seed
7. compaction+resume preserves the watermark (no spurious `worldUpdate`)
8. a trailing reconciler-inserted side-task / reviewer drain is ignored by kick classification (owes no continuation), so it neither masks an older user/assistant debt nor manufactures a kick over a satisfied leaf
