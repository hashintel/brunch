# Walkthrough Findings Log

## Current status — FE-1348 alpha usage and verification sweep

Current row status, owners, evidence gates, and execution order live in the [FE-1348 sweep ledger](memory/cards/post-hardening-alpha-validation--usage-and-verification-sweep.md). This file records only walkthrough observations that need a durable fixed, promoted, or retired disposition. The older entries below remain provenance, not an active checklist.

The A51-L colleague walkthrough completed on 2026-08-11. It retired SA1/SA2 without implementation and closed the `TUI-companion semantic usefulness` row. The successful standalone-web and public-stdio witnesses fixed their owned defects and closed those rows. Exactly two product rows still keep FE-1348 open: `Execute mode interaction` and `Cross-surface graph/session settlement`. CS1/SW2/SW3 are fixed in code. The latest one-shot witness passed SW3's repaired pre-approval React/JSONL gate, but its delegated host exited before the user could perform the authorized Approve action. The row remains partial under WI1's reliable-handoff-lifetime and fresh-authorization re-entry trigger.

### 2026-08-10 retained-corpus reconciliation

| Sweep observation | Findings disposition |
| --- | --- |
| [Authless bare-workspace entry](testing/walkthroughs/2026-08-10/authless-bare-workspace-entry.md) | No finding: creation, `/login` recovery, and no-provider authority checks agreed. |
| [Populated-workspace posture entry](testing/walkthroughs/2026-08-10/populated-workspace-posture-entry.md) | No finding: dialog choices, public readback, and canonical posture state agreed. |
| [Specify session interaction](testing/walkthroughs/2026-08-10/specify-session-interaction.md) | No finding: the one invalid provider attempt was quiet, mutation-free, and immediately recovered under the already-settled R6 contract. |
| [Execute mode interaction](testing/walkthroughs/2026-08-10/execute-mode-interaction-owned-gate.md) | Not a finding: retained as the ledger's owned `partial` product-evidence gate; no unsupported Compile/Execute state was manufactured. |
| [Session resume and active-tree continuity](testing/walkthroughs/2026-08-10/session-resume-active-tree-continuity.md) | No finding: active-branch projections remained stable across relaunch and rejected the append-order rival. |
| [TUI-companion semantic usefulness](testing/walkthroughs/2026-08-11/tui-companion-semantic-usefulness.md) | SA1/SA2 retired: the colleague found the companion useful and its honest TUI-owned ask refusal understandable; no ownership marker or dual-answer authority is currently warranted. |
| [Cross-composition writer transfer](testing/walkthroughs/2026-08-10/cross-composition-writer-transfer.md) | No finding: refusal, release, reacquisition, continuity, and cleanup matched the single-writer contract. |
| [Standalone-web driven session](testing/walkthroughs/2026-08-10/standalone-web-driven-session.md) | SW1 fixed by `b1fa177f8`, `d632ff82a`, `b2df18f8e`, and `08c7f2b87`, focused regressions, and the successful final live/reload/cleanup witness. No graph effect was accepted, so cross-surface settlement remains open. |
| [Stdio public RPC](testing/walkthroughs/2026-08-10/stdio-public-rpc-owned-gate.md) | Prior recovery defect fixed by `f6053d605`, `f741f94df`, `bd77c277f`, and `3cddae4eb`, then proved through the fresh [final same-workspace witness](testing/walkthroughs/2026-08-10/stdio-public-rpc-final/walkthrough.md). The separate duplicate React question rendering is promoted as SW2. |
| [Print projection](testing/walkthroughs/2026-08-10/print-projection-owned-gate.md) | No finding: source and installed foreign-cwd projections were byte-stable. |
| [Cross-surface graph/session settlement](testing/walkthroughs/2026-08-12/cross-surface-graph-session-settlement-post-sw3-final/walkthrough.md) | CS1/SW2/SW3 are fixed in code. The latest one-shot witness reached one canonical one-node/zero-edge settled review set and React exposed exactly one settled proposal plus the canonical three-choice review set without generic Answer or duplicate narration. The delegated host exited before the user could approve, so no graph effect, receipt, A/B projection, or reload evidence exists. WI1 keeps the row partial under FE-1348 pending a reliable approval handoff context and fresh authorization. |
| [Seeded workbench and fixture validation](testing/walkthroughs/2026-08-10/seeded-workbench-and-fixture-validation.md) | No finding: validator, seed CLI, public reads, and runtime-state disposal agreed. |
| [TUI-driver lifecycle fallback](testing/walkthroughs/2026-08-10/tui-driver-lifecycle-fallback.md) | No finding: the lifecycle passed; the stale scripted expectation was not a documentation or product defect. |
| [Component-preview surface](testing/walkthroughs/2026-08-10/component-preview-surface.md) | No finding: the sampled current registry families exposed no defect, architecture question, weak evidence, or measurable simplification. |
| [Debug-mirror legibility](testing/walkthroughs/2026-08-10/debug-mirror-legibility.md) | No finding: trigger-qualified mirrors agreed with canonical runtime inputs and remained projections. |
| [Read-only repository gate](testing/walkthroughs/2026-08-10/read-only-repository-gate.md) | No finding: all nine warnings were classified frozen-baseline advisories, not new contradictions. |
| [Full retained local gate](testing/walkthroughs/2026-08-10/full-retained-local-gate.md) | No finding: the aggregate gate passed; six warnings were the same classified baseline and skipped-test delta was zero. |
| [Comparison lane entry](testing/walkthroughs/2026-08-10/comparison-lane-entry.md) | No finding: the closed lane passed without implying a fresh provider or mission campaign. |
| [Conditional CI lane selection](testing/walkthroughs/2026-08-10/conditional-ci-lane-selection.md) | No finding: selector, workflow, and SPEC policy agreed with no omitted capability. |
| [Installed-package integrity](testing/walkthroughs/2026-08-10/installed-package-integrity.md) | No finding: dependency deprecation warnings did not contradict install, foreign-cwd execution, or SQLite activation. |
| [Installed interactive-mode boot](testing/walkthroughs/2026-08-10/installed-interactive-mode-boot.md) | No finding: both installed startup surfaces and cleanup passed without provider or publication claims. |

### 2026-08-12 cross-surface settlement journey

#### CS1 · one-node/zero-edge review set rejected · product-critical · fixed in code

Concern: the smallest legal review-set batch—one settled requirement and no edges—must pass structural validation so the user can inspect and approve it through the shared settlement operation.
Evidence: [`testing/walkthroughs/2026-08-12/cross-surface-graph-session-settlement-final/walkthrough.md`](testing/walkthroughs/2026-08-12/cross-surface-graph-session-settlement-final/walkthrough.md), including the exact 13-entry canonical JSONL, screenshots, public graph read, and read-only SQLite audit.
Observation: the provider authored exactly one settled `intent` / `requirement` draft with `edgeDrafts: []`; `present_review_set` returned `structural_illegal` because `edgeDrafts must be non-empty`, then the provider authored a plain standalone approval ask. The user correctly made no approval or second answer. React first repeated the canonical ask (existing SW2), then reported `Session transcript cannot be displayed`. Canonical graph authority remained empty at LSN 1. The projection failure is consequential evidence under this finding rather than a second finding: this bounded journey did not independently diagnose another sub-seam, and the closed-inventory stop rule fires at CS1.
Expected: one settled entity draft with zero edge drafts is structurally legal, remains reviewable through the review-set UI, and cannot force a fallback approval path or destroy session presentation.
Disposition: fixed in code by `8c23ada95`, `fd10e839c`, and `abb0b8bd6`, focused regressions, and the green `npm run verify` gate. The authorized rerun did not reach `present_review_set`, so cross-surface behavior remains unwitnessed; no claim of outer closure is made. The row's re-entry is now gated by SW2 under `shared-session-host-cutover`.

### 2026-08-11–12 standalone-web reruns

#### SW1 · reload attachment and writer cleanup · product-critical · fixed

Concern: a supported standalone-web session must survive browser reload and release target authority when its bounded host exits.
Evidence: [`testing/walkthroughs/2026-08-10/standalone-web-driven-session.md`](testing/walkthroughs/2026-08-10/standalone-web-driven-session.md), failed rerun at commit `2b217b865`, focused projection/process/React regressions, and the successful final outer witness at commit `08c7f2b87`.
Observation: the retained 2026-08-11 run proved the defect: reload failed and graceful shutdown left `owner.json`. Repairs landed as `b1fa177f8`, `d632ff82a`, `b2df18f8e`, and `08c7f2b87`. On 2026-08-12, the user reported the requested live/reload flow looked correct; coordinator inspection of the two named screenshots found the same first assistant turn, one answered first ask, assistant follow-up, and second live ask in order, with no stale form or duplicate. The exact 13-entry canonical JSONL preserves one `validation_failed` intermediate ask result that structured React correctly omits, and contains no accepted graph effect. SIGTERM cleanup for PID `88536` stopped the process/listener and removed the target writer owner on bounded attempt 2 without manual repair.
Expected: reload reattaches to the existing standalone runtime and projects the same active branch; bounded shutdown releases the writer owner without manual state repair.
Disposition: fixed by the four named repair commits, their focused regressions, and the successful final outer witness. This closes SW1 and the standalone-web row only; `Cross-surface graph/session settlement` remains `partial` under its existing owner/re-entry trigger because no graph effect was accepted.

#### SW2 · duplicate standalone React actionable controls · product-critical · fixed in code

