# Current alpha usage and verification sweep

Frontier: post-hardening-alpha-validation
Status:   active
Mode:     sweep
Created:  2026-08-10

## Orientation

- The boundary is the supported current alpha product and operator surface after FE-1311–FE-1321: product entrances, durable-state/authority outcomes, development verification entrances, and installed-package smoke.
- FE-1348 is the containing coverage frontier. It stacks on FE-1321 and absorbs A51-L's final colleague walkthrough; it does not absorb other provider-, comparison-, or KA-owned campaigns.
- No `HANDOFF.md` exists. `TESTING_PLAN.md` is useful historical concern input but predates the current runtime and verification surface; this ledger is the frozen execution inventory.
- Main risk: a broad audit becoming generative. The inventory below is closed; incidental defects and simplification ideas are dispositioned, not implemented during the sweep.

Posture: proving (inherited from `post-hardening-alpha-validation`).

Cross-cutting obligations:

- Canonical product truth remains SQLite graph state plus active-branch Pi JSONL; UI/debug/probe projections are evidence, never alternate stores.
- Structural claims require artifact/query/contract evidence in addition to manual appearance.
- Manual findings follow `docs/praxis/manual-testing.md` and terminate only as fixed, promoted, or retired.
- Workbench state stays local; only reviewed evidence promotes to `.fixtures/runs/`.
- Single-writer authority and target-addressed semantic presentation remain fail-closed across TUI-companion and standalone-web compositions.

## Sweep preflight

### Boundary

**Included:** current supported source/package entrances; workspace/spec/session activation; one bounded Specify path; one bounded Execute path; session resume/tree behavior; companion and standalone browser compositions; stdio/WebSocket RPC and print; canonical graph/session settlement; seeded dev/debug/TUI-preview paths; repository/full/comparison/CI-lane gates; foreign-cwd installed-package smoke; current operator documentation and finding disposition.

**Excluded:** feature implementation; inline fixes/refactors; broad provider/model quality campaigns; FE-1187 R8–R10/A48-L; KA-owned Execute evidence; saved-mission and execution-comparison reruns; legacy 0.x migration without a disposable fixture; cross-platform claims beyond the available witnessed host; shared-session-host cutover deletions; actual npm publication.

### Classification

**Evidence-gated.** Every required row has an existing entry point and owner, but fresh PTY/browser/human evidence is required on the current stack. Deferred rows remain explicit `○` tripwires and do not block closure.

### Aggregate definition of done

- Every `●` row is `have` or `built`; none remains `partial`, `spec`, or `new`.
- Each required product row links a fresh entry-point observation to a canonical artifact/query/contract oracle.
- Every new `TESTING_FINDINGS.md` observation is fixed, promoted to a named owner, or retired with rationale; no open/deferred ownerless finding remains.
- `TESTING_PLAN.md` describes only the current outer-loop surface and points to canonical command policy instead of duplicating stale commands.
- `npm run check`, `npm run verify:full`, and `npm run check:release-pack` pass on the final sweep state.
- A51-L and SA1/SA2 receive evidence-backed dispositions, or their row remains open.

### Inventory stop rule

One genuinely omitted capability may be added with a one-line justification. More than one omitted capability, or any newly discovered sub-seam, invalidates the closed inventory and routes back to `ln-plan`.

## Required product-path ledger

