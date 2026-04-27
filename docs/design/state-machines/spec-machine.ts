// Spec-level state machine for Brunch.
// Paste-ready for Stately Studio (studio.stately.ai) — XState v5.
//
// One instance per specification chart. This is intentionally slimmer than the
// older draft: it owns cross-phase legality, invokes at most one phase actor,
// and retries the authoritative phase-outcome write. A runtime host around this
// chart owns hydration reconciliation, observer backlog reseeding, leases,
// cancellation, stale-event rejection, and write-ordering discipline.

import { assign, fromPromise, setup } from 'xstate';
import { phaseMachine } from './phase-machine';

type TurnId = string;

type PhaseKey = 'grounding' | 'design' | 'requirements' | 'criteria';

type DurableFrontierTurnKind = 'question' | 'grounding' | 'review' | 'closure';

type SuccessorKind = 'question' | 'grounding' | 'review' | 'closure_proposal' | 'accept_close';

type RecoveryReason = 'generation_failed' | 'frontier_missing' | 'frontier_invalid';

type ClosureBasis = 'interviewer' | 'force';

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

type OpenPhaseLanding = Extract<
  SpecificationLanding,
  { kind: 'projected_kickoff' | 'frontier_turn' | 'visible_generation' | 'projected_recovery' }
>;

type Context = {
  currentPhaseKey: PhaseKey | null;
  landing: SpecificationLanding | null;
  pendingClosureBasis: ClosureBasis | null;
  boundaryWriteFailure: string | null;
};

type Event =
  | {
      type: 'SPEC_HYDRATED';
      landing: SpecificationLanding;
      pendingCaptureTurnIds: TurnId[];
    }
  | { type: 'TURN_ANSWERED'; turnId: TurnId }
  | { type: 'CAPTURE_SUCCEEDED'; turnId: TurnId }
  | { type: 'CAPTURE_FAILED'; turnId: TurnId; error: string }
  | { type: 'BOUNDARY_RETRY_REQUESTED' };

