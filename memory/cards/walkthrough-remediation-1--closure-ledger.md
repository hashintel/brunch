# Walkthrough remediation sweep 1 — audit closure ledger

Frontier: walkthrough-remediation-1
Status:   active
Mode:     sweep
Created:  2026-07-10

## Orientation

- Seam: FE-1180's user-visible orientation, recovery, onboarding-security, prompt-conduct, debug-evidence, and TUI presentation surfaces.
- Frontier: `walkthrough-remediation-1` / FE-1180, reopened after the 2026-07-10 `ln-review` + `ln-witness` pass found mechanism-vs-meaning gaps after WR1–WR8.
- Volatile state: `HANDOFF.md` is pre-WR13 transfer provenance; its WR13-next row status is superseded by `memory/PLAN.md` and this ledger. The audit findings are reconciled into `TESTING_FINDINGS.md`, D120-L/I60-L, and `memory/PLAN.md` WR13–WR18.
- Main risk: a builder could make tests green by pinning labels, ids, directives, or debug callbacks separately while the production path still diverges. Every required row therefore crosses the real consumer or user-facing boundary named below.

Posture: earned (inherited from `walkthrough-remediation-1`) for WR13–WR17; WR18 is evidence-gated outer closure.

Cross-cutting obligations:

- D120-L / I60-L: one semantic identity across visible Execute choice, persisted id, provider directive, and workflow.
- D109-L / D119-L: dismissal remains inert; explicit `/brunch:continue` resumes through honest product origination.
- D115-L / I59-L: no provider turn fires without an available allowlisted model; non-model product functions remain available.
- D69-L / D97-L: debug mirrors are passive evidence, not a second runtime or truth store.
- Verification design: structural claims require production-consumer evidence; UX feel and model conduct remain outer-loop judgments.

## Sweep preflight

1. **Boundary.** In: only WR13–WR18 from `memory/PLAN.md` — Execute semantic identity, continue completion honesty, interactive login secrecy, live WR5 guidance composition, production debug-mirror legibility, and focused outer closure. Out: WR9 compact tool rendering, WR10 `/introspect`, WR11 review-set visual redesign, WR12 markdown/node-id polish, `spec-posture`, FE-1167's wider residue, dynamic model policy, and unrelated branch cleanup.
2. **Source-of-truth inputs.** D120-L/I60-L own Execute behavior; D119-L and `KickCompletionOutcome` own continue truth; terminal bytes + auth storage own secret masking; registered tools and live skill/prompt composition own WR5 guidance; the production TUI composition and `.brunch/debug/` files own debug legibility; `TESTING_PLAN.md` owns the outer tasks.
3. **Owner and closure.** Every row below names one owning seam, expected touched paths, and a discriminating oracle. Source/prose substring tests are supporting evidence only.
4. **Class.** Evidence-gated. WR13–WR17 are buildable now. WR18 is blocked until all five are built and the source/dev TUI can be exercised against the corrected surface.
5. **Closed inventory.** WR13–WR18 are the complete audit inventory. One newly discovered omission may be added with justification; more than one or any new seam stops the sweep and returns to `ln-plan`.

## Build order

Build the first open required row in this order:

```text
WR13 Execute semantic identity [built]
  → WR14 honest continue completion [built]
  → WR15 interactive API-key secrecy [built]
  → WR16 live conduct composition [built]
  → WR17 production debug mirrors [built]
  → WR18 focused outer closure
```

WR14–WR17 may be reordered when test setup makes that cheaper, but WR18 remains last. One `ln-build` invocation closes one row and updates this ledger plus `TESTING_FINDINGS.md` when evidence changes.

## Cold-start reads

