import type {
  ExecutorPlace,
  ExecutorSubnet,
  ExecutorTopology,
  ExecutorTransition,
} from '../orchestrate-topology.js';
import { compareNaturalIds } from './id-order.js';

export const SDCPN_FILE_FORMAT_VERSION = 1;

const ALWAYS_ENABLED_LAMBDA = 'export default Lambda(() => true)';
const EMPTY_KERNEL = 'export default TransitionKernel(() => ({}))';

export interface SdcpnPlace {
  readonly id: string;
  readonly name: string;
  readonly x?: number;
  readonly y?: number;
  readonly colorId: null;
  readonly dynamicsEnabled: false;
  readonly differentialEquationId: null;
}

export interface SdcpnInputArc {
  readonly placeId: string;
  readonly weight: number;
  readonly type: 'standard' | 'inhibitor';
}

export interface SdcpnOutputArc {
  readonly placeId: string;
  readonly weight: number;
}

export interface SdcpnTransition {
  readonly id: string;
  readonly name: string;
  readonly x?: number;
  readonly y?: number;
  readonly inputArcs: readonly SdcpnInputArc[];
  readonly outputArcs: readonly SdcpnOutputArc[];
  readonly lambdaType: 'predicate' | 'stochastic';
  readonly lambdaCode: string;
  readonly transitionKernelCode: string;
}

export interface SdcpnScenario {
  readonly id: string;
  readonly name: string;
  readonly scenarioParameters: readonly never[];
  readonly parameterOverrides: Record<string, string>;
  readonly initialState: { readonly type: 'per_place'; readonly content: Record<string, string> };
}

export interface SdcpnFile {
  readonly version: number;
  readonly meta: { readonly generator: string; readonly generatorVersion?: string };
  readonly title: string;
  readonly places: readonly SdcpnPlace[];
  readonly transitions: readonly SdcpnTransition[];
  readonly types: readonly unknown[];
  readonly differentialEquations: readonly unknown[];
  readonly parameters: readonly unknown[];
  readonly scenarios: readonly SdcpnScenario[];
  readonly metrics: readonly unknown[];
}

export function parseSdcpnFile(value: unknown): SdcpnFile | undefined {
  if (!isRecord(value) || !isPositiveInteger(value.version) || !isNonEmptyString(value.title))
    return undefined;
  if (!isRecord(value.meta) || !isNonEmptyString(value.meta.generator)) return undefined;
  if (value.meta.generatorVersion !== undefined && typeof value.meta.generatorVersion !== 'string') {
    return undefined;
  }
  if (
    !Array.isArray(value.places) ||
    !Array.isArray(value.transitions) ||
    !Array.isArray(value.types) ||
    !Array.isArray(value.differentialEquations) ||
    !Array.isArray(value.parameters) ||
    !Array.isArray(value.scenarios) ||
    !Array.isArray(value.metrics)
  ) {
    return undefined;
  }
  const placeIds = new Set<string>();
  for (const place of value.places) {
    if (
      !isRecord(place) ||
      !isNonEmptyString(place.id) ||
      !isNonEmptyString(place.name) ||
      !isOptionalFiniteNumber(place.x) ||
      !isOptionalFiniteNumber(place.y) ||
      place.colorId !== null ||
      place.dynamicsEnabled !== false ||
      place.differentialEquationId !== null ||
      placeIds.has(place.id)
    ) {
      return undefined;
    }
    placeIds.add(place.id);
  }

  const transitionIds = new Set<string>();
  for (const transition of value.transitions) {
    if (
      !isRecord(transition) ||
      !isNonEmptyString(transition.id) ||
      !isNonEmptyString(transition.name) ||
      !isOptionalFiniteNumber(transition.x) ||
      !isOptionalFiniteNumber(transition.y) ||
      transitionIds.has(transition.id) ||
      !Array.isArray(transition.inputArcs) ||
      !Array.isArray(transition.outputArcs) ||
      (transition.lambdaType !== 'predicate' && transition.lambdaType !== 'stochastic') ||
      typeof transition.lambdaCode !== 'string' ||
      typeof transition.transitionKernelCode !== 'string'
    ) {
      return undefined;
    }
    transitionIds.add(transition.id);
    for (const arc of transition.inputArcs) {
      if (
        !isRecord(arc) ||
        typeof arc.placeId !== 'string' ||
        !placeIds.has(arc.placeId) ||
        !isPositiveInteger(arc.weight) ||
        (arc.type !== 'standard' && arc.type !== 'inhibitor')
      ) {
        return undefined;
      }
    }
    for (const arc of transition.outputArcs) {
      if (
        !isRecord(arc) ||
        typeof arc.placeId !== 'string' ||
        !placeIds.has(arc.placeId) ||
        !isPositiveInteger(arc.weight)
      ) {
        return undefined;
      }
    }
  }

  for (const scenario of value.scenarios) {
    if (
      !isRecord(scenario) ||
      !isNonEmptyString(scenario.id) ||
      !isNonEmptyString(scenario.name) ||
      !Array.isArray(scenario.scenarioParameters) ||
      scenario.scenarioParameters.length > 0 ||
      !isStringRecord(scenario.parameterOverrides) ||
      !isRecord(scenario.initialState) ||
      scenario.initialState.type !== 'per_place' ||
      !isStringRecord(scenario.initialState.content)
    ) {
      return undefined;
    }
    for (const [placeId, count] of Object.entries(scenario.initialState.content)) {
      if (!placeIds.has(placeId) || !/^[0-9]+$/u.test(count)) return undefined;
    }
  }

  return value as unknown as SdcpnFile;
}