Concern: standalone React must render one canonical provider ask once.
Evidence: the user-observed screenshot named in [`stdio-public-rpc-final/handoff.json`](testing/walkthroughs/2026-08-10/stdio-public-rpc-final/handoff.json), its final [`session.jsonl`](testing/walkthroughs/2026-08-10/stdio-public-rpc-final/session.jsonl) and public projections, plus the user transcript report and exact canonical artifacts in [`cross-surface-graph-session-settlement-rerun/walkthrough.md`](testing/walkthroughs/2026-08-12/cross-surface-graph-session-settlement-rerun/walkthrough.md). No screenshot path was supplied for the rerun.
Observation: the earlier run showed one canonical provider ask rendered twice. In the final authorized rerun, duplicate actionable controls became consequential: the user attempted the first duplicate and React falsely reported `Answer could not be submitted (ask closed)`, while canonical JSONL records that answer succeeding as the financial option. The stale duplicate remained actionable, provider conduct followed that unintended branch, and the later fallback ask duplicated too. Canonical authority stayed singular, but the browser contradiction changed user-visible outcome and derailed conduct before proposal.
Expected: standalone/web renders one actionable control per canonical ask; the visible submit outcome agrees with canonical settlement, and no stale live/hydrated rival remains after closure.
Disposition: fixed in code on FE-1348 at the standalone/web live-overlay versus canonical-hydration seam. Route regressions now enforce one actionable representation per exchange, terminal/local-confirmation precedence, `ask_closed` convergence, and subscribe-before-resnapshot monotonicity without deduping durable history. The consumed final witness confirms no recurrence: one initial actionable ask and one proposal appeared. Cost/value: the repair prevents a silently committed unintended answer from being reported as failure.

#### SW3 · settled review and continuation semantics collapse in React · product-critical · fixed in code

Concern: a canonical settled review set and its continuation must remain visibly settled and expose the intended approval choices in standalone React.
Evidence: [`testing/walkthroughs/2026-08-12/cross-surface-graph-session-settlement-witness/walkthrough.md`](testing/walkthroughs/2026-08-12/cross-surface-graph-session-settlement-witness/walkthrough.md), including the exact 13-entry JSONL and supplied pre-approval screenshot.
Observation: canonical JSONL contains one successful `present_review_set` with one settled requirement, zero edges, and a continuation carrying `approve`, `request_changes`, and `reject`. React rendered one proposal but did not visibly label settlement, rendered no approval choices, exposed only a generic Answer/message input, and showed offer plus continuation copy as two confirmation-like blocks. The user stopped before approval. There was one initial actionable ask and one proposal, so this is not SW2 recurrence.
Expected: React visibly communicates settled review status and renders the canonical Approve/Request changes/Reject continuation as one semantically clear actionable choice set, without duplicate confirmation-like narration.
Disposition: fixed in code by `c180eb55e` and `69d6fd7b`, their focused regressions, and the latest one-shot witness's passed pre-approval gate: React visibly rendered `settled`, exactly one each of Approve/Request changes/Reject, no generic review Answer, and no duplicate proposal/narration while canonical JSONL carried the same one-node/zero-edge review. Full cross-surface settlement remains unwitnessed only because WI1 ended the host before approval.

#### WI1 · delegated host did not survive approval handoff · witness-infrastructure · promoted

Concern: a one-shot user-owned approval witness must keep its sole source host and browser live after the executor returns the pre-approval handoff.
Evidence: [`testing/walkthroughs/2026-08-12/cross-surface-graph-session-settlement-post-sw3-final/walkthrough.md`](testing/walkthroughs/2026-08-12/cross-surface-graph-session-settlement-post-sw3-final/walkthrough.md), including host lifecycle output, exact canonical JSONL, passed pre-approval AX/render evidence, public pre-approval projections, read-only SQLite audit, and cleanup.
Observation: the provider and React reached the exact passed pre-approval state, but the delegated host ended at `2026-08-12T18:45:21.892Z`. The user and coordinator found no listener on port `65333`, so the user could not activate the sole Approve control. No relaunch, retry, approval, reload, receipt, or graph effect occurred.
Expected: the execution/handoff context keeps the sole owned host and browser live until the user performs the one authorized decision or explicitly cancels the witness.
Disposition: promoted to the existing FE-1348 cross-surface row rather than a product-code frontier. Re-enter only when the chosen execution/handoff context can demonstrate host/browser lifetime across the user decision boundary and the user supplies fresh one-shot authorization. Cost/value: this avoids spending another provider/user journey on a handoff that cannot reach its authorized action; it does not reopen SW3 or imply a standalone-host product defect.

### 2026-07-28 Secure Drop pilot — greenfield elicitation → plan synthesis

#### SD1 · Execute plan preparation · demo-critical · fix in progress

Concern: a review-approved four-scope Secure Drop graph must compile into `plan.json` without manual graph repair.
Evidence: session `019fa95a-bf25-76b1-afd1-82375712e85f`; `.fixtures/scratch/greenfield-secure-drop-demo/pilot-1/secure-drop-spec.md`; repeated `execute_plan_file` results at 2026-07-28T16:07–16:14 UTC.
Observation: Specify declared the graph fully covered, but every scope lacked one or more direct D126-L admission edges. Execute-mode preparation tried to backfill them, duplicated REQ3 across scopes, then accumulated superseded scopes/frontiers/milestones and cyclic oracle packaging because settled bad edges could not be removed. Five high-thinking planner rounds timed out at the fixed 120-second deadline. A controlled medium-thinking probe against the retained active graph subsequently wrote `plan.json` in two bounded rounds.
Expected: plan authoring directly packages each requirement into exactly one active scope and gives every scope direct criterion, design, and verification anchors; the sealed planner returns a structured candidate within the existing timeout without graph mutation.
Disposition: FE-1289 narrows the planner to medium thinking, makes the direct D126-L scope-edge preflight explicit in mapping guidance, and derives plan-readiness criterion coverage from the canonical scope package rather than future-evidence witness edges. Fresh-workspace rerun remains required before this row closes.

#### SD2 · Assurance projection wording · demo-critical · fixed

Concern: `execute_plan_check` reported `verified 0` and criterion-without-requirement warnings even though each planned criterion and check was intentionally attached through D131-L realization/dependency semantics.
Evidence: the same retained session, initial `execute_plan_check` at graph LSN 15 (`23 findings`, `verified 0`) and post-repair checks (`18 findings`, `verified 0`).
Observation: the read-only check counted only legacy positive criterion witness edges as requirement coverage, while current D131-L reserves witness for promoted observed evidence.
Expected: plan readiness should recognize direct criterion + requirement co-packaging in a D126-L scope without asking planned assertions to counterfeit evidence.
Disposition: corrected in FE-1289 by deriving readiness coverage from direct scope packages while retaining readable legacy witnesses; no schema or graph-kind change.

#### SD3 · Parallel greenfield repository foundation · demo-critical · fix in progress

Concern: the first independent frontend/crypto and backend slices must run in parallel without inventing incompatible repository roots.
Evidence: fresh session graph LSN 10; run `run-ms55kdd2`; `reports.jsonl` through `slice_integration_conflict`; Petrinaut terminal marking at 2026-07-28T21:28:04.373Z.
Observation: S1.1 and S2.1 both started from the same empty base, independently passed `npm test` on repair cycle 3, and then conflicted while integrating separately-created `package.json` files. Adding a shared project-foundation anchor allowed one correct regenerated plan and clean post-foundation parallel firing, but graph LSN 12 later produced an admitted rival with two initially runnable MOD8 carriers. Planner prompt guidance alone is therefore nondeterministic.
Expected: one accepted design anchor owns the complete root manifest, lockfile, dependency set, build/test configuration, and layout; one foundation slice materializes it before independent crypto/backend slices start in parallel.
Disposition: FE-1289 retains the shared-root authoring/planner guidance and adds deterministic candidate admission: exactly one shared `Project foundation` carrier is allowed, and every other carrier must transitively depend on it. A fresh regenerated run must demonstrate the repaired dependency shape and conflict-free integration before this row closes.

#### SD4 · Worker result artifact leaked into target worktree · demo-critical · fixed

Concern: executor-owned worker summaries must not become application files or create integration conflicts.
Evidence: both S1.1 and S2.1 slice worktrees in run `run-ms55kdd2` contained a top-level `result.json`; S2.1 integration reported add/add conflicts for both `package.json` and `result.json`.
Observation: `agent-runner-port.ts` exposed the external executor result path in the sealed worker task. The worker attempted to honor it through its worktree-only writer, which reduced it to a target-local `result.json`; the port then separately persisted the authoritative result outside the worktree as designed.
Expected: the worker returns summary text only; the app-layer port writes the executor-owned attempt result after the worker exits, and no result artifact enters source integration.
Disposition: fixed by removing the result path from worker-visible task text while retaining port-owned durable persistence and regression coverage.

#### SD5 · Cross-realm byte-equality oracle precision · demo-critical · fixed

Concern: the accepted byte-for-byte round-trip criterion must produce a stable value-level oracle across jsdom and Node Web Crypto realms.
Evidence: runs `run-ms5y9tm9` and `run-ms64ngaw` exhausted six S1 cycles on raw `Uint8Array.toEqual`; intervening runs passed only when a worker happened to choose a different assertion or global equality override.
Observation: recovered bytes matched visually and by length, but Vitest compared typed-array constructor/backing-buffer structure across realms. A general worker-prompt repair rule was ignored in a restarted live process and was removed rather than retained as an unwitnessed fix.
Expected: AC1 requires element-wise byte equality (`Array.from`, `Buffer.from`, or explicit iteration), forbids raw cross-realm typed-array deep equality, and forbids changing production representation or global test configuration merely to satisfy the assertion.
Disposition: fixed in FE-1289 by superseding AC1 with AC5 through the normal Specify review flow while preserving its requirement/scope/verification relationships. Run `run-ms663v20` passed the S1 and S2 AC5 suites, including all eight assertions, without a global equality hook or production accommodation.

#### SD6 · Unspecified test-runner compatibility floor · demo-critical · fixed

Concern: the accepted Project Foundation must carry the minimum test-runner compatibility required by its chosen `node:sqlite` backend.
Evidence: runs `run-ms5zpmux` and `run-ms611svn` exhausted S3 on guessed Vitest 2.1.x and 1.1.x; restarted run `run-ms626cf8` still guessed Vitest 1.0.x despite a prompt-only current-version rule. All backend suites failed at module load with `Cannot find package 'sqlite'` from `vite-node`.
Observation: the accepted graph chose Node's mandatory-prefix `node:sqlite` built-in but left Vitest unconstrained. Vitest 3.0.0 shipped the mandatory-`node:`-prefix fix in January 2025; configuration-only repairs cannot recreate resolver support absent from older releases. A worker-prompt rule was not authoritative and failed its live oracle, so it was removed.
Expected: the shared Project Foundation design explicitly requires Vitest 3 or newer and a compatible Vite release; plan synthesis carries that accepted bound into the sole root-owning slice.
Disposition: fixed in FE-1289 by superseding the foundation design through the normal Specify review flow and retaining the graph-level compatibility bound as mission truth. Run `run-ms663v20` installed Vitest 3, passed S1, and executed the S3 `node:sqlite` suite successfully.

