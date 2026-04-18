// Phase frontier state machine for Brunch.
// Paste-ready for Stately Studio (studio.stately.ai) — XState v5.
//
// One instance per open phase (spawned as an actor by the spec-level machine).
// Observer capture is delegated to a spec-level p-queue via the
// `enqueueObserverCapture` action; this machine never blocks on it.

import { setup, assign } from 'xstate';

type TurnId = string;

type TurnKind =
  | 'kickoff'
  | 'question'
  | 'grounding'
  | 'review'
  | 'closure'
  | 'recovery';

type SuccessorKind =
  | 'question'
  | 'grounding'
  | 'review'
  | 'closure_proposal'
  | 'accept_close';

type Context = {
  frontierTurnId: TurnId | null;
  frontierTurnKind: TurnKind | null;
  lastAnsweredTurnId: TurnId | null;
  pendingSuccessorKind: SuccessorKind | null;
  generationFailure: string | null;
};

type Event =
  | { type: 'USER_ACTION_KICKOFF'; turnId: TurnId }
  | { type: 'USER_SUBMIT_REPLY'; turnId: TurnId; payload: unknown }
  | { type: 'USER_FORCE_CLOSE' }
  | { type: 'INTERVIEWER_DECIDED'; successorKind: SuccessorKind }
  | { type: 'SUCCESSOR_READY'; turnId: TurnId; turnKind: TurnKind }
  | { type: 'GENERATION_FAILED'; reason: string }
  | { type: 'RECOVERY_READY'; turnId: TurnId }
  | { type: 'CLOSURE_RECORDED' };

export const phaseMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Event,
    input: {} as { kickoffTurnId: TurnId },
  },
  actions: {
    // Fire-and-forget: push the just-answered turn into the spec-level
    // observer p-queue. Never awaited from the phase machine.
    enqueueObserverCapture: (_, _params: { turnId: TurnId }) => {
      // parent.send({ type: 'ENQUEUE_OBSERVER', turnId: params.turnId })
    },
    // On entering `closed`, ask the spec machine to seed the next phase's
    // kickoff turn. Modeled as an action so there is no intermediate state
    // in which the user can get stranded between phases.
    emitCreateNextPhaseKickoff: () => {
      // parent.send({ type: 'CREATE_NEXT_PHASE_KICKOFF' })
    },
  },
  guards: {
    isAcceptClose: ({ event }) =>
      event.type === 'INTERVIEWER_DECIDED' &&
      event.successorKind === 'accept_close',
    isClosureProposal: ({ event }) =>
      event.type === 'INTERVIEWER_DECIDED' &&
      event.successorKind === 'closure_proposal',
    isGenerativeSuccessor: ({ event }) =>
      event.type === 'INTERVIEWER_DECIDED' &&
      (event.successorKind === 'question' ||
        event.successorKind === 'grounding' ||
        event.successorKind === 'review'),
  },
}).createMachine({
  id: 'phase',
  context: ({ input }) => ({
    frontierTurnId: input.kickoffTurnId,
    frontierTurnKind: 'kickoff',
    lastAnsweredTurnId: null,
    pendingSuccessorKind: null,
    generationFailure: null,
  }),
  initial: 'entry_pending',
  states: {
    // Kickoff turn is the frontier; user has not yet actioned it.
    entry_pending: {
      on: {
        USER_ACTION_KICKOFF: {
          target: 'active.interviewer_processing',
          actions: [
            assign(({ event }) => ({ lastAnsweredTurnId: event.turnId })),
            // Kickoff answers generally have no extractable knowledge, but
            // enqueueing is cheap and keeps policy out of the state machine.
            {
              type: 'enqueueObserverCapture',
              params: ({ event }) => ({ turnId: event.turnId }),
            },
          ],
        },
        USER_FORCE_CLOSE: 'closing',
      },
    },

    // Open phase. Exactly one frontier turn exists at all times here.
    active: {
      initial: 'awaiting_reply',
      states: {
        awaiting_reply: {
          on: {
            USER_SUBMIT_REPLY: {
              target: 'interviewer_processing',
              actions: [
                assign(({ event }) => ({ lastAnsweredTurnId: event.turnId })),
                {
                  type: 'enqueueObserverCapture',
                  params: ({ event }) => ({ turnId: event.turnId }),
                },
              ],
            },
            USER_FORCE_CLOSE: '#phase.closing',
          },
        },

        // Interviewer agent is deciding what comes next. Must resolve to
        // exactly one of: generative successor, closure proposal, accept
        // close, or recovery. No silent exits.
        interviewer_processing: {
          on: {
            INTERVIEWER_DECIDED: [
              { guard: 'isAcceptClose', target: '#phase.closing' },
              {
                guard: 'isClosureProposal',
                target: 'generating_successor',
                actions: assign({
                  pendingSuccessorKind: 'closure_proposal',
                }),
              },
              {
                guard: 'isGenerativeSuccessor',
                target: 'generating_successor',
                actions: assign(({ event }) => ({
                  pendingSuccessorKind:
                    event.type === 'INTERVIEWER_DECIDED'
                      ? event.successorKind
                      : null,
                })),
              },
            ],
            GENERATION_FAILED: {
              target: 'recovery_needed',
              actions: assign(({ event }) => ({
                generationFailure:
                  event.type === 'GENERATION_FAILED' ? event.reason : null,
              })),
            },
          },
        },

        // Successor card is being generated (thinking + tool use + streaming).
        // Collapsed to one state here; expand into substates if you need to
        // visualize those phases of generation.
        generating_successor: {
          on: {
            SUCCESSOR_READY: {
              target: 'awaiting_reply',
              actions: assign(({ event }) => ({
                frontierTurnId:
                  event.type === 'SUCCESSOR_READY' ? event.turnId : null,
                frontierTurnKind:
                  event.type === 'SUCCESSOR_READY' ? event.turnKind : null,
                pendingSuccessorKind: null,
              })),
            },
            GENERATION_FAILED: {
              target: 'recovery_needed',
              actions: assign(({ event }) => ({
                generationFailure:
                  event.type === 'GENERATION_FAILED' ? event.reason : null,
                pendingSuccessorKind: null,
              })),
            },
          },
        },

        // Reached only when generation failed or an external detector found
        // the phase lost its frontier. The only exit is a recovery turn
        // becoming the new frontier.
        recovery_needed: {
          on: {
            RECOVERY_READY: {
              target: 'awaiting_reply',
              actions: assign(({ event }) => ({
                frontierTurnId:
                  event.type === 'RECOVERY_READY' ? event.turnId : null,
                frontierTurnKind: 'recovery',
                generationFailure: null,
              })),
            },
          },
        },
      },
    },

    // Phase outcome is being recorded. Entry guarantees a durable write
    // before transitioning to `closed`.
    closing: {
      on: {
        CLOSURE_RECORDED: {
          target: 'closed',
          actions: 'emitCreateNextPhaseKickoff',
        },
      },
    },

    closed: {
      type: 'final',
    },
  },
});
