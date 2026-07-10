import type { ExecutorNetEvent } from '../orchestrate-topology.js';
import type { SdcpnFile, SdcpnInputArc, SdcpnOutputArc } from './sdcpn.js';

export type PetriLiveMarking = Record<string, number>;

export interface PetriLiveNetDefinition {
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

export interface PetriLiveTransitionFiring {
  readonly transitionId: string;
  readonly input: PetriLiveMarking;
  readonly output: PetriLiveMarking;
}

export interface PetriLiveExecutionExport {
  readonly definition: PetriLiveNetDefinition;
  readonly initialState: PetriLiveMarking;
  readonly transitionFirings: readonly PetriLiveTransitionFiring[];
}

export const PETRI_RUN_COMPLETED_PLACE = 'run:completed';
export const PETRI_RUN_HALTED_PLACE = 'run:halted';
export const PETRI_RUN_FINISH_TRANSITION = 'run:finish';

export function reducePetriLiveExecutionExport(args: {
  readonly sdcpnFile: SdcpnFile;
  readonly events: readonly ExecutorNetEvent[];
}): PetriLiveExecutionExport {
  const definition = augmentPetriDefinitionWithRunStatus(projectPetriLiveNetDefinition(args.sdcpnFile));
  const transitions = new Map(definition.transitions.map((transition) => [transition.id, transition]));
  const transitionFirings: PetriLiveTransitionFiring[] = [];
  let terminalFired = false;

  for (const event of args.events) {
    if (event.kind === 'transition_fired') {
      const transition = transitions.get(event.transitionId);
      if (!transition) throw new Error(`Unknown Petrinaut transition id: ${event.transitionId}`);
      transitionFirings.push(transitionEventToFiring(event, transition));
      continue;
    }
    if (!terminalFired && isTerminalEvent(event)) {
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

export function parsePetriLiveExecutionExport(value: unknown): PetriLiveExecutionExport | undefined {
  if (!isRecord(value) || !isRecord(value.definition) || !isRecord(value.initialState)) return undefined;
  if (!Array.isArray(value.transitionFirings)) return undefined;

  const definition = parsePetriLiveNetDefinition(value.definition);
  const initialState = parsePetriLiveMarking(value.initialState);
  const transitionFirings = value.transitionFirings.map(parsePetriLiveTransitionFiring);
  if (
    definition === undefined ||
    initialState === undefined ||
    transitionFirings.some((entry) => entry === undefined)
  ) {
    return undefined;
  }
  return { definition, initialState, transitionFirings: transitionFirings as PetriLiveTransitionFiring[] };
}

function parsePetriLiveNetDefinition(value: unknown): PetriLiveNetDefinition | undefined {
  if (!isRecord(value) || typeof value.version !== 'number' || !isRecord(value.meta)) return undefined;
  if (typeof value.title !== 'string' || !Array.isArray(value.places) || !Array.isArray(value.transitions)) {
    return undefined;
  }
  if (typeof value.meta.generator !== 'string') return undefined;
  if (value.meta.generatorVersion !== undefined && typeof value.meta.generatorVersion !== 'string')
    return undefined;
  const places = value.places.map(parsePetriLivePlace);
  const transitions = value.transitions.map(parsePetriLiveTransition);
  if (
    places.some((place) => place === undefined) ||
    transitions.some((transition) => transition === undefined)
  ) {
    return undefined;
  }
  return {
    version: value.version,
    meta: {
      generator: value.meta.generator,
      ...(value.meta.generatorVersion === undefined ? {} : { generatorVersion: value.meta.generatorVersion }),
    },
    title: value.title,
    places: places as PetriLiveNetDefinition['places'],
    transitions: transitions as PetriLiveNetDefinition['transitions'],
  };
}

function parsePetriLivePlace(value: unknown): { readonly id: string; readonly name: string } | undefined {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string'
    ? { id: value.id, name: value.name }
    : undefined;
}

function parsePetriLiveTransition(value: unknown): PetriLiveNetDefinition['transitions'][number] | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return undefined;
  const inputArcs = parseInputArcs(value.inputArcs);
  const outputArcs = parseOutputArcs(value.outputArcs);
  if (inputArcs === undefined || outputArcs === undefined) return undefined;
  return { id: value.id, name: value.name, inputArcs, outputArcs };
}

function parseInputArcs(value: unknown): readonly SdcpnInputArc[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const arcs = value.map((arc) =>
    isRecord(arc) &&
    typeof arc.placeId === 'string' &&
    typeof arc.weight === 'number' &&
    arc.weight > 0 &&
    (arc.type === 'standard' || arc.type === 'inhibitor')
      ? ({ placeId: arc.placeId, weight: arc.weight, type: arc.type } as const)
      : undefined,
  );
  return arcs.some((arc) => arc === undefined) ? undefined : (arcs as readonly SdcpnInputArc[]);
}

function parseOutputArcs(value: unknown): readonly SdcpnOutputArc[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const arcs = value.map((arc) =>
    isRecord(arc) && typeof arc.placeId === 'string' && typeof arc.weight === 'number' && arc.weight > 0
      ? ({ placeId: arc.placeId, weight: arc.weight } as const)
      : undefined,
  );
  return arcs.some((arc) => arc === undefined) ? undefined : (arcs as readonly SdcpnOutputArc[]);
}

function parsePetriLiveTransitionFiring(value: unknown): PetriLiveTransitionFiring | undefined {
  if (!isRecord(value) || typeof value.transitionId !== 'string') return undefined;
  const input = parsePetriLiveMarking(value.input);
  const output = parsePetriLiveMarking(value.output);
  return input === undefined || output === undefined
    ? undefined
    : { transitionId: value.transitionId, input, output };
}

function parsePetriLiveMarking(value: unknown): PetriLiveMarking | undefined {
  if (!isRecord(value)) return undefined;
  const marking: PetriLiveMarking = {};
  for (const [placeId, count] of Object.entries(value)) {
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) return undefined;
    if (count > 0) marking[placeId] = count;
  }
  return marking;
}

export function projectPetriLiveNetDefinition(sdcpnFile: SdcpnFile): PetriLiveNetDefinition {
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
  definition: PetriLiveNetDefinition,
): PetriLiveNetDefinition {
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
): PetriLiveTransitionFiring {
  return {
    transitionId: PETRI_RUN_FINISH_TRANSITION,
    input: {},
    output: { [terminalKind === 'net_completed' ? PETRI_RUN_COMPLETED_PLACE : PETRI_RUN_HALTED_PLACE]: 1 },
  };
}

function transitionEventToFiring(
  event: Extract<ExecutorNetEvent, { readonly kind: 'transition_fired' }>,
  transition: PetriLiveNetDefinition['transitions'][number],
): PetriLiveTransitionFiring {
  return {
    transitionId: event.transitionId,
    input: reduceArcs(transition.inputArcs.filter((arc) => event.consumed.includes(arc.placeId))),
    output: reduceArcs(transition.outputArcs.filter((arc) => event.produced.includes(arc.placeId))),
  };
}

function initialStateFromSdcpn(sdcpnFile: SdcpnFile): PetriLiveMarking {
  const scenario = sdcpnFile.scenarios[0];
  if (!scenario) return {};

  const marking: PetriLiveMarking = {};
  for (const [placeId, count] of Object.entries(scenario.initialState.content)) {
    const parsed = Number.parseInt(count, 10);
    if (Number.isInteger(parsed) && parsed > 0) marking[placeId] = parsed;
  }
  return marking;
}

function reduceArcs(arcs: readonly (SdcpnInputArc | SdcpnOutputArc)[]): PetriLiveMarking {
  const marking: PetriLiveMarking = {};
  for (const arc of arcs) marking[arc.placeId] = (marking[arc.placeId] ?? 0) + arc.weight;
  return marking;
}

function isTerminalEvent(
  event: ExecutorNetEvent,
): event is Extract<ExecutorNetEvent, { readonly kind: 'net_completed' | 'net_halted' | 'net_deadlocked' }> {
  return event.kind === 'net_completed' || event.kind === 'net_halted' || event.kind === 'net_deadlocked';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