| Capability | Status | Req | Fill | Owner / next | Source-of-truth inputs and closure oracle |
| --- | --- | --- | --- | --- | --- |
| Authless bare-workspace entry | `built` | ● | `proving` | `src/app/`, workspace dialog, I59-L | Fresh scratch `PI_CODING_AGENT_DIR` + bare workbench: creation remains available, no provider turn fires, `/login` recovery is named; DB/workspace/session reads confirm no hidden auth or premature turn. Evidence: [`testing/walkthroughs/2026-08-10/authless-bare-workspace-entry.md`](../../testing/walkthroughs/2026-08-10/authless-bare-workspace-entry.md). |
| Populated-workspace posture entry | `built` | ● | `proving` | workspace/session coordinator, D118-L | Fresh populated workbench with no `.brunch/`: dialog establishes kind/origin before the agent; `workspace.state` and DB readback prove persisted posture and no invented authority. Evidence: [`testing/walkthroughs/2026-08-10/populated-workspace-posture-entry.md`](../../testing/walkthroughs/2026-08-10/populated-workspace-posture-entry.md). |
| Specify session interaction | `built` | ● | `proving` | TUI + elicitor/exchange/graph owners | Real TUI path performs orientation, one ask/answer, one proposal or digest/review outcome, and graph readback; JSONL, graph overview, receipt/LSN, and debug mirrors agree. Evidence: [`testing/walkthroughs/2026-08-10/specify-session-interaction.md`](../../testing/walkthroughs/2026-08-10/specify-session-interaction.md). |
| Execute mode interaction | `partial` | ● | `proving` | FE-1348; re-enter on a fresh supported seed with a readable plan/run, or when a supported plan read is available | Real mode switch exposes capability-honest Prepare/Compile/Execute availability on a suitable existing seed; session runtime state and plan/run read methods match visible promises. Full provider execution remains excluded. Owned gate: a fresh `workspace-alpha-grounding/scope-handoff-ready` copy switched through the real TUI to Execute and honestly advertised Prepare only; `session.runtimeState` agreed, but `execute.runs` / `execute.runTraceIndex` were empty and discovery exposed no independent plan read, so Compile/Execute could not be proved without manufacturing state. Evidence: [`testing/walkthroughs/2026-08-10/execute-mode-interaction-owned-gate.md`](../../testing/walkthroughs/2026-08-10/execute-mode-interaction-owned-gate.md). |
| Session resume and active-tree continuity | `built` | ● | `proving` | `src/session/`, coordinator, D24-L | Quit/relaunch and one Pi-valid branch/tree change preserve selected spec, active-leaf transcript, mode/style, and canonical JSONL projection without append-order leakage. Evidence: [`testing/walkthroughs/2026-08-10/session-resume-active-tree-continuity.md`](../../testing/walkthroughs/2026-08-10/session-resume-active-tree-continuity.md). |
| TUI-companion semantic usefulness | `built` | ● | `proving` | FE-1321 / A51-L | A colleague found ordinary turns and the observe-only structured ask useful across the real TUI and companion. Both presentations converged immediately on the canonical JSONL; the browser's answer attempt was honestly refused while the TUI retained sole answer authority; SA1/SA2 were retired without contract changes. Evidence: [`testing/walkthroughs/2026-08-11/tui-companion-semantic-usefulness.md`](../../testing/walkthroughs/2026-08-11/tui-companion-semantic-usefulness.md). |
| Cross-composition writer transfer | `built` | ● | `proving` | session writer guard + standalone host, I64-L | While TUI owns the target, standalone open is refused without mutation; after normal TUI shutdown, standalone web reopens and continues the same JSONL; owner/lock and projection evidence agree. Evidence: [`testing/walkthroughs/2026-08-10/cross-composition-writer-transfer.md`](../../testing/walkthroughs/2026-08-10/cross-composition-writer-transfer.md). |
| Standalone-web driven session | `built` | ● | `proving` | FE-1348 | At commit `08c7f2b87`, the final standalone witness used workspace `/tmp/brunch-fe1348-final2.QTlmdv`, session `019ff56d-2344-7e36-86ba-17fa11935900`, and its exact 13-entry canonical JSONL. User-supplied live and twice-reloaded screenshots plus coordinator inspection showed the same first assistant turn, one answered first ask, follow-up assistant content, and second live ask in order, with no stale form or duplicate. JSONL retained one structured `validation_failed` intermediate result correctly omitted by React and no accepted graph effect. SIGTERM cleanup of PID `88536` completed on bounded attempt 2: process/listener stopped and the target writer owner was removed without manual repair. Evidence: [`testing/walkthroughs/2026-08-10/standalone-web-driven-session.md`](../../testing/walkthroughs/2026-08-10/standalone-web-driven-session.md). |
| Stdio public RPC | `built` | ● | `proving` | FE-1348 | At commit `3cddae4eb`, one fresh same-workspace target carried exactly one unresolved Anthropic free-text ask into the stopped-runtime public stdio host. Discovery, exact-file activation, the sole trigger, pending, and exchanges reads agreed without mutation; one schema-valid direct submit appended exactly one terminal correlated to the original provider tool-call id, after which pending was idle and exchanges was ready with one closed correlation. The final 10-entry JSONL, command/result ledger, hashes, stopped PID/listener, absent owner, zero-retry conduct, and cleanup are retained. Prior clone and trigger failures remain immutable history; repairs `f6053d605`, `f741f94df`, `bd77c277f`, and `3cddae4eb` are fixed by this fresh outer witness. The separately observed duplicate React rendering is promoted under `shared-session-host-cutover` and does not widen this stdio claim. Evidence: [`stdio-public-rpc-final/walkthrough.md`](../../testing/walkthroughs/2026-08-10/stdio-public-rpc-final/walkthrough.md), [`testing/walkthroughs/2026-08-10/stdio-public-rpc-owned-gate.md`](../../testing/walkthroughs/2026-08-10/stdio-public-rpc-owned-gate.md). |
| Print projection | `built` | ● | `proving` | FE-1348 | Source and freshly packed/isolated installed-package foreign-cwd `--mode print` both project a selected workspace without mutation; before/after canonical files are byte-stable. The installed leg uses exactly the reviewed `package.json.allowScripts` policy. Evidence: [`testing/walkthroughs/2026-08-10/print-projection-owned-gate.md`](../../testing/walkthroughs/2026-08-10/print-projection-owned-gate.md). |
| Cross-surface graph/session settlement | `partial` | ● | `proving` | `shared-session-host-cutover`; wait-gated on SW2 repair before another authorized journey | The final authorized rerun stopped before the required instruction/proposal because duplicate actionable React controls made the first canonical ask ambiguous. The user attempted the first duplicate and saw false `ask closed`, but canonical JSONL records a successful financial choice; the stale duplicate remained, provider conduct followed the wrong branch, and the later ask duplicated too. The exact 13-entry JSONL, public graph overview, and read-only SQLite audit prove no proposal/review/effect and `nodes: []`, `edges: []`, LSN 1. This strengthens existing SW2 rather than opening a finding; it is no longer presentation noise. CS1 is fixed in code by `8c23ada95`, `fd10e839c`, and `abb0b8bd6`, but this stopped journey did not outer-witness the repaired cross-surface path. Evidence: [`cross-surface-graph-session-settlement-rerun/walkthrough.md`](../../testing/walkthroughs/2026-08-12/cross-surface-graph-session-settlement-rerun/walkthrough.md); prior CS1 failure provenance: [`cross-surface-graph-session-settlement-final/walkthrough.md`](../../testing/walkthroughs/2026-08-12/cross-surface-graph-session-settlement-final/walkthrough.md). |

