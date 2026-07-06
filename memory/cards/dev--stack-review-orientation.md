# Stack review: session-orientation lifecycle hardening

Frontier: n/a
Status:   active
Mode:     slices
Created:  2026-07-06

## Orientation

- Containing seam: deterministic-orientation's session-orientation extension and mode-switch command path, spanning FE-1134/FE-1137 review comments from PRs #289/#290.
- Current branch: `ln/fe-1152-refinements` top of the submitted stack; these are review-comment repairs intended to land at the tip, not new frontier items.
- Posture: proving for the lifecycle race shape (repo prototype + high stakes; this slice must fail loud rather than rely on timing luck).
- Main risk: the dialog/kick lifecycle crosses Pi event ordering, session transcript writes, and live kick delivery; repairs must preserve the existing deterministic-orientation semantics (`dismissed` is inert, explicit choices route kicks).

## Card 1 — claim juncture guard state for the whole async lifecycle

Status: done
Weight: full

### Target Behavior

The orientation juncture gate carries one explicit lifecycle contract — an ownership-aware in-flight claim plus the resolution window — honored by both entry paths. Event-driven junctures (J1–J4) check claim + window before running and cannot double-run while an attempt is in flight; the user-initiated J5 mode switch never checks the gate (an explicit mode switch always gets its menu) but claims it while its menu is in flight and stamps the window on resolution, so ambient junctures cannot stack on or immediately trail the mode-switch flow.

### Full-card cold-start reads

- `memory/SPEC.md` — D40-L, D109-L, session orientation / authority lifecycle decisions.
- `memory/PLAN.md` — deterministic-orientation arc; `session-entry-orientation`, `execute-entry-readiness`.
- `HANDOFF.md` — submitted stack state and pi 0.80.x event/UI context notes.
- `src/.pi/extensions/TOPOLOGY.md` — session-orientation extension ownership.
- `src/.pi/extensions/session-orientation/registrar.ts` and `src/.pi/extensions/commands/index.ts` — current guard implementations.

### Boundary Crossings

```pseudo
Pi event / mode command
→ session-orientation registrar or runtime-switch command
→ shared OrientationJunctureGate
→ runJunctureForContext / mode-switch orientation
→ live seed + kick side effect
```

### Risks and Assumptions

- DECISION (2026-07-06, user-approved): asymmetric J5 participation — "write, don't read". J5 claims the gate while its menu is in flight and stamps `lastResolvedAt` on resolution, but never checks the window or an existing claim. Rationale: the read side suppresses ambient event echoes and must not gag an explicit user gesture (by menu time the mode has already switched); the write side asserts "a dialog just ran here", which is equally true for J5. Today only the suppress flag is shared — the `OrientationJunctureGate` doc comment overstates the coordination and must be corrected as part of this card.
- RISK: fixing the debounce by only moving `lastResolvedAt` can suppress legitimate follow-up junctures after no-op failures.
  → MITIGATION: reserve synchronously before any await; release in `finally`; stamp only on `result.ran || result.kickFired` (`runOrientationJuncture` already returns `kickFired`; the `|| kickFired` arm is the degraded-boot re-kick fix).
- RISK: a bare-boolean in-flight claim lets a preempted registrar juncture's release clobber J5's live claim, since J5 deliberately proceeds even when the gate is claimed.
  → MITIGATION: ownership-aware claim (token or promise identity); each claimant releases only what it claimed.
- RISK: fixing J5 by always leaving `suppressNextAbortJuncture` set can swallow a later real user abort.
  → MITIGATION (resolved): skip the abort path entirely when `waitForIdle` is unavailable — don't abort what you can't observe settling. The in-code comment "agent_end has been dispatched by the time the agent is idle again" is only true when `waitForIdle` actually ran.
- ASSUMPTION: one shared gate keyed by `BrunchSessionOrientationDeps` remains the right coordination boundary.
  → IMPACT IF FALSE: mode switch and registrar need an explicit per-session state machine.
  → VALIDATE: registrar + command tests that exercise concurrent/near-concurrent event orderings.
- NOTE: J6 (`brunch:consult`) is also user-initiated but currently reads the window — an explicit consult within 750ms of a prior dialog silently no-ops. Do not change J6 in this card; name the write-not-read rule in the rewritten gate-contract comment so the J6 inconsistency is visible, and leave its alignment to a future sync.

### Acceptance Criteria

