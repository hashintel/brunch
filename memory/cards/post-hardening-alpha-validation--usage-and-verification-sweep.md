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
| TUI-companion semantic usefulness | `partial` | ● | `proving` | FE-1321 / A51-L | Colleague walkthrough: ordinary turn + structured ask are useful in both TUI and companion; fresh JSONL projection matches settled React; browser cannot steal answer authority; SA1/SA2 are dispositioned. |
| Cross-composition writer transfer | `built` | ● | `proving` | session writer guard + standalone host, I64-L | While TUI owns the target, standalone open is refused without mutation; after normal TUI shutdown, standalone web reopens and continues the same JSONL; owner/lock and projection evidence agree. Evidence: [`testing/walkthroughs/2026-08-10/cross-composition-writer-transfer.md`](../../testing/walkthroughs/2026-08-10/cross-composition-writer-transfer.md). |
| Standalone-web driven session | `partial` | ● | `proving` | FE-1348; re-enter when agent-browser can launch/connect to Chrome, with a production provider/model capable of authoring one supported structured ask | Source launch succeeded, but agent-browser failed before navigation (`CDP response channel closed`; fresh daemon namespaces exited during startup), so no browser/WebSocket/provider claim was substituted. The product-created three-entry JSONL remained unmodified; host/listener cleanup passed and no writer existed. Evidence: [`testing/walkthroughs/2026-08-10/standalone-web-driven-session.md`](../../testing/walkthroughs/2026-08-10/standalone-web-driven-session.md). |
| Stdio public RPC | `partial` | ● | `proving` | FE-1348; re-enter when the launched Brunch runtime has a provider/model available to `session.triggerExchange`, or a deterministic supported product path authors a pending exchange | `rpc.discover`, workspace/session activation, one read and one structured exchange through `npm run dev-cli -- rpc`; schemas, method results, JSONL, and projections agree without raw Pi RPC. Owned gate: an authorized real-provider retry still returned idle because the launched Brunch runtime had no model available: the canonical JSONL contains the context seed but no kick or assistant turn, and public exchange projections are empty/idle. No typed response can be submitted until a supported assistant-first turn authors a pending exchange. Evidence: [`testing/walkthroughs/2026-08-10/stdio-public-rpc-owned-gate.md`](../../testing/walkthroughs/2026-08-10/stdio-public-rpc-owned-gate.md). |
| Print projection | `built` | ● | `proving` | FE-1348 | Source and freshly packed/isolated installed-package foreign-cwd `--mode print` both project a selected workspace without mutation; before/after canonical files are byte-stable. The installed leg uses exactly the reviewed `package.json.allowScripts` policy. Evidence: [`testing/walkthroughs/2026-08-10/print-projection-owned-gate.md`](../../testing/walkthroughs/2026-08-10/print-projection-owned-gate.md). |
| Cross-surface graph/session settlement | `partial` | ● | `proving` | FE-1348; re-enter when an authorized successful journey retains canonical JSONL plus two fresh product projections of the same accepted effect | Retained Specify evidence proves 1 receipt / 1 LSN / 1 change-log row and exact canonical graph settlement for each of two accepted effects; current contract oracles pass. Normalized-equivalent fresh session projections cannot be proved because the disposable JSONL/workspace was cleaned and the record retained no serializable projections; UI/debug mirrors are non-authoritative. Owned gate: [`testing/walkthroughs/2026-08-10/cross-surface-graph-session-settlement-owned-gate.md`](../../testing/walkthroughs/2026-08-10/cross-surface-graph-session-settlement-owned-gate.md). |

## Active row scope — Standalone-web driven session

### Orientation

- The containing seam is D132-L/D133-L standalone web: `src/app/brunch-web.ts` owns the cwd-scoped `LiveSessionHost`, while the React session route is a target-addressed projection/driver over production WebSocket Brunch RPC.
- FE-1348 `post-hardening-alpha-validation` is the frontier and branch boundary; this proving row obtains or honestly gates evidence only. It does not implement a feature, repair a defect, or change the runtime contract.
- No `HANDOFF.md` exists. The current branch must remain `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`; record the exact commit and environment actually witnessed in the walkthrough.
- Main risk: mistaking a browser-looking-alive or provider-invented transcript for proof. Browser claims require `agent-browser`; conduct uses production Brunch RPC; canonical comparison uses the active-branch JSONL projector rather than append-order inspection.

Posture: proving (inherited from `post-hardening-alpha-validation`).

### Row preflight

- **Boundary:** in — one source-launched standalone-web host, one durable `(specId, sessionId)`, the direct `/session/$specId/$sessionId` route, production `/rpc` `session.open` / `session.driveTurn` / `session.openAsks` / `session.answerExchange` / `session.presentation` / `session.close`, one React-answerable structured ask, settlement, reload, canonical active-branch comparison, and writer/listener cleanup. Out — TUI companion/A51-L, Execute re-entry, stdio re-entry, cross-surface settlement re-entry, provider-quality repetition, package smoke, feature/fix work, raw Pi RPC, private handler calls, and transcript/DB fabrication.
- **Canonical owner:** standalone `LiveSessionHost` and its production WebSocket Brunch RPC boundary; SQLite remains graph truth, active-branch Pi JSONL remains session truth, and React remains a projection.
- **Source-of-truth inputs:** a row-owned local workbench with an honestly product-created target; the source CLI's reported loopback URL; the exact target ids and canonical session file; production WebSocket request/results and semantic events; browser accessibility state; fresh `projectSessionPresentationFile` output over that JSONL; writer-owner path and process/listener liveness.
- **Closure oracle:** a concise walkthrough at `testing/walkthroughs/2026-08-10/standalone-web-driven-session.md` binds every acceptance leaf below to the observed browser/RPC/artifact evidence. The ledger moves to `built` only if every leaf is met; otherwise it stays `partial` with the exact gate and a re-entry trigger.
- **Classification:** evidence-gated. The entry points exist, but a production provider/model and a supported assistant-authored structured ask must be available during the bounded journey.
- **Overlap test:** the only active FE-1348 scope artifact is this ledger. The walkthrough filename is row-unique; production paths are read-only; one write-capable delegate owns the row at a time.