## Required developer and verification-path ledger

| Capability | Status | Req | Fill | Owner / next | Source-of-truth inputs and closure oracle |
| --- | --- | --- | --- | --- | --- |
| Seeded workbench and fixture validation | `built` | ● | `proving` | `.fixtures/`, seed CLI, graph validator | Validate the selected seed, reset its workbench explicitly, inspect workspace/session/graph through dev RPC, and prove local runtime state is not tracked evidence. Evidence: [`testing/walkthroughs/2026-08-10/seeded-workbench-and-fixture-validation.md`](../../testing/walkthroughs/2026-08-10/seeded-workbench-and-fixture-validation.md). |
| TUI-driver lifecycle fallback | `built` | ● | `proving` | `src/dev/tui-driver.ts` | Start/wait/send/screen/stop/remove one bounded session; `list` shows no live or residual session and the captured screen reflects the real entry path. Evidence: [`testing/walkthroughs/2026-08-10/tui-driver-lifecycle-fallback.md`](../../testing/walkthroughs/2026-08-10/tui-driver-lifecycle-fallback.md). |
| Component-preview surface | `built` | ● | `proving` | `src/dev/component-preview/` | Launch the gallery and inspect current exchange/editor/execute/browser-relevant families at both themes and representative widths; record qualitative findings, with existing snapshots as the structural oracle. Evidence: [`testing/walkthroughs/2026-08-10/component-preview-surface.md`](../../testing/walkthroughs/2026-08-10/component-preview-surface.md). |
| Debug-mirror legibility | `built` | ● | `proving` | `src/dev/`, `.brunch/debug/` | A provider-triggering or deterministic supported path produces the documented mirrors; each answers its named operator question and agrees with JSONL/runtime state. Absence is accepted only where canonical docs declare it optional. Evidence: [`testing/walkthroughs/2026-08-10/debug-mirror-legibility.md`](../../testing/walkthroughs/2026-08-10/debug-mirror-legibility.md). |
| Read-only repository gate | `built` | ● | `earned` | `package.json`, CI | `npm run check` passes; warnings are classified as known or promoted, never silently fixed outside the sweep manifest. Evidence: [`testing/walkthroughs/2026-08-10/read-only-repository-gate.md`](../../testing/walkthroughs/2026-08-10/read-only-repository-gate.md). |
| Full retained local gate | `built` | ● | `earned` | Vitest/build scripts | `npm run verify:full` passes, proving default, core-slow, comparison, and build paths through the declared aggregate command. Counts/skips match policy. Evidence: [`testing/walkthroughs/2026-08-10/full-retained-local-gate.md`](../../testing/walkthroughs/2026-08-10/full-retained-local-gate.md). |
| Comparison lane entry | `built` | ● | `proving` | comparison controllers/oracles | `npm run test:comparison` passes its closed current suite and leaves bounded cleanup. This validates the lane, not a fresh provider comparison campaign. Evidence: [`testing/walkthroughs/2026-08-10/comparison-lane-entry.md`](../../testing/walkthroughs/2026-08-10/comparison-lane-entry.md). |
| Conditional CI lane selection | `built` | ● | `earned` | `scripts/ci-test-lanes.mjs`, workflow | Focused selector tests prove closed allowlist omission and fail-open behavior for runtime, unknown/incomplete, and merge-group events; workflow and SPEC policy agree. Evidence: [`testing/walkthroughs/2026-08-10/conditional-ci-lane-selection.md`](../../testing/walkthroughs/2026-08-10/conditional-ci-lane-selection.md). |
| Installed-package integrity | `built` | ● | `proving` | `scripts/check-release-pack.mjs`, package assets | `npm run check:release-pack` passes: tarball assets, isolated install, foreign-cwd boot/RPC, and SQLite native binding work without source-tree reachability. Evidence: [`testing/walkthroughs/2026-08-10/installed-package-integrity.md`](../../testing/walkthroughs/2026-08-10/installed-package-integrity.md). |
| Installed interactive-mode boot | `built` | ● | `proving` | packaged CLI + TUI/web composition | A fresh packed isolated install using exactly the reviewed truthy `package.json.allowScripts` policy starts the installed authless TUI under the project-owned PTY fallback and installed standalone web from separate foreign cwd(s); the rendered pre-agent workspace chooser and served loopback HTML surface are observed before clean shutdown with no driver session, listener, or process residue. No provider turn or publication occurred. Evidence: [`testing/walkthroughs/2026-08-10/installed-interactive-mode-boot.md`](../../testing/walkthroughs/2026-08-10/installed-interactive-mode-boot.md). |
| Current testing guidance | `built` | ● | `earned` | `TESTING_PLAN.md`, D142-L, manual/comparison/dev guidance | Canonical guidance now chooses machine, browser, or PTY control by the evidence claim; Herdr is the preferred PTY host, with overlay and headless fallbacks retained. The current prompt-level `interactive_shell` behavior and Brunch Execute process-move exception remain explicit and owned by `cli-mode-entry` / `comparison-machine-interface-cutover`; no unlanded cutover is claimed. `npm run check` passes with only pre-existing warnings. Evidence: [`TESTING_PLAN.md`](../../TESTING_PLAN.md), [`docs/praxis/manual-testing.md`](../../docs/praxis/manual-testing.md), [`docs/praxis/comparison-runs.md`](../../docs/praxis/comparison-runs.md), [`src/dev/README.md`](../../src/dev/README.md). |
| Findings reconciliation | `built` | ● | `earned` | `TESTING_FINDINGS.md` | Every retained sweep observation is accounted for without converting owned product-evidence gates into findings; SA1/SA2 are promoted with their existing owner and A51-L trigger, and historical findings remain provenance. Evidence: [`TESTING_FINDINGS.md`](../../TESTING_FINDINGS.md). |

