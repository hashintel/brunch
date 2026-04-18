// Phase frontier state machine for Brunch.
// Paste-ready for Stately Studio (studio.stately.ai) — XState v5.
//
// One instance per open phase (spawned as an invoked child by the spec
// machine). Pure in-memory orchestration: no durable writes, no knowledge
// of phase keys. Signals closure to the parent via one of two final states
// whose `output` carries the closure basis.

import { setup, assign } from 'xstate';

type TurnId = string;

type TurnKind = 'kickoff' | 'question' | 'grounding' | 'review' | 'closure' | 'recovery';

type SuccessorKind = 'question' | 'grounding' | 'review' | 'closure_proposal' | 'accept_close';

type ClosureBasis = 'interviewer' | 'force';

type Context = {
  frontierTurnId: TurnId | null;
  frontierTurnKind: TurnKind | null;
  lastAnsweredTurnId: TurnId | null;
  pendingSuccessorKind: SuccessorKind | null;
  generationFailure: string | null;
};

type Event =
  | { type: 'KICKOFF_ACCEPTED'; turnId: TurnId }
  | { type: 'REPLY_SUBMITTED'; turnId: TurnId; payload: unknown }
  | { type: 'FORCE_CLOSE_REQUESTED' }
  | { type: 'INTERVIEWER_DECIDED'; successorKind: SuccessorKind }
  | { type: 'SUCCESSOR_GENERATED'; turnId: TurnId; turnKind: TurnKind }
  | { type: 'GENERATION_FAILED'; reason: string }
  | { type: 'RECOVERY_GENERATED'; turnId: TurnId };

type Output = { basis: ClosureBasis };

export const phaseMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Event,
    input: {} as { kickoffTurnId: TurnId },
    output: {} as Output,
  },
  actions: {
    // Fire-and-forget: tell the parent spec machine that a turn was
    // answered. The parent decides whether to enqueue observer capture.
    emitTurnAnswered: (_, _params: { turnId: TurnId }) => {
      // sendParent({ type: 'TURN_ANSWERED', turnId: params.turnId })
    },
  },
  guards: {
    isAcceptClose: ({ event }) =>
      event.type === 'INTERVIEWER_DECIDED' && event.successorKind === 'accept_close',
    isClosureProposal: ({ event }) =>
      event.type === 'INTERVIEWER_DECIDED' && event.successorKind === 'closure_proposal',
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
  initial: 'awaiting_kickoff',
  states: {
    // Kickoff turn is the frontier; user has not yet actioned it.
    awaiting_kickoff: {
      on: {
        KICKOFF_ACCEPTED: {
          target: 'active.interviewer_processing',
          actions: [
            assign(({ event }) => ({ lastAnsweredTurnId: event.turnId })),
            {
              type: 'emitTurnAnswered',
              params: ({ event }) => ({ turnId: event.turnId }),
            },
          ],
        },
        FORCE_CLOSE_REQUESTED: 'closed_via_force',
      },
    },

    // Open phase. Exactly one frontier turn exists at all times here.
    // Force close is allowed from any substate; the transition is hoisted
    // here so all four substates inherit it.
    active: {
      on: {
        FORCE_CLOSE_REQUESTED: 'closed_via_force',
      },
      initial: 'awaiting_reply',
      states: {
        awaiting_reply: {
          on: {
            REPLY_SUBMITTED: {
              target: 'interviewer_processing',
              actions: [
                assign(({ event }) => ({ lastAnsweredTurnId: event.turnId })),
                {
                  type: 'emitTurnAnswered',
                  params: ({ event }) => ({ turnId: event.turnId }),
                },
              ],
            },
          },
        },

        // Interviewer agent is deciding what comes next. Must resolve to
        // exactly one of: generative successor, closure proposal, accept
        // close, or recovery. No silent exits.
        interviewer_processing: {
          on: {
            INTERVIEWER_DECIDED: [
              { guard: 'isAcceptClose', target: '#phase.closed_via_interviewer' },
              {
                guard: 'isClosureProposal',
                target: 'generating_successor',
                actions: assign({ pendingSuccessorKind: 'closure_proposal' }),
              },
              {
                guard: 'isGenerativeSuccessor',
                target: 'generating_successor',
                actions: assign(({ event }) => ({
                  pendingSuccessorKind:
                    event.type === 'INTERVIEWER_DECIDED' ? event.successorKind : null,
                })),
              },
            ],
            GENERATION_FAILED: {
              target: 'awaiting_recovery',
              actions: assign(({ event }) => ({
                generationFailure: event.type === 'GENERATION_FAILED' ? event.reason : null,
              })),
            },
          },
        },

        // Successor card is being generated (thinking + tool use + streaming).
        // Collapsed to one state here; expand into substates if you need to
        // visualize those phases of generation.
        generating_successor: {
          on: {
            SUCCESSOR_GENERATED: {
              target: 'awaiting_reply',
              actions: assign(({ event }) => ({
                frontierTurnId: event.type === 'SUCCESSOR_GENERATED' ? event.turnId : null,
                frontierTurnKind: event.type === 'SUCCESSOR_GENERATED' ? event.turnKind : null,
                pendingSuccessorKind: null,
              })),
            },
            GENERATION_FAILED: {
              target: 'awaiting_recovery',
              actions: assign(({ event }) => ({
                generationFailure: event.type === 'GENERATION_FAILED' ? event.reason : null,
                pendingSuccessorKind: null,
              })),
            },
          },
        },

        // Reached only when generation failed or an external detector found
        // the phase lost its frontier. The only exit is a recovery turn
        // becoming the new frontier.
        awaiting_recovery: {
          on: {
            RECOVERY_GENERATED: {
              target: 'awaiting_reply',
              actions: assign(({ event }) => ({
                frontierTurnId: event.type === 'RECOVERY_GENERATED' ? event.turnId : null,
                frontierTurnKind: 'recovery',
                generationFailure: null,
              })),
            },
          },
        },
      },
    },

    // Terminal states. Output carries the closure basis up to the spec
    // machine via `onDone`; no durable writes happen here.
    closed_via_interviewer: {
      type: 'final',
    },
    closed_via_force: {
      type: 'final',
    },
  },
  // Parent reads the basis from `event.output.basis` on its `onDone`.
  // The final state id is encoded in the xstate done event type.
  output: ({ event }) =>
    event.type === 'xstate.done.state.phase.closed_via_force'
      ? { basis: 'force' }
      : { basis: 'interviewer' },
});
