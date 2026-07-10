import type {
  PetriLiveExecutionExport,
  PetriLiveMarking,
  PetriLiveNetDefinition,
  PetriLiveTransitionFiring,
} from './petri-live-export.js';

export type PetrinautTerminalState = 'completed' | 'halted' | 'deadlocked';
export type PetrinautRunState = 'running' | PetrinautTerminalState;

export type PetrinautStreamFrame =
  | { readonly kind: 'status'; readonly state: PetrinautRunState; readonly reason?: string }
  | { readonly kind: 'definition'; readonly definition: PetriLiveNetDefinition }
  | { readonly kind: 'initial_state'; readonly initialState: PetriLiveMarking }
  | { readonly kind: 'transition_firing'; readonly firing: PetriLiveTransitionFiring }
  | { readonly kind: 'terminal'; readonly state: PetrinautTerminalState; readonly reason?: string };

export function projectPetrinautStreamFrames(args: {
  readonly liveExport: PetriLiveExecutionExport;
  readonly terminal?: { readonly state: PetrinautTerminalState; readonly reason?: string };
}): readonly PetrinautStreamFrame[] {
  return [
    {
      kind: 'status',
      state: args.terminal?.state ?? 'running',
      ...(args.terminal?.reason === undefined ? {} : { reason: args.terminal.reason }),
    },
    { kind: 'definition', definition: args.liveExport.definition },
    { kind: 'initial_state', initialState: args.liveExport.initialState },
    ...args.liveExport.transitionFirings.map((firing) => ({ kind: 'transition_firing' as const, firing })),
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

export function foldPetrinautStreamFrames(frames: readonly PetrinautStreamFrame[]): PetriLiveExecutionExport {
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