export function petriTopologyToSdcpnFile(args: {
  readonly runId: string;
  readonly topology: ExecutorTopology;
  readonly title?: string;
}): SdcpnFile {
  const subnets = new Map(args.topology.subnets.map((subnet) => [subnet.id, subnet]));
  const sliceIds = args.topology.subnets
    .flatMap((subnet) => (subnet.kind === 'slice_control' && subnet.sliceId ? [subnet.sliceId] : []))
    .sort(compareNaturalIds);
  const epicIds = args.topology.subnets
    .flatMap((subnet) => (subnet.kind === 'epic_control' && subnet.epicId ? [subnet.epicId] : []))
    .sort(compareNaturalIds);
  const layout = { sliceIds, epicIds };
  const incidentPlaceIds = new Set(
    args.topology.transitions.flatMap((transition) =>
      [...transition.inputArcs, ...transition.outputArcs].map((arc) => arc.placeId),
    ),
  );
  const projectedPlaces = args.topology.places.filter(
    (place) => incidentPlaceIds.has(place.id) || (args.topology.initialMarking[place.id] ?? 0) > 0,
  );
  // ceiling: full per-slice attempt identity stays expanded; adopt standardized subnet grouping/folding
  // above roughly 12 slices rather than claiming color-fold parity.
  const positions = allocateNodePositions(
    projectedPlaces.map((place) => ({
      kind: 'place' as const,
      id: place.id,
      subnet: subnets.get(place.subnetId),
    })),
    args.topology.transitions.map((transition) => ({
      kind: 'transition' as const,
      id: transition.id,
      subnet: subnets.get(transition.subnetId),
    })),
    layout,
  );
  return {
    version: SDCPN_FILE_FORMAT_VERSION,
    meta: { generator: 'brunch', generatorVersion: 'executor-topology-v1' },
    title: args.title ?? `Executor run ${args.runId}`,
    places: projectedPlaces.map((place) => ({
      id: place.id,
      name: placeProjectionName(place, subnets.get(place.subnetId)),
      ...positions.get(nodePositionKey('place', place.id))!,
      colorId: null,
      dynamicsEnabled: false,
      differentialEquationId: null,
    })),
    transitions: args.topology.transitions.map((transition) => ({
      id: transition.id,
      name: transitionProjectionName(transition, subnets.get(transition.subnetId)),
      ...positions.get(nodePositionKey('transition', transition.id))!,
      inputArcs: transition.inputArcs.map((arc) => ({
        placeId: arc.placeId,
        weight: arc.weight,
        type: 'standard' as const,
      })),
      outputArcs: transition.outputArcs.map((arc) => ({ placeId: arc.placeId, weight: arc.weight })),
      lambdaType: 'predicate',
      lambdaCode: ALWAYS_ENABLED_LAMBDA,
      transitionKernelCode: EMPTY_KERNEL,
    })),
    types: [],
    differentialEquations: [],
    parameters: [],
    scenarios: initialMarkingScenarios(args.topology.initialMarking),
    metrics: [],
  };
}

function initialMarkingScenarios(initialMarking: Record<string, number>): readonly SdcpnScenario[] {
  const content = Object.fromEntries(
    Object.entries(initialMarking)
      .filter(([, count]) => count > 0)
      .map(([placeId, count]) => [placeId, String(count)]),
  );
  return Object.keys(content).length === 0
    ? []
    : [
        {
          id: 'scenario__initial-marking',
          name: 'Initial marking',
          scenarioParameters: [],
          parameterOverrides: {},
          initialState: { type: 'per_place', content },
        },
      ];
}

interface ProjectionLayout {
  readonly sliceIds: readonly string[];
  readonly epicIds: readonly string[];
}

