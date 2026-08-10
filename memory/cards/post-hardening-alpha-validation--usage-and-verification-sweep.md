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
| Standalone-web driven session | `partial` | ● | `proving` | `src/app/brunch-web.ts`, live-session host | Source launch, direct target route, open/drive/ask/settle/reload/close journey through production WebSocket RPC; browser state equals canonical JSONL and cleanup leaves no writer. |
| Stdio public RPC | `partial` | ● | `proving` | FE-1348; re-enter when the launched Brunch runtime has a provider/model available to `session.triggerExchange`, or a deterministic supported product path authors a pending exchange | `rpc.discover`, workspace/session activation, one read and one structured exchange through `npm run dev-cli -- rpc`; schemas, method results, JSONL, and projections agree without raw Pi RPC. Owned gate: an authorized real-provider retry still returned idle because the launched Brunch runtime had no model available: the canonical JSONL contains the context seed but no kick or assistant turn, and public exchange projections are empty/idle. No typed response can be submitted until a supported assistant-first turn authors a pending exchange. Evidence: [`testing/walkthroughs/2026-08-10/stdio-public-rpc-owned-gate.md`](../../testing/walkthroughs/2026-08-10/stdio-public-rpc-owned-gate.md). |
| Print projection | `partial` | ● | `proving` | FE-1348; re-enter on an owned successful real packed install | Source and installed-package foreign-cwd `--mode print` both project the selected workspace without mutation; before/after canonical files are byte-stable. Source passes and is byte-stable; installed projection is gated because npm 12 blocked the real packed install's `better-sqlite3@12.11.1` script, leaving no native binding. Evidence: [`testing/walkthroughs/2026-08-10/print-projection-owned-gate.md`](../../testing/walkthroughs/2026-08-10/print-projection-owned-gate.md). |
| Cross-surface graph/session settlement | `partial` | ● | `proving` | FE-1348; re-enter when an authorized successful journey retains canonical JSONL plus two fresh product projections of the same accepted effect | Retained Specify evidence proves 1 receipt / 1 LSN / 1 change-log row and exact canonical graph settlement for each of two accepted effects; current contract oracles pass. Normalized-equivalent fresh session projections cannot be proved because the disposable JSONL/workspace was cleaned and the record retained no serializable projections; UI/debug mirrors are non-authoritative. Owned gate: [`testing/walkthroughs/2026-08-10/cross-surface-graph-session-settlement-owned-gate.md`](../../testing/walkthroughs/2026-08-10/cross-surface-graph-session-settlement-owned-gate.md). |

## Required developer and verification-path ledger

| Capability | Status | Req | Fill | Owner / next | Source-of-truth inputs and closure oracle |
| --- | --- | --- | --- | --- | --- |
| Seeded workbench and fixture validation | `partial` | ● | `proving` | `.fixtures/`, seed CLI, graph validator | Validate the selected seed, reset its workbench explicitly, inspect workspace/session/graph through dev RPC, and prove local runtime state is not tracked evidence. |
| TUI-driver lifecycle fallback | `built` | ● | `proving` | `src/dev/tui-driver.ts` | Start/wait/send/screen/stop/remove one bounded session; `list` shows no live or residual session and the captured screen reflects the real entry path. Evidence: [`testing/walkthroughs/2026-08-10/tui-driver-lifecycle-fallback.md`](../../testing/walkthroughs/2026-08-10/tui-driver-lifecycle-fallback.md). |
| Component-preview surface | `partial` | ● | `proving` | `src/dev/component-preview/` | Launch the gallery and inspect current exchange/editor/execute/browser-relevant families at both themes and representative widths; record qualitative findings, with existing snapshots as the structural oracle. |
| Debug-mirror legibility | `built` | ● | `proving` | `src/dev/`, `.brunch/debug/` | A provider-triggering or deterministic supported path produces the documented mirrors; each answers its named operator question and agrees with JSONL/runtime state. Absence is accepted only where canonical docs declare it optional. Evidence: [`testing/walkthroughs/2026-08-10/debug-mirror-legibility.md`](../../testing/walkthroughs/2026-08-10/debug-mirror-legibility.md). |
| Read-only repository gate | `built` | ● | `earned` | `package.json`, CI | `npm run check` passes; warnings are classified as known or promoted, never silently fixed outside the sweep manifest. Evidence: [`testing/walkthroughs/2026-08-10/read-only-repository-gate.md`](../../testing/walkthroughs/2026-08-10/read-only-repository-gate.md). |
| Full retained local gate | `built` | ● | `earned` | Vitest/build scripts | `npm run verify:full` passes, proving default, core-slow, comparison, and build paths through the declared aggregate command. Counts/skips match policy. Evidence: [`testing/walkthroughs/2026-08-10/full-retained-local-gate.md`](../../testing/walkthroughs/2026-08-10/full-retained-local-gate.md). |
| Comparison lane entry | `built` | ● | `proving` | comparison controllers/oracles | `npm run test:comparison` passes its closed current suite and leaves bounded cleanup. This validates the lane, not a fresh provider comparison campaign. Evidence: [`testing/walkthroughs/2026-08-10/comparison-lane-entry.md`](../../testing/walkthroughs/2026-08-10/comparison-lane-entry.md). |
| Conditional CI lane selection | `built` | ● | `earned` | `scripts/ci-test-lanes.mjs`, workflow | Focused selector tests prove closed allowlist omission and fail-open behavior for runtime, unknown/incomplete, and merge-group events; workflow and SPEC policy agree. Evidence: [`testing/walkthroughs/2026-08-10/conditional-ci-lane-selection.md`](../../testing/walkthroughs/2026-08-10/conditional-ci-lane-selection.md). |
| Installed-package integrity | `partial` | ● | `proving` | `scripts/check-release-pack.mjs`, package assets | `npm run check:release-pack` passes: tarball assets, isolated install, foreign-cwd boot/RPC, and SQLite native binding work without source-tree reachability. |
| Installed interactive-mode boot | `partial` | ● | `proving` | packaged CLI + TUI/web composition | Reuse the packed isolated install to bound-start authless TUI and standalone web from a foreign cwd; observe real startup surfaces, then shut both down cleanly. No provider turn or publication required. |
| Current testing guidance | `built` | ● | `earned` | `TESTING_PLAN.md`, manual-testing docs, SPEC verification policy | Stale branch/PR/command/runtime assumptions are removed; retained outer-loop concerns map to current required rows or named deferred owners, while canonical command policy remains linked rather than duplicated. Markdown-link check passes. Evidence: [`TESTING_PLAN.md`](../../TESTING_PLAN.md). |
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

## Expected touched paths (tentative)

```text
memory/
├── PLAN.md                                                        ~
├── SPEC.md                                                        ?  # only if A51-L or another durable assumption changes
└── cards/
    └── post-hardening-alpha-validation--usage-and-verification-sweep.md  +
TESTING_PLAN.md                                                     ~
TESTING_FINDINGS.md                                                 ~
testing/walkthroughs/2026-08-10/                                   +
.fixtures/runs/                                                     ?  # reviewed promotion only
src/                                                               —  # no production edits in the sweep itself
```
