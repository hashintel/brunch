// Spec-level state machine for Brunch.
// Paste-ready for Stately Studio (studio.stately.ai) — XState v5.
//
// One instance per specification. Owns:
//   - the currently-running phase actor (at most one alive at a time)
//   - the observer p-queue service (long-lived for the life of the spec)
//   - all phase-boundary durable writes: recording outcomes and seeding
//     the next phase's kickoff turn
//
// Phase machines are pure in-memory orchestrators; they never write to
// durable storage. They signal closure via `onDone` output carrying the
// closure basis, and this machine handles the two boundary writes in
// symmetric states.

import { setup, assign, fromPromise } from 'xstate';
import { phaseMachine } from './phase-machine';

type TurnId = string;

type PhaseKey = 'scope' | 'design' | 'requirements' | 'criteria';

type ClosureBasis = 'interviewer' | 'force';

type BoundaryWrite = 'recording' | 'seeding';

const PHASE_SEQUENCE: readonly PhaseKey[] = ['scope', 'design', 'requirements', 'criteria'] as const;

const nextPhaseKey = (current: PhaseKey): PhaseKey | null => {
  const index = PHASE_SEQUENCE.indexOf(current);
  return index >= 0 && index < PHASE_SEQUENCE.length - 1 ? PHASE_SEQUENCE[index + 1]! : null;
};

type Context = {
  currentPhaseKey: PhaseKey | null;
  currentKickoffTurnId: TurnId | null;
  pendingClosureBasis: ClosureBasis | null;
  pendingBoundaryWrite: BoundaryWrite | null;
  boundaryWriteFailure: string | null;
};

