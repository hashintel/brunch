# Turn-Based State Machines

State machine design for Brunch's turn-based workflow. Written for Stately Studio
(studio.stately.ai); code is XState v5 and paste-ready.

This document is downstream of the current product/data-model spec in
`memory/SPEC.md`. In particular:

- kickoff and recovery are **projected control cards**, not authored durable turns
- the workspace stream is a **merged read model**, not identical to the turn tree
- open phases must bottom out in exactly one visible next action
- recovery is a **structural fallback**, not another turn that must be generated

The charts therefore model workflow legality and product-visible state, while a
small runtime layer owns hydration, cancellation, queue recovery, and stale-event
suppression.

For a companion clarification of **workflow projection (read path)** vs
**workflow transition/orchestration (write path)**, see
`docs/design/WORKFLOW_OWNERSHIP.md`.

## Why State Machines

The durable model in `SPEC.md` is now much clearer about product meaning: turns
own conversational lineage, phase outcomes are anchored workflow facts, and
kickoff/recovery/handoff controls project from workflow state. What still needs a
runtime design is the orchestration around an open phase:

- reply submission and interviewer processing
- successor generation and visible generation state
- observer capture backlog and late capture attachment
- phase-boundary durable writes
- hydration after reload or crash
- force close, cancellation, and late-event races

Those interactions still have enough concurrency and enough invalid-state risk to
be worth modeling explicitly. Statecharts keep the phase workflow legible. The
runtime host keeps the charts from turning into procedural control flow.

## Recommended Shape

The preferred shape is a **runtime supervisor over slim charts**, combined with a
**recovery-first reconciler** for hydration.

That means:

- durable truth remains authoritative
- hydration lands from a pure reconciliation function
- live interviewer/generation work is ownable and cancellable
- stale outputs are ignored through ephemeral leases plus durable idempotency
- restart favors safe reconciliation over pretending a lost in-flight operation survived

It does **not** mean introducing a second durable workflow model or making kickoff
and recovery durable turn categories again.

## Topology

```
durable snapshot
├── active-path turns
├── anchored phase outcomes
├── accepted review outputs
└── turn capture statuses
         │
         ▼
deriveSpecificationLanding(snapshot)      ← pure reconciliation
         │
         ▼
specification runtime                     ← owns leases, queues, cancellation,
├── spec machine                             stale-output rejection, retries
│   ├── loading
│   ├── phase_running
│   ├── recording_phase_outcome
│   ├── boundary_write_failed
│   └── complete
│
└── phase machine                        ← owns in-phase workflow legality
    ├── awaiting_kickoff                 ← projected kickoff control card
    ├── active
    │   ├── awaiting_reply
    │   ├── interviewer_processing
    │   ├── generating_successor
    │   └── awaiting_recovery           ← projected recovery control card
    ├── closed_via_interviewer
    └── closed_via_force
```

The phase machine is still a child of the spec machine. The important change is
that the spec machine is no longer asked to encode every durability and lifecycle
detail itself; those concerns sit in a runtime host around the charts.

## Public Runtime Boundary

```ts
interface SpecificationRuntime {
  start(snapshot: DurableSpecificationSnapshot): RuntimeView;
  send(event: RuntimeEvent): void;
  stop(): Promise<void>;
}

type RuntimeView = {
  landing: SpecificationLanding;
  actor: ActorRef<RuntimeEvent>;
};
```

The public boundary is intentionally small. Callers should not need to know about
queue reseeding, cancellation, leases, or retry policy.

## Landing Derivation

Hydration must land from durable truth, not from optimism about lost live work.