- `memory/SPEC.md` — D69-L, D97-L, D109-L, D115-L, D119-L, D120-L; I59-L, I60-L; Verification Design.
- `memory/PLAN.md` — frontier `walkthrough-remediation-1`, audit reopening inventory WR13–WR18.
- `HANDOFF.md` — pre-WR13 transfer provenance only; cold-start warning: do not treat its WR13-next row status as current because `memory/PLAN.md` and this ledger supersede it.
- `TESTING_FINDINGS.md` — A1–A10, C1–C5, and §2026-07-10 FE-1180 review/witness audit.
- `TESTING_PLAN.md` — Concerns 1, 3, 4, 5, 6, 7.
- `src/.pi/extensions/TOPOLOGY.md` — orientation, commands, no-auth gate, and debug-mirror composition.
- `src/session/TOPOLOGY.md` — orientation carrier and context-seed ownership.
- `src/agents/prompts/TOPOLOGY.md` and `src/agents/skills/TOPOLOGY.md` — live prompt/skill ownership.
- `src/dev/TOPOLOGY.md` and `docs/praxis/manual-testing.md` — debug evidence and outer-loop protocol.

## Required rows

| ID | Capability | Status | Req | Fill | Owner / next | Source inputs + closure oracle |
| --- | --- | --- | --- | --- | --- | --- |
| WR13 | Execute orientation semantic identity | `built` | ● | earned | session orientation carrier + Execute prompt/skill conduct | Built 2026-07-10: canonical ids `prepare_execution` / `compile_plan` / `execute_plan` now cross visible menu → persisted entry → context seed, and the live Execute prompt pins preparation recommendation/confirmation, compilation readiness with compile/backfill choice, and readiness-validated next-safe-unit execution. |
| WR14 | Honest general-continue completion | `built` | ● | earned | `session-orientation/juncture.ts` + command adapter | Built 2026-07-10, amended after residual review: `completeAssistantKick` returns its classified outcome; juncture/manual-trigger helpers derive `kickFired` only from `status: fired`; no-model/idle retries append no carriers; a failed kick surfaces as a warning and leaves its delivered trailing seed for the next retry to reuse; outcome callbacks remain one-per-attempt. |
| WR15 | Interactive API-key secrecy | `built` | ● | earned | `app/brunch-login.ts` + PTY probe | Built 2026-07-10: `src/probes/scripts/verify-brunch-login-secret.sh` drives `brunch login` through a real Python-stdlib PTY, proves captured terminal bytes omit the sentinel API key, proves isolated `PI_CODING_AGENT_DIR/auth.json` stores the exact key, and covers cancellation as nonzero/no-auth-write; the non-TTY test remains supporting coverage only. |
| WR16 | Live WR5 guidance composition | `built` | ● | earned | registered exchange tools + live agent skill/prompt composition | Built 2026-07-10: `exchanges-extension.test.ts` now proves registered ask/digest tool definitions expose Other/pretext/review-continuation conduct; live skill registry and composed elicitor prompt tests prove the active foreground manifest exposes `ingest` and its routed `map` reference path carrying digest-approval direct mutation and multi-pass extraction rules; the source-file substring sentinel was retired. |
| WR17 | Production debug-mirror legibility | `built` | ● | earned | TUI composition root + passive debug cache | Built 2026-07-10: `src/dev/__tests__/tier-2-harness.test.ts` now drives `/brunch:continue` through the real `runBrunchTui` boot + command wiring with debug mirroring enabled, then inspects workspace-local `.brunch/debug/entry-contents.md` and `origination.md` for seed contents, `manual_trigger`, fired outcome, and seed-entry-before-outcome record order. |
| WR18 | Focused outer closure evidence | `new` | ● | proving | manual testing protocol; blocked by WR13–WR17 | The authoritative end-of-frontier outer closure checklist is in the WR18 brief below. Every obligation must reach an allowed terminal state; `not encountered` / `not observed` leaves WR18 and FE-1180 open. |

## Row briefs

### WR13 · Execute orientation semantic identity

**Closure target:** retire the legacy offered ids `design_first` / `oracle_first` / `project_plan` and the broadened-label-over-narrow-directive dual shape.

**Required behavior:**

- Canonical offered ids name the visible workflows directly (recommended vocabulary: `prepare_execution`, `compile_plan`, `execute_plan`); under free-rewrite posture, do not add read aliases solely for local/dev transcripts.
- Preparation assesses design/oracle/commitment evidence, recommends one next prep path, and uses structured confirmation before beginning it.
- Compilation assesses readiness and offers compile-now versus backfill-first.
- Execution validates plan freshness/readiness and begins only the next safe scoped unit; stale/incomplete plans route to compilation/backfill, and no choice authorizes unattended whole-plan execution.
- Remove or regenerate stale tests/snapshots/docs that mint the retired offered ids. Existing unrelated parseable legacy ids are not widened by symmetry.

