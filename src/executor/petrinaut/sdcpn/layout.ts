import type { ExecutorSubnet } from '../../orchestrate-topology.js';
import { compareNaturalIds } from '../id-order.js';

// Petrinaut stores centers. The production default mirrors its classic nodes;
// spacing is derived from whichever rendered bounds the caller supplies.
const X_ORIGIN = 100;
const Y_ORIGIN = 100;
const LANE_PADDING = 80;
const LANE_GAP = 80;

export interface SdcpnNodeDimensions {
  readonly place: { readonly width: number; readonly height: number };
  readonly transition: { readonly width: number; readonly height: number };
  readonly clearance: number;
}

export const PETRINAUT_CLASSIC_NODE_DIMENSIONS: SdcpnNodeDimensions = {
  place: { width: 130, height: 130 },
  transition: { width: 160, height: 80 },
  clearance: 24,
};

export interface SdcpnProjectionLayout {
  readonly sliceIds: readonly string[];
  readonly epicIds: readonly string[];
  readonly maxCycle: number;
  readonly maxAttempt: number;
}

export interface SdcpnPositionCandidate {
  readonly kind: 'place' | 'transition';
  readonly id: string;
  readonly subnet: ExecutorSubnet | undefined;
}

interface PositionedCandidate extends SdcpnPositionCandidate {
  readonly phase: number;
  readonly lane: string;
}

export function createSdcpnProjectionLayout(
  sliceIds: readonly string[],
  epicIds: readonly string[],
  candidates: readonly SdcpnPositionCandidate[],
): SdcpnProjectionLayout {
  return {
    sliceIds,
    epicIds,
    maxCycle: Math.max(1, ...candidates.map(({ id }) => cycleNumber(id))),
    maxAttempt: Math.max(1, ...candidates.map(({ id }) => attemptNumber(id))),
  };
}

export function allocateSdcpnNodePositions(
  candidates: readonly SdcpnPositionCandidate[],
  layout: SdcpnProjectionLayout,
  dimensions: SdcpnNodeDimensions,
): ReadonlyMap<string, { readonly x: number; readonly y: number }> {
  assertNodeDimensions(dimensions);
  const nodeGap =
    Math.max(
      dimensions.place.width,
      dimensions.place.height,
      dimensions.transition.width,
      dimensions.transition.height,
    ) + dimensions.clearance;
  const positioned = candidates.map(
    (candidate): PositionedCandidate => ({
      ...candidate,
      phase: nodePhase(candidate, layout),
      lane: nodeLane(candidate.subnet),
    }),
  );
  const laneCenters = allocateLaneCenters(positioned, layout, dimensions, nodeGap);
  const groups = groupBy(positioned, ({ lane, phase }) => `${lane}\0${phase}`);
  const positions = new Map<string, { readonly x: number; readonly y: number }>();

  for (const group of groups.values()) {
    group.sort(
      (left, right) => compareNaturalIds(left.id, right.id) || compareNaturalIds(left.kind, right.kind),
    );
    const centerY = laneCenters.get(group[0]!.lane)!;
    for (const [index, candidate] of group.entries()) {
      positions.set(nodePositionKey(candidate.kind, candidate.id), {
        x: X_ORIGIN + candidate.phase * nodeGap,
        y: centerY + (index - (group.length - 1) / 2) * nodeGap,
      });
    }
  }

  return positions;
}

function allocateLaneCenters(
  candidates: readonly PositionedCandidate[],
  layout: SdcpnProjectionLayout,
  dimensions: SdcpnNodeDimensions,
  verticalGap: number,
): ReadonlyMap<string, number> {
  const laneOrder = [
    'run',
    ...layout.sliceIds.map((sliceId) => `slice:${sliceId}`),
    ...layout.epicIds.map((epicId) => `epic:${epicId}`),
  ];
  const candidatesByLane = groupBy(candidates, ({ lane }) => lane);
  const laneHeights = new Map<string, number>();

  for (const lane of laneOrder) {
    const groups = groupBy(candidatesByLane.get(lane) ?? [], ({ phase }) => phase);
    const maxStack = Math.max(1, ...[...groups.values()].map((group) => group.length));
    laneHeights.set(
      lane,
      Math.max(dimensions.place.height, dimensions.transition.height) +
        (maxStack - 1) * verticalGap +
        LANE_PADDING * 2,
    );
  }

  const centers = new Map<string, number>();
  let previousLane: string | undefined;
  for (const lane of laneOrder) {
    const height = laneHeights.get(lane)!;
    const center =
      previousLane === undefined
        ? Y_ORIGIN
        : centers.get(previousLane)! + laneHeights.get(previousLane)! / 2 + LANE_GAP + height / 2;
    centers.set(lane, center);
    previousLane = lane;
  }
  return centers;
}

function nodeLane(subnet: ExecutorSubnet | undefined): string {
  if (subnet?.sliceId) return `slice:${subnet.sliceId}`;
  if (subnet?.epicId) return `epic:${subnet.epicId}`;
  return 'run';
}