#### SD7 · Generated test cache entered source integration · demo-critical · fixed

Concern: the post-foundation S2/S3 parallel wave must integrate application source without committing dependency trees or tool-generated caches.
Evidence: run `run-ms663v20`; S1, S2, and S3 all passed their canonical harnesses, then S3 produced `slice_integration_conflict` on `src/client/node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json`. A second independent integration attempt produced the same three blob SHAs.
Observation: MOD8 required the manifest, lockfile, test/build configuration, source layout, and toolchain floor but omitted a root `.gitignore`. S1 therefore committed a Vitest cache under `node_modules/`; the parallel S2 and S3 branches each updated that tracked generated file differently.
Expected: the sole Project Foundation owner writes a root `.gitignore` containing `node_modules/` and `dist/` before project commands run; generated dependency/build artifacts never enter a slice source diff, and the S2/S3 parallel batch integrates without conflict.
Disposition: fixed in FE-1289 by superseding MOD8 with MOD9 through the normal Specify review flow, preserving its exact foundation content while adding only the required root `.gitignore`. Run `run-ms671oww` retained one foundation owner, fired S2/S3 in parallel, and integrated both cycle-1 results without a generated-artifact conflict.

#### SD8 · Repair recovery rejected valid interleaved Petri history · demo-critical · fixed

Concern: a later serial slice must enter its bounded repair cycle after earlier independent slices fired in parallel without losing Petri/run lifecycle parity.
Evidence: run `run-ms671oww`; S6 cycle 1 failed because jsdom omits `URL.createObjectURL`; the cycle-2 repair context materialized, but repeated `execute_orchestrate` calls halted at `test_result` with `petri_input_unreadable`. Manual step ingestion proved the repair and test passed but left run metadata ahead of the marking at `slice:S6:cycle:2:agent_attempt:1`, then `epic_integrate` halted with `petri_journal_gap`.
Observation: `recoverPendingSliceRepair` compares the journal transition sequence to the projected lifecycle as an ordered prefix. The earlier S2/S3 parallel wave produced a different valid interleaving; both histories replay through the compiled topology and have equal transition multisets, but the positional comparison rejects them before dispatching the cycle-2 worker.
Expected: repair recovery uses the existing compiled-topology and transition-multiset authority. An `equal` relation emits no catch-up transitions; lifecycle-ahead recovery emits only its exact residual multiset in projected order; journal-ahead or mixed residuals remain blocked.
Disposition: fixed in FE-1289 by replacing the repair-only positional prefix check with the canonical Petri journal authority relation and adding a regression with an earlier parallel wave plus a later dependent-slice repair. Run `run-ms68py2m` fired S2/S3 in parallel, recovered S4 through cycle 2 under `execute_orchestrate` alone, reached `promotion_prepared`, and retained an aligned `net_completed` marking.

#### SD9 · Final harness skipped UI suites and could not build · demo-critical · fix in progress

Concern: a promoted and landed Secure Drop application must execute every authored criterion suite and produce the declared client/server build.
Evidence: run `run-ms68py2m` landed at `/tmp/brunch-secure-drop-demo-app`; controller `npm test` exited 0 with 31 assertions from only `src/lib` and `src/server`; `npx vitest list` omitted `CreateDropPage.test.tsx` and `ReceiveDropPage.test.tsx`; `npm run build` failed with `Could not resolve entry module "src/client/index.html"`.
Observation: the generated Vite config sets `root: 'src/client'` while its absolute include pattern discovers sibling lib/server tests but not test files at the configured root. The generated tree also has no `src/client/index.html` or mounted client entrypoint. Slice/epic verification therefore passed without proving the final UI suites or a runnable application.
Expected: accepted graph truth requires a concrete Vite client entrypoint, complete client/lib/server test discovery with named UI-suite evidence, and canonical test plus build commands before promotion.
Disposition: FE-1289 will supersede the Project Foundation and authored execution harness through the normal Specify review flow, preserving the settled security/toolchain content while adding only the missing entrypoint, discovery, and final build obligations. The landed tree remains failed evidence; no direct target edits are permitted.

### 2026-07-09 run A — bare entrypoint, no auth → first digest/review flow

Source notes + screenshots: `testing/walkthroughs/2026-07-09/2026-07-09-A.md`.

#### A1 · onboarding safety · high · logged

Concern: CLI invocation and first-run shape.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §CLI invocation, §startup menu, §main UI.
Observation: `--workspace` is clumsy; web sidecar default feels inverted; no-auth startup still offers dead-end/low-value choices; warning copy is long and reveals model-policy details; footer showed `unknown`.
Expected: first alpha entry should make the safe next action obvious, keep implementation/model policy mostly hidden, and avoid offering actions that cannot proceed without auth.
Disposition: built in WR8 (FE-1180): no-auth copy is now short and hides model-policy internals, the startup dialog keeps spec/session creation available while warning that provider turns are disabled until auth, and footer chrome renders `no model` instead of `unknown`. CLI invocation shape (`--workspace`, web default inversion) remains outside this remediation row.

#### A2 · onboarding safety · high · diagnose

Concern: `brunch login` and in-session `/login` auth UX.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §brunch login, §in-session `/login` flow.
Observation: CLI login works but echoed a pasted API key in clear text; provider choices are restricted to the current allowlist; in-session `/login` feels better but model restrictions still produce friction when saved auth does not resolve an allowed default.
Expected: pasted secrets should be hidden; login should minimize auth/setup friction without exposing internal model-policy choices.
Disposition: built in WR8/WR15 (FE-1180): `brunch login` API-key entry uses hidden input and labels the prompt as hidden; login/warning copy steers users toward in-session `/login` as the preferred path. WR15 adds the interactive oracle: a real PTY paste capture omits the sentinel key while isolated Pi auth storage receives the exact key, and cancellation exits nonzero without API-key auth. Model/provider restriction settled 2026-07-13 — owner: FE-1187 (D113-L–D115-L reversal: full Pi provider/model range, Pi-native `/login`/`/model`, soft recommended default, no-auth gate re-keyed to "no resolvable auth"). Secret in source note was redacted locally; rotate the real key if it was live.

#### A3 · chrome / model policy · medium · diagnose

Concern: mode shortcut and thinking-level collision.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §main UI.
Observation: `shift+tab` still appears entangled with Pi thinking-level behavior/warnings in the observed no-auth/main UI path.
Expected: Brunch mode switching should not leak Pi thinking-level friction into the alpha UI; plain Pi scoping can keep its own binding.
Disposition: fixed in FE-1187 — commit `cd973beb` retired Brunch's Shift+Tab mode-cycle shortcut and its command path, leaving Pi's thinking-level binding unshadowed; operational-mode switching remains available through `/brunch:mode`.

#### A4 · product behavior · high · scoped

Concern: `/continue` semantics.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §`/continue` command, §cancellation, §continuation.
Observation: command description is too specific and execution says “nothing to continue” in cases where the user means “resume/kick whatever was interrupted or blocked,” including esc, quit/resume, no-auth prevented default kick, or a cancelled ask that leaves the user out of flow. After cancelling an ask, the UI gives no notification telling the user how to resume or reorient.
Expected: `/brunch:continue` should be the general “continue interrupted Brunch work” affordance, not only declared ask-continuation recovery; cancellation should surface a short recovery notice naming `/continue`, `/consult`, and `/mode` as appropriate.
Disposition: built in WR3 (FE-1180): `/brunch:continue` now re-presents declared asks as the special case and otherwise resumes interrupted Brunch work through manual-trigger origination; cancelled declared asks surface recovery copy naming `/brunch:continue`, `/brunch:consult`, and `/brunch:mode`; command strings are centralized.

#### A5 · prompt/context + observability · high · diagnose

Concern: seed/context insertion and tool rendering.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §built-in tools.
Observation: Brunch tool outputs render verbosely; agent appeared to request/read information that the session should likely have been seeded with already.
Expected: initial context seed should be present before first useful provider conduct, and debug mirrors should make the seed insertion point/trigger obvious.
Disposition: built in WR7/WR17 (FE-1180): diagnosis found the recovery seam is the general `/brunch:continue` manual-trigger path; regression coverage now proves it inserts `brunch.context_seed` before the trigger-turn `brunch.kick`, and the production-wired `runBrunchTui` + command path writes operator-readable `.brunch/debug/entry-contents.md` / `origination.md` showing seed contents, `manual_trigger`, fired outcome, and seed-entry-before-outcome ordering. Compact Brunch tool-call/result rendering remains deferred row WR9.

#### A6 · exchange protocol + rendering · high · scoped

Concern: digest → ask repetition and ask markdown/result fidelity.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §`present_digest` flow, §mapping the digest.
Observation: digest content is repeated inside the `ask` UI; ask rendering appears markdown-limited or differently formatted; JSON appeared in the TUI after an ask invocation; optional-comment prompts are not preserved with the submitted comment; “Something else” duplicated the built-in Other affordance; nested esc works but help text does not say so; nested states use plain bordered editors rather than the full rounded/mode-reactive box.
Expected: large present-then-ask flows should keep pretext outside the ask; result rendering should preserve enough prompt framing for comments; custom “Something else” options should be discouraged or normalized against Other; nested ask states should explain esc/back behavior and share the intended chrome.
Disposition: WR4 built the ask comment-framing echo: `commentPrompt` and Other-elaboration framing now persist into standalone ask details and model-facing formatted text. WR5 built conduct guidance for large-present continuation bodies and Other-equivalent options. WR6 built exchange-tool validation failure rendering so ask invocation failures return human-readable `TOOL_INPUT_INVALID` markdown without raw payload leaks. Remaining A6 facets: nested chrome/help text — owner: FE-1187 (Group 1) folded row `exchange-visual-design` (promoted 2026-07-13). The digest-pretext-must-not-repeat principle rides FE-1187's repeated-offer-content row.

