import type { ExecutorNetEvent } from './orchestrate-topology.js';
import type { PetriProjection } from './petri-projection.js';

export type { PetriProjection } from './petri-projection.js';

export type ReplayArc = { readonly placeId: string; readonly weight: number };

export type ReplayTransition = {
  readonly id: string;
  readonly inputArcs: readonly ReplayArc[];
  readonly outputArcs: readonly ReplayArc[];
};

export type ReplayNet = {
  readonly transitions: readonly ReplayTransition[];
  readonly initialMarking: Record<string, number>;
};

export function replayPetri(args: {
  readonly net: unknown;
  readonly events: readonly ExecutorNetEvent[];
}): PetriProjection | undefined {
  const net = asReplayNet(args.net);
  if (!net) return undefined;

  const transitionIds: string[] = [];
  let sawTerminalEvent = false;
  let terminalSummary: Pick<PetriProjection, 'terminalEventKind' | 'haltedReason'> | undefined | null;

  for (const event of args.events) {
    switch (event.kind) {
      case 'transition_fired':
        transitionIds.push(event.transitionId);
        if (sawTerminalEvent) terminalSummary = null;
        break;
      case 'net_completed':
      case 'net_halted':
      case 'net_deadlocked':
        sawTerminalEvent = true;
        terminalSummary = mergeTerminalSummary(terminalSummary, event);
        break;
    }
  }

  const replay = replayTransitionHistory(net, transitionIds);
  if (!replay) return undefined;

  return {
    currentMarking: replay.currentMarking,
    firedTransitionCount: replay.firedTransitionCount,
    ...terminalSummary,
  };
}

function mergeTerminalSummary(
  current: Pick<PetriProjection, 'terminalEventKind' | 'haltedReason'> | undefined | null,
  event: Extract<ExecutorNetEvent, { readonly kind: 'net_completed' | 'net_halted' | 'net_deadlocked' }>,
): Pick<PetriProjection, 'terminalEventKind' | 'haltedReason'> | undefined | null {
  const next =
    event.kind === 'net_halted'
      ? typeof event.reason === 'string'
        ? { terminalEventKind: 'net_halted' as const, haltedReason: event.reason }
        : undefined
      : { terminalEventKind: event.kind };
  if (current === null) return null;
  if (next === undefined) return null;
  if (current === undefined) return next;
  return current.terminalEventKind === next.terminalEventKind && current.haltedReason === next.haltedReason
    ? current
    : null;
}

export function replayTransitionHistory(
  net: ReplayNet,
  transitionIds: readonly string[],
): { readonly currentMarking: Record<string, number>; readonly firedTransitionCount: number } | undefined {
  const transitions = new Map(net.transitions.map((transition) => [transition.id, transition]));
  const currentMarking = { ...net.initialMarking };
  let firedTransitionCount = 0;
  for (const transitionId of transitionIds) {
    const transition = transitions.get(transitionId);
    if (!transition) return undefined;
    for (const arc of transition.inputArcs) {
      const count = currentMarking[arc.placeId] ?? 0;
      if (count < arc.weight) return undefined;
      const next = count - arc.weight;
      if (next === 0) delete currentMarking[arc.placeId];
      else currentMarking[arc.placeId] = next;
    }
    for (const arc of transition.outputArcs) {
      currentMarking[arc.placeId] = (currentMarking[arc.placeId] ?? 0) + arc.weight;
    }
    firedTransitionCount += 1;
  }
  return { currentMarking, firedTransitionCount };
}

function asReplayNet(value: unknown): ReplayNet | undefined {
  if (!isRecord(value) || !isRecord(value.initialMarking) || !Array.isArray(value.transitions))
    return undefined;
  const transitions: ReplayTransition[] = [];
  for (const transition of value.transitions) {
    if (!isRecord(transition) || typeof transition.id !== 'string') return undefined;
    const inputArcs = asReplayArcs(transition.inputArcs);
    const outputArcs = asReplayArcs(transition.outputArcs);
    if (!inputArcs || !outputArcs) return undefined;
    transitions.push({ id: transition.id, inputArcs, outputArcs });
  }

  const initialMarking: Record<string, number> = {};
  for (const [placeId, count] of Object.entries(value.initialMarking)) {
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) return undefined;
    if (count > 0) initialMarking[placeId] = count;
  }
  return { transitions, initialMarking };
}

function asReplayArcs(value: unknown): readonly ReplayArc[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const arcs: ReplayArc[] = [];
  for (const arc of value) {
    if (!isRecord(arc) || typeof arc.placeId !== 'string' || typeof arc.weight !== 'number') return undefined;
    if (!Number.isInteger(arc.weight) || arc.weight <= 0) return undefined;
    arcs.push({ placeId: arc.placeId, weight: arc.weight });
  }
  return arcs;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
