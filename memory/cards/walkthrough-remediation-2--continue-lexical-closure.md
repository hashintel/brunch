# FE-1187 Continue lexical closure

Frontier: walkthrough-remediation-2
Status:   complete
Mode:     sweep
Created:  2026-07-16

## Orientation

- **Containing seam:** product-owned orientation and recovery vocabulary across the Pi menu/command adapters, their current dev previews, Brunch agent prompt resources, and canonical current-state records.
- **Frontier:** `walkthrough-remediation-2` / FE-1187 on `ln/fe-1187-remediation-4`; this is the bounded D119-L follow-through triggered after Cards 1–4 of the deterministic remediation queue.
- **Volatile state:** no `HANDOFF.md`; Cards 1–4 are committed and done. The consolidated outer checkpoint remains paused and is not implementation scope here.
- **Main risk:** a lexical sweep could accidentally rename the real `/brunch:continue` recovery path, the declared-continuation protocol, or workspace resume state instead of removing only the stale Continue=wait/proceed vocabulary.

**Posture: proving (inherited from `walkthrough-remediation-2`).**

This is an earned closure pass inside the proving frontier: D119-L already settles the meaning, and every required row removes ambiguity or materializes the settled state rather than discovering a new product behavior.

Frontier-level obligations carried by every row:

- Preserve active-root-to-leaf branch semantics, provider-auth kick gating, seed-before-kick delivery, D37-L exchange boundaries, and the two-mode/concentric-authority contract.
- Preserve the D109-L split between persistent elicitation style and one-shot process moves; no generic `brunch.session_orientation` parser/write/alias may return.
- Deterministic inner/middle proof is acceptance. Provider/manual, both-theme, R6, R12, A48-L, KA O7–O9, and the paused consolidated outer checkpoint remain owned by `walkthrough-remediation-2` and are not implementation license here.

---

## Sweep preflight

### Boundary

**In:**

- product-controlled menu titles, labels, choice/result ids, comments, and notices under `src/.pi/`
- current component-preview and parked-campaign locators that mirror the production orientation menu
- current Brunch agent prompt/skill prose under `src/agents/`
- tests that teach current orientation/recovery semantics
- D98-L/D109-L/D119-L/D120-L current-state pointers, the Continue/Wait glossary row, and PLAN's execution pointer

**Out:**

- `/brunch:continue`'s actual resume-interrupted-work behavior and truthful recovery/auth notices
- `ask({ continues })` and other declared-continuation schema/projection vocabulary
- workspace resume copy and internal `action: 'continue'` decisions
- TypeScript's `continue` keyword, generic user-authored/test-fixture prose, dependencies, generated files, root `.pi` developer-workflow prompts, archives, dated walkthrough evidence, `TESTING_FINDINGS.md`, promoted transcripts, and fixture prose
- broader repair of the parked consequential-fact campaign, A48-L semantic preflight, R6/R12, and outer walkthrough work

### Source-of-truth inputs

- `memory/SPEC.md` — D37-L, D78-L, D98-L, D109-L, D116-L, D119-L, D120-L; I59-L, I62-L, I66-L
- `memory/PLAN.md` — frontier `walkthrough-remediation-2`, arc `deterministic-orientation`
- `src/.pi/extensions/TOPOLOGY.md` and `src/session/TOPOLOGY.md` — materialized menu/carrier/recovery ownership
- the current source inventory named row-by-row below

### Ownership, closure, and class

- Each required row names one canonical owner and one focused oracle; the final row owns the aggregate negative-space check.
- The containing FE-1187 frontier remains **evidence-gated** because its provider/human checkpoint is still open. Every required row in this lexical ledger is buildable now and depends on no missing evidence.
- The inventory is closed. One genuinely omitted occurrence may be added with a reason; discovery of more than one new row or a new protocol/seam stops the sweep and routes back through `ln-plan`.

### Aggregate definition of done

Every `●` row is `have` or `built`; the aggregate lexical oracle rejects stale Continue=wait/dismiss/proceed/next-step menu vocabulary over the declared current surface while preserving every explicit negative-space category above.

---

