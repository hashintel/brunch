import type { ExecutorNetEvent } from '../orchestrate-topology.js';
import type { SdcpnFile, SdcpnInputArc, SdcpnOutputArc } from './sdcpn.js';

export type PetrinautReplayMarking = Record<string, number>;

export interface PetrinautReplayNetDefinition {
  readonly version: number;
  readonly meta: { readonly generator: string; readonly generatorVersion?: string };
  readonly title: string;
  readonly places: readonly { readonly id: string; readonly name: string }[];
  readonly transitions: readonly {
    readonly id: string;
    readonly name: string;
    readonly inputArcs: readonly SdcpnInputArc[];
    readonly outputArcs: readonly SdcpnOutputArc[];
  }[];
}

export interface PetrinautReplayTransitionFiring {
  readonly transitionId: string;
  readonly input: PetrinautReplayMarking;
  readonly output: PetrinautReplayMarking;
}

export interface PetrinautReplayExport {
  readonly definition: PetrinautReplayNetDefinition;
  readonly initialState: PetrinautReplayMarking;
  readonly transitionFirings: readonly PetrinautReplayTransitionFiring[];
}

export const PETRI_RUN_COMPLETED_PLACE = 'run:completed';
export const PETRI_RUN_HALTED_PLACE = 'run:halted';
export const PETRI_RUN_FINISH_TRANSITION = 'run:finish';

export function reducePetrinautReplayExport(args: {
  readonly sdcpnFile: SdcpnFile;
  readonly events: readonly ExecutorNetEvent[];
}): PetrinautReplayExport {
  const definition = augmentPetriDefinitionWithRunStatus(projectPetrinautReplayNetDefinition(args.sdcpnFile));
  const transitions = transitionMap(definition.transitions);
  const transitionFirings: PetrinautReplayTransitionFiring[] = [];
  let terminalFired = false;

  for (const event of args.events) {
    if (event.kind === 'transition_fired') {
      if (terminalFired) throw new Error('Petrinaut transition fired after terminal event');
      const transition = transitions.get(event.transitionId);
      if (!transition) throw new Error(`Unknown Petrinaut transition id: ${event.transitionId}`);
      transitionFirings.push(transitionEventToFiring(event, transition));
      continue;
    }
    if (isTerminalEvent(event)) {
      if (terminalFired) throw new Error('Conflicting Petrinaut terminal events');
      terminalFired = true;
      transitionFirings.push(synthesizePetriRunStatusFiring(event.kind));
    }
  }

  return {
    definition,
    initialState: initialStateFromSdcpn(args.sdcpnFile),
    transitionFirings,
  };
}

export function projectPetrinautReplayNetDefinition(sdcpnFile: SdcpnFile): PetrinautReplayNetDefinition {
  return {
    version: sdcpnFile.version,
    meta: sdcpnFile.meta,
    title: sdcpnFile.title,
    places: sdcpnFile.places.map((place) => ({ id: place.id, name: place.name })),
    transitions: sdcpnFile.transitions.map((transition) => ({
      id: transition.id,
      name: transition.name,
      inputArcs: transition.inputArcs,
      outputArcs: transition.outputArcs,
    })),
  };
}

export function augmentPetriDefinitionWithRunStatus(
  definition: PetrinautReplayNetDefinition,
): PetrinautReplayNetDefinition {
  return {
    ...definition,
    places: [
      ...definition.places,
      { id: PETRI_RUN_COMPLETED_PLACE, name: 'Run completed' },
      { id: PETRI_RUN_HALTED_PLACE, name: 'Run halted' },
    ],
    transitions: [
      ...definition.transitions,
      {
        id: PETRI_RUN_FINISH_TRANSITION,
        name: 'Run finish',
        inputArcs: [],
        outputArcs: [
          { placeId: PETRI_RUN_COMPLETED_PLACE, weight: 1 },
          { placeId: PETRI_RUN_HALTED_PLACE, weight: 1 },
        ],
      },
    ],
  };
}

export function synthesizePetriRunStatusFiring(
  terminalKind: 'net_completed' | 'net_halted' | 'net_deadlocked',
): PetrinautReplayTransitionFiring {
  return {
    transitionId: PETRI_RUN_FINISH_TRANSITION,
    input: {},
    output: { [terminalKind === 'net_completed' ? PETRI_RUN_COMPLETED_PLACE : PETRI_RUN_HALTED_PLACE]: 1 },
  };
}

function transitionEventToFiring(
  event: Extract<ExecutorNetEvent, { readonly kind: 'transition_fired' }>,
  transition: PetrinautReplayNetDefinition['transitions'][number],
): PetrinautReplayTransitionFiring {
  return {
    transitionId: event.transitionId,
    input: reduceArcs(transition.inputArcs.filter((arc) => event.consumed.includes(arc.placeId))),
    output: reduceArcs(transition.outputArcs.filter((arc) => event.produced.includes(arc.placeId))),
  };
}

function initialStateFromSdcpn(sdcpnFile: SdcpnFile): PetrinautReplayMarking {
  const scenario = sdcpnFile.scenarios[0];
  if (!scenario) return {};

  const marking: PetrinautReplayMarking = {};
  for (const [placeId, count] of Object.entries(scenario.initialState.content)) {
    if (!/^[0-9]+$/u.test(count)) throw new Error(`Invalid Petrinaut initial marking count: ${placeId}`);
    const parsed = Number(count);
    if (Number.isInteger(parsed) && parsed > 0) marking[placeId] = parsed;
  }
  return marking;
}

function transitionMap(
  transitions: readonly PetrinautReplayNetDefinition['transitions'][number][],
): Map<string, PetrinautReplayNetDefinition['transitions'][number]> {
  const map = new Map<string, PetrinautReplayNetDefinition['transitions'][number]>();
  for (const transition of transitions) {
    if (map.has(transition.id)) throw new Error(`Duplicate Petrinaut transition id: ${transition.id}`);
    map.set(transition.id, transition);
  }
  return map;
}

function reduceArcs(arcs: readonly (SdcpnInputArc | SdcpnOutputArc)[]): PetrinautReplayMarking {
  const marking: PetrinautReplayMarking = {};
  for (const arc of arcs) marking[arc.placeId] = (marking[arc.placeId] ?? 0) + arc.weight;
  return marking;
}

function isTerminalEvent(
  event: ExecutorNetEvent,
): event is Extract<ExecutorNetEvent, { readonly kind: 'net_completed' | 'net_halted' | 'net_deadlocked' }> {
  return event.kind === 'net_completed' || event.kind === 'net_halted' || event.kind === 'net_deadlocked';
}
