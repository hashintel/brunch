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

## Known gaps

These are the things most likely to be missed or go wrong given the current
model. They are ordered roughly by how load-bearing they are for the
invariants already claimed.

### Hydration mid-flight is not modeled

The machines cover the happy startup paths: `SPEC_HYDRATED` lands in
`phase_running`, in `seeding_next_kickoff`, or in `complete` depending on
durable state. They do not cover crashing or reloading *inside*
`generating_successor`, `interviewer_processing`, `recording_phase_outcome`,
or `seeding_next_kickoff`.

What can go wrong:
- Reload during `generating_successor`: the in-flight generation is lost,
  and if no durable successor turn was written, the frontier pointer still
  points at the previously-answered turn. Without an explicit rule, the
  system could silently reopen to `awaiting_reply` on an already-answered
  frontier, or worse, appear to have no frontier at all.
- Reload during `recording_phase_outcome`: the durable write may or may
  not have landed. The hydration path needs to distinguish "outcome
  recorded but next kickoff not seeded" from "outcome not recorded."
- Reload during `seeding_next_kickoff`: similar — the kickoff turn may or
  may not exist in durable storage.

What is missing: a hydration rule that, given the persisted turn graph and
phase-outcome records, computes which statechart node to land in. Likely
rules: frontier turn id matches an unanswered durable turn → `awaiting_reply`;
frontier turn id matches an answered turn with no successor → `awaiting_recovery`;
most recent phase-outcome record without a seeded next kickoff →
`seeding_next_kickoff`; and so on. This rule should be written down and
encoded into the `SPEC_HYDRATED` guards.

### Interviewer agent lifecycle is outside the chart

SPEC.md D30 and A28 treat the interviewer as a long-lived `ToolLoopAgent`
that spans turns. The phase machine treats `INTERVIEWER_DECIDED` as an
arriving fact but does not name who starts, resumes, pauses, or tears down
the interviewer.

What can go wrong:
- Two interviewer runs racing if the machine re-enters
  `interviewer_processing` while a prior run is still active.
- Interviewer holding streaming connections past a force-close, leaking
  resources or emitting `INTERVIEWER_DECIDED` into a machine that has
  already transitioned to `closed_via_force`.
- Ambiguity about which phase "owns" the interviewer session when the
  underlying agent is spec-level or longer-lived.

What is missing: a model for invoking the interviewer as a child actor of
the phase machine (or spec machine), with explicit start on entering
`interviewer_processing`, cancel on exit, and an output contract that maps
to `INTERVIEWER_DECIDED`.

### Observer queue persistence across restarts

`p-queue` is in-memory. If the process crashes with pending observer
captures, those are lost. There is no state in either machine that tracks
"turns whose capture has not yet succeeded."

What can go wrong:
- A turn answered just before a crash permanently loses its observer
  extraction, silently reducing knowledge-graph coverage.
- Hydration cannot reconstruct which captures to re-enqueue without a
  durable capture-status field on each turn record.

What is missing: a persistence contract for per-turn capture status plus
a hydration step that re-seeds the queue from turns whose status is
`pending` or `failed`. The `SPEC_HYDRATED` event could carry a
`pendingCaptureTurnIds: TurnId[]` array.

### Turn-durability ordering is implicit

The phase machine assumes `SUCCESSOR_GENERATED` fires *after* the new turn
is durable, because the event carries a real turn id that the machine
then writes into `frontierTurnId`. If this ordering ever flipped —
emitting the event before persisting, or persisting a turn without firing
the event — the "no open phase without a frontier" invariant would
silently break.

What can go wrong:
- A successor turn is persisted but the event is lost: frontier advances
  in durable storage but the machine still points at the old frontier.
- The event fires before persistence completes and the persistence fails:
  machine believes the new frontier exists; reload disagrees.

What is missing: a comment in the phase machine (and in the interviewer
integration code) pinning this ordering, and ideally a small integration
test that asserts "turn durable before SUCCESSOR_GENERATED event."

### Closure rejection has no explicit path

When a user rejects a closure turn proposal (D94), the machine handles it
as a normal `REPLY_SUBMITTED`, with the interviewer then producing a
same-phase successor. This works implicitly but is unnamed in the chart
and in the events.

What can go wrong:
- A reader of the chart assumes there is no way to reject a closure turn
  because no state or event calls it out.
- The interviewer's decision on a closure rejection accidentally routes
  to `closure_proposal` again, causing an immediate re-proposal loop.

What is missing: either an explicit `CLOSURE_REJECTED` event distinct
from `REPLY_SUBMITTED`, or a comment in `interviewer_processing` noting
that closure-turn replies flow through the normal path and that the
interviewer is responsible for not immediately re-proposing closure.

### Event arrival races

XState serializes events per actor, but external systems emitting into
the machine can race. Notable cases:
- `REPLY_SUBMITTED` and `FORCE_CLOSE_REQUESTED` arriving near-simultaneously.
- `INTERVIEWER_DECIDED` arriving after the machine already transitioned
  (e.g., force-close landed first).
- `SUCCESSOR_GENERATED` arriving after `FORCE_CLOSE_REQUESTED`.

What can go wrong:
- Late `INTERVIEWER_DECIDED` or `SUCCESSOR_GENERATED` events landing in a
  final state are silently dropped by XState — which is correct, but
  side effects tied to those events (e.g., writing the generated turn to
  durable storage) may have already happened. The machine has no undo.

What is missing: an explicit rule for handling late events after force
close, ideally at the integration-code layer (cancel the interviewer,
discard in-flight generation) rather than inside the chart. Worth naming
in this document so it is not forgotten.

### Recovery turn origination is unspecified

`awaiting_recovery` relies on some external actor creating a recovery
turn and firing `RECOVERY_GENERATED`. The chart says nothing about who
that actor is, what triggers it, or what happens if it fails.

What can go wrong:
- Phase is permanently stuck in `awaiting_recovery` with no mechanism to
  produce a recovery turn.
- Recovery-turn generation itself fails and there is no
  `RECOVERY_FAILED` event — the only failure paths in the current chart
  are `GENERATION_FAILED` from the forward direction.

What is missing: either a recovery-generator child actor invoked on
entry to `awaiting_recovery` (with its own failure handling), or a
product decision that recovery is always user-triggered (in which case
the chart should reflect that the user has an explicit affordance).

### Multi-spec / workspace level is uncovered

Per SPEC.md Requirement 15, the dashboard shows multiple specifications
per workspace. The current design stops at the single-spec level; there
is no workspace-level machine coordinating which spec actor is alive,
how specs are persisted as actor state, or how navigation across specs
interacts with any running spec actor.

Likely low-risk because each spec machine is independent, but worth
naming so it is not discovered late.

### Revisit and secondary threads are out of scope

D80's knowledge-graph revisit and modal secondary threads are explicit
future work in SPEC.md. They are outside the current machines. When they
land, they will likely need their own small machine (secondary thread
lifecycle) and a seam by which they can invalidate knowledge items on
the main path — which may in turn require the phase machine to react to
invalidation events. Flagged here as a known future integration point.

## Files

- `phase-machine.ts` — phase frontier machine
- `spec-machine.ts` — spec-level machine (invokes phase machine, owns boundary writes)
- `README.md` — this document
