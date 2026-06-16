<!-- Derivative execution queue for the FE-878 presentation seam (rides under brunch-ship).
     Not canonical: SPEC I136-K + the brunch-ship frontier note own durable truth.
     Delete this file when the queue is exhausted. -->

# FE-878 presentation seam — scope-card queue

The TUI work splits the original slice 1 (whole `serve`/`cook`/`plan` boundary) into
1a/1b because the cook surface revealed real size (the injected-clock design + many
byte-exact arms). Slice 2 (Ink) follows once the seam covers both surfaces.

## Slice 1a — seam foundation + plan surface — **done**

`presenter.ts` root + `presenter/{events,bus,select,plain,silent}.ts`; `selectPresenter`
decision table; `CookBus` synchronous fan-out with presenter-error isolation;
`PlainPresenter` byte-exact for the plan arms; `plan-runner` migrated to `emit(CookEvent)`
and CLI (`plan`/`serve`) wired through `createCookBus`. Cook left untouched (still
behavior-preserving). Verified: `npm run verify` green; `plan-runner.test.ts` golden
stderr unchanged via a capturing bus.

## Slice 1b — cook surface — **next**

### Target Behavior

`cook`/`serve` terminal output flows through `emit(CookEvent)` with `PlainPresenter`
reproducing today's stderr byte-for-byte, the elapsed/duration timer driven by a clock
injected into the presenter (not module-level `Date.now()`).

### Boundary Crossings

```
→ cook-cli.ts banner (454-462) / completion summary (507-531) / promotion (536-609) / petrinaut block (245-258) → bus.emit
→ pi-actions.ts log helper (49-51) + ~10 per-action log() sites (313-439) → bus.emit, elapsed moved into PlainPresenter
→ pi-actions.ts t0/elapsed (41-50) → presenter-owned injected clock (now()); cook-start seeds t0
→ runCook(opts) gains a bus param; cli.ts cook path builds createCookBus('cook')
→ exit: cook/serve stderr byte-identical; stdout still empty
```

### Risks and Assumptions

```
- RISK: elapsed-time prefix drift once the clock moves to the presenter
  → MITIGATION: inject now(); golden test feeds a fake clock for fixed elapsed values.
- RISK: logVerbose raw-agent output (verbose only) has its own multi-line shape
  → MITIGATION: model a verbose passthrough arm; assert verbose golden separately.
- RISK: the epic/slice summary tree + promotion conflicts have many branches
  → MITIGATION: one golden per branch (completed/halted, brownfield/greenfield, conflicts).
```

### Acceptance Criteria

```
✓ cook-cli.test.ts golden stderr byte-identical pre/post for completed + halted runs
✓ injected fake clock yields deterministic elapsed values in the per-action golden
✓ no direct console.error/log on the cook path outside presenter/ (grep gate)
✓ stdout remains empty across cook/serve
✓ npm run verify green
```

### Verification Approach

```
- Inner: unit — PlainPresenter cook arms (incl. fake clock); grep negative-space gate.
- Middle: cook-cli/serve CLI tests pass against golden stderr with injected clock.
- Outer: none (Ink + waiting-state legibility is slice 2).
```
