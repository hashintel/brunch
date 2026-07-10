import type { ExecutorTopology } from '../orchestrate-topology.js';

export const SDCPN_FILE_FORMAT_VERSION = 1;

const ALWAYS_ENABLED_LAMBDA = 'export default Lambda(() => true)';
const EMPTY_KERNEL = 'export default TransitionKernel(() => ({}))';

export interface SdcpnPlace {
  readonly id: string;
  readonly name: string;
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
  readonly types: readonly never[];
  readonly differentialEquations: readonly never[];
  readonly parameters: readonly never[];
  readonly scenarios: readonly SdcpnScenario[];
  readonly metrics: readonly never[];
}

export function petriTopologyToSdcpnFile(args: {
  readonly runId: string;
  readonly topology: ExecutorTopology;
  readonly title?: string;
}): SdcpnFile {
  const allocateName = createNameAllocator();
  return {
    version: SDCPN_FILE_FORMAT_VERSION,
    meta: { generator: 'brunch', generatorVersion: 'executor-topology-v1' },
    title: args.title ?? `Executor run ${args.runId}`,
    places: args.topology.places.map((place) => ({
      id: place.id,
      name: allocateName(place.id),
      colorId: null,
      dynamicsEnabled: false,
      differentialEquationId: null,
    })),
    transitions: args.topology.transitions.map((transition) => ({
      id: transition.id,
      name: transition.id,
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

function createNameAllocator(): (id: string) => string {
  const used = new Set<string>();
  return (id: string) => {
    const base = pascalCaseLetters(id) || 'Place';
    let name = base;
    let n = 1;
    while (used.has(name)) {
      n += 1;
      name = `${base}${n}`;
    }
    used.add(name);
    return name;
  };
}

function pascalCaseLetters(source: string): string {
  return source
    .split(/[^A-Za-z]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}