```ts
type SpecificationLanding =
  | { kind: 'projected_kickoff'; phaseKey: PhaseKey }
  | {
      kind: 'frontier_turn';
      phaseKey: PhaseKey;
      turnId: TurnId;
      turnKind: DurableFrontierTurnKind;
    }
  | {
      kind: 'visible_generation';
      phaseKey: PhaseKey;
      answeredTurnId: TurnId;
      successorKind: SuccessorKind | null;
    }
  | { kind: 'projected_recovery'; phaseKey: PhaseKey; reason: RecoveryReason }
  | { kind: 'handoff'; closedPhaseKey: PhaseKey; nextPhaseKey: PhaseKey | null }
  | { kind: 'complete' };

function deriveSpecificationLanding(
  snapshot: DurableSpecificationSnapshot,
): SpecificationLanding;
```

This function is the authoritative hydration rule. It should be pure and heavily
tested. It derives the one visible bottom artifact from:

- active-path turn lineage
- anchored phase outcomes
- accepted review carry-forward state
- durable capture status
- any durable evidence that justifies a visible generation state

### Recovery-First Reconciliation

On restart, prefer **safe reconciliation** over exact mid-flight revival.

- If durable state proves an unanswered frontier turn exists, land in `frontier_turn`.
- If durable state proves the phase is in entry state, land in `projected_kickoff`.
- If durable state proves the phase is closed, land in `handoff` or `complete`.
- If durable state cannot prove a valid frontier after an answered turn, land in
  `projected_recovery`.

Do not reopen into a fake `visible_generation` state just because the process died
mid-request. `visible_generation` is primarily a live-runtime state and should only
hydrate if future durable evidence makes that truthful.

## Division Of Responsibility

| Concern | Owner | Why |
| ------- | ----- | --- |
| Landing derivation on hydration/restart | `deriveSpecificationLanding` | Keeps restart semantics pure, explicit, and testable |
| In-phase workflow legality | phase machine | Small chart with product-visible open-phase states |
| Phase-to-phase progression and boundary retries | spec machine | The spec is the only place with the linear cross-phase view |
| Interviewer / generation lifecycle | runtime supervisor | Start, cancel, and stale-event suppression are live-operation concerns |
| Observer backlog reseeding and dispatch | runtime supervisor | Queue internals do not belong in the chart, but backlog truth must survive restarts |
| Stream projection / UI | read model assembly | The stream is derived from durable turns, anchored facts, projected controls, and activity cards |

The rule of thumb is: if a concern is about **what workflow state is legal and
visible**, it belongs in the charts; if it is about **how asynchronous work is
owned, retried, canceled, or reconciled**, it belongs in the runtime.

## Key Invariants Made Structural

1. **Exactly one bottom artifact in an open phase.** An open phase must bottom out
   in one and only one of: projected kickoff, frontier turn, visible generation,
   or projected recovery.
2. **No open phase without a visible next action.** There is no silent state in
   which a phase is open but the user sees neither an actionable frontier nor a
   truthful structural fallback.
3. **Phase cannot be closed without a durable outcome.** Closing the phase actor is
   not enough; the spec machine must record the phase outcome before the next phase
   can be considered open.
4. **Next phase opens into projected entry, not a required kickoff row.** The next
   phase's entry affordance is a projected control card. Any durable helper seam is
   transitional implementation detail, not product truth.
5. **Reply submission is atomic with interviewer kickoff.** There is no state where
   the reply was accepted but interviewer processing has not yet begun.
6. **Observer capture stays turn-owned.** Capture status always belongs to the
   answered turn that just left the frontier; late observer completion reattaches to
   that same turn card on replay.
7. **Late live outputs are ignorable.** Force-close, phase transition, or runtime
   stop must make stale interviewer/generation outputs harmless through leases and
   idempotent durable writes.

### Bug Class To Fold In

One concrete bug class to retire in this work: observer/capture state must remain
owned by the answered turn that triggered it, rather than leaking onto the
successor turn or depending on loosely coordinated UI flags. The failure pattern
shows up as answered cards skipping their transient `still thinking` state,
remaining stuck there forever, or inheriting stale `data-observer-result`
artifacts that suppress later observation for the wrong turn. The eventual state
model should make per-turn observer lifecycle explicit and reject cross-turn
observer artifact attachment as invalid.