**Acceptance oracles:**

- `src/.pi/extensions/session-orientation/__tests__/index.test.ts` — canonical menu ids and labels.
- New/extended table-driven contract test crossing `runSessionOrientationDialog`/entry persistence through `formatSessionOrientationSeed` — each visible choice produces a semantically matching directive (I60-L).
- `src/agents/runtime/executor/__tests__/compose-prompt.test.ts` — live Execute prompt carries all three D120-L workflow guards, including structured confirmation and next-safe-unit ceiling.
- Existing J2–J6 and mode-switch tests stay green with canonical ids.

**Invariants preserved:**

- Escape/timeout remains `dismissed`, recorded and inert — `session-orientation` index/juncture tests.
- Specify choices and `continue`/wait behavior do not change — existing orientation and command suites.
- Plan projection remains frontier-level per D103-L; execution uses the existing `execute_*` authority boundary.

**Expected touched paths (tentative):**

```text
src/session/
├── session-orientation.ts                                      ~
├── TOPOLOGY.md                                                 ~
└── __tests__/session-orientation.test.ts                       ~
src/agents/
├── contexts/data-model/session-orientation.ts                  ~
├── prompts/executor.md                                         ~
├── runtime/executor/__tests__/compose-prompt.test.ts           ~
└── skills/                                                     ?  # only if a live skill needs D120-L workflow conduct
src/.pi/extensions/
├── TOPOLOGY.md                                                 ~
└── session-orientation/
    ├── index.ts                                                ~
    └── __tests__/{index,juncture,registrar}.test.ts             ~
src/.pi/extensions/__tests__/commands-runtime-switch.test.ts    ~
```

### WR14 · Honest general-continue completion

**Closure target:** make `kickFired` describe a fired provider turn, not a completed attempt.

**Required behavior:**

- Propagate the classified `KickCompletionOutcome` through manual-trigger origination.
- Derive `kickFired` only from `status: fired`.
- Preserve `onKickOutcome` exactly once for fired, skipped, and failed outcomes.
- `/brunch:continue` gives an honest no-model/idle/failure result and does not append duplicate seed/kick carriers on retry.

**Acceptance oracles:**

- Parameterized `juncture.test.ts` cases for fired, `no_model_available`, idle, and failed send.
- `commands-runtime-switch.test.ts` proves user-visible command behavior for no-model and failed completion while preserving successful general resume and declared-ask recovery.
- Existing D119-L cancellation/re-presentation tests remain green.

**Expected touched paths (tentative):**

```text
src/.pi/extensions/
├── session-orientation/juncture.ts                              ~
├── session-orientation/__tests__/juncture.test.ts               ~
├── commands/index.ts                                           ~
└── __tests__/commands-runtime-switch.test.ts                    ~
src/session/originate-assistant-turn.ts                          ?  # only if outcome return ownership must deepen here
src/session/__tests__/originate-assistant-turn.test.ts           ?
```

### WR15 · Interactive API-key secrecy

**Closure target:** replace false non-TTY proof with a real interactive-terminal witness.

**Required behavior:**

- PTY-captured terminal output never contains the pasted sentinel key.
- The exact key reaches Pi-shaped auth storage.
- Prompt and post-entry newline remain usable; cancellation still exits nonzero without writing auth.
- Prefer stdlib and the repository's existing cross-platform `script` pattern; add no dependency unless the PTY oracle is impossible without one.

**Acceptance oracles:**

- A new executable probe/script drives `brunch login` through a PTY on supported macOS/Linux `script` forms and checks terminal bytes plus an isolated `PI_CODING_AGENT_DIR/auth.json`.
- A Vitest wrapper or script contract test keeps the probe runnable and fails loudly when the platform lacks the declared PTY prerequisite.
- `src/app/__tests__/brunch-login.test.ts` remains as non-interactive persistence/provider-order coverage but no longer claims to prove echo suppression by itself.

**Expected touched paths (tentative):**

