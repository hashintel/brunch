# Legacy present_question read-path retirement + D117-L anchor

Frontier: walkthrough-remediation-2 (FE-1187) — Group 4 cleanup slices on the stack
Status:   next
Mode:     slices
Created:  2026-07-14

## Orientation

- **Containing seam:** the persisted structured-exchange read paths that still reconstruct legacy `present_question` pending state (`src/session/structured-exchange-loop/pending-exchange.ts`, `src/exchanges/recovery.ts`), plus the sweep-watermark terminal-name classifier (`src/projections/session/sweep-watermark.ts`).
- **Frontier:** `walkthrough-remediation-2` (FE-1187). Two paired Group-4 cleanup slices that ride the stack with no standalone Linear issue/branch (PLAN.md §Cleanups — Group 4 + `legacy-question-read-path-retirement` definition).
- **Posture:** earned deletion / vocabulary convergence. D116-L's `ask` write path is settled and D125-L's live ask registry now owns driver discovery, so the transcript scan no longer serves discovery — it survives only for legacy `present_question` pending reconstruction, which this slice removes.
- **Main open risk:** an actively registered present tool still emitting `tool_meta.curr === 'present_question'`. Confirm registration before deleting. Legacy transcript schemas/projections and committed `.fixtures/runs/` artifacts remain valid historical readers/evidence and are explicitly preserved.
- **Deliberately not scoped:** the `present_digest` legacy-review compatibility branch in `recovery.ts` (lines 31–37) — different terminal, not this slice. The larger capture-conditional watermark question (A40-L) stays open; Card 2 here only anchors the terminal-name string, it does not touch watermark classification logic.

---

## Card 1 — Retire the legacy `present_question` read paths and fixtures · `done`

### Objective

Remove the persisted-transcript compatibility branches that reconstruct legacy `present_question` pending/incomplete exchanges, and the stale fixtures that only exercised them — leaving the `ask`/request-detail semantics and the `session.pendingExchange` compatibility projection intact for the live present tools.

### Light-card cold-start reads

```
- memory/SPEC.md   — D116-L (ask is the one interactive terminal), D125-L (live ask registry owns discovery)
- memory/PLAN.md    — §Cleanups Group 4 + `legacy-question-read-path-retirement` definition (Deletes/Keeps/Traceability)
- src/session/structured-exchange-loop/pending-exchange.ts — promptMode() present_question branch + respondsToPresentTool enum
- src/exchanges/recovery.ts — findIncompleteStructuredExchangePresents present_question skip (~L72)
- src/.pi/README.md — legacy-vocabulary section to delete
```

### Acceptance Criteria

```
✓ WRITE-SIDE CHECK first: `registerStructuredExchange` does not register a tool that emits `tool_meta.curr === 'present_question'`. Legacy transcript schema/projection constructors do not block this retirement and remain intact.
✓ pending-exchange.ts — the plain present_question fallback (pendingExchangeFromStructuredPresent final branch + promptMode helper) and the 'present_question' member of respondsToPresentTool are removed; review/digest/candidates reconstruction paths unchanged.
✓ recovery.ts — the present_question skip in findIncompleteStructuredExchangePresents is removed; the answered-terminal completion contract and present_digest branch are untouched.
✓ src/.pi/README.md — legacy present_question vocabulary section deleted.
✓ Tests and probe drivers that use legacy present_question solely to manufacture pending state are rewritten against active present tools; active ask/request-detail behavior stays covered. Legacy transcript schemas/projections, their contract tests, and committed .fixtures/runs/** historical evidence remain untouched.
✓ The public RPC parity proof drives the active structured-exchange grammar and no longer depends on present_question pending reconstruction; RPC handler production code remains unchanged.
✓ npm run verify green; targeted grep confirms active registration excludes present_question while preserved legacy transcript readers may still name it.
```

### Verification Approach

```
- Inner: vitest — pending-exchange, recovery, structured-exchange-loop, exchange-projection suites stay green after branch removal
- Middle: repo grep proves present_question survives only in archive/history/committed-run snapshots
- Gate: npm run verify (fix → test → build)
```

### Cross-cutting obligations

- Keep the pending-exchange scan alive as the `session.pendingExchange` compatibility projection for the live present tools — retire the `present_question` case only, not the scan.
- Pre-release posture: delete, do not shim. No alias/compat layer for the removed vocabulary.

### Assumption dependency

Depends on the D116-L write-path retirement having landed (#305). The write-side check above re-confirms it at build time rather than trusting the record.

### Expected touched paths (tentative)

```
src/session/structured-exchange-loop/pending-exchange.ts   ~
src/exchanges/recovery.ts                                   ~
src/.pi/README.md                                           ~
src/session/**/__tests__/*.test.ts                          ~  (only tests dedicated to removed pending branch)
src/exchanges/__tests__/recovery.test.ts                   ~  (only tests dedicated to removed recovery skip)
src/rpc/__tests__/handlers.test.ts                         ~  (replace legacy pending-state fixtures; no handler changes)
src/probes/public-rpc-parity-proof.ts                      ~  (drive active exchange grammar)
src/probes/__tests__/public-rpc-parity-proof.test.ts       ~  (update parity expectations)
```

---

## Card 2 — Anchor the sweep terminal-name classifier (D117-L one-liner) · `next` (independent of Card 1)

### Objective

Replace the magic terminal-name strings (`'ask'`, `'request_'`) in the sweep-watermark classifier with the shared compile-time terminal-name anchor, so a terminal rename fails closed at compile time instead of silently mis-classifying carriers.

### Light-card cold-start reads

```
- memory/SPEC.md   — D117-L (fail-closed sweep classification)
- src/projections/session/sweep-watermark.ts — the toolName === 'ask' || startsWith('request_') check (~L64-70)
- src/exchanges/schemas/** — locate the canonical terminal-name / tool-name constant to anchor against
```

### Acceptance Criteria

```
✓ The 'ask'/'request_' literals in sweep-watermark.ts reference a single canonical terminal-name source (constant or type-derived), such that renaming the terminal fails the type-check.
✓ Behavior is byte-identical: sweep-watermark.test.ts unchanged and green.
✓ No new terminal-name literal introduced elsewhere; PLAN.md §Current seams note ("compile-time terminal-name anchor is still a small cleanup") no longer applies.
```

### Verification Approach

```
- Inner: vitest — src/projections/session/sweep-watermark.test.ts stays green
- Gate: npm run verify
```

### Cross-cutting obligations

- No scope creep into the A40-L capture-conditional watermark question — anchor the name only, do not touch classification semantics.

### Assumption dependency

None — a canonical terminal-name source exists in the exchange schemas; if it does not, add the minimal constant rather than widening scope.

### Expected touched paths (tentative)

```
src/projections/session/sweep-watermark.ts   ~
src/exchanges/schemas/*.ts                    ~  (only if a shared terminal-name constant must be introduced)
```