## Explicit deferred / tripwired rows

| Capability | Status | Req | Fill | Owner / next | Gate / re-entry trigger |
| --- | --- | --- | --- | --- | --- |
| Disposable Brunch 0.x compatibility | `spec` | ○ | `proving` | onboarding safety / D124-L | Wait for a trustworthy disposable 0.x fixture; do not manufacture or risk real data. |
| FE-1187 provider conduct and A48-L | `partial` | ○ | `proving` | `walkthrough-remediation-2` | Resume only on explicit user re-entry after extractor/oracle reconciliation. |
| KA-owned Execute outer evidence | `partial` | ○ | `proving` | PLAN KA evidence queue | Re-enter under each named KA frontier and its existing authorization trigger. |
| Saved-mission Brunch + Claude witness | `spec` | ○ | `proving` | `saved-mission-comparison-witness` | Operator scheduling; FE-1215/FE-1320 dependencies are already satisfied. |
| Execution-comparison provider reruns | `partial` | ○ | `proving` | FE-1230/FE-1250/FE-1254/FE-1289 | Existing exact-artifact or explicit-authorization triggers only. |
| Cross-platform terminal matrix | `spec` | ○ | `proving` | SPEC blind spot / manual protocol | Re-enter on available Linux/other-terminal host or a concrete portability defect. |
| Shared-session raw-relay cutover | `spec` | ○ | `earned` | `shared-session-host-cutover` | Starts only after A51-L and this frontier's relevant evidence close. |
| Actual npm publication | `spec` | ○ | `earned` | release workflow | Reviewed Changesets release path on `next`; never publish from this sweep. |

