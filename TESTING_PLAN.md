# Brunch Outer-Loop Testing Guidance

This file is a stable orientation surface for current alpha walkthroughs. It is not a branch checklist, PR gate, command-policy copy, or live status ledger.

- FE-1348's closed inventory, row status, owners, gates, and retained evidence live in the [current alpha usage and verification sweep](memory/cards/post-hardening-alpha-validation--usage-and-verification-sweep.md).
- Setup, PTY/browser control, workbench handling, evidence capture, and findings discipline live in the [Manual Testing Protocol](docs/praxis/manual-testing.md).
- Canonical verification commands and lane policy live in [SPEC §Verification Design](memory/SPEC.md#verification-design); repository execution details live in [AGENTS §verification](AGENTS.md#verification).
- Walkthrough observations go to [`TESTING_FINDINGS.md`](TESTING_FINDINGS.md). Durable product or sequencing changes reconcile through `memory/SPEC.md` and `memory/PLAN.md`.

Do not copy a branch name, PR number, package/runtime version, fixture list, or verification command table into this file. Record run-specific values in the walkthrough evidence for the applicable FE-1348 row.

## Current outer-loop surface

Use the FE-1348 ledger as the executable checklist. The concern map below explains why each part of the current surface is sampled without duplicating row status or acceptance criteria.

### Entry and durable posture

- **Authless first run and bare workspaces** → `Authless bare-workspace entry`.
- **Populated workspace posture before agent activity** → `Populated-workspace posture entry`.
- **Legacy Brunch 0.x safety** → deferred `Disposable Brunch 0.x compatibility`, owned by onboarding safety / D124-L and re-entered only with a trustworthy disposable fixture.

Workbench `.brunch/` state is local runtime state, not tracked fixture truth. Promote only reviewed evidence through the process in the Manual Testing Protocol.

### Specify, Execute, and continuity

- **One bounded Specify journey, including structured interaction and graph settlement** → `Specify session interaction` and `Cross-surface graph/session settlement`.
- **Mode choice and capability-honest Execute availability** → `Execute mode interaction`.
- **Relaunch, active-branch/tree continuity, and retained orientation** → `Session resume and active-tree continuity`.
- **Broader Specify provider conduct** → deferred `FE-1187 provider conduct and A48-L`, owned by `walkthrough-remediation-2` and resumed only on explicit re-entry after extractor/oracle reconciliation.
- **KA-specific Execute conduct** → deferred `KA-owned Execute outer evidence`, owned by the PLAN KA evidence queue and re-entered under each named KA frontier's authorization trigger.

### TUI and browser compositions

- **Normal TUI plus companion React usefulness, structured asks, and answer authority** → `TUI-companion semantic usefulness` (including A51-L and findings SA1/SA2).
- **Standalone browser open/drive/settle/reload/close behavior** → `Standalone-web driven session`.
- **Single-writer refusal and post-shutdown ownership transfer** → `Cross-composition writer transfer`.
- **Current component families across themes and representative widths** → `Component-preview surface`.
- **Terminal portability beyond the witnessed host** → deferred `Cross-platform terminal matrix`, owned by the SPEC blind spot / manual protocol and re-entered on another available host or a concrete portability defect.
- **Raw-relay deletion after the evidence gate** → deferred `Shared-session raw-relay cutover`, owned by `shared-session-host-cutover` after A51-L and the relevant FE-1348 evidence close.

### Public projections and operator observability

- **Public stdio discovery, reads, and structured exchange** → `Stdio public RPC`.
- **Source and foreign-cwd installed print without mutation** → `Print projection`.
- **Operator-readable debug mirrors tied back to canonical runtime state** → `Debug-mirror legibility`.

Canonical truth remains graph state plus active-branch Pi JSONL. Browser, TUI, print, RPC, and debug outputs are projections or evidence, not alternate stores.

### Developer and package paths

- **Seed validation, explicit workbench reset, and dev reads** → `Seeded workbench and fixture validation`.
- **Bounded headless PTY fallback lifecycle** → `TUI-driver lifecycle fallback`.
- **Repository, full, comparison, and conditional-CI behavior** → `Read-only repository gate`, `Full retained local gate`, `Comparison lane entry`, and `Conditional CI lane selection`.
- **Packed assets, isolated foreign-cwd install, native binding, and source-tree independence** → `Installed-package integrity`.
- **Foreign-cwd TUI and standalone-web startup/cleanup** → `Installed interactive-mode boot`.
- **Actual publication** → deferred `Actual npm publication`, owned by the reviewed Changesets release workflow on `next`; never publish from the FE-1348 sweep.

Mission-driven provider comparisons are not implied by entering the comparison lane. The saved Brunch + Claude witness and execution-comparison reruns remain with the named deferred rows and their authorization triggers in the FE-1348 ledger.

## Evidence and findings

For each required product row, pair the fresh entry-point observation with the row's canonical artifact, query, or contract oracle. Appearance alone does not prove a structural claim.

Use the finding shape and terminal dispositions defined by the Manual Testing Protocol. A finding is not closed by an unnamed deferral: promotion must name its owner and re-entry trigger. Historical findings remain provenance unless a current walkthrough produces fresh contradictory evidence.
