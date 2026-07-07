# Demo overview — the fe-1124 → fe-1152 stack (LN), for KA

**Audience:** Kostandin, who landed the executor lane (FE-1089–FE-1125) and has not yet seen this stack.
**Purpose:** one-session walkthrough of everything that lands when the stack merges, ending exactly where his executor tooling takes over. Delete this file after the demo session; durable truth lives in `memory/SPEC.md`, `memory/PLAN.md`, and the co-located `TOPOLOGY.md` homes.

## The one-line framing

Your lane is the **engine** — the execute-mode run machinery (`src/executor/`, `ExecutionPorts`, `execute_*` tools). This stack is the **cockpit** — how a user deterministically arrives at, is oriented within, and authorizes that machinery, plus the closed capture-ingest and exchange-presentation arcs that feed it. Nothing in this stack touches run mechanics.

## What the stack contains (bottom to top)

| Branch | Frontier | What landed |
| --- | --- | --- |
| `ln/fe-1124-walkthrough-batch-2` | FE-1124 | Walkthrough seeds/fixtures, generative-scenario seed variants, findings ledger |
| `ln/fe-1134-session-orientation` | FE-1134 | Deterministic orientation dialog at every settle-point juncture (boot, post-switch, `/tree`, esc-abort, mode switch, `/consult`); `brunch.session_orientation` entries feed kick composition; esc/timeout is inert `dismissed` (D109-L) |
| `ln/fe-1137-executor-readiness` | FE-1137 | Concentric authority as code contract (`EXECUTOR_ALLOWED_TOOL_NAMES ⊇` elicitor's, write-execution stays executor-only); CODE-mode J5 entry menu (proceed / backfill / design-first / oracle-first / project-plan); readiness/backfill conduct |
| `ln/fe-1135-capture-contract` | FE-1135 | Outcome-capture contract: five governing invariants pinned in conduct homes, sweep-window exclusions, honest `formatMutateGraphResult` approval receipts |
| `ln/fe-1136-present-digest` | FE-1136 | `present_digest` end to end (D110-L): large source → prose digest offer → review vocabulary → accepted-abstract echo as sole sweep carrier; I57-L supersession/cancel probes |
| `ln/fe-1138-answering-chrome` | FE-1138 | Bordered answering chrome for every response kind (decision picker, multi-choice with None/Other discipline, free-text editor); raw `ctx.ui.select` retired; pi 0.80.3 bump |
| `ln/fe-1152-refinements` | — | Brand theme pair, konsistent structural-convention config, boot-kick ordering fix, orientation-append hardening, post-review judo cleanup |

Two arcs closed with this stack: **capture-ingest-throughline** (FE-1135 + FE-1136) and **exchange-presentation** (FE-1123 + FE-1138). The **deterministic-orientation** arc (FE-1134 + FE-1137) is inner-loop closed; outer walkthrough evidence is still owed.

## Where our work meets (the seams)

Sixteen files overlap; three are load-bearing:

1. **`src/agents/runtime/executor/active-tools.ts`** — your `execute_*` grants now live inside the FE-1137 concentric contract: the allowlist is composed from the live elicitor allowlist plus executor-only grants, enforced by `agent-runtime-authority-matrix.test.ts`. Rule going forward: *executor ⊇ elicitor; write-execution tooling stays executor-only.*
2. **`src/agents/prompts/executor.md` / `compose-prompt.ts`** — every Execute session now enters through the J5 orientation menu and opens with a readiness posture (Proceed / Negotiate / Ask) before reaching the live `execute_*` tooling and explicit-acceptance host-apply boundary.
3. **`src/app/pi-extensions.ts`** — your port composition (`GitHostPromotionPort` et al.) and the stack's `sessionOrientation` wiring meet in the same factory.

Doc reconciliation already done (2026-07-06 ln-sync on this stack): your lane is registered in SPEC as **D111-L** (executor core over injected ports), **D112-L** (run driver), **I58-L** (bounded side effects) — the D101-L/D102-L/I56-L IDs your code cited were already taken by elicitation-scratchpad decisions; references repaired, no content change.

## Demo arc (one live session, ~20 min)

1. **Cold open** → J1 orientation dialog fires before any model turn; show esc = inert "wait for me".
2. **SPEC-mode elicitation** → structured exchanges through the new bordered chrome: single-choice, multi-select (None exclusivity, Other write-in re-prompt), free-text editor.
3. **Ingest** → paste a large design note → `present_digest` offer → request changes → regenerated successor → approve → accepted-abstract echo → advisory review-set map with honest graph receipt.
4. **Mode switch** → `/switch` to CODE aborts any in-flight turn, fires the J5 readiness menu; contrast thin-seed (Ask posture) vs rich-seed (Proceed) entry.
5. **Handover** → from the CODE menu, proceed to where `execute_plan_check` / `execute_orchestrate` — your territory — takes over. You drive from here.

## Agenda items to settle with KA in the same session

- The six `memory/cards/executor-*` cards: all acceptance boxes are checked and the code exists — confirm they are exhausted so we can garbage-collect them, or name what is genuinely still open.
- FE-1107 (`orchestrator-tool-port`): close as absorbed by your lane, or narrow to any unported `../brunch` cook CLI behavior?
- KA-card confirmation: which remaining `memory/cards/executor-*` files are open vs exhausted?
- Seam ownership going forward for `active-tools.ts` / `executor.md` / `pi-extensions.ts` (both lanes edit all three).