type Event =
  | {
      type: 'SPEC_HYDRATED';
      activePhaseKey: PhaseKey | null;
      kickoffTurnId: TurnId | null;
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
    // Writes the closure outcome (summary + basis) for the current phase.
    // Failure lands the machine in `boundary_write_failed`.
    recordPhaseOutcome: fromPromise<void, { phaseKey: PhaseKey; basis: ClosureBasis }>(
      async ({ input: _input }) => {
        // await api.recordPhaseOutcome({ phaseKey, basis })
        throw new Error('not implemented');
      },
    ),
    // Creates the next phase's kickoff turn in durable storage and returns
    // its turn id. Failure lands the machine in `boundary_write_failed`.
    seedKickoffTurn: fromPromise<TurnId, { phaseKey: PhaseKey }>(async ({ input: _input }) => {
      // await api.createKickoffTurn({ phaseKey })
      throw new Error('not implemented');
    }),
  },
  actions: {
    // Hand the just-answered turn id off to the spec-level p-queue.
    // A single PQueue instance is shared across all phases; this action
    // just calls queue.add(() => runObserver(turnId)).
    enqueueObserverCapture: (_, _params: { turnId: TurnId }) => {
      // observerQueue.add(() => runObserver(params.turnId))
    },
    markCaptureSucceeded: (_, _params: { turnId: TurnId }) => {
      // notify UI / persistence that capture landed
    },
    markCaptureFailed: (_, _params: { turnId: TurnId; error: string }) => {
      // notify UI / persistence of capture failure; queue may retry
    },
  },
  guards: {
    hasNoNextPhase: ({ context }) =>
      context.currentPhaseKey === null || nextPhaseKey(context.currentPhaseKey) === null,
    hasRunningPhase: ({ event }) =>
      event.type === 'SPEC_HYDRATED' &&
      event.activePhaseKey !== null &&
      event.kickoffTurnId !== null,
    allPhasesClosed: ({ event }) => event.type === 'SPEC_HYDRATED' && event.activePhaseKey === null,
    isRecordingWrite: ({ context }) => context.pendingBoundaryWrite === 'recording',
    isSeedingWrite: ({ context }) => context.pendingBoundaryWrite === 'seeding',
  },
}).createMachine({
  id: 'spec',
  context: {
    currentPhaseKey: null,
    currentKickoffTurnId: null,
    pendingClosureBasis: null,
    pendingBoundaryWrite: null,
    boundaryWriteFailure: null,
  },
  initial: 'loading',
  // Turn-answered and capture-settled events can arrive in any state. The
  // observer queue outlives individual phase transitions by design (D96:
  // observer capture may trail interviewer completion and phase close).
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
    // Waiting for persisted spec state. Resolves to one of:
    //   - phase_running (existing open phase with a kickoff turn)
    //   - seeding_next_kickoff (spec exists but needs phase 1 kickoff)
    //   - complete (all four phases already closed)
    loading: {
      on: {
        SPEC_HYDRATED: [
          { guard: 'allPhasesClosed', target: 'complete' },
          {
            guard: 'hasRunningPhase',
            target: 'phase_running',
            actions: assign(({ event }) => ({
              currentPhaseKey: event.type === 'SPEC_HYDRATED' ? event.activePhaseKey : null,
              currentKickoffTurnId: event.type === 'SPEC_HYDRATED' ? event.kickoffTurnId : null,
            })),
          },
          {
            // Fresh spec with no phase yet: seed the first kickoff.
            target: 'seeding_next_kickoff',
            actions: assign({
              currentPhaseKey: 'scope',
              pendingBoundaryWrite: 'seeding',
            }),
          },
        ],
      },
    },

    // Exactly one phase actor is invoked here. The phase actor owns
    // frontier state; this machine only reacts to its completion and
    // captures the closure basis from its output.
    phase_running: {
      invoke: {
        id: 'phase',
        src: 'phaseMachine',
        input: ({ context }) => ({ kickoffTurnId: context.currentKickoffTurnId! }),
        // Phase reaching one of its final states fires onDone with
        // `{ basis: 'interviewer' | 'force' }` as output. We stash the
        // basis and move into the recording boundary write.
        onDone: {
          target: 'recording_phase_outcome',
          actions: assign(({ event }) => ({
            pendingClosureBasis: event.output.basis,
            pendingBoundaryWrite: 'recording',
          })),
        },
      },
    },

    // Durable write #1 at a phase boundary: record the closure outcome
    // of the phase that just ended. Must succeed before we seed the next
    // phase's kickoff turn.
    recording_phase_outcome: {
      invoke: {
        src: 'recordPhaseOutcome',
        input: ({ context }) => ({
          phaseKey: context.currentPhaseKey!,
          basis: context.pendingClosureBasis!,
        }),
        onDone: [
          { guard: 'hasNoNextPhase', target: 'complete' },
          {
            target: 'seeding_next_kickoff',
            actions: assign(({ context }) => ({
              currentPhaseKey: nextPhaseKey(context.currentPhaseKey!),
              currentKickoffTurnId: null,
              pendingClosureBasis: null,
              pendingBoundaryWrite: 'seeding',
            })),
          },
        ],
        onError: {
          target: 'boundary_write_failed',
          actions: assign(({ event }) => ({
            boundaryWriteFailure:
              event.error instanceof Error ? event.error.message : 'recording failed',
          })),
        },
      },
    },

    // Durable write #2 at a phase boundary: create the next phase's
    // kickoff turn. Gating the next phase_running on this guarantees the
    // spec never enters an open phase without a frontier turn.
    seeding_next_kickoff: {
      invoke: {
        src: 'seedKickoffTurn',
        input: ({ context }) => ({ phaseKey: context.currentPhaseKey! }),
        onDone: {
          target: 'phase_running',
          actions: assign(({ event }) => ({
            currentKickoffTurnId: event.output,
            pendingBoundaryWrite: null,
            boundaryWriteFailure: null,
          })),
        },
        onError: {
          target: 'boundary_write_failed',
          actions: assign(({ event }) => ({
            boundaryWriteFailure:
              event.error instanceof Error ? event.error.message : 'seeding failed',
          })),
        },
      },
    },

    // Shared retry state for either boundary write. Retry routes back to
    // whichever operation failed based on context.pendingBoundaryWrite.
    boundary_write_failed: {
      on: {
        BOUNDARY_RETRY_REQUESTED: [
          { guard: 'isRecordingWrite', target: 'recording_phase_outcome' },
          { guard: 'isSeedingWrite', target: 'seeding_next_kickoff' },
        ],
      },
    },

    // All four phases closed and their outcomes recorded. The output
    // route becomes available; no phase actor alive. The observer queue
    // may still drain in the background via the root-level event handlers.
    complete: {
      type: 'final',
    },
  },
});
