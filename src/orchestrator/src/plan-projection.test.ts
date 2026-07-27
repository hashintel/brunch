import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { stringify as stringifyYaml } from 'yaml';

import { loadPlan } from './plan-loader.js';
import { buildPlanSpec, projectPlanFromSpec, type CompletedSpecSnapshot } from './plan-projection.js';

describe('projectPlanFromSpec', () => {
  it('defaults the plan mode to greenfield when the snapshot omits a mode', () => {
    const plan = projectPlanFromSpec({ requirements: [], criteria: [], edges: [] });
    expect(plan.mode).toBe('greenfield');
  });

  it('carries the snapshot mode onto the plan', () => {
    const greenfield = projectPlanFromSpec({ mode: 'greenfield', requirements: [], criteria: [], edges: [] });
    const brownfield = projectPlanFromSpec({ mode: 'brownfield', requirements: [], criteria: [], edges: [] });
    expect(greenfield.mode).toBe('greenfield');
    expect(brownfield.mode).toBe('brownfield');
  });

  it('returns a single default epic and zero slices for an empty snapshot', () => {
    const snapshot: CompletedSpecSnapshot = {
      requirements: [],
      criteria: [],
      edges: [],
    };

    const plan = projectPlanFromSpec(snapshot);

    expect(plan.epics).toHaveLength(1);
    expect(plan.epics[0]!.id).toBe('default');
    expect(plan.epics[0]!.depends_on).toEqual([]);
    expect(plan.epics[0]!.verification).toEqual([]);
    expect(plan.slices).toEqual([]);
  });

  it('produces one slice per requirement, ordered by kindOrdinal, with stable ids', () => {
    const snapshot: CompletedSpecSnapshot = {
      requirements: [
        { id: 11, content: 'Second requirement', kindOrdinal: 2 },
        { id: 10, content: 'First requirement', kindOrdinal: 1 },
        { id: 12, content: 'Third requirement', kindOrdinal: 3 },
      ],
      criteria: [],
      edges: [],
    };

    const plan = projectPlanFromSpec(snapshot);

    expect(plan.slices).toHaveLength(3);
    expect(plan.slices.map((slice) => slice.id)).toEqual(['req-10', 'req-11', 'req-12']);
    expect(plan.slices.map((slice) => slice.definition)).toEqual([
      'First requirement',
      'Second requirement',
      'Third requirement',
    ]);
    for (const slice of plan.slices) {
      expect(slice.epic_id).toBe('default');
      expect(slice.depends_on).toEqual([]);
      expect(slice.verification).toEqual([]);
    }
  });

  it('uses requirement identity rather than ordinal so duplicate ordinals remain unique', () => {
    const snapshot: CompletedSpecSnapshot = {
      requirements: [
        { id: 12, content: 'Second duplicate ordinal', kindOrdinal: 1 },
        { id: 10, content: 'First duplicate ordinal', kindOrdinal: 1 },
      ],
      criteria: [],
      edges: [],
    };

    const plan = projectPlanFromSpec(snapshot);

    expect(plan.slices.map((slice) => slice.id)).toEqual(['req-10', 'req-12']);
    expect(plan.slices.map((slice) => slice.definition)).toEqual([
      'First duplicate ordinal',
      'Second duplicate ordinal',
    ]);
  });

  it('populates a slice verification from `criterion --verifies--> requirement` edges', () => {
    const snapshot: CompletedSpecSnapshot = {
      requirements: [{ id: 10, content: 'A requirement', kindOrdinal: 1 }],
      criteria: [
        { id: 20, content: 'Second criterion text', kindOrdinal: 2 },
        { id: 21, content: 'First criterion text', kindOrdinal: 1 },
      ],
      edges: [
        { fromItemId: 20, toItemId: 10, relation: 'verifies' },
        { fromItemId: 21, toItemId: 10, relation: 'verifies' },
      ],
    };

    const plan = projectPlanFromSpec(snapshot);

    expect(plan.slices).toHaveLength(1);
    expect(plan.slices[0]!.verification).toEqual([
      { kind: 'criterion', target: 'First criterion text' },
      { kind: 'criterion', target: 'Second criterion text' },
    ]);
  });

  it('does NOT project requirement→requirement `depends_on` edges into slice.depends_on', () => {
    // Slice 1 intentionally drops graph-read execution ordering — the LLM
    // planning pass (slice 2) owns that. We assert the drop is silent and
    // deliberate so a future regression that quietly re-introduces a
    // graph-read ordering rule will be caught.
    const snapshot: CompletedSpecSnapshot = {
      requirements: [
        { id: 10, content: 'First requirement', kindOrdinal: 1 },
        { id: 11, content: 'Second requirement', kindOrdinal: 2 },
      ],
      criteria: [],
      edges: [{ fromItemId: 11, toItemId: 10, relation: 'depends_on' }],
    };

    const plan = projectPlanFromSpec(snapshot);

    for (const slice of plan.slices) {
      expect(slice.depends_on).toEqual([]);
    }
  });

  it('is deterministic — same snapshot yields structurally equal Plans', () => {
    const snapshot: CompletedSpecSnapshot = {
      requirements: [
        { id: 11, content: 'Req B', kindOrdinal: 2 },
        { id: 10, content: 'Req A', kindOrdinal: 1 },
      ],
      criteria: [{ id: 20, content: 'Crit', kindOrdinal: 1 }],
      edges: [{ fromItemId: 20, toItemId: 10, relation: 'verifies' }],
    };

    expect(projectPlanFromSpec(snapshot)).toEqual(projectPlanFromSpec(snapshot));
  });

  it('round-trips through loadPlan — projected Plan survives YAML serialise + parse', () => {
    const snapshot: CompletedSpecSnapshot = {
      requirements: [
        { id: 10, content: 'First requirement', kindOrdinal: 1 },
        { id: 11, content: 'Second requirement', kindOrdinal: 2 },
      ],
      criteria: [{ id: 20, content: 'A criterion', kindOrdinal: 1 }],
      edges: [{ fromItemId: 20, toItemId: 10, relation: 'verifies' }],
    };

    const projected = projectPlanFromSpec(snapshot);

    const dir = mkdtempSync(join(tmpdir(), 'plan-projection-'));
    const yamlPath = join(dir, 'plan.yaml');
    writeFileSync(yamlPath, stringifyYaml(projected));

    const reloaded = loadPlan(yamlPath);

    expect(reloaded).toEqual(projected);

    // Schema-conformance pin: every slice.epic_id resolves to an existing epic.
    const epicIds = new Set(reloaded.epics.map((epic) => epic.id));
    for (const slice of reloaded.slices) {
      expect(epicIds.has(slice.epic_id)).toBe(true);
    }
  });

  it('emits a non-empty definition on every slice (display + LLM-prompt invariant)', () => {
    // sliceLabel and the pi-agent task prompts both read slice.definition;
    // pin that projection never emits an empty one so cook progress
    // lines stay legible and pi never receives a content-free task.
    const fixturePath = join(
      dirname(fileURLToPath(import.meta.url)),
      '__fixtures__',
      'brunch-graphs-snapshot.json',
    );
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as CompletedSpecSnapshot;

    const plan = projectPlanFromSpec(fixture);

    expect(plan.slices.length).toBeGreaterThan(0);
    for (const slice of plan.slices) {
      expect(slice.definition.trim().length).toBeGreaterThan(0);
    }
  });

  it('preserves the brunch_graphs spike oracle — every requirement gets ≥1 verifying criterion', () => {
    // Pin the spike's positive finding (2026-06-03 against completed
    // spec 2 'brunch_graphs', memory/PLAN.md §spec-to-cook-plan):
    // projection works AND verification linkage is fully covered. The
    // fixture is a hand-curated subset; the eventual server-side
    // snapshot builder (separate slice) will obviate it.
    const fixturePath = join(
      dirname(fileURLToPath(import.meta.url)),
      '__fixtures__',
      'brunch-graphs-snapshot.json',
    );
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as CompletedSpecSnapshot;

    const plan = projectPlanFromSpec(fixture);

    expect(plan.slices).toHaveLength(fixture.requirements.length);
    for (const slice of plan.slices) {
      expect(slice.verification.length).toBeGreaterThanOrEqual(1);
      for (const verification of slice.verification) {
        expect(verification.kind).toBe('criterion');
      }
    }
  });
});

