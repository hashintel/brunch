# Handoff — FE-1059 elicitor-generate

> Updated: 2026-06-24. Branch: `ln/fe-1059-elicitor-generate` (stacked on `ln/fe-1054-subagent-reconciliation-ii`, ahead 10 of origin).

## TL;DR / resume prompt

```
Resume FE-1059 elicitor-generate. The `generate` capability is built across all
three planes (intent=pick, design=synthesize, oracle=compose) as ONE plane-
parameterized skill with no schema/tool/state fork; deterministic activation is
proven through real boot. The next slice is SCOPED BUT NOT BUILT:
memory/cards/elicitor-generate--fan-out-witness-run.md — an automated real-model
fan-out witness (S1 = P3 oracle plane) that is the A31-L runtime proof. Read that
card, then ln-build S1. It needs a real model available; if none, build the
runner + skip-path and hand me the run command.
```

## Phase

Flow: `… scope → build → scope (S1) → [next: build]`

- **Last completed:** `ln-build` of the deterministic real-boot activation check + stale-golden repair → committed `8faea49f`.
- **Current:** `ln-handoff` (this). The fan-out witness slice is freshly **scoped via `ln-scope`** but **not built**.
- **Frontier:** `elicitor-generate` (FE-1059). Posture: proving.

## In-flight state (volatile — not fully on disk as code)

### 1. ACTIVE scope card — S1 fan-out witness (scoped, NOT built)

`memory/cards/elicitor-generate--fan-out-witness-run.md` exists on disk (untracked) and is **current** — it already has all six planner corrections folded in. `Mode: slices`.

- **S1 (build next):** P3 oracle-plane fan-out witness — the core A31-L runtime proof.
- **S2 (later, optional):** A1 extractive-oracle anti-prompt (separate no-fire claim + hang risk). Do NOT block S1 on S2.

What S1 builds (all detail in the card; key load-bearing points):
- A **dev runner in `src/dev/**`** (because it imports build-excluded `bootTier2RuntimeFromFixture`). Only pure marker/report utils may later go in `src/probes/**`, never importing `src/dev/**`.
- **Real product services path** — OMIT the `agentServices` override (verified: `brunch-tui.ts:480-481` applies it only when present; `:498` computes `modelAvailable` from `services.modelRegistry.getAvailable()`). Do NOT build a custom real-provider registrar.
- **Idle resumed fixture** (`bootTier2RuntimeFromFixture`, transcript resting at an idle leaf) so auto-kick can't contaminate the P3 witness.
- Pin `oracle` lens via `extensionRunner.getCommand('brunch:lens').handler('oracle', …)` then `emitBeforeAgentStart`.
- Seed accepted intent+design graph (foreign-writer `commandExecutor.createNode`, as gap-legality test does) so an oracle proposal is meaningful.
- One `session.prompt(P3)` turn **under a global timeout**.
- **Markers off canonical `session.jsonl`** (never injected): branch=oracle, `read(SKILL.md)`→`read(references/oracle.md)`, `present_candidates` emitted, and **I51-L no-write** = graph LSN/node/edge counts unchanged + no `mutate_graph` result + no approved review. NOTE: `present_review_set` is NOT a commit.
- **Status vocabulary:** `ok | skipped (getAvailable()===0) | blocked (timeout)` — none is a silent pass.
- Artifacts → `.fixtures/scratch/generate-fan-out/<run-id>/{session.jsonl,report.json}` (via `portable-report.ts` schema). Promote to `.fixtures/runs/...` only on review.
- **`markers.ts` extraction deferred** until the first run shows what's needed (both planners). If extracted: pure, buildable, unit-tested against a committed sample `session.jsonl`.

### 2. Honest automation ceiling (settled across two planners)

- **Automatable (this card):** the **fan-out half** — branch + pointer-follow + `present_candidates` + no-write. This IS the core A31-L claim.
- **NOT automatable (separate manual-TUI card, not yet scoped):** the fan-in completion — the model's own same-turn `request_response → present_review_set`. Headless `request_response` returns `unavailable: 'request_response requires interactive UI'` for choice/review. Manual TUI is the honest proof for that choreography today.
- Public RPC CAN drive a candidate pick (`present_candidates` → single-select; `session.submitExchangeResponse {answer:{optionId}}`) but that's a SYNTHETIC terminal response, not in-turn proof — parked for the fan-in card, code-verify when building it.

### 3. Pending canonical reconciliation