function placeProjectionName(place: ExecutorPlace, subnet: ExecutorSubnet | undefined): string {
  if (subnet?.kind === 'slice_control' && subnet.sliceId) {
    const dependency = /:(?:dependency|epic_dependency):(.+)$/u.exec(place.id)?.[1];
    return `${subnet.sliceId} · ${place.name}${dependency ? ` ${dependency}` : ''}`;
  }
  if (subnet?.kind === 'attempt_control' && subnet.sliceId) {
    return `${subnet.sliceId} · ${sentenceCase(place.name)}`;
  }
  if (subnet?.kind === 'epic_control' && subnet.epicId) {
    const member = /:member:(.+)$/u.exec(place.id)?.[1];
    return `${subnet.epicId} · ${place.name}${member ? ` ${member}` : ''}`;
  }
  return `Run · ${place.name}`;
}

function transitionProjectionName(
  transition: ExecutorTransition,
  subnet: ExecutorSubnet | undefined,
): string {
  const action = transitionActionName(transition.id);
  if (subnet?.kind === 'slice_control' && subnet.sliceId) return `${subnet.sliceId} · ${action}`;
  if (subnet?.kind === 'attempt_control' && subnet.sliceId) return `${subnet.sliceId} · ${action}`;
  if (subnet?.kind === 'epic_control' && subnet.epicId) return `${subnet.epicId} · ${action}`;
  return `Run · ${action}`;
}

function transitionActionName(id: string): string {
  const [kind, identity, qualifier, attempt] = id.split(':');
  const attemptNumber = attempt ?? (qualifier && /^\d+$/u.test(qualifier) ? qualifier : undefined);
  const labels: Record<string, string> = {
    slice_start: 'Start slice',
    slice_execute: 'Execute slice',
    slice_integrate: 'Integrate slice',
    slice_complete: 'Complete slice',
    agent_result: 'Agent result',
    agent_retry: 'Retry agent',
    agent_exhausted: 'Agent attempts exhausted',
    agent_reset: 'Reset agent attempts',
    test_result_ingested: 'Ingest verification result',
    verify_passed: 'Verification passed',
    verify_failed: 'Verification failed',
    verify_retry: 'Retry verification',
    verify_exhausted: 'Verification attempts exhausted',
    verify_reset: 'Reset verification attempts',
    epic_integrate: 'Integrate epic',
    epic_verify: 'Verify epic',
    epic_complete: 'Complete epic',
  };
  const label = labels[kind ?? ''] ?? sentenceCase(kind ?? id);
  return attemptNumber && identity ? `${label} · attempt ${attemptNumber}` : label;
}

function nodePosition(
  id: string,
  subnet: ExecutorSubnet | undefined,
  layout: ProjectionLayout,
): { readonly x: number; readonly y: number } {
  return {
    x: phaseColumn(id),
    y: laneRow(subnet, layout),
  };
}

interface PositionCandidate {
  readonly kind: 'place' | 'transition';
  readonly id: string;
  readonly subnet: ExecutorSubnet | undefined;
}

function allocateNodePositions(
  places: readonly PositionCandidate[],
  transitions: readonly PositionCandidate[],
  layout: ProjectionLayout,
): ReadonlyMap<string, { readonly x: number; readonly y: number }> {
  const candidates = [...places, ...transitions]
    .map((node) => ({ ...node, base: nodePosition(node.id, node.subnet, layout) }))
    .sort(
      (left, right) =>
        left.base.y - right.base.y ||
        left.base.x - right.base.x ||
        compareNaturalIds(left.id, right.id) ||
        compareNaturalIds(left.kind, right.kind),
    );
  const positions = new Map<string, { readonly x: number; readonly y: number }>();
  const occupied = new Set<string>();

  for (const candidate of candidates) {
    for (let radius = 0; ; radius += 1) {
      const offsets = compactOffsets(radius);
      const available = offsets.find(
        ({ x, y }) => !occupied.has(`${candidate.base.x + x}/${candidate.base.y + y}`),
      );
      if (!available) continue;
      const position = { x: candidate.base.x + available.x, y: candidate.base.y + available.y };
      occupied.add(`${position.x}/${position.y}`);
      positions.set(nodePositionKey(candidate.kind, candidate.id), position);
      break;
    }
  }

  return positions;
}

function compactOffsets(radius: number): readonly { readonly x: number; readonly y: number }[] {
  if (radius === 0) return [{ x: 0, y: 0 }];
  const spacing = 8;
  const offsets: { x: number; y: number }[] = [];
  for (let x = -radius; x <= radius; x += 1) offsets.push({ x: x * spacing, y: -radius * spacing });
  for (let y = -radius + 1; y <= radius; y += 1) offsets.push({ x: radius * spacing, y: y * spacing });
  for (let x = radius - 1; x >= -radius; x -= 1) offsets.push({ x: x * spacing, y: radius * spacing });
  for (let y = radius - 1; y > -radius; y -= 1) offsets.push({ x: -radius * spacing, y: y * spacing });
  return offsets;
}