describe('buildPlanSpec (FE-885)', () => {
  it('returns undefined when the snapshot has no specId', () => {
    expect(buildPlanSpec({ requirements: [], criteria: [], edges: [] })).toBeUndefined();
  });

  it('normalizes requirements + criteria into slice-id space with verifies edges', () => {
    const snapshot: CompletedSpecSnapshot = {
      specId: 49,
      requirements: [
        { id: 2, content: 'Second req', kindOrdinal: 1 },
        { id: 1, content: 'First req', kindOrdinal: 0 },
      ],
      criteria: [{ id: 10, content: 'renders fast', kindOrdinal: 0 }],
      edges: [{ fromItemId: 10, toItemId: 1, relation: 'verifies' }],
    };

    const spec = buildPlanSpec(snapshot)!;
    expect(spec.spec_id).toBe('49');
    // requirements sorted by kindOrdinal → req-1 before req-2.
    expect(spec.requirements).toEqual([
      { item_id: 'req-1', content: 'First req' },
      { item_id: 'req-2', content: 'Second req' },
    ]);
    expect(spec.criteria).toEqual([{ item_id: 'crit-10', content: 'renders fast', verifies: ['req-1'] }]);
  });

  it('gives a criterion with no verifies edge an empty verifies list', () => {
    const spec = buildPlanSpec({
      specId: 7,
      requirements: [],
      criteria: [{ id: 5, content: 'orphan criterion', kindOrdinal: 0 }],
      edges: [],
    })!;
    expect(spec.criteria[0]!.verifies).toEqual([]);
  });
});