function nodePhase(candidate: SdcpnPositionCandidate, layout: SdcpnProjectionLayout): number {
  const { id } = candidate;
  const runPrefixPhases: Readonly<Record<string, number>> = {
    'run:created': 0,
    worktree_create: 1,
    'run:worktree_created': 2,
    populate: 3,
    'run:worktree_populated': 4,
    source_policy: 5,
    'run:source_policy_selected': 6,
    source_copy: 7,
    'run:source_copied': 8,
    report_init: 9,
    'run:slice_frontier': 10,
  };
  const runPrefix = runPrefixPhases[id];
  if (runPrefix !== undefined) return runPrefix;

  if (/:(?:dependency|epic_dependency):/u.test(id) || id.endsWith(':claim')) return 10;
  if (id.startsWith('slice_start:')) return 11;
  if (id.endsWith(':started')) return 12;
  if (id.startsWith('slice_execute:')) return 13;

  const cycle = cycleNumber(id);
  const cyclePhaseCount = layout.maxAttempt * 4 + 6;
  const cycleBase = 14 + (cycle - 1) * cyclePhaseCount;
  const attempt = attemptNumber(id);
  if (id.includes(':agent_attempt:')) return cycleBase + (attempt - 1) * 2;
  if (id.startsWith('agent_result:') || id.startsWith('agent_retry:')) {
    return cycleBase + (attempt - 1) * 2 + 1;
  }
  if (id.startsWith('agent_exhausted:')) return cycleBase + layout.maxAttempt * 2 - 1;
  if (id.includes(':agent_attempts_exhausted')) return cycleBase + layout.maxAttempt * 2;
  if (id.startsWith('agent_reset:')) return cycleBase + layout.maxAttempt * 2 + 1;
  const verifyBase = cycleBase + layout.maxAttempt * 2 + 2;
  if (id.includes(':verify_attempt:')) return verifyBase + (attempt - 1) * 2;
  if (id.startsWith('test_result_ingested:') || id.startsWith('verify_retry:')) {
    return verifyBase + (attempt - 1) * 2 + 1;
  }
  if (id.includes(':verify_result:')) return verifyBase + (attempt - 1) * 2 + 2;
  if (id.startsWith('verify_passed:') || id.startsWith('verify_failed:')) {
    return verifyBase + (attempt - 1) * 2 + 3;
  }
  if (id.startsWith('verify_exhausted:')) return verifyBase + layout.maxAttempt * 2 - 1;
  if (id.includes(':verify_attempts_exhausted')) return verifyBase + layout.maxAttempt * 2;
  if (id.startsWith('verify_reset:')) return verifyBase + layout.maxAttempt * 2 + 1;
  if (/:verification_(?:passed|failed)$/u.test(id)) return verifyBase + layout.maxAttempt * 2 + 2;
  if (id.startsWith('slice_integrate:') || id.startsWith('verify_repair:')) {
    return verifyBase + layout.maxAttempt * 2 + 3;
  }

  const finalCycleEnd = 14 + layout.maxCycle * cyclePhaseCount;
  if (id.endsWith(':integrated') && id.startsWith('slice:')) return finalCycleEnd;
  if (id.startsWith('slice_complete:')) return finalCycleEnd + 1;
  if (id.startsWith('epic:') && id.includes(':member:')) return finalCycleEnd + 2;
  if (id.startsWith('epic_integrate:')) return finalCycleEnd + 3;
  if (/^epic:.+:integrated$/u.test(id)) return finalCycleEnd + 4;
  if (id.startsWith('epic_verify:')) return finalCycleEnd + 5;
  if (/^epic:.+:verified$/u.test(id)) return finalCycleEnd + 6;
  if (id.startsWith('epic_complete:')) return finalCycleEnd + 7;
  if (/^epic:.+:completed$/u.test(id)) return finalCycleEnd + 8;
  if (id === 'run_complete') return finalCycleEnd + 9;
  if (id === 'run:run_completed') return finalCycleEnd + 10;
  if (id === 'petri_export') return finalCycleEnd + 11;
  if (id === 'run:petri_exported') return finalCycleEnd + 12;
  if (id === 'promotion') return finalCycleEnd + 13;
  if (id === 'run:promotion_prepared') return finalCycleEnd + 14;
  if (candidate.kind === 'place') return finalCycleEnd + 15;
  throw new Error(`Unknown Petrinaut layout node role: ${id}`);
}

function cycleNumber(id: string): number {
  const match = /:cycle:(\d+)/u.exec(id);
  return match ? Number(match[1]) : 1;
}

function attemptNumber(id: string): number {
  const match = /:attempt:(\d+)$/u.exec(id);
  return match ? Number(match[1]) : 1;
}

function nodePositionKey(kind: SdcpnPositionCandidate['kind'], id: string): string {
  return `${kind}:${id}`;
}

function assertNodeDimensions(dimensions: SdcpnNodeDimensions): void {
  const positive = [
    dimensions.place.width,
    dimensions.place.height,
    dimensions.transition.width,
    dimensions.transition.height,
  ].every((value) => Number.isFinite(value) && value > 0);
  if (!positive || !Number.isFinite(dimensions.clearance) || dimensions.clearance < 0) {
    throw new Error('Invalid Petrinaut node dimensions');
  }
}

function groupBy<Value, Key>(
  values: readonly Value[],
  keyFor: (value: Value) => Key,
): ReadonlyMap<Key, Value[]> {
  const groups = new Map<Key, Value[]>();
  for (const value of values) {
    const key = keyFor(value);
    const group = groups.get(key);
    if (group) group.push(value);
    else groups.set(key, [value]);
  }
  return groups;
}