function nodePositionKey(kind: PositionCandidate['kind'], id: string): string {
  return `${kind}:${id}`;
}

function laneRow(subnet: ExecutorSubnet | undefined, layout: ProjectionLayout): number {
  if (subnet?.kind === 'slice_control' && subnet.sliceId) return sliceBandY(subnet.sliceId, layout);
  if (subnet?.kind === 'attempt_control' && subnet.sliceId) {
    return sliceBandY(subnet.sliceId, layout) + (subnet.id.endsWith(':agent') ? 80 : 160);
  }
  if (subnet?.kind === 'epic_control' && subnet.epicId) {
    return 400 + layout.sliceIds.length * 320 + layout.epicIds.indexOf(subnet.epicId) * 160;
  }
  return 80;
}

function sliceBandY(sliceId: string, layout: ProjectionLayout): number {
  return 400 + layout.sliceIds.indexOf(sliceId) * 320;
}

function phaseColumn(id: string): number {
  const runColumns: Record<string, number> = {
    'run:created': 80,
    worktree_create: 180,
    'run:worktree_created': 280,
    populate: 380,
    'run:worktree_populated': 480,
    source_policy: 580,
    'run:source_policy_selected': 680,
    source_copy: 780,
    'run:source_copied': 880,
    report_init: 980,
    'run:slice_frontier': 1_080,
    run_complete: 4_000,
    'run:run_completed': 4_100,
    petri_export: 4_200,
    'run:petri_exported': 4_300,
    promotion: 4_400,
    'run:promotion_prepared': 4_500,
  };
  if (runColumns[id] !== undefined) return runColumns[id];
  if (/:(?:dependency|epic_dependency):/u.test(id) || id.endsWith(':claim')) return 1_080;
  if (id.startsWith('slice_start:')) return 1_180;
  if (id.endsWith(':started')) return 1_280;
  if (id.startsWith('slice_execute:')) return 1_380;
  if (id.includes(':agent_attempt:')) return 1_480 + (attemptNumber(id) - 1) * 180;
  if (id.startsWith('agent_retry:')) return 1_570 + (attemptNumber(id) - 1) * 180;
  if (id.startsWith('agent_result:')) return 1_560 + (attemptNumber(id) - 1) * 180;
  if (id.includes(':agent_attempts_exhausted') || id.startsWith('agent_exhausted:')) return 2_020;
  if (id.startsWith('agent_reset:')) return 1_930;
  if (id.includes(':verify_attempt:')) return 2_100 + (attemptNumber(id) - 1) * 180;
  if (id.startsWith('verify_retry:')) return 2_190 + (attemptNumber(id) - 1) * 180;
  if (id.startsWith('test_result_ingested:')) return 2_180 + (attemptNumber(id) - 1) * 180;
  if (id.includes(':verify_result:')) return 2_260 + (attemptNumber(id) - 1) * 180;
  if (id.startsWith('verify_passed:') || id.startsWith('verify_failed:')) {
    return 2_340 + (attemptNumber(id) - 1) * 180;
  }
  if (id.includes(':verify_attempts_exhausted') || id.startsWith('verify_exhausted:')) return 2_740;
  if (id.startsWith('verify_reset:')) return 2_650;
  if (/:verification_(?:passed|failed)$/u.test(id)) return 2_900;
  if (id.startsWith('slice_integrate:')) return 3_000;
  if (/^epic:.+:integrated$/u.test(id)) return 3_520;
  if (/^epic:.+:verified$/u.test(id)) return 3_640;
  if (/^epic:.+:completed$/u.test(id)) return 3_860;
  if (id.endsWith(':integrated')) return 3_100;
  if (id.startsWith('slice_complete:')) return 3_200;
  if (id.startsWith('epic:') && id.includes(':member:')) return 3_300;
  if (id.endsWith(':completed')) return 3_300;
  if (id.startsWith('epic_integrate:')) return 3_400;
  if (id.startsWith('epic_verify:')) return 3_580;
  if (id.startsWith('epic_complete:')) return 3_760;
  return 3_900;
}

function attemptNumber(id: string): number {
  const match = /(?::attempt:|:)(\d+)$/u.exec(id);
  return match ? Number(match[1]) : 1;
}

function sentenceCase(source: string): string {
  const words = source.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isOptionalFiniteNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}