## Projected Controls In The Charts

`awaiting_kickoff` and `awaiting_recovery` stay as real workflow states, but their
visible artifact is a **projected control card**, not a durable authored turn.

That means:

- the phase machine may still name `awaiting_kickoff`
- the phase machine may still name `awaiting_recovery`
- neither state implies a required `kickoff` or `recovery` row in the `turn` table
- leaving those states should result in a normal durable conversational turn or a
  phase closure, not in a special durable control-turn category

This keeps the chart expressive without regressing D94/D95/D110.

## Live Operation Ownership

The runtime supervisor should own live interviewer/generation work through a small,
ephemeral lease registry.

```ts
type OperationLease =
  | {
      kind: 'interviewer';
      leaseId: string;
      phaseKey: PhaseKey;
      frontierTurnId: TurnId;
    }
  | {
      kind: 'successor';
      leaseId: string;
      phaseKey: PhaseKey;
      answeredTurnId: TurnId;
    }
  | {
      kind: 'boundary_write';
      leaseId: string;
      phaseKey: PhaseKey;
      write: 'recording';
    };
```

Leases are runtime-local. They exist to:

- cancel in-flight work on force close or phase exit
- reject stale outputs from superseded work
- keep the charts free of cancellation bookkeeping

Leases are **not** the recovery source of truth across restarts. Durable truth plus
idempotent writes carry that burden.

## Observer Backlog: Durable, Not Just In Memory

The observer itself is still a stateless `generateObject` call. What needs durable
modeling is the backlog: which answered turns still need capture, which failed, and
which already succeeded.

The current implementation may still use `p-queue`, but the durable model should
carry per-turn capture status. At minimum:

- `pending`
- `succeeded`
- `failed`

If implementation detail benefits from `in_progress`, that can exist, but restart
truth must be recoverable from durable state.

Hydration should re-seed the queue from durable turns whose capture status is not
yet settled. `SPEC_HYDRATED` should therefore carry both:

- the derived `landing`
- the list of turn ids whose capture should be re-enqueued

## Write Ordering And Idempotency

The runtime must pin the ordering between durable writes and chart events.

Rules:

- A successor event is emitted only after the successor turn is durable.
- A phase-outcome success is emitted only after the anchored outcome write lands.
- Capture success/failure is emitted only after the answered turn's durable capture
  status has been updated.

These writes should also be idempotent around real domain seams:

- successor creation keyed by the answered frontier turn and continuation slot
- phase-outcome recording keyed by the authoritative closure anchor on the active path
- observer capture keyed by answered turn id

This is enough to make retries safe without introducing a general durable operation
ledger.

## Closure Rejection

Closure rejection remains the normal reply path.

- a closure proposal is still a durable proposal-shaped conversational turn
- rejecting it is still `REPLY_SUBMITTED`
- the interviewer must then produce a same-phase successor frontier
- the runtime/integration layer should prevent immediate blind re-proposal loops

The chart does not need a separate `CLOSURE_REJECTED` event unless implementation
clarity later proves it worthwhile. A comment plus tests is enough for now.

## Late Events And Force Close

XState serializes events per actor, but external work can still resolve late.

Important cases:

- `REPLY_SUBMITTED` racing with `FORCE_CLOSE_REQUESTED`
- `INTERVIEWER_DECIDED` arriving after a force close
- `SUCCESSOR_GENERATED` arriving after the phase already moved on

The intended rule is simple: the runtime should cancel in-flight work where
possible, and any output carrying an expired lease should be ignored. Durable
idempotency prevents already-completed writes from corrupting state when retries or
late completions happen.

## Routing Integration

Spec runtimes are specification-owned, not route-owned. Route components subscribe
to the actor/runtime view; they do not create or destroy the authoritative runtime.

Consequences:

- navigating away from the active phase does not kill interviewer work
- closed phases have no live phase actor; their routes read durable data and the
  projected handoff state
