# FE-1187 exchange continuation chrome corrections

Frontier: walkthrough-remediation-2
Status:   active
Mode:     slices
Created:  2026-07-14

Posture: proving (inherited from walkthrough-remediation-2)

Orientation:

- Containing seam: D116-L declared `present_*` → `ask` continuations in the Pi TUI adapter.
- Active frontier: FE-1187 walkthrough closure; findings R5 and R7 are reproduced and mechanically located in the actual 2026-07-14 session JSONLs.
- Volatile state: the consolidated outer checkpoint is paused after Session B beats 1–3.
- Main risk: changing live chrome must not weaken D106-L self-contained transcript results or D119-L continuation recovery.

Sequence validity: both cards stay inside the settled continuation adapter. Card 2 does not depend on Card 1 findings; the sequence exists because both cards modify `ask/continuation.ts` and must remain serial in the shared worktree.

## Card 1 · Make cancellation guidance transient — `done`

Implemented in commit `daba4cda` and closed by the user-present live TUI walkthrough on 2026-07-14.

### Objective

Cancelled asks notify the user once without occupying persistent footer status.

### Light-card cold-start reads

- `memory/SPEC.md` — D106-L, D116-L, D119-L
- `memory/PLAN.md` — frontier: `walkthrough-remediation-2`
- `TESTING_FINDINGS.md` — R5
- `src/.pi/extensions/exchanges/TOPOLOGY.md` — cancellation and recovery ownership

### Acceptance Criteria

- ✓ `src/.pi/extensions/__tests__/exchanges-present-request.test.ts` — standalone cancellation calls `ctx.ui.notify` with `/brunch:consult` and `/brunch:mode`, never `/brunch:continue`, and publishes no `brunch.ask` status.
- ✓ `src/.pi/extensions/__tests__/exchanges-present-request.test.ts` — declared-continuation cancellation calls `ctx.ui.notify` with `/brunch:continue`, `/brunch:consult`, and `/brunch:mode`, and publishes no `brunch.continue` status.
- ✓ `src/.pi/extensions/__tests__/exchanges-present-request.test.ts` — a cancelled declared continuation remains recoverable and a later answer still closes the same durable exchange exactly once.
- ✓ `TESTING_FINDINGS.md` R5 outer re-observation — cancellation guidance appears above the editor, does not remain through the next user turn, and repeated cancellations do not accumulate footer messages.

### Verification Approach

- Inner: focused Vitest exchange-extension suite proves notification calls, absence of status writes, and preserved recovery.
- Middle: existing structured-exchange recovery/projection suites prove cancellation and later answer remain transcript-correct.
- Outer: R5 live TUI beat on `workspace-alpha-grounding`; this card owns the disposition update.

### Cross-cutting obligations

- D119-L: only a cancelled declared continuation advertises `/brunch:continue`.
- D116-L: continuation state remains transcript-derived; no new runtime pending-state carrier.
- Canonical cancellation terminal value from the accepted FE-1187 correction remains unchanged.

### Assumption dependency

None — the actual status keys and missing lifecycle are directly observed in source and JSONL.

### Completion report

| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| Standalone cancellation uses transient guidance without `/brunch:continue` or footer status | met | Inner: `exchanges-present-request.test.ts` “records cancellation with terminate, broker fallback, unavailable, and empty-answer discipline”; live TUI 2026-07-14 showed an above-editor notification naming `/brunch:consult` and `/brunch:mode`, with no status surviving an ordinary new turn. |
| Declared-continuation cancellation uses transient guidance with all three recovery commands and no footer status | met | Inner: `exchanges-present-request.test.ts` “notifies transient continuation guidance on cancel without publishing footer status”; live TUI 2026-07-14 showed `/brunch:continue`, `/brunch:consult`, and `/brunch:mode` above the editor. |
| Cancelled declared continuation remains recoverable and closes once | met | Inner: `exchanges-present-request.test.ts` “keeps a declared continuation resumable after cancelled or unavailable terminals”; middle: structured-exchange recovery/projection suites from implementation commit `daba4cda`; live TUI 2026-07-14 re-presented the picker via `/brunch:continue` and completed the answer. |
| Repeated cancellations do not persist or accumulate footer chrome | met | Live TUI 2026-07-14 showed no lingering or accumulated footer message after recovery or repeated cancellation. |

Skipped-test-count delta vs parent of implementation commit `daba4cda`: 0.

### Expected touched paths (tentative)