### Objective

A real browser completes the standalone-web target lifecycle over production WebSocket Brunch RPC and, after settlement and reload, presents the same active-branch session meaning as canonical Pi JSONL with no writer or listener left after close.

### Execution discipline and honest stop

1. Use `docs/praxis/manual-testing.md`: launch source Brunch with `npm run dev-cli -- --workspace <workbench> --mode web`, drive the direct target route with `agent-browser`, and use CDP only for WebSocket/console/network detail. Do not use a PTY merely to exchange text.
2. Use a fresh row-owned workbench or a coordinator-approved existing one; never reset, delete, or overwrite pre-existing ignored `.brunch/` state. Keep the exercised workbench `.brunch/` local/ignored after the row.
3. Establish the target only through a supported product path. If a fresh workbench has no target, a bounded public `npm run dev-cli -- rpc workspace.activate ...` prerequisite may create it before web launch; that setup supplies no evidence for and does not re-enter the separate stdio row. Do not author JSONL, SQLite rows, open-ask state, or provider output directly.
4. Bound provider conduct to the smallest journey that can produce one React-answerable free-text or listed single/multi-choice `ask`; answer it through the browser's `session.answerExchange` path and wait for the production `agent_settled` boundary.
5. If no model/provider resolves, `session.driveTurn` cannot produce a real turn, or no supported structured ask is authored within the bounded journey, stop. Record the exact RPC/browser/JSONL state and re-entry condition, leave the row `partial`, and do not substitute a faux transcript, test-only provider, private handler, raw Pi RPC, or direct state edit.
6. Do not edit production code. A product contradiction becomes a dispositioned finding or a separately routed scope; it is not repaired during this row.

### Acceptance criteria

- ✓ **Source/route observation** — the walkthrough records the exact source launch command and reported loopback URL, then an `agent-browser` observation of the direct `/session/$specId/$sessionId` route for the intended durable target.
- ✓ **Production WebSocket lifecycle trace** — browser/CDP evidence names successful target-addressed `session.open`, `session.driveTurn`, `session.openAsks`, `session.answerExchange`, `session.presentation`, and `session.close` traffic on `/rpc`; no `/rpc/driver`, raw `brunch.sessionEvent`, raw Pi RPC, or targetless fallback participates.
- ✓ **Ask and settlement observation** — the browser renders the real assistant-authored ask, submits the typed answer through its supported control, remains busy until `agent_settled`, then clears ephemeral overlay state and shows the settled terminal meaning.
- ✓ **Canonical active-branch comparison** — after settlement, the ordered browser-visible user/assistant/ask meaning and production `session.presentation` equal a fresh `projectSessionPresentationFile` projection of the same target's active-branch Pi JSONL; abandoned/history append order and debug mirrors are not used as current truth.
- ✓ **Reload convergence** — reloading the same direct target route reopens or reattaches through production `/rpc`, reconstructs the settled meaning from canonical JSONL without duplicates or stale overlay, and does not create a second session file or writer.
- ✓ **Close/cleanup proof** — route close issues `session.close`; host shutdown closes the loopback listener; the Brunch process exits; the target writer-owner path is absent; and no row-owned browser/driver process remains. The workbench's durable `.brunch/` evidence remains local/ignored, not promoted or deleted.
- ✓ **No implementation or manufactured success** — `git diff` shows no production/config/fixture change from the row, and any unmet provider/model/ask prerequisite is recorded as a `partial` owned gate rather than claimed as success.

### Verification approach

- **Inner:** none — this row edits no production code and does not re-prove existing unit contracts.
- **Middle:** production WebSocket RPC results/events plus a fresh active-branch `projectSessionPresentationFile` projection prove target identity, lifecycle, settlement, reload convergence, and JSONL equality.
- **Outer:** `agent-browser` accessibility snapshots/interactions prove the browser route, ask control, settled presentation, and reload behavior; CDP supplies WebSocket and console/network detail where needed.

### Cross-cutting obligations

- Preserve D142-L machine-first conduct and real-browser evidence for browser claims.
- Preserve I64-L target-addressed single-writer authority and I65-L JSONL-derived semantic convergence.
- Treat SQLite plus active-branch Pi JSONL as canonical; browser/debug/network observations remain projections or transport evidence.
- Keep the later A51-L colleague walkthrough, Execute re-entry, stdio re-entry, and cross-surface settlement rows untouched.
- Reconcile this ledger only to evidence actually obtained; findings use the manual-testing terminal dispositions and never trigger inline production edits.

### Expected touched paths (tentative)

```text
memory/cards/
└── post-hardening-alpha-validation--usage-and-verification-sweep.md  ~  # active row result only
testing/walkthroughs/2026-08-10/
└── standalone-web-driven-session.md                                 +
TESTING_FINDINGS.md                                                   ?  # only for an actual observation, with terminal disposition or named owner/re-entry trigger
.fixtures/workbenches/<row-owned-workbench>/.brunch/                  ~  # ignored local runtime evidence; retain, do not promote/delete
src/                                                                  —  # read-only; no production edits
```

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
| Findings reconciliation | `partial` | ● | `earned` | `TESTING_FINDINGS.md` | Every observation from this sweep uses the pinned finding shape and terminates as fixed/promoted/retired; historical findings remain provenance rather than being reopened by default. |

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
