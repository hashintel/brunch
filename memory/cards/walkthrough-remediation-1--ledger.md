# Walkthrough remediation sweep 1 ledger

Frontier: walkthrough-remediation-1
Status:   active
Mode:     sweep
Created:  2026-07-09

## Orientation

- Seam: post-PR-305 alpha walkthrough remediation over user-visible Brunch TUI/agent interaction surfaces, especially session orientation, consult menus, ask/present exchange conduct, no-auth onboarding, and seed/tool-result observability.
- Frontier: `walkthrough-remediation-1` / FE-1180, a coverage-shaped findings-contract sweep over `TESTING_FINDINGS.md` run A/C findings plus the 2026-07-09 induction lenses. Runs before walkthrough B/D, which should witness the remediated surface.
- Volatile state: `HANDOFF.md` absent at scoping time; current evidence lives in `TESTING_FINDINGS.md` and source walkthrough notes under `testing/walkthroughs/2026-07-09/`.
- Main open risk: two required rows are evidence-gated (`WR6`, `WR7`) and must diagnose first; if diagnosis reveals more than one new required row or a new sub-seam, stop and route back through `ln-plan` rather than growing this ledger silently.

Posture: mixed (inherited from `walkthrough-remediation-1`) — most rows `earned` closure over understood seams; `WR6`/`WR7` are `proving`/evidence-gated.

## Sweep preflight

1. **Boundary.** In: required closure for `TESTING_FINDINGS.md` A1–A10 and C1–C5 where the plan admitted a row, plus the 2026-07-09 induction lenses named by the frontier. Out: `spec-posture` persistence (own frontier), FE-1167 residue groups, dynamic/model-policy changes beyond evidence gathering, review-set visual design, low-priority introspection polish, and standalone markdown/node-id polish unless it is a tiny byproduct of an owned required row.
2. **Source-of-truth inputs.** Row inputs are `memory/PLAN.md` §`walkthrough-remediation-1`, `TESTING_FINDINGS.md` A/C findings, `TESTING_PLAN.md` concerns 1/4/5/6/7, SPEC decisions D99-L/D104-L/D106-L/D109-L/D115-L/D116-L/D119-L and invariant I59-L, plus the owning topology files named per row.
3. **Owner and closure.** Every required row names an owning seam and a concrete oracle below; row closure flips Status to `built` only after its owner/oracle entry is satisfied and finding dispositions are reconciled.
4. **Class.** Frontier class: buildable-now with internally evidence-gated rows `WR6` and `WR7` (diagnose-first, still required). Deferred `○` rows are not hidden DoD.
5. **Closed inventory.** The inventory below is closed for sweep admission. Add a row only for a genuinely omitted capability; if more than one missing row or a new sub-seam appears, stop and route to `ln-plan`.

## Build order

Build the first open required row whose gate is satisfied. Current next ready row: **WR6 · Themed exchange-tool failure rendering after raw JSON leak diagnosis** (evidence-gated: run `ln-diagnose` first).

## Cold-start reads for builders

- `memory/PLAN.md` — frontier `walkthrough-remediation-1`.
- `memory/SPEC.md` — D99-L, D104-L, D106-L, D109-L, D115-L, D116-L, D119-L; I57-L, I59-L.
- `TESTING_FINDINGS.md` — run A/C findings mapped by row.
- `TESTING_PLAN.md` — concerns 1, 4, 5, 6, 7; B/D closure context.
- `src/.pi/extensions/TOPOLOGY.md` — session-orientation, commands, exchanges, no-auth gate ownership.
- `src/.pi/extensions/exchanges/TOPOLOGY.md` — ask/present continuation and cancellation contracts.
- `src/.pi/components/TOPOLOGY.md` — consult/ask/workspace-dialog presentation ownership and test tiers.
- Row-specific topology / prompt-skill docs named in the row.

## Required rows