```text
src/app/
├── brunch-login.ts                                             ?
└── __tests__/brunch-login.test.ts                              ~
src/probes/
├── scripts/verify-brunch-login-secret.sh                       +
└── __tests__/brunch-login-secret-script.test.ts                +
package.json                                                     ?  # only if a named probe command is warranted
```

### WR16 · Live WR5 guidance composition

**Closure target:** retire tests that freeze source prose without proving the live consumer receives it.

**Required behavior:**

- Registered `ask` and `present_digest` tool objects expose the Other/pretext/review-vocabulary guidance through the same surface provider composition reads.
- The code-owned live skill registry and composed prompt manifest expose `ingest` and its routed `map` reference path; test through registry/composition APIs, not `readFile(process.cwd()/src/...)`.
- Keep exact prose flexible where a semantic assertion over the registered/composed artifact is sufficient.

**Acceptance oracles:**

- Extend `src/.pi/extensions/__tests__/exchanges-extension.test.ts` over `registerStructuredExchange` output for tool guidance.
- Extend the appropriate live prompt/skill registry composition suite to prove ingest + map routing resources are reachable from the active foreground manifest.
- Delete `src/probes/__tests__/walkthrough-remediation-conduct-contract.test.ts` when its only claims have consumer-level replacements.

**Expected touched paths (tentative):**

```text
src/.pi/extensions/__tests__/exchanges-extension.test.ts         ~
src/agents/
├── skills/__tests__/registry.test.ts                            ?
├── runtime/elicitor/__tests__/compose-live-prompt.test.ts       ?
└── runtime/executor/__tests__/compose-prompt.test.ts            ?
src/probes/__tests__/walkthrough-remediation-conduct-contract.test.ts -
```

### WR17 · Production debug-mirror legibility

**Closure target:** cross the real continuation composition root into operator-readable files.

**Required behavior:**

- A manual-trigger continuation writes the seed entry to `entry-contents.md` before its kick outcome record appears in `origination.md`.
- `origination.md` names `manual_trigger` and the classified completion outcome.
- The oracle uses the production-wired callback/cache path, not direct calls to cache helpers.
- Debug files remain passive and workspace-local; no canonical state is introduced.

**Acceptance oracles:**

- Extend `src/dev/__tests__/tier-2-harness.test.ts` or the narrowest real-boot harness to invoke the wired continuation and inspect both files in a temporary workspace.
- Existing debug-cache unit tests remain supporting evidence; the new test must fail if `brunch-tui.ts` omits the mirror wiring.

**Expected touched paths (tentative):**

```text
src/app/brunch-tui.ts                                           ?
src/dev/__tests__/tier-2-harness.test.ts                        ~
src/.pi/extensions/dev-mode/introspection/                      ?
src/dev/TOPOLOGY.md                                             ?
```

### WR18 · Focused outer closure evidence

**Evidence gate:** WR13–WR17 are `built`; the verification gate passes; testing uses disposable workbenches and scratch auth only.

#### End-of-frontier outer closure checklist — authoritative

This is the single closure inventory for WR18 and therefore for the end of `walkthrough-remediation-1`. `TESTING_PLAN.md`, Run B's worksheet, and prior findings supply scenarios and evidence; they do not own a second closure list.