- at most one phase actor is alive per specification at a time
- the runtime is a third source of live state alongside durable router loaders and
  cached reads, and should be named as such in the codebase

## Naming Conventions

**States.** Use gerunds for active work (`loading`, `generating_successor`),
`awaiting_*` for durable conditions or waits (`awaiting_reply`, `awaiting_kickoff`,
`awaiting_recovery`), and adjectives / past participles for terminal states
(`closed_via_*`, `complete`, `boundary_write_failed`).

**Events.** Prefer `<SUBJECT>_<PAST_TENSE_VERB>` for facts (`REPLY_SUBMITTED`,
`INTERVIEWER_DECIDED`, `SUCCESSOR_GENERATED`, `CAPTURE_SUCCEEDED`). Deliberate
command-style exceptions are acceptable when the user or runtime is issuing a
request rather than reporting a completed fact (`BOUNDARY_RETRY_REQUESTED`,
`FORCE_CLOSE_REQUESTED`).

## Deferred / Later Work

- **`generating_successor` substates.** Split into thinking/tool-use/streaming only
  if the UI needs that level of visible distinction.
- **Workspace-level runtime registry.** Probably a lightweight registry of
  specification runtimes rather than a workspace-wide super-machine.
- **Revisit and secondary threads.** Still outside these charts; likely a separate
  small lifecycle machine later.
- **Durable runtime-operations table.** Only introduce if restart-resumable long
  jobs or multi-process coordination becomes necessary.

## Relation To The Projector Frontier

This design note is the machine/runtime articulation of the merged stream
projector frontier in `memory/PLAN.md`.

That frontier depends on four explicit contracts:

- a pure `deriveSpecificationLanding(snapshot)` reconciler that produces the one
  truthful bottom artifact for hydration and resume
- a narrowed `OpenPhaseLanding` contract that feeds the phase chart only open-phase
  states
- a slim spec chart that owns only cross-phase legality and `phaseOutcome` retry
- a runtime host that owns queue reseeding, leases, cancellation, stale-event
  rejection, and write-ordering discipline

This is how the projector cutover stops treating kickoff/recovery as durable turn
truth and starts treating them as projected controls over anchored workflow facts.

## Refactor Targets For Current Drafts

The current draft files in this directory still reflect the older kickoff/recovery
as-turn model. The next refactor should move them toward this document, not the
other way around.

### `spec-machine.ts`

- replace `SPEC_HYDRATED { activePhaseKey, kickoffTurnId }` with a landing union and
  pending capture ids
- remove `seedKickoffTurn` / `seeding_next_kickoff` as a required product seam
- keep `recording_phase_outcome` as the real phase-boundary durable write
- push queue ownership, lease management, and stale-event rejection into a runtime
  host around the chart
- narrow the child-phase input to open-phase landing states rather than handing it a
  kickoff turn id
- derive handoff/completion from `phaseOutcome` and landing reconciliation rather
  than treating them as second chart-owned boundary writes

### `phase-machine.ts`

- keep `awaiting_kickoff` and `awaiting_recovery` as states, but stop treating them
  as durable turn kinds
- remove `kickoff` / `recovery` from the durable turn-kind authority
- replace `RECOVERY_GENERATED` semantics with a projected recovery control that
  leads back to a normal successor-frontier path
- keep closure rejection on the normal reply path
- initialize from narrowed open-phase landing input, not from an assumed kickoff
  turn id

## Suggested Refactor Sequence

1. Define `SpecificationLanding`, `OpenPhaseLanding`, and
   `deriveSpecificationLanding(snapshot)` in design/shared types.
2. Introduce the specification runtime host around the charts.
3. Rewrite the chart drafts so hydration and restart flow through landing unions.
4. Cut server/client projector, fixtures, and tests over to projected controls and
   derived landings.

## Files

- `phase-machine.ts` — phase frontier machine draft
- `spec-machine.ts` — spec-level machine draft
- `README.md` — current design authority for the machine/runtime seam