✓ `src/.pi/extensions/session-orientation/__tests__/registrar.test.ts` — two near-simultaneous juncture triggers cannot both run while `resolveKickContext` / `runJunctureForContext` is pending.
✓ `src/.pi/extensions/session-orientation/__tests__/registrar.test.ts` — degraded boot that fires a kick without a dialog still updates the guard so repeated startup events inside the window do not re-kick.
✓ `src/.pi/extensions/__tests__/commands-runtime-switch.test.ts` — the abort path is skipped when `waitForIdle` is unavailable; when it is available, suppression is not cleared before the corresponding aborted `agent_end` is observed.
✓ `src/.pi/extensions/__tests__/commands-runtime-switch.test.ts` — an event-driven juncture firing while the mode-switch menu is in flight, or inside the window after it resolves, does not open a second dialog (test drives both paths against one shared `deps` object).
✓ An explicit mode switch is never skipped by the gate, even immediately after another juncture resolved.
✓ `registrar.ts` gate + ceiling comments describe the claim-based contract (ownership claim + resolution window; user-initiated triggers write but don't read) and the remaining upgrade path — the current 750ms `ceiling:` is reached by this sixth, policy-differentiated trigger.

### Verification Approach

- Inner: focused Vitest tests above for guard reservation/release behavior.
- Harness note: the existing registrar fakes resolve synchronously; the race tests need a deferrable `select` / `resolveKickContext` to interleave two attempts mid-flight.
- Gate: `npm run fix` after edit; `npm run verify` before commit.

### Cross-cutting obligations

- Keep `dismissed` inert: no kick and no orientation seed directive.
- Preserve D109-L: product-owned deterministic dialog, not a structured exchange.
- Preserve hasUI-first UI checks from the pi 0.80.x audit.

### Expected touched paths (tentative)

```pseudo
src/.pi/extensions/
├── session-orientation/
│   ├── registrar.ts                         ~
│   └── __tests__/registrar.test.ts          ~
└── __tests__/commands-runtime-switch.test.ts ~
src/.pi/extensions/commands/index.ts          ~
```

## Card 2 — prevent directed kicks after failed orientation entry writes

Status: next
Weight: full

### Target Behavior

A directed session-orientation kick cannot depend on a transcript entry that failed to persist.

### Full-card cold-start reads

- `memory/SPEC.md` — D40-L, D109-L; transcript-backed runtime state requirement.
- `memory/PLAN.md` — `session-entry-orientation` / `execute-entry-readiness` status notes.
- `src/session/TOPOLOGY.md` — session-orientation carrier and seed consumption rules.
- `src/.pi/extensions/session-orientation/index.ts` and `juncture.ts` — dialog recording and kick flow.

### Boundary Crossings

```pseudo
ctx.ui.select resolution
→ appendSessionOrientationEntry
→ freshSessionOrientationChoice during originateAssistantTurn
→ delivered context seed
→ completeAssistantKick
```

### Risks and Assumptions

- RISK: preserving the existing "append is best-effort" comment while blocking a directed kick can make boot behavior surprising.
  → MITIGATION: make the distinction explicit: inert/no-UI boot may proceed as designed, but non-inert directed choices require either durable entry or an explicitly threaded directive.
- ASSUMPTION: the transcript entry remains the canonical source of orientation seed truth.
  → IMPACT IF FALSE: the fix must instead thread the selected choice into origination as an intentional non-transcript input and update topology.
  → VALIDATE: failing-append test proves no unseeded directed kick is fired.
- NOTE: prefer the durable-entry repair over threading the choice — `src/rpc/methods/session.ts:471` is a parallel `originateAssistantTurn` site that reads persisted entries, so a threaded-choice contract would have to reach that transport too.
- NOTE: the J5 mode-switch orientation (`commands/index.ts` → `runJunctureForContext`) shares the identical append-then-kick pattern; fixing `juncture.ts`/`index.ts` covers it transitively, but test coverage should include the mode-switch failed-append case.

### Acceptance Criteria

✓ `src/.pi/extensions/session-orientation/__tests__/index.test.ts` or `juncture.test.ts` — append failure for a non-inert choice reports the error and does not fire a directed live kick without a seed directive.
✓ `src/.pi/extensions/session-orientation/__tests__/juncture.test.ts` — successful append still routes explicit non-`dismissed` / non-`noKickChoice` choices through `forceSeed`.
✓ Comments/topology in the touched files no longer claim append failure is harmless for directed kicks unless the implementation truly threads the choice independently.

### Verification Approach

- Inner: focused session-orientation unit tests.
- Gate: `npm run fix`; `npm run verify` before commit.

### Cross-cutting obligations

- Do not add compatibility aliases or alternate orientation carriers.
- Keep the transcript-backed seed contract visible to a future `ln-review` pass.

### Expected touched paths (tentative)

```pseudo
src/.pi/extensions/session-orientation/
├── index.ts                         ~
├── juncture.ts                      ~
├── __tests__/index.test.ts          ~
└── __tests__/juncture.test.ts       ~
src/.pi/extensions/__tests__/commands-runtime-switch.test.ts ?  # mode-switch failed-append coverage
src/session/TOPOLOGY.md ?
```
