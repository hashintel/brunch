import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { compileTopology } from './net-compiler.js';
import { serializeBlueprint, type PetrinautNet } from './petrinaut-export.js';
import { SDCPN_FILE_FORMAT_VERSION, toSdcpnFile } from './petrinaut-sdcpn.js';
import type { Plan } from './types.js';

// ---------------------------------------------------------------------------
// Faithful mirror of Petrinaut's `sdcpnFileSchema`
// (@hashintel/petrinaut-core/src/file-format/types.ts +
//  schemas/entity-schemas.ts). This is the round-trip oracle: if a produced
// file validates here, Petrinaut's `parseSDCPNFile` loader accepts it.
//
// Petrinaut is not a brunch dependency, so we re-declare the relevant subset
// rather than import it. Keep this in sync if the upstream loader changes.
// ---------------------------------------------------------------------------

const id = z.string().min(1);
// Place names: PascalCase — start uppercase, letters, optional trailing digits.
const entityName = z
  .string()
  .trim()
  .refine((v) => /^[A-Z][a-zA-Z]*\d*$/.test(v), 'must be PascalCase');
// Transition / scenario names: non-empty after trim.
const displayName = z.string().trim().min(1);

const inputArc = z.strictObject({
  placeId: id,
  weight: z.number().positive(),
  type: z.enum(['standard', 'inhibitor']),
});
const outputArc = z.strictObject({ placeId: id, weight: z.number().positive() });

const place = z.object({
  id,
  name: entityName,
  colorId: id.nullable(),
  dynamicsEnabled: z.boolean(),
  differentialEquationId: id.nullable(),
  x: z.number().optional(),
  y: z.number().optional(),
});

const transition = z.object({
  id,
  name: displayName,
  inputArcs: z.array(inputArc),
  outputArcs: z.array(outputArc),
  lambdaType: z.enum(['predicate', 'stochastic']),
  lambdaCode: z.string(),
  transitionKernelCode: z.string(),
  x: z.number().optional(),
  y: z.number().optional(),
});

const scenario = z.object({
  id,
  name: displayName,
  scenarioParameters: z.array(z.unknown()),
  parameterOverrides: z.record(z.string(), z.string()),
  initialState: z.object({
    type: z.literal('per_place'),
    content: z.record(z.string(), z.union([z.string(), z.array(z.array(z.number()))])),
  }),
});

const sdcpnFileSchema = z.object({
  version: z.number().int().min(1).max(SDCPN_FILE_FORMAT_VERSION),
  meta: z.object({ generator: z.string(), generatorVersion: z.string().optional() }),
  title: z.string(),
  places: z.array(place),
  transitions: z.array(transition),
  types: z.array(z.unknown()),
  differentialEquations: z.array(z.unknown()),
  parameters: z.array(z.unknown()),
  scenarios: z.array(scenario),
  metrics: z.array(z.unknown()),
});

const simplePlan: Plan = {
  epics: [{ id: 'epic-1', summary: 'E', depends_on: [], verification: [] }],
  slices: [
    {
      id: 'slice-1',
      epic_id: 'epic-1',
      definition: 'D',
      depends_on: [],
      verification: [{ kind: 'unit-test', target: 't' }],
    },
  ],
};

const depPlan: Plan = {
  epics: [{ id: 'epic-1', summary: 'E', depends_on: [], verification: [] }],
  slices: [
    {
      id: 'slice-a',
      epic_id: 'epic-1',
      definition: 'A',
      depends_on: [],
      verification: [{ kind: 'unit-test', target: 'ta' }],
    },
    {
      id: 'slice-b',
      epic_id: 'epic-1',
      definition: 'B',
      depends_on: ['slice-a'],
      verification: [{ kind: 'unit-test', target: 'tb' }],
    },
  ],
};

