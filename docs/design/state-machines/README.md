# Turn-based state machines

State machine design for Brunch's turn-based workflow. Written for Stately Studio
(studio.stately.ai); code is XState v5 and paste-ready.

## Why state machines

The turn model in SPEC.md is well-defined at the data layer — turn kinds, frontier
turns, closure turns, observer capture, phase outcomes. What it does not define is
the **runtime orchestration** of those moving parts as a user works through a
phase: reply submission, interviewer processing, successor generation, observer
capture, phase-boundary durable writes, and recovery from failure.

Those interactions have enough concurrency and enough invalid-state potential
(two frontier turns; no frontier in an open phase; closed phase with missing
outcome; observer capture attached to the wrong turn) that they are worth
modeling explicitly. Statecharts make the invariants structural rather than
depending on scattered checks in imperative code.

## Two machines

```
spec machine                    (one per specification; long-lived)
├── loading
├── phase_running               ← invokes phase machine as child
├── recording_phase_outcome     ← durable write: phase close
├── seeding_next_kickoff        ← durable write: next phase's entry turn
├── boundary_write_failed       ← shared retry state
└── complete                    (final)

phase machine                   (one per open phase; lives only while open)
├── awaiting_kickoff
├── active
│   ├── awaiting_reply
│   ├── interviewer_processing
│   ├── generating_successor
│   └── awaiting_recovery
├── closed_via_interviewer      (final; output: { basis: 'interviewer' })
└── closed_via_force            (final; output: { basis: 'force' })
```

## Division of responsibility

| Concern | Owner | Why |
| ------- | ----- | --- |
| In-phase frontier cycle (reply → process → generate → reply) | phase machine | Pure in-memory orchestration; no durable writes |
| Phase-boundary durable writes (record outcome, seed next kickoff) | spec machine | Symmetric writes at the boundary between phase actors |
| Phase-to-phase transitions (which phase key is current) | spec machine | Only the spec has the linear view across phases |
| Observer capture dispatch | spec machine (via p-queue) | Outlives any single phase; D96 allows trailing capture |
| Routing / UI | neither | Views subscribe to these machines; machines never navigate |

The phase machine knows nothing about phase keys, durable storage, or what
comes next. It runs a frontier cycle and reports its closure basis via final
state output. The spec machine treats each phase as a black-box child actor
and owns everything that happens at the seams between them.

## Key invariants made structural

1. **Exactly one frontier turn in an open phase.** The `active` parent state
   has one substate at a time; there is no state combination that yields two
   concurrent `awaiting_reply`s.
2. **No open phase without a frontier.** The only exits from
   `generating_successor` produce either a new frontier (`SUCCESSOR_GENERATED`
   landing in `awaiting_reply`) or `awaiting_recovery`. The only exit from
   `awaiting_recovery` is a new recovery frontier. There is no silent path
   back to `active` without a frontier turn id.
3. **Phase cannot be closed without a durable outcome.** The phase machine's
   `closed_via_*` final states emit the closure basis as output; the spec
   machine cannot reach `seeding_next_kickoff` without transiting through
   `recording_phase_outcome` successfully.
4. **Next phase cannot open without a kickoff turn.** The spec machine can
   only enter `phase_running` from a successful `seeding_next_kickoff`, which
   guarantees `currentKickoffTurnId` is populated.
5. **Reply submission is atomic with interviewer kick-off.** The
   `REPLY_SUBMITTED` transition goes directly from `awaiting_reply` to
   `interviewer_processing` with observer emission as an inline action;
   there is no intermediate state where a reply has been received but
   processing has not started.
6. **Observer capture never attaches to the frontier turn.** `TURN_ANSWERED`
   is emitted only at the moment a frontier turn transitions *out* of being
   the frontier, so the captured id always refers to an already-answered
   turn.

## Observer capture: not a machine

The observer is a stateless `generateObject` call. What has state is the
**backlog** — answered turn ids awaiting capture, plus any in-flight calls.
This is modeled as a `p-queue` instance (sindresorhus/p-queue) owned by the
spec machine as a service, not as a statechart.

Rationale: the interesting state of a promise queue is pending/inflight/done
per job, with a concurrency cap. That is exactly what `p-queue` is; wrapping
it in a statechart would duplicate its state without a better diagram. The
spec machine exposes observer events at its root (`TURN_ANSWERED`,
`CAPTURE_SUCCEEDED`, `CAPTURE_FAILED`) so they work in any state, including
`complete` — honoring D96's "observer capture may trail" semantic.

## Routing integration

Phase machines are spec-owned, not route-owned. Route components subscribe
(via XState's React bindings) to the relevant actor; they do not create or
destroy it. Consequences:

- Navigating away from the active phase does not pause or kill the interviewer.
- Closed phases have no running actor; their routes read durable data.
- At most one phase actor is alive per spec at any time (phases are sequential).
- The "Proceed to [next phase]" CTA shown on a closed-phase route is enabled
  once the spec machine has reached `phase_running` for the next phase.

This is a *third* source of live state alongside router loaders (durable
reads) and React Query (cached reads); it should be named as such in the
codebase rather than collapsing into either.

## Naming conventions

**States.** Gerunds for "system is actively doing X" (`loading`,
`generating_successor`), `awaiting_*` for "condition holds while we wait"
(`awaiting_reply`, `awaiting_kickoff`, `awaiting_recovery`), past participles
and adjectives for terminal states (`closed_via_*`, `complete`,
`boundary_write_failed`).

**Events.** `<SUBJECT>_<PAST_TENSE_VERB>` as the dominant form — events are
facts about what just happened, from the machine's point of view:
`KICKOFF_ACCEPTED`, `REPLY_SUBMITTED`, `INTERVIEWER_DECIDED`,
`SUCCESSOR_GENERATED`, `GENERATION_FAILED`, `TURN_ANSWERED`,
`CAPTURE_SUCCEEDED`, `SPEC_HYDRATED`. The one deliberate exception is
`BOUNDARY_RETRY_REQUESTED` — it is a user-initiated command, not a fact,
and the name makes that explicit.

## Open extension points

- **`generating_successor` substates.** Currently collapsed. Can be
  expanded to `thinking` / `tool_use` / `streaming` if the UI wants to
  reflect those phases of generation in the transcript.
- **Force close scope.** Currently allowed from `awaiting_kickoff` and any
  substate of `active`. Could be narrowed or widened based on product
  decisions about when force-close is a valid affordance.
- **Observer retry policy.** The spec machine currently treats
  `CAPTURE_FAILED` as a notify-only event. Retry behavior lives inside
  `p-queue` configuration; promoting it to the machine would let the chart
  show retry state if that becomes a product-visible concern.
- **Recovery turn origination.** `awaiting_recovery` relies on an external
  actor creating the recovery turn and emitting `RECOVERY_GENERATED`. The
  machine is silent on who that actor is; likely an interviewer follow-up
  run or a scripted fallback.

## Files

- `phase-machine.ts` — phase frontier machine
- `spec-machine.ts` — spec-level machine (invokes phase machine, owns boundary writes)
- `README.md` — this document