#### A7 · capture logic · high · spec/plan needed

Concern: digest acceptance, mapping, review-set offer, and direct mutation semantics.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §mapping the digest, §review-set flow.
Observation: after accepting a digest the agent asked more questions, then later offered a review set. In the older product logic, an approved digest may have been enough authority to mutate directly. However the review-set structure was more rigorous, and a second pass after user feedback extracted edges that the first pass missed.
Expected: Brunch needs a clearer contract for when digest approval authorizes direct graph mutation vs when it should produce a review set or multi-pass proposal.
Disposition: WR5 built the inner conduct contract: accepted digests now default to direct mapping into advisory graph mutations when supported, multi-pass extraction is pinned (entities, relations, narrative obligations), and broad follow-up questions before mapping are discouraged. More structured digest payloads or parallel subagents — owner: `memory/SPEC.md` §Future Direction "Subagent acquisition" (pointer recorded 2026-07-13); re-enter via a concrete triggering frontier.

#### A8 · prompt/skill/model · medium · logged

Concern: proposal quality, latency, and instruction following.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §review-set flow.
Observation: the first review proposal missed thesis/story nodes and edges; explicitly telling the agent fixed some of this in a second proposal; inference took a long time.
Expected: prompt/skill routing should make expected extraction breadth explicit before user correction; model/thinking policy should balance latency and quality.
Disposition: WR5 added digest extraction-breadth guidance for accepted digests. D123-L later settled the alpha model surface; remaining latency/quality observations are fitness evidence only. Owner: SPEC Future Direction “Role-tiered model picks”; re-entry trigger: repeated foreground/subagent evidence that one soft default is inadequate.

#### A9 · consult menu + exchange rendering · medium · scoped

Concern: `/brunch:consult` style/action routing and rendering after graph mutations.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §changing styles with `/consult`.
Observation: After graph mutations the agent gave an unprompted summary/overview and then `/consult` → example-based reoriented into a question, which is promising. Rendering issues remain: markdown `\n\n` appeared inline in the question, node identifiers need a styling convention such as backticks/`<kbd>`, and the consult/main-menu border role should be visually distinct from editor/ask mode-reactive borders.
Expected: consult choices should visibly be a surface-identity menu, route cleanly to the selected style/action, and preserve markdown/node-id legibility in the resulting ask.
Disposition: consult-menu chrome/content built in WR2 (FE-1180). Markdown/node-id polish and border distinctness — owner: FE-1187 (Group 1) folded row `exchange-visual-design` (promoted 2026-07-13); routing behavior is promising but needs more evidence in Run B/D.

#### A10 · observability · low · logged

Concern: `/introspect` usefulness.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-A.md` §`/introspect`.
Observation: `/introspect` reports only terse object summaries (`basePromptOptions=object(8)`, `latestPassiveCapture=turn-2 object(10)`), leaving the operator unsure what to do next.
Expected: introspection should either show the actionable summary inline or point directly to the debug files/artifacts that contain the captured prompt/session data.
Disposition: observability polish — owner: FE-1187 (Group 1) folded row `exchange-visual-design` (promoted 2026-07-13, WR10 `/introspect` legibility folded there); lower priority than auth, continue, and exchange rendering.

### 2026-07-09 run C — developed/resume spec, Execute + design/oracle/commit flows

Source notes + screenshots: `testing/walkthroughs/2026-07-09/2026-07-09-C.md`.
Session/debug outputs observed under `.fixtures/workbenches/brunch-self/.brunch/`.

#### C1 · consult menu · medium · scoped

Concern: Specify-mode `/brunch:consult` menu on a resumed non-empty spec.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-C.md` §resume orientation on non-empty spec.
Observation: Menu border says `[ Consult ]` where the role label should be `[ Specify ]`, and the spec name should remain on the lower right. Fixed-height scrolling hides options because the scrollbar is too subtle. “Continue” is first, semantically confused, and really means “stay inert until user types a custom instruction,” closer to an Other/manual option than a primary action.
Expected: consult menu should use role/spec chrome, show all materially relevant choices or make overflow obvious, and reserve inert/manual entry for a lower-priority option with clearer naming.
Disposition: built in WR2 (FE-1180): consult menu now uses role/spec top-bottom labels, visible overflow thumb, wait-flavored inert option last, and role-specific option content.

#### C2 · mode switch / consult menu · high · scoped

Concern: Specify → Execute switch and Execute entry menu.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-C.md` §switch Specify → Execute, §`/brunch:consult` in Execute mode.
Observation: Switching via `/mode` opens a consult menu, but its border still says `[ Consult ]` instead of `[ Execute ]`; option rendering is inconsistent, with only one option showing subtext. The first two options are agent-discretionary rather than user-facing. Re-invoking `/brunch:consult` while in Execute mode showed the Specify menu, not the Executor menu.
Expected: Execute-mode consult should show the executor-specific choices only: design/oracle/commit work, plan compilation, plan execution. It should not expose internal/discretionary agent actions, and it must respect the active mode on re-entry.
Disposition: built in WR1/WR2 (FE-1180): active-mode re-entry fixed in WR1; Execute menu chrome/content fixed in WR2 with agent-discretionary options removed. Still evidence for FE-1167 Execute-entry orientation residue.

#### C3 · exchange protocol + skill routing · high · diagnose

Concern: Technical/verification design routing from consult.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-C.md` §“technical design” and “verification design” routing.
Observation: Agent struggled to call `present_candidates`; error output and JSON leaked into the TUI; final choice came without a recommendation even though the expected technical-design shape is closer to “design it twice” plus recommendation/synthesis. After the user answered, the agent followed up with a plain text question instead of using `ask`.
Expected: design/oracle routing should reliably use the structured exchange tools, avoid raw validation JSON in the transcript, and follow the intended design-comparison shape with a recommendation or explicit synthesis path.
Disposition: WR6 built the exchange-tool validation failure rendering portion: invalid structured-exchange tool arguments now return themed `TOOL_INPUT_INVALID` markdown instead of raw validation payload leaks. The design/oracle recommendation shape — owner: FE-1187 (Group 1) folded row `generative-flow-synthesis-shape` (promoted 2026-07-13). Fallback to plain text instead of `ask` and broader prompt/skill routing concerns remain diagnostic inputs to the prompt/skill/model audit.

#### C4 · executor readiness · medium · logged