| ID | Outer obligation | Required observation |
| --- | --- | --- |
| O1 | No-auth entry is safe and honest | With a scratch `PI_CODING_AGENT_DIR`, workspace/spec/session creation remains usable; no orientation or provider turn fires before auth exists; copy points to `brunch login` and `/login`; `/brunch:continue` reports no model honestly without appending seed/kick carriers; ambient auth is not read. |
| O2 | Interactive login and post-login recovery work | In the same scratch agent dir, an actual pasted credential remains visually hidden, writes only Pi-shaped scratch auth, and exposes the allowlisted provider/model policy; after login, relaunch or explicit continuation reaches normal orientation and a real seed-before-kick provider turn. |
| O3 | Run B seed/debug evidence is useful to the agent | In a reset `workspace-alpha-grounding/base` workbench, `entry-contents.md`, `origination.md`, `system-prompt.md`, and session JSONL make the seed and trigger legible; the seed precedes the first useful provider action; that action demonstrably interprets seeded graph facts/readiness rather than behaving as an ungrounded generic assistant. |
| O4 | Specify consultation and recovery affordances are usable | Live `/brunch:consult` in Specify mode presents understandable role/spec-labelled choices, routes the selected choice as described, keeps escape inert, and makes the `/continue` / `/consult` / `/mode` recovery hints noticeable and actionable where cancellation or interruption exposes them. |
| O5 | WR5 Other/pretext conduct holds live | In a live ask/present continuation, the model does not author an option equivalent to built-in Other and does not repeat a large present/digest pretext inside the continuation ask body. |
| O6 | WR5 accepted-digest mapping conduct holds live | Given an accepted digest with enough authority to map, the model defaults to supported advisory graph mutation instead of broad re-questioning and performs the required multi-pass extraction across entities, relations, and narrative obligations. |
| O7 | Execute preparation matches its promise | Selecting `prepare_execution` produces assessment of design/oracle/commitment evidence, recommends one next preparation path, and asks for structured confirmation before beginning it. |
| O8 | Execute compilation matches its promise | Selecting `compile_plan` assesses readiness and offers compile-now versus backfill-first rather than silently following a legacy directive. |
| O9 | Execute execution matches its promise | Selecting `execute_plan` validates plan freshness/readiness and begins only the next safe scoped unit; stale or incomplete plans route to compilation/backfill, never unattended whole-plan execution. |
| O10 | Both-theme visual treatment is legible | In `dev:components` and the live TUI, in both themes, consult borders remain distinguishable from mode-reactive ask/editor borders, role/spec labels read correctly, overflow thumbs are salient, and recovery hints remain visible in the states that expose them. |

**Closure rule:** each O1–O10 row must be recorded in `TESTING_FINDINGS.md` as either `pass` with exact evidence, or `promoted failure` with the finding, owner/frontier, and explicit PLAN disposition that removes it from FE-1180. `Not encountered`, `not naturally reached`, `not observed`, and missing evidence are open states and cannot close WR18. In particular, if Run B does not naturally reach O5/O6, run a focused conduct beat; absence of opportunity is not evidence.

**Execution grouping (non-authoritative):** Concern 1A covers O1–O2; Run B covers O3–O4 and may cover O5–O6; a focused conduct beat is mandatory for any O5/O6 obligation Run B does not exercise; controlled Execute sessions cover O7–O9; the both-theme component/live-TUI gallery covers O10.

**Evidence recording:**

- Append a status and exact workspace/theme/session/debug references for every O1–O10 row to `TESTING_FINDINGS.md`.
- Screenshots/source notes go under `testing/walkthroughs/<date>/`; promote runtime artifacts to `.fixtures/runs/` only when reviewed and replay-worthy.
- A failure is not fixed inside WR18 unless it is demonstrably a tiny correction inside a WR13–WR17 owner. Otherwise classify it and route through `ln-plan`; until that promotion is explicit, the obligation remains open.

**Expected touched paths (tentative):**

```text
TESTING_FINDINGS.md                                             ~
testing/walkthroughs/2026-07-10/                                +
.fixtures/runs/                                                 ?  # reviewed promotion only
memory/PLAN.md                                                   ~  # close frontier only after evidence passes
memory/cards/walkthrough-remediation-1--closure-ledger.md        -  # delete only at exhaustion
```

## Aggregate DoD

- WR13–WR18 are `have` or `built`; no required row is `spec`, `new`, or `partial`.
- D120-L/I60-L are materialized in code, tests, and the current topology homes.
- The PTY secret oracle, consumer-level conduct oracle, and wired debug-mirror oracle pass; every WR18 O1–O10 obligation reaches an allowed terminal state under the authoritative checklist above.
- `TESTING_FINDINGS.md` records actual post-change observations and evidence for every O1–O10 row rather than only implementation dispositions.
- `npm run verify` passes before the final code commit; `npm run check` is the read-only confirmation after evidence/doc-only updates.
- Only then: delete this ledger, restore FE-1180 to closed in `memory/PLAN.md`, and leave WR9–WR12 explicitly deferred.
