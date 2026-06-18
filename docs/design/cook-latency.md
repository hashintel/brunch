# Cook Orchestrator Performance — Caching & Harness Strategies

**Date:** 2026-06-18
**Scope:** Latency-first analysis of the `cook` orchestrator, with emphasis on parallel-slice execution, prompt caching, and harness overhead.
**Codebase:** `brunch` · `src/orchestrator/src`
**Frontier:** backs `cook-latency-hardening` in `memory/PLAN.md` (build order P0→P5 lives there; this doc is the rationale + file:line map).
**Related:** `docs/design/orchestrator.md`.

---

## 1. How cook executes (the latency model)

Cook is a **Petri-net execution engine**. A plan is `Epics → Slices`; each slice action (`write-tests`, `write-code`, `run-tests`, `verify-epic`, `evaluate-done`) is a transition that consumes/produces tokens carrying slice state.

- Entry point: `cook-cli.ts:417` `runCook()` → `createOrchestrator(opts.policy)` (`engine.ts:46`).
- Compile → wire → run: `compileTopology` (`net-compiler.ts`) → `wireHandlers` → `net.run(policy)` (`petri-net.ts`).
- Two firing policies (`petri-net.ts`):
  - **serial** (`runSerial`, ~344): first-enabled, one at a time.
  - **parallel** (`runParallel`, 398–478): claim tokens greedily for *all* enabled transitions, fire concurrently via `Promise.allSettled`.

**Key consequence:** total wall-clock ≈ **critical path** (longest chain of dependent slices) + **per-action overhead** along it. Parallel firing widens the net; it does not shorten depth. Only three things reduce latency:

1. Make each action on the critical path return sooner (model latency + verify latency).
2. Ensure the parallel width is not secretly serialized (pool size, rate limits, worktree setup on the JS thread).
3. Cut redundant work that lands on the critical path (re-verification, cold session setup).

---

## 2. What's already well-optimized (do not touch)

- **Copy-on-write sandboxes** — `cowCopy` (`cow-copy.ts:12`) uses APFS `clonefile` (`-c`) / Linux `--reflink=auto`. `node_modules` costs ~zero disk on first copy.
- **Symlinked `node_modules` across slices** — `SHAREABLE_TOP_LEVEL_ENTRIES = {'node_modules'}` (`epic-sandbox-merge.ts:280`). One parent-owned tree linked into each slice; removes N−1 redundant copies.
- **Recent ENOSPC / verify-dep fixes** (commits `b53af978`, `865d93b6`) closed the remaining deep-copy holes: an in-slice `npm install` clobbers the symlink into a real tree, and verify-epic now links deps from the slice that installed them.
- **Idle deadline that pauses during tool calls** (`pi-actions.ts:338`, FE-864) — only true dead air trips the timeout; an in-flight `bash` re-arms it.

**One residual serialization:** `git worktree add` runs `execFileSync` on the JS thread, so concurrent slice setups queue behind each other. Minor unless many slices start simultaneously — but it's the one place "parallel" setup is actually serial.

---

## 3. Where latency actually goes (cost centers)

| Cost center | Current state | Reference |
| --- | --- | --- |
| **Model latency** | Fresh in-memory pi session per action; no prompt caching; system prompt re-uploaded cold each time | `pi-actions.ts:229`, `:301` |
| **Concurrency** | Two agent pools (`pool:test-agent`, `pool:code-agent`); `agentPoolSize` defaults to `plan.slices.length` (effectively unbounded) | `net-compiler.ts:49` |
| **Verification** | Per slice: up to 3× test runs (1 eval gate + 2 retries). Per epic: verify dir rebuilt fresh each call | `net-compiler.ts:693`, `epic-sandbox-merge.ts:5` |
| **Session cold-start** | `mkdtempSync` + `AuthStorage.create` + `resourceLoader.reload()` + fresh session per action | `pi-actions.ts:301` |
| **Model routing** | All agent actions hardcoded to `claude-opus-4-8` | `pi-actions.ts:556, 592, 632` |

---

## 4. Spike findings (2026-06-18) — caching is already on; telemetry is the real gap

A time-boxed ln-spike retired the central uncertainty behind P1. Evidence:

- pi (`@earendil-works/pi-coding-agent` 0.79.1) applies Anthropic prompt caching **by default**. CHANGELOG line 887: a `cache_control` breakpoint is placed on the last tool definition (plus system prompt + transcript); line 2158: `cacheRetention` defaults to **short (5-min)**; lines 49/56: the interactive footer reports a live cache-hit rate (`CH`).
- brunch **overrides the system prompt** with a static file (`systemPromptOverride`, `pi-actions.ts:254`) and sets empty append/skills/agents/prompts — so the prefix carries **no dynamic cwd/date drift** and is byte-stable across slices of the same action type. The system+tools prefix is therefore cacheable cross-session, server-side, within the TTL.
- **The harness captures zero usage/timing telemetry.** `runPi`'s `session.subscribe` handler reads only `text_delta` (`pi-actions.ts:389`); the comment at `:81` confirms that stream is "text/lifecycle only." pi *has* the cache-hit data (footer `CH%`), brunch just discards it.