Concern: Execute “plan and execute” behavior on a relatively developed spec.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-C.md` §whether Execute asks for missing design/oracle/commitment before pretending it can execute.
Observation: Going straight to “plan and execute” from Execute entry did not backfill design/oracle/commitment; the executor reasoned the plan was relatively ready and projected a plan. The user did not continue far enough to judge execution quality, and noted this area belongs partly to a colleague.
Expected: Execute should be honest about readiness: proceed only when enough design/oracle/commitment exists, otherwise route to prep work without mode ping-pong.
Disposition: retained as partial Execute-entry evidence owned by the KA stream's carved walkthrough sub-list (O7–O9); not enough alone to scope a fix.

#### C5 · prompt/skill/model · low · logged

Concern: Richer graph context overload.
Evidence: `testing/walkthroughs/2026-07-09/2026-07-09-C.md` §whether richer graph context overloads prompt/skill routing.
Observation: User was not sure how to evaluate overload from this run.
Expected: Future runs need a sharper oracle for prompt overload, such as repeated tool-call schema errors, missed required skill reads, failure to summarize graph state, excessive latency, or generic-agent behavior despite specific context.
Disposition: audit-method gap — owner: SPEC §Verification Design blind-spot row "prompt-overload oracle", to be added in the FE-1187 `ln-spec` pass (2026-07-13); until then FE-1187 entry work carries it. Fold the overload markers into the prompt/skill/model audit rather than treating as product failure.

### 2026-07-10 FE-1180 review/witness audit

The required WR1–WR8 implementations exist, but the post-build audit reopened FE-1180 because several finding dispositions had mechanism evidence without meaning-level closure:

- **Execute routing (C2/C3/C4):** the FE-1180 labels broadened legacy `design_first` / `oracle_first` / `project_plan` directives without changing provider conduct. D120-L now requires preparation assessment + structured choice, compilation-readiness assessment + compile/backfill choice, and readiness-validated execution of the next safe unit. Required follow-up: WR13.
- **Continue honesty (A4):** general continuation could report `kickFired: true` after the completion seam skipped or failed the provider turn. Closed by WR14 plus its residual amendment: completion outcomes now propagate honestly; no-model/idle retries append no carriers; and failed-kick retry reuses the already-delivered trailing seed instead of duplicating it.
- **Secret masking (A2):** WR15 adds the required PTY witness: a real terminal paste omits the sentinel secret from captured bytes while isolated Pi auth storage receives the exact key; cancellation exits nonzero without API-key auth, and the non-TTY test remains supporting persistence/provider-order coverage.
- **Conduct guidance (A6/A7/A8/C3):** WR16 replaced the source-substring sentinel with consumer-level tests: registered ask/digest tool definitions carry the Other/pretext/review-continuation guidance, and the live foreground skill/prompt manifest exposes `ingest` plus its routed `map` reference path for digest-approval direct mutation and multi-pass extraction. Model adherence remains outer re-observation: WR18.
- **Debug legibility and seed usefulness (A5):** WR17 now proves the production-wired manual-trigger continuation writes `.brunch/debug/entry-contents.md` and `origination.md` with seed contents, `manual_trigger`, fired outcome, and seed-entry-before-outcome ordering. Agent use of seeded facts remains Run B outer evidence: WR18.
- **Visual/UX choices (A9/C1/C2):** role labels and scrollbar glyphs render, but border distinctness, overflow salience, choice comprehension, and recovery-hint noticeability remain outer-loop judgments. Required focused gallery/live evidence: WR18.

#### WR18 closure — focused outer evidence

Evidence: `testing/walkthroughs/2026-07-10/WR18-manual.md` and its referenced screenshots.
Ownership disposition: FE-1180 closes by explicit promotion, not by treating promoted findings as passes. Residual failures/unknowns are owned by `walkthrough-remediation-2` / [FE-1187](https://linear.app/hash/issue/FE-1187/walkthrough-remediation-sweep-2-wr18-follow-up-closure).

| ID | Outcome | Evidence / promoted disposition |
| --- | --- | --- |
| O1 | promoted failure + unknown | Pass evidence: spec/session creation remains usable without auth, no orientation/provider turn before auth, and no ambient auth used. Promoted failures: Shift+Tab extension/built-in shortcut conflict; provider/model restrictions; startup-menu auth warning and `brunch login` guidance/product path. Promoted unknown: no-model `/brunch:continue` plus no seed/kick carrier observation. Owner: FE-1187. |
| O2 | pass + promoted failure | Pass evidence: normal post-auth orientation/provider turn. Promoted failure: provider/model restrictions and `brunch login` product path residue from O1/O2. Owner: FE-1187. |
| O3 | pass + promoted failure | Pass evidence: seed precedes first useful action; first action uses seeded graph facts/readiness; debug/session artifacts are legible. Promoted failures: duplicated records in `.brunch/debug/origination.md`; unintended Pi-documentation references in `system-prompt.md`. Owner: FE-1187. |
| O4 | pass + promoted failure | Pass evidence: Specify `/brunch:consult` labels/routing are understandable; Escape is inert. Promoted failure: missing `/continue` / `/consult` / `/mode` hints after ask cancellation. Owner: FE-1187. |
| O5 | pass + promoted failure | Pass evidence: model did not author an Other-equivalent option. Promoted failure: repeated offer content in present→ask continuation. Owner: FE-1187. |
| O6 | pass + promoted unknown | Pass evidence: digest approval led directly to supported advisory mutation. Promoted unknown: extraction breadth after a thin first pass. Owner: FE-1187. |
| O7 | promoted unknown | O7 live D120-L Execute workflow not observed; owner: KA stream (FE-1187 coordination only). |
| O8 | promoted unknown | O8 live D120-L Execute workflow not observed; owner: KA stream (FE-1187 coordination only). |
| O9 | promoted unknown | O9 live D120-L Execute workflow not observed; owner: KA stream (FE-1187 coordination only). |
| O10 | promoted unknown | Both-theme component/live-TUI checks not observed; owner: FE-1187. |

Deferred WR9–WR12 (compact tool rendering, `/introspect` legibility, review-set visual redesign, markdown/node-id polish) — owner: FE-1187 (Group 1) folded row `exchange-visual-design` (promoted 2026-07-13 under the owned-deferral rule, `docs/praxis/manual-testing.md` §Findings ledger discipline). The broader review-set/ask visual-revamp impulse (WR11) lives there too, with its trigger and cost note.

### 2026-07-13 FE-1187 auth/model reversal — outer beat

#### R1 · chrome / model policy · high · pass

Concern: onboarding
Evidence: manual TUI walkthrough on branch `ln/fe-1187-walkthrough-remediation-2` (commit a15f33b0, pre-restack 5938981d), workbench launch per `docs/praxis/manual-testing.md`.
Observation: `/model` surfaces Pi's full native picker and `/login` runs Pi-native auth; no Brunch allowlist restriction, no `brunch login` product path, no startup-menu auth warning.
Expected: D123-L open model/auth surface — Pi's native provider/model/thinking range with the soft recommended default from the sealed profile.
Disposition: fixed — commit a15f33b0 (`feat: open Pi model and auth surface`; pre-restack 5938981d); guarded by `brunch-tui.test.ts` boot-option projection, `workspace-dialog/component.test.ts` no-warning assertions, and the re-keyed I59-L registrar/juncture suppression tests. WR18 O1/O2 promoted failures (provider/model restrictions, `brunch login` path, startup warning) close with it. The no-model `/brunch:continue` + no-carrier observation (O1 promoted unknown) remains open on FE-1187.

#### R2 · debug mirrors · medium · fixed

Concern: debug mirrors
Evidence: `.fixtures/workbenches/manual-no-auth/.brunch/debug/origination.md` (6 records = 3 originations, each doubled); ln-diagnose pass 2026-07-13.
Observation: not an accidental double-write — the mirror intentionally records decision-time and outcome-time, but the outcome record re-embedded the entire decision including full `seedEntries` content, so each origination produced two near-identical multi-KB blocks (and seed content appeared three times across `entry-contents.md` + `origination.md`).
Expected: two-phase records stay (decision-first keeps failed/never-completed kicks observable) but each phase is legible: decision record carries seed-entry summaries, outcome record carries the outcome plus a slim decision summary.
Disposition: fixed — commit f0630a70 (`fix(debug): stop outcome record re-embedding decision payload`; pre-restack 2ec50505); regression oracle in `dev-mode-introspection.test.ts` asserts exact record shapes, decision-before-outcome ordering, and no seed content in `origination.md`. Closes the WR18 O3 promoted failure.

#### R3 · onboarding safety · high · fixed

Concern: onboarding
Evidence: no-auth boot walkthrough 2026-07-13 (isolated launch: provider env keys stripped + `PI_CODING_AGENT_DIR` pointed at an empty temp dir), workbench `manual-no-auth`; screenshots of the spec picker, the booted session, and the post-`/brunch:continue` state.
Observation: with no resolvable provider auth, the session correctly suppressed the orientation kick (no fake turn), but gave no unprompted indication of the state or remedy — only the dim `no model` footer chip. The honest guidance message existed only as the `/brunch:continue` outcome, which the user had to already know to run. (The old startup warning was deliberately deleted by the D123-L reversal without a Pi-native replacement surfacing at boot.)
Expected: on session entry with no resolvable auth, the user gets one warning-level notification naming the state and the Pi-native remedy (`/login`), identical to the `/brunch:continue` outcome message; later junctures stay silent since the footer already shows the state.
Disposition: fixed — the I59-L suppression gate in `session-orientation/registrar.ts` now emits the shared `NO_PROVIDER_AUTH_NOTICE` as a warning on the J1 entry trigger, and `/brunch:continue`'s no-model outcome reuses the same constant raised from info to warning. Guarded by the reshaped J1 no-auth registrar test (asserts exactly one entry warning) and the continue-outcome level assertions. Verified live: warning appears at boot and again on `/brunch:continue`. Closes the WR18 O1 promoted unknown's guidance half.

No-carrier half (same session, checked 2026-07-13): pass. Two `/brunch:continue` attempts produced honest `{status: skipped, reason: no_model_available}` outcome records in `origination.md`, and the session JSONL (`2026-07-13T13-50-14-967Z_…`) contains only bootstrap entries — zero `brunch.context_seed` / `brunch.kick` carriers appended. The same records also witness the R2 mirror shape live: decision records carry seed-entry summaries (`contentLength`, no full text), outcome records carry a slim decision summary. WR18 O1 promoted unknown fully closed.

#### R4 · debug mirrors · medium · pass

Concern: prompt/skill/model + debug mirrors
Evidence: Session B walkthrough 2026-07-13, workbench `workspace-alpha-grounding` debug cache inspected directly while the session stayed open (beats B1/B2).
Observation: B1 — `system-prompt.md` mirror opens with the Brunch product preamble (`systemPromptOverride`) followed by Brunch capability/policy context; zero `pi-coding-agent` doc paths or Pi-development guidance. B2 — `origination.md` shows the summarized record shapes on a live fired outcome: decision records carry seed-entry summaries (`details`, `contentLength`, no full seed text) and outcome records carry `{status: fired}` plus a slim decision summary (`seedEntryCount`); no doubled multi-KB blocks.
Expected: Card 2's outer beat (no Pi docs in the provider prompt) and the R2 mirror fix confirmed live on the auth-present fired path (Session A only witnessed skips).
Disposition: pass — closes the Card 2 outer beat and the fired-path confirmation of R2. B4 ask-cancellation legibility was subsequently built and its scope consumed on FE-1187; B5 extraction breadth remains owned by FE-1187.

### 2026-07-14 runs B/D/1D — FE-1196 tie-off walkthroughs (spec-posture + workspace-db-identity)

Agent-driven TUI walkthroughs on branch `ln/fe-1196-platform-debt` (commit e72e0302) via a PTY harness (`expect` driver; cmux/agent-tui unavailable in-sandbox). Workbenches: `run-d-populated` (fake `recipe-box` project, no `.brunch/`), `run-b-bare` (empty cwd), `run-1d-legacy` (disposable copy of `~/Code/lunelson/fable/.brunch` — 0.x `brunch.db` 4K + 1.6M wal, copied 2026-07-14), and re-seeded `workspace-alpha-grounding/base`.

Passes (no individual entries):

- **Run D populated-cwd establishment**: new-spec flow asked kind ("What does this specification own?" — product/feature/function per D89-L/D118-L) then brownfield confirm ("Does this build on the existing code here?"), both before any agent turn; `specs` row persisted `kind=feature, origin=brownfield`; relates-to correctly not asked (D118-L narrowing). Concern 2 matrix populated branches witnessed.
- **Resume of an established spec**: relaunch → continue went straight to the orientation menu; kind/origin never re-asked (posture read from the DB row).
- **Bare-cwd establishment**: only the greenfield confirm fired ("Is this a fresh, greenfield specification?"), no kind ask; row persisted `product/greenfield`. D118-L bare branch witnessed.
- **Esc-inert orientation menu**: esc at the entry menu recorded `brunch.session_orientation {choice: dismissed, trigger: entry}` with no kick fired, context at 0%; editor usable. D109-L esc-inert revision witnessed live.
- **Run 1D fail-safe (I63-L)**: boot against the 0.x workspace created a fresh stamped `brunch-v1.db` (`application_id` 1112692273) + `workspace.json` and left `brunch.db`/`-wal`/`-shm` byte-identical (shasum before/after, across print-mode boot **and** a full interactive session incl. spec creation). No migration attempted, no destructive writes. The initial run exposed that 0.x detection incorrectly fed the populated-cwd posture path; T3 records the ruling and fix that decoupled prior Brunch state from code-population inference.

#### T1 · posture/capture · high · scoped

Concern: posture/capture
Evidence: `run-d-populated/.brunch/debug/entry-contents.md` after a live "Work by decision" kick (session `2026-07-14T08-11-10-802Z…`); `src/session/originate-assistant-turn.ts:216`; `src/agents/contexts/seeds/origination.ts:61,88`.
Observation: the kick's context seed carries workspace identity, topology tree, graph facts, and the orientation directive — but no spec posture. `composeContextSeedContent` supports a `posture` input (rendered by `formatSpecPostureSeed`, unit-tested), yet the product origination path never passes it, so the seed section is dead wiring live. First agent turn opened domain-blind ("is this about a grocery store's aisles… a warehouse picker…") despite confirmed `feature/brownfield` and a README answering the question.
Expected: PLAN spec-posture names kick assembly (`agents/contexts/seeds/origination.ts`) as a posture reader; the seed should carry confirmed kind/origin so brownfield conduct can ground itself.
Disposition: fixed — commit 1a2eaa58 (`FE-1196: Wire spec posture into the kick seed`): posture plumbed through `OriginateAssistantTurnInput` and `LiveKickDeps` from both product callers (TUI kick context, `session.triggerExchange`). Oracles: seed-content assertions in `originate-assistant-turn.test.ts` + the juncture-level delivered-seed wiring test. Re-witnessed live 2026-07-14: post-establishment kick on `workspace-alpha-grounding` mirrors `SPEC POSTURE / kind: product / origin: brownfield` in `entry-contents.md`.

#### T2 · posture/capture · high · scoped

Concern: posture/capture
Evidence: seeded `workspace-alpha-grounding` (spec created by `seed-fixtures`, `origin=NULL`); live resume flow "Continue another existing specification → Alpha Grounding → Create new session"; `src/.pi/components/workspace-dialog/model.ts:85` (only caller of `decideSpecEstablishmentAsks` is `nextStageAfterTitle`, a create-path helper); `src/session/workspace-session-coordinator.ts:111-113`.
Observation: resuming a posture-unestablished spec fired no establishment asks — straight to the orientation menu; `origin` stayed NULL after the session. The coordinator's doc comment and `spec-establishment.ts` both document "establishment step at next resume", and TESTING_PLAN Concern 2 marks this ✅, but no resume-path dialog stage invokes the decision function; it is inner-tested only.
Expected: a spec created outside the dialog (seed/RPC) gets the establishment step once at next resume (D118-L covers creation *and* resume).
Disposition: fixed — commit 66093e86 (`FE-1196: Fire the establishment step on resume of an unestablished spec`): the dialog's three resume emits route through establishment stages when the target spec is unestablished, the held decision fires with an `establish` payload, and the new establish-once `CommandExecutor.establishSpecPosture` applies it before binding (already-established specs refuse — never re-asked, never clobbered). Oracles: command-executor establish-once tests, coordinator establish-payload tests, dialog-model routing tests; Concern 2 annotation corrected in `TESTING_PLAN.md`. Re-witnessed live 2026-07-14: re-seeded `Alpha Grounding` (origin NULL) got kind + origin asks at resume and persisted `product/brownfield`.

#### T3 · onboarding · medium · logged

Concern: onboarding
Evidence: run-1d-legacy walkthrough 2026-07-14; print-mode boot output and the establishment dialog wording.
Observation: the detected 0.x database is never named to the user. Print-mode boot surfaced nothing; the interactive path silently flips the workspace to "populated" and asks the generic "Does this build on the existing code here?" — in a cwd containing no code at all, only the legacy db. Fail-safe behavior is correct (see run 1D pass above) but illegible: nothing tells the user a 0.x database was found, won't be opened, and won't be migrated.
Expected: TESTING_PLAN 1D asks for a legible message when migration is unsupported; D124-L's detection-as-posture-evidence deserves one user-visible sentence at the establishment ask (or a boot notice) naming the 0.x file and its disposition.
Disposition: fixed — resolved 2026-07-14 by user ruling, in the opposite direction from the drafted copy fix: a previous Brunch database is not product code, so detection must not influence the posture questions at all. `isWorkspacePopulated` no longer ORs in `detectLegacyZeroXDatabase`; a cwd with no code gets the bare-branch greenfield confirm regardless of legacy databases, which also removes the misleading "existing code here" ask this finding witnessed. D124-L mechanic 3 / I63-L revised in SPEC; detection itself remains (fail-safe open guard unchanged, `legacyZeroXDetected` stays informational). Oracle: the flipped coordinator test ("ignores a sibling 0.x brunch.db for posture"). No user-facing 0.x notice was added — deliberately out, per the ruling's treat-as-new-workspace framing.
### 2026-07-14 FE-1187 consolidated checkpoint — beats 1–3

Evidence: [`testing/walkthroughs/2026-07-14/remediations-3a.md`](testing/walkthroughs/2026-07-14/remediations-3a.md) and its referenced screenshots.

Checkpoint state: paused after Session B beats 1–3. Restack completed 2026-07-14; the five incorporated FE-1196 commits affect posture establishment/seed wiring, not exchanges, chrome, digest/review conduct, or the tripwire. Read-only reconciliation against the two actual session JSONLs below resolved the mechanical questions that did not require another live run.

#### R5 · exchange recovery chrome · high · fixed

Concern: standalone-ask cancellation guidance.
Evidence: `remediations-3a.md` §1, screenshot `post-ask-cancellation`; implementation commit `daba4cda`; user-confirmed live TUI walkthrough on 2026-07-14.
Observation: root Escape cancelled the ask, but recovery guidance rendered as footer status rather than an above-editor notification. The status survived a new user turn, and cancelling a later ask appended a second, differently worded notice instead of replacing or clearing the first.
Expected: completed cancellation guidance uses `ctx.ui.notify`; it is noticeable without becoming persistent chrome, does not survive unrelated turns, and repeated cancellations do not accumulate inconsistent messages.
Disposition: fixed — commit `daba4cda` replaces persistent standalone/continuation status entries with transient notifications. Inner oracles in `exchanges-present-request.test.ts` prove standalone guidance names `/brunch:consult` and `/brunch:mode` without `/brunch:continue`, declared-continuation guidance names all three recovery commands, neither path publishes footer status, and cancelled continuations remain recoverable; middle structured-exchange recovery/projection suites preserve one-close transcript semantics. In the 2026-07-14 user-present live TUI walkthrough, both notifications appeared above the editor with the expected command sets, no cancellation status survived an ordinary new turn, `/brunch:continue` re-presented and completed the declared continuation, and repeated cancellation produced no lingering or accumulated footer entries.

#### R6 · exchange terminal and error rendering · high · built; outer visual judgment pending

Concern: cancelled and invalid structured-exchange tool results.
Evidence: `remediations-3a.md` §§1–2 and screenshots; actual session JSONLs `2026-07-14T08-29-24-216Z_…` and `2026-07-14T08-45-39-646Z_…` under the `workspace-alpha-grounding` workbench.
Observation: the cancelled `ask` terminal did not read as an intentionally cancelled exchange. The invalid-input errors were diagnosed separately: the model authored reserved option id `other` while enabling `allowOther`, then twice supplied body/options fields that D116-L continuing asks must inherit from the referenced offer. The adapter correctly returned themed `TOOL_INPUT_INVALID` results; this was not raw renderer corruption.
Expected: cancelled, unavailable, and answered results have deliberately distinct compact rendering. Provider argument rejection remains exact model-facing feedback for retry but creates no persistent human-visible transcript artifact; it is not a user-owned terminal outcome.
Disposition: reopened by the 2026-07-17 authenticated walkthrough. The valid Answered/Cancelled/Unavailable rail landed in `229c7abc`; `c8f15b3b`'s warning-toned Input rejected presentation is superseded by direct human judgment after the live screenshot showed internal provider retry feedback dominating the transcript. D104-L now preserves validation content/details for the model while requiring empty TUI rendering. Owner: [`walkthrough-remediation-2--tui-presentation-corrections.md`](memory/cards/walkthrough-remediation-2--tui-presentation-corrections.md); the consolidated outer checkpoint judges the corrected live-TUI result.

#### R7 · offer continuation rendering · high · fixed

Concern: `present_*` → continuing `ask` non-repetition.
Evidence: `remediations-3a.md` §2, screenshot `present-and-ask-open`; implementation commit `b882d70f`; user-confirmed live TUI walkthrough on 2026-07-14 after restarting on that commit.
Observation: the question and rationale appeared above the main `present_*` options and were then repeated inside the continuing `ask` tool.
Expected: the presentation remains the pretext; a continuing ask renders only the answer controls needed at that step rather than repeating the question/rationale block.
Disposition: fixed — commit `b882d70f` omits the declaration-owned body only from live candidate/digest/review-set continuation pickers while preserving declared choices, durable terminal content/details, and RPC/headless question payloads. Inner oracles in `exchanges-present-request.test.ts` inspect controls-only picker inputs for candidate, digest, and review-set continuations while preserving candidate choices and approve/request-changes/reject behavior. Middle registered-exchange, recovery/projection, formatter, and RPC/headless suites preserve declaration compatibility and self-contained model/RPC results. In the 2026-07-14 user-present live TUI walkthrough after restart on `b882d70f`, a `present_candidates` result displayed its heading/rationale once and its continuation picker displayed only picker framing/options; a `present_digest` result displayed digest prose once and its review picker displayed only `Approve`, `Request changes`, and `Reject` controls.

Completion report:

| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| Candidate continuation omits repeated heading/body/rationale and preserves choices | met | Inner: `exchanges-present-request.test.ts` controls-only candidate picker assertions; outer: 2026-07-14 live `present_candidates` showed heading/rationale once followed only by picker framing/options. |
| Digest and review-set continuations expose only review controls while preserving D110-L behavior | met | Inner: `exchanges-present-request.test.ts` digest/review-set picker assertions; outer: 2026-07-14 live `present_digest` showed prose once followed only by `Approve`, `Request changes`, and `Reject`. |
| Answered/cancelled terminal content and details remain self-contained | met | Middle: existing registered-exchange, recovery/projection, formatter, and RPC/headless suites passed for implementation commit `b882d70f`. |
| Human-gated candidate and digest non-repetition | met | User-confirmed live TUI walkthrough on 2026-07-14 after restart on `b882d70f`. |

Skipped-test-count delta vs parent of implementation commit `b882d70f`: 0.

#### R8 · digest choreography · high · built; fresh provider campaign pending (0/3)

Concern: ingest digest review and clarification ordering.
Evidence: `remediations-3a.md` §3, screenshots `digest-review-as-ask` and `after-review-accepted`; session JSONL `2026-07-14T08-45-39-646Z_…` entries 12–21.
Observation: `present_digest` did run. Its D110-L declaration mechanically supplied the approve/request-changes/reject continuation; the model's first attempt to override that continuation failed validation, then the declared review was accepted. Only afterward did the assistant ask three clarifying questions that would have been useful before mapping.
Expected: the assistant presents the digest, asks a simple free-text confirmation such as “does that sound right?”, asks any material clarification questions before mapping, and then maps the confirmed understanding. A heavyweight change-request review protocol should not be imposed when ordinary conversational correction is clearer.
Disposition: built — D110-L/D106-L’s conversational free-text digest feedback, digest-referencing bounded questionnaire (or single-select confirmation), runtime-copied final abstract, and successor/capture guards are materialized and mechanically covered. The stopped 2026-07-17 run produced a human-approved faithful digest, but the governing review contract was invalidated before settlement, so this is a non-counting observation rather than a pass. Owner: paused FE-1187 provider-evidence gate; re-enter only by explicit user decision, then reconcile the extractor/oracle and restart at 0/3.

#### R9 · multi-question collection · medium · built; fresh provider campaign pending (0/3)

Concern: several related clarification questions forced into one structured ask.
Evidence: `remediations-3a.md` §3, screenshot `after-review-accepted`.
Observation: the assistant compressed several questions into a few permutation options, producing an awkward and incomplete choice surface.
Expected: related questions can be answered without combinatorial options—either as a short questionnaire-style interaction or as a deliberate sequence of focused asks.
Disposition: built — D38-L/D116-L’s bounded one-terminal questionnaire, fixed ordered keyed answers, TUI Back/Next/final Submit path, and schema-tagged RPC editor envelope are materialized and mechanically covered. In the stopped 2026-07-17 run the provider treated only one conflict as decision-blocking and used one standalone option ask; that non-counting observation is neither pass nor failure. The revised oracle must distinguish one remaining material question from several. Owner: paused FE-1187 provider-evidence gate; re-enter only by explicit user decision, then reconcile the extractor/oracle and restart at 0/3.

#### R10 · large-capture review scale · high · corrected; fresh provider/human evidence pending (0/3)

Concern: large advisory review-set presentation and persistence.
Evidence: `remediations-3a.md` §3, screenshots `large review set after two following questions` and `review accepted and persisted`; session JSONL `2026-07-14T08-45-39-646Z_…` entries 22–31.
Observation: after a long wait, one 17-node/11-edge review set overwhelmed the TUI. After one review acceptance, the assistant deliberately issued two `mutate_graph` calls split by settlement: settled intent at LSN 2, then advisory sketches at LSN 3. This was not one `acceptReviewSet` transaction being internally chunked.
Expected: large capture does not require the user to inspect an unmanageably long TUI review set; one accepted proposal has honest authority and receipt semantics, and settlement differences are visible before acceptance rather than discovered through post-accept mutation splitting.
Disposition: corrected in `45a61d93f` + `805243a4f` (topology follow-up `ef60504d2`). Every review node and role-named edge now requires its own advisory/settled status; local TUI and RPC preserve the exact mixed set through one `acceptReviewSet` transaction, LSN, change-log row, and receipt, with duplicate/post-approval negative space. Model-facing and TUI review presentations show each item status; the Impact Ledger omits empty Terms/concern groups in canonical relative order, and existing-host edges render exactly once in a trailing populated Connections section. Direct advisory `mutate_graph` remains supported when no extra review is useful. Focused contract/render stacks and `npm run verify` passed (2,441 tests passed, 2 skipped; skipped delta 0). Remaining claims—extractor/oracle reconciliation, three fresh provider samples, and human fatigue/inspectability judgment—are paused at user direction after the `remediation-4` branch tie-off. Owner: paused FE-1187 provider-evidence gate and consolidated outer checkpoint; re-enter only by explicit user decision. The stopped run at `.fixtures/scratch/provider-conduct/run-1-20260717T170400Z/` has no report and counts 0/3.

#### R11 · scratchpad disclosure · high · fixed

Concern: internal narrative obligations exposed in assistant-facing output.
Evidence: `remediations-3a.md` §3, screenshot `review accepted and persisted`; implementation commit `1343a7c4`; user-present authenticated TUI walkthrough on 2026-07-14.
Observation: after persistence, the assistant listed scratchpad obligations to the user.
Expected: scratchpad obligations remain internal working notes in ordinary user-facing prose while remaining available when the user explicitly asks about them.
Disposition: fixed — commit `1343a7c4` makes the always-on foreground prompt treat scratchpad obligations as private working state, forbids routine user-facing enumeration, and permits disclosure on explicit request. The composed live-prompt oracle proves that conduct reaches the active foreground agent; the existing scratchpad, origination, and turn-context carrier suites prove the full ledger remains provider-visible without a storage or projection change. In the 2026-07-14 user-present authenticated TUI walkthrough, the assistant carried multiple scratchpad obligations while processing `FOREIGN-SPEC-NOTES.md`, omitted obligation ids and text from its ordinary completion summary, then disclosed/summarized the obligations only after the user explicitly asked what it was carrying.

Completion report:

| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| Composed foreground prompt keeps obligations private by default and permits explicit-request disclosure | met | Composed live-prompt oracle at implementation commit `1343a7c4`. |
| Scratchpad remains the provider-visible planning carrier without storage/projection changes | met | Existing scratchpad, origination, and turn-context carrier suites passed at implementation commit `1343a7c4`. |
| Ordinary completion prose omits obligation ids/text after multiple updates | met | 2026-07-14 authenticated TUI walkthrough while processing `FOREIGN-SPEC-NOTES.md`. |
| Explicit user request can retrieve an obligation summary | met | Same walkthrough: disclosure occurred only after the user explicitly asked what obligations were being carried. |

Skipped-test-count delta vs parent of implementation commit `1343a7c4`: 0.

#### R12 · model and opening-state chrome · medium · retired as non-reproduced

Concern: footer model projection and opening-turn working message.
Evidence: `remediations-3a.md` §8; fresh authenticated `r12-diagnosis` workbench and user-driven 2026-07-17 walkthrough.
Observation: the original run displayed `no model` throughout a session that produced provider turns and made “Opening assistant turn…” look stale. The fresh authenticated reproduction showed the selected Anthropic model correctly before and after the provider turn; the user independently confirmed correct model chrome and did not reproduce the stalled-opening claim.
Expected: the footer reflects the resolved active model, and working-state copy does not falsely suggest a stalled opening operation.
Disposition: retired as a current defect because the authenticated reproduction did not reproduce either reported failure. The static `modelRegistry.getAvailable()` versus `ctx.model` split remains insufficient evidence of a bug. Reopen only with a timestamped run that shows provider output and `no model` concurrently. The concrete collapsed-thinking color defect observed in the same walkthrough is R14.

#### R13 · zero-readiness entry and orientation menu · high · built; outer comprehension pending

Concern: new-spec startup sequence, readiness, and menu affordances.
Evidence: `remediations-3a.md` §8.
Observation: after the posture questions for a brand-new, empty spec, Specify mode immediately presented the full orientation menu before the assistant reviewed seed/context or performed any orientation of its own. Several options were premature. “Ingest source material” behaved as an imperative to go find material rather than an inert invitation for the user to provide text, files, folders, or links.
Expected: zero-readiness entry first establishes what is known and asks/offers the limited moves that are actually possible. At this stage the useful choices are approximately work by decision, work by example, and provide information sources. Providing information leaves the system inert with a clear affordance for supplying material; it does not instruct the assistant to search autonomously.
Disposition: built — the D98-L/D109-L decision resolved the menu shape without a new provide-information carrier: only style-less startup and operational-mode switch auto-open, persistent Specify styles are active-branch state, process moves are separate/readiness-filtered one-shot entries, and Escape is inert. Branch, prompt, juncture, and lexical negative-space oracles materialize that state. Owner: the consolidated outer checkpoint judges first-run orientation/menu comprehension; no structural implementation remains open.

#### R14 · startup and transcript presentation contract · high · built; both-theme outer judgment pending

Concern: startup hierarchy, quiet provider retries, editor/footer geometry, and theme legibility.
Evidence: authenticated user-driven walkthrough and CleanShot `CleanShot 2026-07-17 at 13.00.44@2x.png`.
Observation: Welcome rendered in the bottom widget region instead of immediately after startup identity; its command notes were not dim. A rejected `ask` call persisted provider retry diagnostics into the human transcript. The sidecar URL appeared below the editor despite already living in header/footer. Nested footer styling reset model/thinking/context to normal brightness and the line had no lateral inset. Pi’s collapsed `Thinking...` label rendered at normal brightness, while the compact BRUNCH wordmark was nearly invisible.
Expected: Welcome is one-time non-transcript header-adjacent Box content with one-column lateral padding and dim command notes; provider validation remains model-visible but renders nothing to the human transcript; editor has no below-box URL; the sole footer line is fully dim and one-column inset; collapsed thinking is dim; the compact wordmark uses terminal-default text.
Disposition: built — focused component/extension oracles pin header-backed one-time Welcome composition, transparent one-column Box padding and dim notes, byte-preserved model-facing validation diagnostics with zero TUI lines, no editor sidecar duplicate, one outer-dim inset footer line, `thinkingText === dim` in both sealed themes, and terminal-default compact wordmark text. Owner: FE-1187 consolidated outer checkpoint; re-entry trigger: replay the authenticated screenshot beat in both themes after A48-L and R8–R10 gates are dispositioned.

### 2026-07-16 FE-1208 automation-observability-dx — PM-door dry run

#### DX1 · observability/DX documentation · high · pass

Concern: the seed-based PM door documented in `docs/praxis/comparison-runs.md` §PM door, followed as written with no tribal knowledge.
Evidence: user-driven live run 2026-07-16 from the repo root — `npm run dev-cli` → seed-derived instance → tracked seed → reset confirm → Brunch TUI + web observer sidecar.
Observation: the entire documented flow worked as described; no friction, mismatched menu wording, or unclear next actions were reported.
Expected: launch → observe → read succeeds against the doc alone, witnessing the frontier's outer verification leaf.
Disposition: pass — closes the `automation-observability-dx` outer verification leaf (`memory/PLAN.md` §automation-observability-dx, Verification: outer). No follow-up defect; the doc stands as the canonical PM entry point.

### 2026-07-14 FE-1196 session-branching Card 3 — active-branch cutover

#### SB1 · session branching · high · pass

Concern: TUI tree navigation, sibling continuation, restart, and product-shaped RPC readback.
Evidence: `.fixtures/workbenches/session-branching-card3/.brunch/sessions/2026-07-14T14-28-21-129Z_019f6107-6009-70a8-81c5-313936e64e18.jsonl`; tmux-driven real `npm run dev-cli -- --workspace .fixtures/workbenches/session-branching-card3`; one-shot `session.exchanges` and `session.runtimeState` reads after relaunch.
Observation: after cancelling the resumed orientation menu, the editor executed Pi `/tree`; selecting the prior assistant turn with two Up keys and choosing “No summary” created a sibling at `09dfec6a`. The active sibling ended at assistant entry `6cdc3a4c`; the earlier answered branch (`725a9f52` then `a0bb517c`) remained in physical append history. Cancelling the new sibling ask returned focus to the editor. `/quit`, relaunch, and resume succeeded. `session.exchanges` returned `open_prompt` with active range `09dfec6a..6cdc3a4c` and no abandoned answered exchange; `session.runtimeState` returned `ready`, `specify`/`elicitor`, graph LSN 3, with no `-32002` error.
Expected: native Pi tree navigation creates a usable sibling; quit/resume preserves the selected active leaf; Brunch exchange/runtime reads remain product-shaped and branch-correct.
Disposition: retired — walkthrough passed with no follow-up defect; Card 3 automated branch-rival and reader-inventory oracles carry regression coverage.

### 2026-07-17 FE-1215 operator-comparison-workflow — direct-Brunch remediation smoke

Run: `.fixtures/scratch/comparisons/minimal-petri-net-editor-20260717T191333Z` (operator-driven, Brunch lane only).

#### CS1 · direct-harness control · high · pass

Concern: the corrected D134-L/I67-L topology — one top-level Pi session drives one direct normal-width Brunch `interactive_shell` and reaches a real Specify exchange beyond the startup splash.
Evidence: `harness-setup.md` (direct `npm run dev-cli -- --workspace …/targets/brunch` from repo root, Brunch order 1); session `…/targets/brunch/.brunch/sessions/2026-07-17T19-15-00-852Z_019f7180-e674-7682-b416-085db90a3879.jsonl` (59 events; 45 messages; 12 `ask`, 4 `mutate_graph`, 2 `present_digest`, 1 `present_candidates`); exported `lanes/brunch/petri-net-editor-spec.md` (G1, 9 REQ, D1–D4, 7 CON); empty `lanes/claude-code/` + `targets/claude-code/` confirm Brunch-only.
Observation: the interview advanced well past the splash into a populated graph (empty seed at LSN 1 → committed spec) and exported a review-ready document; the failed nested-viewport topology did not recur.
Expected: one direct normal-width shell exposes a usable Brunch Specify exchange while preserving mission isolation and cleanup.
Disposition: pass — meets FE-1215's focused stock-Pi/direct-Brunch smoke leaf (scope card consumed on completion; status in `memory/PLAN.md` §operator-comparison-workflow).

#### CS2 · private-mission isolation · high · pass; placement risk closed

Concern: whether the private mission leaked into target-visible input or was ingested from disk.
Evidence: transcript scan of the session/`debug/trajectory.ndjson` — zero occurrences of mission-only phrasings (`private-mission`, `top-level-session-only`, `The PM wants`, `Decision latitude`, `Conversational and disclosure posture`) and zero references to the `private-mission.md`/`harness-setup.md` paths; the one matching phrase is the mission's sanctioned natural opening. Full tool-call audit: 20 calls (12 `ask`, 4 `mutate_graph`, 2 `present_digest`, 1 `present_candidates`, 1 `read`); the sole `read` targeted `src/agents/skills/propose/SKILL.md`; no `ls`/`find`/`grep` were used.
Observation: no mission text, path, or wholesale payload entered the Brunch cwd/session; the spec content came from the elicitation exchanges, not file ingestion.
Expected: the private-mission boundary holds without a separate actor process.
Residual risk: `private-mission.md` is stored at the run root, two levels **above** the Brunch target cwd (`targets/brunch`), and the Brunch agent's active tools include generic `read`/`ls`/`find`/`grep` (per `debug/system-prompt.md`). Isolation held **behaviorally** (the agent did not traverse up), not by a filesystem jail; a differently-behaved contender or retry could `read ../../private-mission.md`.
Disposition: closed by FE-1320. `/compare-specs` now gives each harness a fresh system-temporary external target root outside controller checkout, scratch, and retained trees; actual-entry-point tests reject the `../../private-mission.md` rival and preserve exact controller evidence through target cleanup. This closes ordinary target-relative ancestor traversal, not unrestricted absolute-path or whole-host discovery. The real Brunch + Claude conduct witness remains owned by `saved-mission-comparison-witness`.

#### CS3 · harness cleanup · medium · unverified

Concern: no comparison/background process remains after the run.
Evidence: run artifacts stopped being written ~19:25Z (last `trajectory.ndjson`/session write); `ps` is not permitted in the reconciling shell, so lingering-process absence could not be independently confirmed from the artifact side.
Observation: operator reported the run completed; scratch tree is quiescent.
Expected: the direct shell and any child process are dismissed after cleanup.
Disposition: logged — process-cleanup confirmation remains the operator/top-level session's responsibility for this scratch run; not a code defect. Re-entry trigger: confirm process teardown in the operator session at run end.

### 2026-08-07 FE-1321 shared-session-host-tracer — structured-ask companion questions

Both entries were design questions raised by the structured-ask slice, not defects. The slice proved the correctness half automatically (`src/app/__tests__/session-runtime-contract-structured-ask.slow.test.ts`); the 2026-08-11 A51-L colleague walkthrough supplied the presentation judgment and retired both questions.

#### SA1 · consult menu / chrome carryover · medium · retired

Concern: under the normal-TUI composition the companion browser renders a TUI-owned ask with its ordinary answer form, but submitting it is refused as `ask_closed` and surfaces as a visible error.
Evidence: `src/app/__tests__/session-runtime-contract-structured-ask.slow.test.ts` (single-answering-authority leaf); the refusal path is `src/session/tui-live-session-adapter.ts` `answerExchange` → `ask_closed`, rendered by the `Ask` form's error branch in `src/web/routes/session.tsx`.
Observation: the refusal is honest and requires no contract change, but a colleague sees an inviting form that cannot succeed.
Expected: a human judges whether that is confusing enough to warrant the deliberately excluded ownership marker on `OpenAsk` (e.g. `owner: 'tui'` / `answerable: false`) so the companion can render a TUI-owned ask read-only.
Disposition: retired — the A51-L colleague deliberately attempted the visible companion form, saw `answer could not be submitted` followed by `ask closed`, and judged the result understandable. The TUI-owned ask remained open and accepted the sole successful answer. The marker's cross-contract cost has no demonstrated current value; re-enter only on a concrete confusion report. Evidence: [`testing/walkthroughs/2026-08-11/tui-companion-semantic-usefulness.md`](testing/walkthroughs/2026-08-11/tui-companion-semantic-usefulness.md).

#### SA2 · consult menu / chrome carryover · medium · retired

Concern: whether observation-without-answering is sufficient companion value for structured asks.
Evidence: the same witness — the companion observes the ask and converges at settlement, but the TUI is the sole answering authority (assumption A51-L in `memory/SPEC.md`).
Observation: the slice chose observation over dual-answer because dismissing a TUI picker from outside is not reachable — the extension holds only Pi's tool-execution `AbortSignal`, and aborting it cancels the whole turn.
Expected: a human judges whether a colleague watching an ask they cannot answer is useful, or whether dual-answer authority is a real product requirement.
Disposition: retired — the colleague found the companion useful while the TUI retained sole structured-ask answer authority; both presentations updated immediately and converged after the TUI answer. Dual-answer authority is not a current product requirement. Re-enter only if a future workflow requires a companion observer to answer a TUI-owned ask. Evidence: [`testing/walkthroughs/2026-08-11/tui-companion-semantic-usefulness.md`](testing/walkthroughs/2026-08-11/tui-companion-semantic-usefulness.md).

Use future entries like:

```md
#### FX · kind · severity · status

Concern: [onboarding | posture/capture | seeding/orientation | prompt/skill/model | debug mirrors | consult menu | chrome carryover | FE-1187/KA overlap]
Evidence: [workspace/auth dir/terminal/theme/session/debug file/RPC read]
Observation: ...
Expected: ...
Disposition: [pass | logged | diagnose | scoped | spec/plan needed | FE-1167 overlap]
```

## Retired historical material

The original 2026-07-02 walkthrough log was retired from this active findings file. Archived copy: `docs/archive/TESTING_FINDINGS_2026-07-02.md`.

Historical statuses that still matter have been re-collated above into current post-PR-305 concerns. Do not append new findings to the archived log.