## Incidental audit protocol

For each required row, ask only:

1. Did the real path contradict its documented owner, authority, or outcome?
2. Is a duplicate/bridge/indirection demonstrably load-bearing nowhere on this path?
3. Can the same contract be preserved with fewer concepts or a more canonical existing seam?
4. Did the test require wiring the product itself does not provide?

Record evidence in `TESTING_FINDINGS.md`. Do not edit production code while executing a row.

- Tiny settled verification-harness defect → separate FE-1348 row-sized scope/build.
- Behavioral or architecture change → promote to the owning existing frontier or `ln-plan` a new one.
- Restructure-only opportunity → `ln-refactor`.
- Weak or proxy-divergent evidence → `ln-witness` / `ln-oracles`.
- No present reader, failure, or measurable simplification → retire the finding.

## Execution order

1. Freeze commit, environment, selected fixtures, and tool versions in one walkthrough record.
2. Run repository/full/comparison/release-pack gates; stop and route any red result through `ln-diagnose`.
3. Run isolated onboarding, source-mode, lifecycle, RPC/print, and dev-tool rows.
4. Run browser/TUI companion and cross-composition rows, including A51-L/SA1/SA2.
5. Reconcile guidance and findings; rerun the final canonical gates.
6. Update ledger statuses and canonical PLAN/SPEC only for evidence actually obtained.

## Expected touched paths (frontier, tentative)

```text
memory/
├── PLAN.md                                                        ~
├── SPEC.md                                                        ?  # only if A51-L or another durable assumption changes
└── cards/
    └── post-hardening-alpha-validation--usage-and-verification-sweep.md  ~
TESTING_PLAN.md                                                     ~
TESTING_FINDINGS.md                                                 ~
testing/walkthroughs/2026-08-10/                                   +
.fixtures/runs/                                                     ?  # reviewed promotion only
src/                                                               —  # no production edits in the sweep itself
```