**Consequence:** P1 is *not* "enable caching" (already on). A new **P0 — instrumentation** is the hard prerequisite: until brunch records `cacheRead`/`cacheWrite`/tokens + per-action wall-clock, none of P1–P5 can be prioritized by evidence and "where does critical-path time go" is unanswerable. P1 narrows to retention + prefix-stability + stagger-prime (below).

## 4b. Proposals (re-ranked after the spike)

### P0 — Capture usage + per-action timing telemetry  *(prerequisite for everything)*

Extend the `session.subscribe` handler (or a parallel usage hook) in `runPi` (`pi-actions.ts:389`) to record per-action `cacheRead`/`cacheWrite`/input/output tokens and wall-clock (cold-start vs prompt turn vs verify), emitted into `reports.jsonl` / the SSE stream. Output: real numbers confirming whether cross-slice prefix caching actually hits, and which node dominates the critical path. Cheap, low-risk, unblocks the rest.

### P1 — Prefix-stability + retention + prime  *(narrowed; caching already on)*

A cache **read** skips prefill of the cached prefix → directly cuts time-to-first-token on every turn, and avoids rate-limit throttling. Today this benefit is discarded: each action builds a fresh session and re-uploads the system prompt + tool defs cold.

directly cuts time-to-first-token and avoids rate-limit throttling. Caching is already on by default — so this is *not* "enable caching." The remaining wins:

1. **Bump `cacheRetention` short → long (1h).** Dependency chains and verify-epic easily exceed the 5-min default TTL between the first slice and the action that reuses the prefix.
2. **Guarantee the invariant prefix is byte-identical and first** (system prompt → tool defs → repo conventions), slice-specific content last. Spike confirms the system prompt is already static; verify nothing slice-specific leaks early.
3. **Prime once / stagger:** N parallel slices firing simultaneously with a cold-but-identical prefix all *miss* and all *write* (cache not yet populated). Staggering the first slice by ~1s lets its write land so siblings read — turns N writes into 1 write + (N−1) reads. The genuine remaining parallel-slice win.

> P1 touches `buildSessionOptions` / the pi session config — the `agent-extension-host` core contract (coordination seam with the unpublished pi-harness thread). Confirm ownership before changing retention/prefix defaults.

### P2 — Right-size `agentPoolSize` against the rate ceiling

`agentPoolSize = plan.slices.length` fires every slice's opus session at once. Past the Anthropic TPM/RPM ceiling this throttles, and throttling is **invisible latency** the net can't see. There's a sweet spot: wide enough to fill the critical path's available parallelism, narrow enough to stay under the rate ceiling. Measure the throttle rate on a real run before picking a number. (Tuning, not a code change.)

### P3 — Trim re-verification and the opus eval gate off the critical path

- **Eval gate uses opus read-only just to judge test results** (`pi-actions.ts:511`, `READ_ONLY_TOOLS='read'`). Any verdict decidable from the runner's exit status without a model turn is pure latency removed from the path.
- **Incremental build/test scope** — `build` (tsc) is cacheable; only the changed package needs rebuilding. The verify dir is currently rebuilt from scratch each call.
- Per-slice tests run up to 3× and verify-epic runs again on the merged tree — no result memoization across related slices.

### P4 — Session / prefix reuse across same-type actions

Every action pays `mkdtempSync` + auth + `resourceLoader.reload()` + fresh session. Small per call, but multiplies across every action on the critical chain — and is the same reason caching never warms. Reuse attacks P4 and P1 together.

### P5 — Model routing per action

`write-tests` scaffolding and `verify` triage may not need opus. Routing mechanical actions to Sonnet/Haiku is a direct latency + cost cut with low quality risk — A/B per action type.

---

## 5. Recommended sequence

1. **P0 — instrument** (hard prerequisite, per spike): capture `cacheRead`/`cacheWrite`/tokens + per-action timing on one real cook run, so optimization targets real numbers, not topology reasoning. Also confirms whether cross-slice prefix caching already hits.
2. **P1** (retention + prefix-stability + stagger-prime) — narrowed by the spike; shortens every node on the path.
3. **P3** (trim re-verification + eval gate) — shortens every node on the path.
4. **P2** (pool sizing) — keeps the parallel width real instead of throttled.
5. **P4 / P5** — incremental follow-ups.

P0 unblocks evidence-based prioritization; P1 and P3 shorten every node on the critical path; P2 ensures the width is real. That's the order with the most latency payoff per unit effort.

---

## Appendix — key files & lines

| Component | File | Lines |
| --- | --- | --- |
| Entry point (`runCook`) | `cook-cli.ts` | 417–663 |
| Orchestrator factory | `engine.ts` | 46–204 |
| Topology compile / wire | `net-compiler.ts` | 39–850 |
| Parallel firing policy | `petri-net.ts` | 398–478 |
| Serial firing policy | `petri-net.ts` | 344–384 |
| Agent pool sizing | `net-compiler.ts` | 45–55 |
| Pi session factory | `pi-actions.ts` | 226–292 |
| Pi runtime (drive loop) | `pi-actions.ts` | 301–444 |
| Agent action dispatch | `pi-actions.ts` | 511–699 |
| Copy-on-write | `cow-copy.ts` | 1–81 |
| Epic merge / shared entries | `epic-sandbox-merge.ts` | 272–430 |