/** Build a real PetrinautNet from a plan (the actual `net.json` shape). */
function realNet(plan: Plan): PetrinautNet {
  return serializeBlueprint(compileTopology(plan, { maxRetries: 3 }), { runId: 'run-1' });
}

describe('toSdcpnFile — envelope', () => {
  it('emits a versioned envelope with brunch generator metadata', () => {
    const file = toSdcpnFile(realNet(simplePlan), {});
    expect(file.version).toBe(SDCPN_FILE_FORMAT_VERSION);
    expect(file.meta.generator).toBe('brunch');
    expect(file.meta.generatorVersion).toBe('0.2.0');
  });

  it('defaults the title to the runId and honours an override', () => {
    expect(toSdcpnFile(realNet(simplePlan), {}).title).toContain('run-1');
    expect(toSdcpnFile(realNet(simplePlan), { title: 'My Net' }).title).toBe('My Net');
  });

  it('includes all SDCPN collections (empty for an uncoloured net)', () => {
    const file = toSdcpnFile(realNet(simplePlan), {});
    expect(file.types).toEqual([]);
    expect(file.differentialEquations).toEqual([]);
    expect(file.parameters).toEqual([]);
    expect(file.metrics).toEqual([]);
  });
});

describe('toSdcpnFile — places', () => {
  it('preserves every place id as an uncoloured place', () => {
    const net = realNet(simplePlan);
    const file = toSdcpnFile(net, {});
    expect(file.places.map((p) => p.id).sort()).toEqual(net.places.map((p) => p.id).sort());
    for (const p of file.places) {
      expect(p.colorId).toBeNull();
      expect(p.dynamicsEnabled).toBe(false);
      expect(p.differentialEquationId).toBeNull();
    }
  });

  it('derives PascalCase names from place ids', () => {
    const net: PetrinautNet = {
      schemaVersion: '0.1.0',
      runId: 'r',
      tokenTypes: [],
      places: [
        { id: 'slice:version-flag:spec-ready', label: 'spec-ready' },
        { id: 'pool:test-agent', label: 'pool:test-agent' },
      ],
      transitions: [],
      initialMarking: [],
    };
    const names = toSdcpnFile(net, {}).places.map((p) => p.name);
    expect(names).toContain('SliceVersionFlagSpecReady');
    expect(names).toContain('PoolTestAgent');
  });

  it('disambiguates place names that collapse to the same PascalCase base', () => {
    const net: PetrinautNet = {
      schemaVersion: '0.1.0',
      runId: 'r',
      tokenTypes: [],
      places: [
        { id: 'slice-1:done', label: 'done' },
        { id: 'slice-2:done', label: 'done' },
      ],
      transitions: [],
      initialMarking: [],
    };
    const names = toSdcpnFile(net, {}).places.map((p) => p.name);
    expect(new Set(names).size).toBe(2);
    for (const n of names) expect(n).toMatch(/^[A-Z][a-zA-Z]*\d*$/);
  });
});

describe('toSdcpnFile — transitions', () => {
  it('wraps inputs/outputs into weighted arcs and synthesizes firing code', () => {
    const net: PetrinautNet = {
      schemaVersion: '0.1.0',
      runId: 'r',
      tokenTypes: [],
      places: [
        { id: 'a', label: 'a' },
        { id: 'b', label: 'b' },
        { id: 'c', label: 'c' },
      ],
      transitions: [{ id: 't1', label: 't1', kind: 'structural', inputs: ['a'], outputs: ['b', 'c'] }],
      initialMarking: [],
    };
    const [t] = toSdcpnFile(net, {}).transitions;
    expect(t!.inputArcs).toEqual([{ placeId: 'a', weight: 1, type: 'standard' }]);
    expect(t!.outputArcs).toEqual([
      { placeId: 'b', weight: 1 },
      { placeId: 'c', weight: 1 },
    ]);
    expect(t!.lambdaType).toBe('predicate');
    expect(t!.lambdaCode.length).toBeGreaterThan(0);
    expect(t!.transitionKernelCode.length).toBeGreaterThan(0);
  });
});