export const specMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Event,
    input: {} as { specId: string },
  },
  actors: {
    phaseMachine,
    // Writes the authoritative phase outcome (summary + closure basis) for the
    // current phase. Failure lands the chart in `boundary_write_failed`.
    recordPhaseOutcome: fromPromise<void, { phaseKey: PhaseKey; basis: ClosureBasis }>(
      async ({ input: _input }) => {
        // await api.recordPhaseOutcome({ phaseKey, basis })
        throw new Error('not implemented');
      },
    ),
  },
  actions: {
    // The runtime host owns the durable-backed capture backlog. These actions are
    // still useful chart-level facts for documentation, but the queue itself lives
    // outside this chart.
    enqueueObserverCapture: (_, _params: { turnId: TurnId }) => {
      // runtime.enqueueCapture(params.turnId)
    },
    markCaptureSucceeded: (_, _params: { turnId: TurnId }) => {
      // runtime.markCaptureSucceeded(params.turnId)
    },
    markCaptureFailed: (_, _params: { turnId: TurnId; error: string }) => {
      // runtime.markCaptureFailed(params.turnId, params.error)
    },
    reseedCaptureBacklog: (_, _params: { turnIds: TurnId[] }) => {
      // runtime.reseedCaptureBacklog(params.turnIds)
    },
    requestReconciliation: () => {
      // runtime.reconcileAndSendHydrated()
    },
  },
  guards: {
    isOpenPhaseLanding: ({ event }) =>
      event.type === 'SPEC_HYDRATED' &&
      (event.landing.kind === 'projected_kickoff' ||
        event.landing.kind === 'frontier_turn' ||
        event.landing.kind === 'visible_generation' ||
        event.landing.kind === 'projected_recovery'),
    isCompleteLanding: ({ event }) => event.type === 'SPEC_HYDRATED' && event.landing.kind === 'complete',
    isHandoffLanding: ({ event }) => event.type === 'SPEC_HYDRATED' && event.landing.kind === 'handoff',
  },
}).createMachine({
  id: 'spec',
  context: {
    currentPhaseKey: null,
    landing: null,
    pendingClosureBasis: null,
    boundaryWriteFailure: null,
  },
  initial: 'loading',
  // Turn-answered and capture-settled events can arrive in any state. The runtime
  // host may continue draining capture backlog while the spec chart is waiting on
  // reconciliation, a retry, or has already moved on from the just-answered phase.
  on: {
    TURN_ANSWERED: {
      actions: {
        type: 'enqueueObserverCapture',
        params: ({ event }) => ({ turnId: event.turnId }),
      },
    },
    CAPTURE_SUCCEEDED: {
      actions: {
        type: 'markCaptureSucceeded',
        params: ({ event }) => ({ turnId: event.turnId }),
      },
    },
    CAPTURE_FAILED: {
      actions: {
        type: 'markCaptureFailed',
        params: ({ event }) => ({ turnId: event.turnId, error: event.error }),
      },
    },
  },
  states: {
    // Waiting for durable truth to be reconciled into a landing union. The runtime
    // host computes the landing before dispatching `SPEC_HYDRATED`.
    loading: {
      on: {
        SPEC_HYDRATED: [
          {
            guard: 'isCompleteLanding',
            target: 'complete',
            actions: [
              assign(({ event }) => ({
                landing: event.type === 'SPEC_HYDRATED' ? event.landing : null,
                currentPhaseKey: null,
                pendingClosureBasis: null,
                boundaryWriteFailure: null,
              })),
              {
                type: 'reseedCaptureBacklog',
                params: ({ event }) => ({ turnIds: event.pendingCaptureTurnIds }),
              },
            ],
          },
          {
            guard: 'isHandoffLanding',
            actions: [
              assign(({ event }) => ({
                landing: event.type === 'SPEC_HYDRATED' ? event.landing : null,
                currentPhaseKey: null,
                pendingClosureBasis: null,
                boundaryWriteFailure: null,
              })),
              {
                type: 'reseedCaptureBacklog',
                params: ({ event }) => ({ turnIds: event.pendingCaptureTurnIds }),
              },
            ],
          },
          {
            guard: 'isOpenPhaseLanding',
            target: 'phase_running',
            actions: [
              assign(({ event }) => ({
                landing: event.type === 'SPEC_HYDRATED' ? event.landing : null,
                currentPhaseKey:
                  event.type === 'SPEC_HYDRATED' &&
                  (event.landing.kind === 'projected_kickoff' ||
                    event.landing.kind === 'frontier_turn' ||
                    event.landing.kind === 'visible_generation' ||
                    event.landing.kind === 'projected_recovery')
                    ? event.landing.phaseKey
                    : null,
                pendingClosureBasis: null,
                boundaryWriteFailure: null,
              })),
              {
                type: 'reseedCaptureBacklog',
                params: ({ event }) => ({ turnIds: event.pendingCaptureTurnIds }),
              },
            ],
          },
        ],
      },
    },

    // Exactly one phase actor is invoked here. The child owns open-phase legality;
    // this chart reacts only to closure and records the durable phase outcome.
    phase_running: {
      invoke: {
        id: 'phase',
        src: 'phaseMachine',
        input: ({ context }) => ({ landing: context.landing as OpenPhaseLanding }),
        onDone: {
          target: 'recording_phase_outcome',
          actions: assign(({ event }) => ({
            pendingClosureBasis: event.output.basis,
          })),
        },
      },
    },

    // Durable phase-boundary write: record the authoritative outcome for the phase
    // that just closed. The runtime host will reconcile that durable truth into the
    // next landing, which may be handoff, projected kickoff, another open landing,
    // or final completion.
    recording_phase_outcome: {
      invoke: {
        src: 'recordPhaseOutcome',
        input: ({ context }) => ({
          phaseKey: context.currentPhaseKey!,
          basis: context.pendingClosureBasis!,
        }),
        onDone: {
          target: 'loading',
          actions: [
            assign({
              currentPhaseKey: null,
              landing: null,
              pendingClosureBasis: null,
              boundaryWriteFailure: null,
            }),
            { type: 'requestReconciliation' },
          ],
        },
        onError: {
          target: 'boundary_write_failed',
          actions: assign(({ event }) => ({
            boundaryWriteFailure:
              event.error instanceof Error ? event.error.message : 'phase outcome recording failed',
          })),
        },
      },
    },

    // Shared retry state for the authoritative phase-outcome write.
    boundary_write_failed: {
      on: {
        BOUNDARY_RETRY_REQUESTED: 'recording_phase_outcome',
      },
    },

    complete: {
      type: 'final',
    },
  },
});
