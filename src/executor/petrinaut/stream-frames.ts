import {
  PETRI_RUN_FINISH_TRANSITION,
  synthesizePetriRunStatusFiring,
  type PetrinautReplayExport,
  type PetrinautReplayMarking,
  type PetrinautReplayNetDefinition,
  type PetrinautReplayTransitionFiring,
} from './replay-export.js';

export type PetrinautTerminalState = 'completed' | 'halted' | 'deadlocked';
export type PetrinautRunState = 'running' | PetrinautTerminalState;

export type PetrinautStreamFrame =
  | { readonly kind: 'status'; readonly state: PetrinautRunState; readonly reason?: string }
  | { readonly kind: 'definition'; readonly definition: PetrinautReplayNetDefinition }
  | { readonly kind: 'initial_state'; readonly initialState: PetrinautReplayMarking }
  | { readonly kind: 'transition_firing'; readonly firing: PetrinautReplayTransitionFiring }
  | { readonly kind: 'terminal'; readonly state: PetrinautTerminalState; readonly reason?: string };

export function projectPetrinautStreamFrames(args: {
  readonly replayExport: PetrinautReplayExport;
  readonly terminal?: { readonly state: PetrinautTerminalState; readonly reason?: string };
}): readonly PetrinautStreamFrame[] {
  const needsTerminalFiring =
    args.terminal !== undefined &&
    !args.replayExport.transitionFirings.some(
      (firing) => firing.transitionId === PETRI_RUN_FINISH_TRANSITION,
    );
  return [
    {
      kind: 'status',
      state: args.terminal?.state ?? 'running',
      ...(args.terminal?.reason === undefined ? {} : { reason: args.terminal.reason }),
    },
    { kind: 'definition', definition: args.replayExport.definition },
    { kind: 'initial_state', initialState: args.replayExport.initialState },
    ...args.replayExport.transitionFirings.map((firing) => ({ kind: 'transition_firing' as const, firing })),
    ...(needsTerminalFiring
      ? [
          {
            kind: 'transition_firing' as const,
            firing: synthesizePetriRunStatusFiring(
              args.terminal!.state === 'completed'
                ? 'net_completed'
                : args.terminal!.state === 'halted'
                  ? 'net_halted'
                  : 'net_deadlocked',
            ),
          },
        ]
      : []),
    ...(args.terminal === undefined
      ? []
      : [
          {
            kind: 'terminal' as const,
            state: args.terminal.state,
            ...(args.terminal.reason === undefined ? {} : { reason: args.terminal.reason }),
          },
        ]),
  ];
}

export function foldPetrinautStreamFrames(frames: readonly PetrinautStreamFrame[]): PetrinautReplayExport {
  const definition = frames.find(
    (frame): frame is Extract<PetrinautStreamFrame, { kind: 'definition' }> => frame.kind === 'definition',
  )?.definition;
  const initialState = frames.find(
    (frame): frame is Extract<PetrinautStreamFrame, { kind: 'initial_state' }> =>
      frame.kind === 'initial_state',
  )?.initialState;
  if (definition === undefined) throw new Error('foldPetrinautStreamFrames: missing definition frame');
  if (initialState === undefined) throw new Error('foldPetrinautStreamFrames: missing initial_state frame');
  return {
    definition,
    initialState,
    transitionFirings: frames
      .filter(
        (frame): frame is Extract<PetrinautStreamFrame, { kind: 'transition_firing' }> =>
          frame.kind === 'transition_firing',
      )
      .map((frame) => frame.firing),
  };
}
