export interface ReferencePetriNet {
  readonly places: readonly {
    readonly id: string;
    readonly initialTokens: number;
  }[];
  readonly transitions: readonly {
    readonly id: string;
  }[];
  readonly arcs: readonly {
    readonly source: string;
    readonly target: string;
    readonly weight: number;
  }[];
}

export type ReferenceMarking = Readonly<Record<string, number>>;

export interface ReferenceFireResult {
  readonly fired: boolean;
  readonly marking: ReferenceMarking;
}

interface CompiledReferenceNet {
  readonly placeIds: ReadonlySet<string>;
  readonly transitionIds: readonly string[];
  readonly inputArcs: ReadonlyMap<string, readonly ReferencePetriNet['arcs'][number][]>;
  readonly outputArcs: ReadonlyMap<string, readonly ReferencePetriNet['arcs'][number][]>;
}

export function createInitialMarking(net: ReferencePetriNet): ReferenceMarking {
  compile(net);
  return Object.fromEntries(net.places.map((place) => [place.id, place.initialTokens]));
}

export function enabledTransitionIds(net: ReferencePetriNet, marking: ReferenceMarking): readonly string[] {
  const compiled = compile(net);
  validateMarking(compiled.placeIds, marking);
  return compiled.transitionIds.filter((transitionId) =>
    (compiled.inputArcs.get(transitionId) ?? []).every((arc) => marking[arc.source]! >= arc.weight),
  );
}

export function fireTransition(
  net: ReferencePetriNet,
  marking: ReferenceMarking,
  transitionId: string,
): ReferenceFireResult {
  const compiled = compile(net);
  validateMarking(compiled.placeIds, marking);
  if (!compiled.transitionIds.includes(transitionId)) {
    throw new Error(`unknown transition: ${transitionId}`);
  }

  const inputs = compiled.inputArcs.get(transitionId) ?? [];
  if (inputs.some((arc) => marking[arc.source]! < arc.weight)) {
    return { fired: false, marking: { ...marking } };
  }

  const next: Record<string, number> = { ...marking };
  for (const arc of inputs) next[arc.source] = next[arc.source]! - arc.weight;
  for (const arc of compiled.outputArcs.get(transitionId) ?? []) {
    next[arc.target] = next[arc.target]! + arc.weight;
  }
  return { fired: true, marking: next };
}

export function resetMarking(net: ReferencePetriNet, currentMarking: ReferenceMarking): ReferenceMarking {
  const compiled = compile(net);
  validateMarking(compiled.placeIds, currentMarking);
  return Object.fromEntries(net.places.map((place) => [place.id, place.initialTokens]));
}

function compile(net: ReferencePetriNet): CompiledReferenceNet {
  const placeIds = new Set<string>();
  for (const place of net.places) {
    if (!nonempty(place.id) || placeIds.has(place.id))
      throw new Error('place ids must be unique and non-empty');
    if (!nonnegativeInteger(place.initialTokens)) {
      throw new Error(`place ${place.id} initial tokens must be a non-negative integer`);
    }
    placeIds.add(place.id);
  }

  const transitionIds: string[] = [];
  const transitionIdSet = new Set<string>();
  for (const transition of net.transitions) {
    if (!nonempty(transition.id) || transitionIdSet.has(transition.id) || placeIds.has(transition.id)) {
      throw new Error('node ids must be unique and non-empty');
    }
    transitionIds.push(transition.id);
    transitionIdSet.add(transition.id);
  }

  const inputArcs = new Map<string, ReferencePetriNet['arcs'][number][]>();
  const outputArcs = new Map<string, ReferencePetriNet['arcs'][number][]>();
  const arcPairs = new Set<string>();
  for (const arc of net.arcs) {
    if (!positiveInteger(arc.weight)) throw new Error('arc weights must be positive integers');
    const input = placeIds.has(arc.source) && transitionIdSet.has(arc.target);
    const output = transitionIdSet.has(arc.source) && placeIds.has(arc.target);
    if (!input && !output) {
      throw new Error('every arc must connect opposite existing endpoint types');
    }
    const pair = `${arc.source}\u0000${arc.target}`;
    if (arcPairs.has(pair)) throw new Error('duplicate arcs are not supported by the reference model');
    arcPairs.add(pair);
    const owner = input ? inputArcs : outputArcs;
    const transitionId = input ? arc.target : arc.source;
    const selected = owner.get(transitionId) ?? [];
    selected.push(arc);
    owner.set(transitionId, selected);
  }

  return { placeIds, transitionIds, inputArcs, outputArcs };
}

function validateMarking(placeIds: ReadonlySet<string>, marking: ReferenceMarking): void {
  const markingIds = Object.keys(marking);
  if (
    markingIds.length !== placeIds.size ||
    markingIds.some((id) => !placeIds.has(id) || !nonnegativeInteger(marking[id]))
  ) {
    throw new Error('marking must assign one non-negative integer to every place');
  }
}

function nonempty(value: string): boolean {
  return value.trim().length > 0;
}

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