- **`memory/PLAN.md` is dirty (uncommitted)** — the `elicitor-generate` Status block was updated to record the fifth slice (`8faea49f`) and repoint the execution pointer at the fan-out-witness card. This edit is correct but not committed (scope-phase convention: scope files + pointer edits not committed mid-work). Next commit that touches PLAN should include it.
- **A31-L / A32-L remain `partially validated`** in `memory/SPEC.md` — they graduate only after a PROMOTED real-model run (planner #5: never cite scratch/skipped/blocked runs). The fan-out run is the A31-L runtime witness; fan-in (manual TUI) is the A32-L compose-completion witness.

## Persisted state (on disk)

- **Committed this session (FE-1059 arc):**
  - `be0b8765` present_candidates pick-only un-stub (D96-L/I51-L)
  - `9e33f10e` design-plane generate facet (synthesize, no schema)
  - `d6ed8004` oracle-plane facet + progressive-disclosure split (references/{intent,design,oracle}.md + probes.md)
  - `8faea49f` real-boot generate-activation check + regenerated 4 stale compose goldens
- **Skill on disk:** `src/.pi/skills/methods/generate-proposal/SKILL.md` (shared spine + 3 plane refs + `probes.md`). `state.ts` grants the generate triad. All committed.
- **Dirty:** `memory/PLAN.md` (M, see reconciliation above), `memory/cards/elicitor-generate--fan-out-witness-run.md` (untracked, the active card).
- **Retired this session:** 9 done scope cards deleted in `d6ed8004` (oracle slice + landed subagent-reconciliation/readiness-bands cards).
- **Test status:** the 4 deterministic suites green (43 passed: tier-2-harness, state, compose, architecture). NOTE: full vitest needs `npm rebuild better-sqlite3` first (local Node ABI mismatch `NODE_MODULE_VERSION 147 vs 137` — environmental, rebuilt once this session; DB-touching suites fail without it). `npm run check` clean (only pre-existing `unicorn(no-thenable)` warnings in `src/graph/**`, outside manifest).

## Key decisions reached this session (durable ones already in SPEC; listed for context)

- **D95-L** capability spine `capture`/`generate`/`project` over the frozen `strategy`/`lens`/`method` axes (A35-L) — dissolved the earlier grounding/elicitation/projection re-axis fork.
- **D96-L** `generate` = one deep plane-parameterized skill; fan-in is plane-keyed method CONDUCT (pick/synthesize/compose) over `present_candidates` + review-set — **NOT a schema field**. Reworded from "encoded as a field" after the design+oracle slices proved no `fan_in_mode` needed. `fan_in_mode` built only if a future plane/probe proves the UI must carry it.
- **D97-L** skill ontology provenance: consume FE-870 renderers + generated typed-vocab; hand-author judgment; cite-don't-copy. References materialize the deferred `references/` sub-shape (D85-L closure (a)).
- **I51-L** `present_candidates` is fan-out recognition only; commit only via `acceptReviewSet`/`mutateGraph`.
- **A33-L** `project` capability undesigned — needs its own `ln-design` before scope (next frontier `elicitor-project`, own issue+branch per CLAUDE.md).
- **A34-L** acquisition subagents ride `subagent-reconciliation` (FE-1054, done).

## Deferred follow-ons (named, not lost)

- The **manual-TUI fan-in completion** witness (A32-L compose proof) — not yet scoped.
- `fan_in_mode` schema/affordance — only if oracle/compose probe proves the UI must carry it.
- `generate-proposal` → `generate` rename (cosmetic; touches kinds.ts/state.ts/manifest tests).
- `capture_candidate` → review-set commit leg (the pick→commit path).
- Design-pass refresh of `docs/design/ELICITATION_QUESTIONS.md` as a D97-L heuristic-render surface (post-FE-1052 drift: `vv_method`/`vv_obligation` renames, add `story`/`unknown`/`entity`/`sketch`, four-band model). Doc carries a drift banner.
- Next frontier: **`elicitor-project`** (design-gated, A33-L) — own Linear issue + Graphite branch.

## Do first in the next thread

1. Read `memory/cards/elicitor-generate--fan-out-witness-run.md` (it's complete and corrected).
2. Confirm a real model is available in the env (`getAvailable()`); if not, build runner + skip-path and surface the run command.
3. `ln-build` S1 (P3 fan-out witness). Leave S2 (A1) and the manual-TUI fan-in for after a clean S1 run.
4. Commit the dirty `memory/PLAN.md` with the build (or sooner if PLAN is touched).
