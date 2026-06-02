// ---------------------------------------------------------------------------
// FE-763 follow-up — Petrinaut SDCPN import file from the compiled net.
//
// Petrinaut's only import surface is an SDCPN JSON file: its file-picker reads
// a `.json` and validates it with `parseSDCPNFile`
// (@hashintel/petrinaut-core/src/file-format). This module transforms our
// `net.json` shape (PetrinautNet — see petrinaut-export.ts) into that SDCPN
// file format so a cook run drops straight into the Petrinaut editor.
//
// Pure function: no filesystem side effects. The cook entry point writes the
// result to `<runDir>/net.sdcpn.json`; tests consume the value directly and
// validate it against a mirror of Petrinaut's loader schema.
//
// Fidelity notes (v1):
//   - All places are uncoloured (`colorId: null`); tokens carry no attributes,
//     so the marking collapses to per-place counts.
//   - Guards live only as human-readable strings in net.json and cannot be
//     expressed structurally without inhibitor arcs / coloured tokens, so every
//     transition gets a permissive `predicate` lambda (always enabled) and an
//     empty kernel (uncoloured output places are auto-populated by Petrinaut).
//   - Initial marking maps to a single `per_place` scenario keyed by place ID
//     (Petrinaut's per_place content is keyed by ID, not name).
//   - This is therefore a visualization/import projection, not a lossless
//     executable SDCPN semantics export. Brunch remains the execution authority;
//     Petrinaut uses this file to render topology and replay observed firings.
// ---------------------------------------------------------------------------

import type { PetrinautNet } from './petrinaut-export.js';

/**
 * Petrinaut SDCPN file format version this module targets. This is Petrinaut's
 * loader envelope version, not Brunch's generated-net contract version.
 */
export const SDCPN_FILE_FORMAT_VERSION = 1;

/** Predicate lambda that always enables the transition (presence-gated firing). */
const ALWAYS_ENABLED_LAMBDA = 'export default Lambda(() => true)';
/** Empty kernel — every output place is uncoloured, so none are listed. */
const EMPTY_KERNEL = 'export default TransitionKernel(() => ({}))';

export type SdcpnPlace = {
  id: string;
  name: string;
  colorId: null;
  dynamicsEnabled: false;
  differentialEquationId: null;
};

export type SdcpnInputArc = { placeId: string; weight: number; type: 'standard' | 'inhibitor' };
export type SdcpnOutputArc = { placeId: string; weight: number };

export type SdcpnTransition = {
  id: string;
  name: string;
  inputArcs: SdcpnInputArc[];
  outputArcs: SdcpnOutputArc[];
  lambdaType: 'predicate' | 'stochastic';
  lambdaCode: string;
  transitionKernelCode: string;
};

export type SdcpnScenario = {
  id: string;
  name: string;
  scenarioParameters: never[];
  parameterOverrides: Record<string, string>;
  initialState: { type: 'per_place'; content: Record<string, string> };
};

export type SdcpnFile = {
  version: number;
  /** generatorVersion carries Brunch's exported-net schema version. */
  meta: { generator: string; generatorVersion?: string };
  title: string;
  places: SdcpnPlace[];
  transitions: SdcpnTransition[];
  types: never[];
  differentialEquations: never[];
  parameters: never[];
  scenarios: SdcpnScenario[];
  metrics: never[];
};

export type ToSdcpnFileOpts = {
  /** Display title for the imported net. Defaults to `Cook run <runId>`. */
  title?: string;
};

/**
 * Transform a PetrinautNet (`net.json`) into a Petrinaut SDCPN import file.
 */
export function toSdcpnFile(net: PetrinautNet, opts: ToSdcpnFileOpts): SdcpnFile {
  const nameAllocator = createNameAllocator();

  const places: SdcpnPlace[] = net.places.map((p) => ({
    id: p.id,
    name: nameAllocator(p.id),
    colorId: null,
    dynamicsEnabled: false,
    differentialEquationId: null,
  }));

  const transitions: SdcpnTransition[] = net.transitions.map((t) => ({
    id: t.id,
    name: t.label,
    inputArcs: t.inputs.map((placeId) => ({ placeId, weight: 1, type: 'standard' as const })),
    outputArcs: t.outputs.map((placeId) => ({ placeId, weight: 1 })),
    lambdaType: 'predicate',
    lambdaCode: ALWAYS_ENABLED_LAMBDA,
    transitionKernelCode: EMPTY_KERNEL,
  }));

  const scenarios = toScenarios(net);

  return {
    version: SDCPN_FILE_FORMAT_VERSION,
    // Keep the two version axes distinct:
    // - `version` is Petrinaut's SDCPN file-format version.
    // - `meta.generatorVersion` is the Brunch `PetrinautNet.schemaVersion`.
    meta: { generator: 'brunch', generatorVersion: net.schemaVersion },
    title: opts.title ?? `Cook run ${net.runId}`,
    places,
    transitions,
    types: [],
    differentialEquations: [],
    parameters: [],
    scenarios,
    metrics: [],
  };
}

/** Map the initial marking to a single per_place scenario, or none if empty. */
function toScenarios(net: PetrinautNet): SdcpnScenario[] {
  if (net.initialMarking.length === 0) return [];

  const content: Record<string, string> = {};
  for (const { place, tokens } of net.initialMarking) {
    content[place] = String(tokens.length);
  }

  return [
    {
      id: 'scenario__initial-marking',
      name: 'Initial marking',
      scenarioParameters: [],
      parameterOverrides: {},
      initialState: { type: 'per_place', content },
    },
  ];
}

/**
 * Allocate unique PascalCase names. Petrinaut place names must match
 * `^[A-Z][a-zA-Z]*\d*$` (letters, optional trailing digits — no interior
 * digits or separators). We derive a letters-only base from the place id and
 * append a numeric suffix only to break collisions (keeping it valid).
 */
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