## Ledger

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| Dismissal is absence, not an orientation pseudo-choice | `built` | `●` | `earned` | `src/.pi/extensions/session-orientation/` | Removed internal `'dismissed'` from `SessionOrientationChoice` and dialog results; Escape/timeout returns no choice and writes/fires nothing. Repaired stale command/juncture comments and replaced the fabricated retired mixed-carrier command fixture with a real inert dismissal followed by `/brunch:continue`. Parser rejection of `dismissed` and `continue` remains pinned. Touched `commands/index.ts` beyond the tentative row manifest solely to repair its stale pseudo-choice comment. Closure: `session-orientation/__tests__/index.test.ts`, `juncture.test.ts`, `commands-runtime-switch.test.ts`, and `process-move.test.ts`. |
| Orientation menu and mirror copy use work/move vocabulary | `built` | `●` | `earned` | `src/.pi/extensions/session-orientation/index.ts` | Execute now asks the user to choose a process move; component fixtures use current style/process-move vocabulary and ids. The current preview mirrors the production title, and only the parked consequential-fact campaign title/locator changed—its stale conduct fixture remains deliberately untouched. Closure: orientation index, consult-menu, component-preview registry, and campaign-runner tests. |
| Branch-flow policy copy names the actual `/new` action | `built` | `●` | `earned` | `src/.pi/extensions/commands/policy.ts` | The fork/clone refusal now says directly that `/new` starts a new session. Closure: `src/app/__tests__/brunch-tui.test.ts`. |
| Agent prompt resources do not teach Continue as generic progression | `built` | `●` | `earned` | `src/agents/skills/` | Replaced `continue through map-plans` / `Continue in …` handoff prose with direct `use` / `read` wording in `project/SKILL.md` and `map/references/map-nodes.md`; ordinary prose outside product prompt resources remains untouched. Closure: scoped lexical grep and `src/agents/skills/__tests__/registry.test.ts`. |
| Canonical event records point at materialized current state | `built` | `●` | `earned` | `memory/SPEC.md` | Update D98-L/D109-L/D119-L/D120-L materialization status/pointers without changing their decisions; correct the Continue/Wait glossary so inertness is Escape dismissal, not a no-kick menu option. PLAN points to this active ledger. Closure: `npm run check:markdown-links`, exact decision/pointer review, and topology cross-check. |
| Closed live-surface lexical negative-space oracle | `built` | `●` | `earned` | `src/.pi/extensions/__tests__/continue-lexicon.test.ts` | Added a focused static inventory over current `src/.pi/components`, `src/.pi/extensions`, and `src/agents` source/prompt files, excluding tests, fixtures, and topology prose. Historical rivals pin stale Continue=wait/dismiss/proceed/next-step menu/progression shapes; explicit negative-space examples preserve recovery commands, declared continuations, workspace resume state, parser rejection rivals, and TypeScript keywords. No new in-boundary stale occurrence was found and no source copy changed. Closure: `continue-lexicon.test.ts` and `npm run verify`. |

---

## Row acceptance details

### Dismissal identity

- `src/.pi/extensions/session-orientation/__tests__/index.test.ts` — Escape/timeout yields no selected choice and appends no carrier; same-style selection remains a real selected style that writes no duplicate.
- `src/.pi/extensions/session-orientation/__tests__/juncture.test.ts` — absent/unavailable selection starts no carrier, seed, or kick in follow-choice and boot paths.
- `src/.pi/extensions/__tests__/commands-runtime-switch.test.ts` — explicit `/brunch:continue` after an inert menu dismissal resumes through the current no-carrier path; no `brunch.session_orientation` fixture or compatibility reading is introduced.
- `src/session/__tests__/process-move.test.ts` — `dismissed` and `continue` remain rejected legacy rivals, not accepted carriers.

### Product copy

- `src/.pi/extensions/session-orientation/__tests__/index.test.ts` and `src/.pi/components/__tests__/consult-menu.test.ts` — Specify/Execute titles use **work**; no visible Continue/Wait choice renders; Escape help remains `dismisses; give another instruction`.
- `src/dev/component-preview/__tests__/registry.test.ts` and `src/dev/__tests__/consequential-fact-campaign-runner.test.ts` — current preview/locator copy follows the production title without changing parked campaign behavior.
- `src/app/__tests__/brunch-tui.test.ts` — the branch-flow refusal teaches `/new` as starting another session, not “continue.”