```text
src/.pi/extensions/exchanges/
├── ask.ts                                      ~
├── ask/continuation.ts                         ~
├── shared/ui-context.ts                        ~
└── TOPOLOGY.md                                 ~
src/.pi/extensions/__tests__/
├── commands-runtime-switch.test.ts             ~
└── exchanges-present-request.test.ts           ~
src/probes/__tests__/
└── structured-exchange-ordering-proof.test.ts  ~
TESTING_FINDINGS.md                              ~
```

## Card 2 · Elide repeated offer pretext from the live ask — `in progress`

### Target Behavior

A continuing offer ask presents only its answer controls in the live TUI.

### Full-card cold-start reads

- `memory/SPEC.md` — D104-L, D106-L, D116-L
- `memory/PLAN.md` — frontier: `walkthrough-remediation-2`
- `TESTING_FINDINGS.md` — R7
- `src/exchanges/TOPOLOGY.md` — offer/continuation ownership
- `src/.pi/extensions/exchanges/TOPOLOGY.md` — TUI adapter and render-source contract

### Boundary Crossings

```text
present_* declared continuation
→ transcript-derived pending offer
→ ask continuation collector
→ Brunch decision/review picker
→ self-contained durable terminal result
```

### Risks and Assumptions

- RISK: deleting the continuation body from durable details would make the terminal unintelligible to the model or on resume → MITIGATION: elide only the live picker pretext; retain D106-L model-facing content and terminal details.
- RISK: candidate and review continuations drift into different chrome rules → MITIGATION: pin both families in the shared continuation collector suite.
- ASSUMPTION: the observed duplication is caused by passing the declared offer body into the live picker.
  → IMPACT IF FALSE: implementation would need a projection/schema change and Card 2 must stop.
  → VALIDATE: the first red tests capture picker inputs for candidate, digest, and review-set continuations before production edits.

### Posture check

Stabilizes the D104-L audience split: the offer remains the visible pretext, the live continuation becomes controls-only, and the durable result remains self-contained. The first red test falsifies the load-bearing implementation assumption before any schema change.

### Acceptance Criteria

- ✓ `src/.pi/extensions/__tests__/exchanges-present-request.test.ts` — a continuing `present_candidates` ask passes no repeated heading/body/rationale into the live picker while preserving all declared choices.
- ✓ `src/.pi/extensions/__tests__/exchanges-present-request.test.ts` — continuing digest and review-set asks pass only review controls into the live picker while preserving approve/change/reject behavior until D110-L is separately revised.
- ✓ existing exchange formatter/projection suites — answered and cancelled terminal `content`/`details` remain self-contained and unchanged for model/RPC readers.
- ◐ `TESTING_FINDINGS.md` R7 outer re-observation — human-gated: presentation prose appears once and the following ask shows only its controls.

### Invariants preserved

- D106-L self-contained terminal details — guarded by: existing request-response projection/content tests plus the focused continuation suite.
- D116-L declaration-owned continuation payload and invoke-by-reference contract — guarded by: `exchanges-present-request.test.ts` declared-continuation tests.
- RPC/headless ask question payload remains complete — guarded by: existing live-ask/public-RPC contract suites.

### Verification Approach

- Inner: focused continuation collector tests inspect live picker inputs and durable result projections.
- Middle: registered exchange and RPC/headless suites prove declaration/recovery compatibility.
- Outer: R7 live TUI beat on one candidates offer and one digest offer; this card owns the disposition update.

### Cross-cutting obligations

- Do not revise D110-L digest review vocabulary in this card; R8 owns that unresolved product decision.
- Do not add a second renderer or continuation payload carrier.
- Preserve the single canonical cancellation terminal from Card 1.

### Implementation checkpoint

The first red test captured all three live picker render inputs before production edits. It failed on the candidate continuation because the declared body rendered a second time inside the picker, confirming the scoped assumption. The adapter now omits that body only from interactive continuation picker construction; declaration details, durable terminal projections, and RPC/headless question payloads remain unchanged. `npm run verify` passes (250 files passed, 1 skipped; 2024 tests passed, 2 skipped). R7 live candidates + digest re-observation remains human-gated, so this card stays open.

Skipped-test-count delta vs parent: 0.

### Expected touched paths (tentative)

```text
src/.pi/extensions/exchanges/
├── ask/continuation.ts                         ~
└── TOPOLOGY.md                                 ~
src/.pi/extensions/__tests__/
└── exchanges-present-request.test.ts           ~
TESTING_FINDINGS.md                              ~
```