| ID | Capability | Status | Req | Fill | Owner / next | Source inputs + closure oracle |
| --- | --- | --- | --- | --- | --- | --- |
| WR1 | Mode-aware orientation menus at every juncture | `built` | ● | earned | `src/.pi/extensions/session-orientation/{juncture.ts,registrar.ts}` and `src/.pi/extensions/commands/index.ts` | Inputs: C2 and induction lens 1a/1b; D109-L. Closure oracle: per-mode juncture/registrar/command tests prove J2/J3/J4/J5/J6 derive the menu from `projectBrunchAgentState(...).operationalMode`, including Execute `/brunch:consult` re-entry showing executor choices rather than Specify choices. Built 2026-07-09: J2/J3/J4/J6 now re-project runtime state at firing time; J5 was already target-mode table-selected and remains covered. |
| WR2 | Consult-menu chrome, option content, and overflow legibility | `built` | ● | earned | `src/.pi/components/consult-menu.ts` plus session-orientation menu descriptors | Inputs: C1, C2, A9; D109-L/D119-L lexicon. Closure oracle: component direct tests, command custom-factory test, and `dev:components` preview entries prove role/spec labels use the same top/bottom label channel as pickers, options render consistently with subtext, overflow is visible, Execute drops agent-discretionary options, and the inert/manual choice is wait-flavored and last. Built 2026-07-09: consult menus now carry `[ Specify ]` / `[ Execute ]` top labels plus spec-name bottom labels through the rounded-box label channel; Specify content uses by-decision/by-example/by-proposal/prep/ingest with `Wait for me` last; Execute exposes only design/oracle/commit, plan-compilation readiness, and plan-execution choices; overflow renders an explicit scroll thumb. |
| WR3 | `/brunch:continue` as general resume-interrupted-work | `built` | ● | earned | `src/.pi/extensions/commands/` and `src/.pi/extensions/exchanges/ask/continuation.ts` | Inputs: A4, A6 cancellation notes; D119-L, D116-L, D109-L. Closure oracle: command tests prove declared-ask re-presentation remains the special case, no-auth-suppressed boot/manual-trigger origination kicks through `manual_trigger`, prior dismissals are overridden by explicit `/continue`, command strings are centralized, and ask cancellation notice names `/continue`, `/consult`, and `/mode`. Built 2026-07-09: command names moved to a shared command-name module; `/brunch:continue` now falls through to manual-trigger origination when no declared ask is open while preserving declared-ask recovery; cancelled declared continuations advertise `/brunch:continue`, `/brunch:consult`, and `/brunch:mode`. |
| WR4 | Ask comment framing echo | `built` | ● | earned | `src/exchanges/schemas`, `src/exchanges/projections/ask.ts`, `src/agents/contexts/exchanges/ask.ts` | Inputs: A6 and induction lens 2; D106-L self-contained echoes. Closure oracle: ask tuple/golden tests prove `commentPrompt` and Other-elaboration framing survive into `AskQuestionEcho` / `projectAsk` / `formatAsk` so recorded comments are legible without reopening the original UI state. Built 2026-07-09: standalone ask question echoes now preserve optional `commentPrompt` and Other-elaboration prompt framing, and `formatAsk` renders those framing lines plus Other write-in text in the golden ask tuple snapshots. |
| WR5 | Ask/present conduct contracts for Other, digest, and advisory mutation | `built` | ● | earned | `src/.pi/extensions/exchanges/ask.ts` prompt guidelines; `src/.pi/extensions/exchanges/present-digest.ts`; `src/agents/skills/ingest/SKILL.md`; `src/agents/skills/map/references/routing.md`; related prompt snapshots | Inputs: A6, A7, A8; D99-L conduct clarification, D106-L, I57-L. Closure oracle: dual-audience prompt/probe or snapshot tests prove guidance says never author an Other-equivalent listed option, never restate large present pretext in a continuation body, approved digests default to direct advisory-settlement mutation, and digest extraction uses multi-pass entity/relation/narrative guidance. Built 2026-07-09: ask/present tool guidance now forbids Other-equivalent listed options and large-pretext restatement in continuations; ingest/routing conduct now defaults accepted digests to direct advisory graph mutation and pins multi-pass extraction (entities, relations, narrative obligations), guarded by a prompt-probe test. Run B/D re-observation remains outer debt, not a substitute for inner evidence. |
| WR6 | Themed exchange-tool failure rendering after raw JSON leak diagnosis | `spec` | ● | proving | Diagnose first; owner tbd by failure path (likely `.pi/extensions/exchanges` render/fallback or agent tool-result renderer) | Inputs: A6 ask invocation JSON leak, C3 `present_candidates` retry JSON leak; D104-L render-honesty. Gate: run `ln-diagnose` to locate the raw-payload render path. Closure oracle after diagnosis: regression test proves validation/failure output renders as themed, human-legible failure text without leaking raw JSON payloads in the TUI transcript. Stop if the diagnosis identifies a wider rendering sub-seam. |
| WR7 | Seed insertion legibility after no-auth → post-login continuation diagnosis | `spec` | ● | proving | Diagnose first; owner tbd by seed/origination path (`src/agents/contexts/seeds/*`, `src/session/originate-assistant-turn.ts`, app TUI auth continuation) | Inputs: A5; D102-L as amended by D118-L, I59-L. Gate: run `ln-diagnose` on the no-auth → post-login seed path and debug mirror evidence. Closure oracle after diagnosis: seed/origination tests and/or a focused manual beat prove useful seed context is inserted before first provider conduct after login continuation, and debug mirrors identify the insertion point/trigger. Stop if this becomes `spec-posture` frontier work. |
| WR8 | No-auth onboarding surface | `spec` | ● | earned | `src/.pi/components/workspace-dialog/*`, `src/app/brunch-login.ts`, `src/app/model-policy.ts`, TUI login command wiring | Inputs: A1, A2; D115-L, I59-L. Closure oracle: no-auth boot/workspace-dialog/app login tests prove startup options do not offer dead-end model turns, warning copy is short and hides internal model policy, footer no longer shows `unknown`, pasted API keys are masked in `brunch login`, and copy steers toward in-session `/login` where appropriate. |

## Deferred / non-DoD rows

| ID | Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| WR9 | Compact `renderShell` / Brunch tool-result rendering | `spec` | ○ | earned | Defer unless it is a tiny byproduct of WR6's diagnosed render path | Finding A5. Do not pull forward as standalone work in this sweep unless WR6 makes it the same fix. |
| WR10 | `/introspect` legibility | `spec` | ○ | earned | Deferred observability polish | Finding A10. Out of DoD. |
| WR11 | Review-set TUI visual design | `new` | ○ | earned | Promote to design session / chrome frontier when prioritized | Run-A observation; explicitly out of this sweep. |
| WR12 | Markdown polish: literal `\n\n` inline rendering and node-id styling convention | `spec` | ○ | earned | Deferred unless it is a tiny byproduct of WR2 | Finding A9. Out of DoD except cheap same-seam fix while touching consult rendering. |

## Aggregate DoD

- No required `●` row remains `spec`, `new`, or `partial`; `WR6` and `WR7` are either built after diagnosis or explicitly routed back through planning with evidence.
- `TESTING_FINDINGS.md` dispositions for A1–A10 and C1–C5 are reconciled to the row outcomes without duplicating this ledger as a second plan.
- Any SPEC/PLAN/topology update required by a landed row is performed in the same row commit; otherwise the builder reports explicit canonical no-op.
- Runs B/D can proceed against the remediated surface as outer closure evidence.