describe('toSdcpnFile — initial marking', () => {
  it('maps the marking to one per_place scenario keyed by place id', () => {
    const net: PetrinautNet = {
      schemaVersion: '0.1.0',
      runId: 'r',
      tokenTypes: [],
      places: [
        { id: 'pool:test-agent', label: 'pool:test-agent' },
        { id: 'slice:s:eligible', label: 'eligible' },
      ],
      transitions: [],
      initialMarking: [
        { place: 'pool:test-agent', tokens: [{ id: 'x' }, { id: 'y' }, { id: 'z' }] },
        { place: 'slice:s:eligible', tokens: [{ id: 'w' }] },
      ],
    };
    const file = toSdcpnFile(net, {});
    expect(file.scenarios).toHaveLength(1);
    expect(file.scenarios[0]!.initialState).toEqual({
      type: 'per_place',
      content: { 'pool:test-agent': '3', 'slice:s:eligible': '1' },
    });
  });

  it('emits no scenario when the net has no initial marking', () => {
    const net: PetrinautNet = {
      schemaVersion: '0.1.0',
      runId: 'r',
      tokenTypes: [],
      places: [{ id: 'a', label: 'a' }],
      transitions: [],
      initialMarking: [],
    };
    expect(toSdcpnFile(net, {}).scenarios).toEqual([]);
  });
});

describe('toSdcpnFile — round-trips through the Petrinaut loader', () => {
  it('produces a file that satisfies Petrinaut sdcpnFileSchema', () => {
    const result = sdcpnFileSchema.safeParse(toSdcpnFile(realNet(simplePlan), {}));
    expect(result.success).toBe(true);
  });

  it('keeps every scenario initial-state key pointing at a real place id', () => {
    const file = toSdcpnFile(realNet(simplePlan), {});
    const placeIds = new Set(file.places.map((p) => p.id));
    for (const scenario of file.scenarios) {
      for (const placeId of Object.keys(scenario.initialState.content)) {
        expect(placeIds.has(placeId)).toBe(true);
      }
    }
  });
});

describe('toSdcpnFile — folded multi-slice net (FE-784)', () => {
  // The colour fold's original motivation: clean SDCPN names. Before folding,
  // every slice produced a `slice:slice-N:spec-ready` place that PascalCased to
  // the same base, so the name allocator appended collision counters
  // (SliceSliceSpecReady, SliceSliceSpecReady2, …). After folding, the slice
  // lifecycle collapses to one copy, so no allocator suffix is needed.

  it('produces collision-free PascalCase names with no allocator digit suffixes', () => {
    const file = toSdcpnFile(realNet(depPlan), {});
    // pascalCaseLetters strips digits from the source, so any digit in a final
    // name can only be an allocator collision counter — there should be none.
    for (const p of file.places) {
      expect(p.name, `place ${p.id} got a collision-suffixed name ${p.name}`).not.toMatch(/\d/);
    }
    expect(new Set(file.places.map((p) => p.name)).size).toBe(file.places.length);
  });

  it('collapses the slice lifecycle: one shared place, far fewer than an unfolded 2-slice net', () => {
    const single = toSdcpnFile(realNet(simplePlan), {}).places.length;
    const file = toSdcpnFile(realNet(depPlan), {});
    // Unfolded, two slices would roughly double the single-slice lifecycle.
    // Folded, the shared lifecycle appears once, so dep stays well under 2×.
    expect(file.places.length).toBeLessThan(single * 2);
    expect(file.places.filter((p) => p.id === 'spec-ready')).toHaveLength(1);
  });

  it('still satisfies the Petrinaut loader schema', () => {
    expect(sdcpnFileSchema.safeParse(toSdcpnFile(realNet(depPlan), {})).success).toBe(true);
  });
});
