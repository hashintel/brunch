// Phase frontier state machine for Brunch.
// Paste-ready for Stately Studio (studio.stately.ai) — XState v5.
//
// One instance per open phase (spawned as an invoked child by the spec chart).
// Pure in-memory orchestration: no durable writes. This chart owns only in-phase
// legality and visible open-phase states. The runtime host around the spec chart
// owns durable landing reconciliation, write ordering, leases, and stale-event
// rejection.

import { assign, setup } from 'xstate';

type TurnId = string;

type PhaseKey = 'grounding' | 'design' | 'requirements' | 'criteria';

type DurableFrontierTurnKind = 'question' | 'grounding' | 'review' | 'closure';

type SuccessorKind = 'question' | 'grounding' | 'review' | 'closure_proposal' | 'accept_close';

type RecoveryReason = 'generation_failed' | 'frontier_missing' | 'frontier_invalid';

type OpenPhaseLanding =
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
  | { kind: 'projected_recovery'; phaseKey: PhaseKey; reason: RecoveryReason };

type ClosureBasis = 'interviewer' | 'force';

type Context = {
  landingKind: OpenPhaseLanding['kind'];
  phaseKey: PhaseKey;
  frontierTurnId: TurnId | null;
  frontierTurnKind: DurableFrontierTurnKind | null;
  lastAnsweredTurnId: TurnId | null;
  pendingSuccessorKind: SuccessorKind | null;
  generationFailure: string | null;
};

type Event =
  | { type: 'KICKOFF_ACCEPTED' }
  | { type: 'REPLY_SUBMITTED'; turnId: TurnId; payload: unknown }
  | { type: 'FORCE_CLOSE_REQUESTED' }
  | { type: 'INTERVIEWER_DECIDED'; successorKind: SuccessorKind }
  | { type: 'SUCCESSOR_GENERATED'; turnId: TurnId; turnKind: DurableFrontierTurnKind }
  | { type: 'GENERATION_FAILED'; reason: string }
  | { type: 'RECOVERY_CONTINUED' };

type Output = { basis: ClosureBasis };

export const phaseMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Event,
    input: {} as { landing: OpenPhaseLanding },
    output: {} as Output,
  },
  actions: {
    // Fire-and-forget: tell the parent spec chart that a durable frontier turn was
    // answered. The runtime host decides how to enqueue observer capture.
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
    startsAtProjectedKickoff: ({ context }) => context.landingKind === 'projected_kickoff',
    startsAtFrontierReply: ({ context }) => context.landingKind === 'frontier_turn',
    startsAtVisibleGeneration: ({ context }) => context.landingKind === 'visible_generation',
    startsAtProjectedRecovery: ({ context }) => context.landingKind === 'projected_recovery',
  },
}).createMachine({
  id: 'phase',
  context: ({ input }) => ({
    landingKind: input.landing.kind,
    phaseKey: input.landing.phaseKey,
    frontierTurnId: input.landing.kind === 'frontier_turn' ? input.landing.turnId : null,
    frontierTurnKind: input.landing.kind === 'frontier_turn' ? input.landing.turnKind : null,
    lastAnsweredTurnId:
      input.landing.kind === 'visible_generation' ? input.landing.answeredTurnId : null,
    pendingSuccessorKind:
      input.landing.kind === 'visible_generation' ? input.landing.successorKind : null,
    generationFailure:
      input.landing.kind === 'projected_recovery' ? input.landing.reason : null,
  }),
  initial: 'bootstrapping',
  states: {
    // Hydration does not always land in kickoff. This transient entry state narrows
    // the open-phase landing into the truthful visible bottom artifact.
    bootstrapping: {
      always: [
        { guard: 'startsAtProjectedKickoff', target: 'awaiting_kickoff' },
        { guard: 'startsAtFrontierReply', target: 'active.awaiting_reply' },
        { guard: 'startsAtVisibleGeneration', target: 'active.generating_successor' },
        { guard: 'startsAtProjectedRecovery', target: 'active.awaiting_recovery' },
      ],
    },

    // Kickoff is now a projected control card, not a durable turn row. Accepting
    // it initiates first-successor generation; there is no kickoff turn to answer.
    awaiting_kickoff: {
      on: {
        KICKOFF_ACCEPTED: {
          target: 'active.interviewer_processing',
          actions: assign({
            frontierTurnId: null,
            frontierTurnKind: null,
            lastAnsweredTurnId: null,
            pendingSuccessorKind: null,
            generationFailure: null,
          }),
        },
        FORCE_CLOSE_REQUESTED: 'closed_via_force',
      },
    },

    // Open phase. Exactly one visible bottom artifact exists at all times here:
    // a frontier turn, visible generation state, or projected recovery control.
    active: {
      on: {
        FORCE_CLOSE_REQUESTED: 'closed_via_force',
      },
      initial: 'awaiting_reply',
      states: {
        awaiting_reply: {
          on: {
            // Closure rejection stays on the normal reply path. A rejected closure
            // proposal is still just a structured reply to the current frontier.
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

        // Interviewer agent is deciding what comes next. Must resolve to exactly
        // one of: generative successor, closure proposal, accept close, or
        // projected recovery. No silent exits.
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
                frontierTurnId: null,
                frontierTurnKind: null,
                pendingSuccessorKind: null,
                generationFailure: event.type === 'GENERATION_FAILED' ? event.reason : null,
              })),
            },
          },
        },

        // The runtime host must only emit `SUCCESSOR_GENERATED` after the durable
        // turn exists. This chart treats visible generation as a truthful open-phase
        // bottom artifact, including hydration into that state when durable evidence
        // justifies it.
        generating_successor: {
          on: {
            SUCCESSOR_GENERATED: {
              target: 'awaiting_reply',
              actions: assign(({ event }) => ({
                frontierTurnId: event.type === 'SUCCESSOR_GENERATED' ? event.turnId : null,
                frontierTurnKind: event.type === 'SUCCESSOR_GENERATED' ? event.turnKind : null,
                pendingSuccessorKind: null,
                generationFailure: null,
              })),
            },
            GENERATION_FAILED: {
              target: 'awaiting_recovery',
              actions: assign(({ event }) => ({
                frontierTurnId: null,
                frontierTurnKind: null,
                pendingSuccessorKind: null,
                generationFailure: event.type === 'GENERATION_FAILED' ? event.reason : null,
              })),
            },
          },
        },

        // Recovery is a projected control, not a durable turn row. Exiting recovery
        // re-enters the normal successor path and must ultimately produce an
        // ordinary durable frontier turn.
        awaiting_recovery: {
          on: {
            RECOVERY_CONTINUED: {
              target: 'interviewer_processing',
              actions: assign({
                frontierTurnId: null,
                frontierTurnKind: null,
                pendingSuccessorKind: null,
                generationFailure: null,
              }),
            },
          },
        },
      },
    },

    // Terminal states. Output carries the closure basis up to the parent spec
    // chart via `onDone`; no durable writes happen here.
    closed_via_interviewer: {
      type: 'final',
    },
    closed_via_force: {
      type: 'final',
    },
  },
  output: ({ event }) =>
    event.type === 'xstate.done.state.phase.closed_via_force'
      ? { basis: 'force' }
      : { basis: 'interviewer' },
});