### Prompt and canonical closure

- `src/agents/skills/__tests__/registry.test.ts` — prompt resources remain discoverable/legal after direct wording changes.
- `src/.pi/extensions/__tests__/continue-lexicon.test.ts` — the closed current-surface inventory has no stale Continue=wait/dismiss/proceed/menu-default phrase or pseudo-choice shape.
- `memory/SPEC.md` exact review — D98-L/D109-L/D119-L/D120-L point to materialized topology; the glossary agrees with D119-L.
- `npm run verify` — default tests and build pass with no skipped-test increase.

## Invariants preserved

- `/brunch:continue` remains the general resume-interrupted-work command, including declared-ask recovery and manual-trigger origination — guarded by: `commands-runtime-switch.test.ts`, registrar tests, and exchange recovery tests.
- Workspace resume copy and `action: 'continue'` stay unchanged — guarded by: workspace-dialog, coordinator, app, and RPC handler suites.
- `ask({ continues })` and declared-continuation details stay schema-owned and unchanged — guarded by: exchange schema/projection/recovery suites.
- Escape/timeout remains inert, creates no carrier, and starts no seed/kick — guarded by: orientation index/juncture/registrar suites.
- Persistent style and one-shot move carriers remain disjoint, active-branch-relative, and capture-excluded — guarded by: elicitation-style, process-move, prompt-composition, exchange-projection, and sweep-watermark suites.
- **Stop the line:** any change to actual `/brunch:continue` behavior, workspace activation semantics, declared-continuation schema, active-branch reconstruction, provider-auth gating, or seed-before-kick ordering requires rescope/replan rather than fixture adjustment.

## Verification approach

- **Inner:** focused orientation, command, component, dev-locator, prompt-registry, parser, and branch-policy tests plus the new lexical inventory oracle.
- **Middle:** existing origination/exchange/workspace contract suites and `npm run verify` prove that wording/sentinel cleanup did not change behavior.
- **Outer:** not acceptance for this deterministic closure. Owner remains `walkthrough-remediation-2` / FE-1187's consolidated outer checkpoint; re-enter after R6, R12, R8–R10, and the named provider/manual evidence have owned dispositions.

## Expected touched paths (tentative)

```text
memory/
├── SPEC.md                                                   ~
├── PLAN.md                                                   ~
└── cards/
    └── walkthrough-remediation-2--continue-lexical-closure.md ~
src/.pi/
├── components/__tests__/consult-menu.test.ts                 ~
└── extensions/
    ├── commands/
    │   ├── index.ts                                          ~
    │   └── policy.ts                                         ~
    ├── session-orientation/
    │   ├── index.ts                                          ~
    │   ├── juncture.ts                                       ~
    │   └── __tests__/
    │       ├── index.test.ts                                  ~
    │       └── juncture.test.ts                               ~
    └── __tests__/
        ├── commands-runtime-switch.test.ts                    ~
        └── continue-lexicon.test.ts                           +
src/agents/skills/
├── project/SKILL.md                                          ~
├── map/references/map-nodes.md                               ~
└── __tests__/registry.test.ts                                ?
src/app/__tests__/brunch-tui.test.ts                          ~
src/dev/
├── component-preview/registry.ts                             ~
├── consequential-fact-campaign-runner.ts                     ~
└── __tests__/
    ├── registry.test.ts                                      ?
    └── consequential-fact-campaign-runner.test.ts             ~
src/session/__tests__/originate-assistant-turn.test.ts        ~
```

## Promotion / disposal

- A row that requires a new protocol, public seam, or product decision is promoted through `ln-plan`; it remains open here until that promoted work lands.
- More than one newly discovered row or any widening into actual recovery/workspace/exchange semantics invalidates the closed inventory and stops the sweep.
- Every required row is now `built`. Retain this completed ledger until its active PLAN execution pointer can be reconciled by the owning follow-up; this delegated row may not modify PLAN, and deleting it now would create a stale canonical link and discard the row-level closure record. The completed deterministic remediation queue can be retired by `ln-build`/`ln-sync` once this ledger carries all remaining execution context.
