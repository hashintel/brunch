import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  planFilePayload,
  planFilePath,
  planProvenancePath,
  readPlanFileProvenance,
  writePlanFile,
} from '../plan-file.js';
import type { PlanPreview } from '../plan-preview.js';

const preview: PlanPreview = {
  schemaVersion: 2,
  mode: 'brownfield',
  scope_handoff_required: false,
  spec: {
    spec_id: '42',
    requirements: [{ item_id: 'REQ1', content: 'Build the feature.' }],
    criteria: [{ item_id: 'AC1', content: 'Feature is visible.', verifies: ['REQ1'] }],
  },
  epics: [
    { id: 'frontier-1', summary: 'Implement projected requirements', depends_on: [], verification: [] },
  ],
  slices: [
    {
      id: 'task-1',
      epic_id: 'frontier-1',
      definition: 'Build the feature.',
      depends_on: [],
      verification: [{ kind: 'criterion', criterionId: 'AC1', target: 'Feature is visible.' }],
      derived_from: ['REQ1'],
    },
  ],
  sideEffects: [],
};

describe('cook plan file writer', () => {
  it('rejects a v1 preview while keeping plan provenance independently at v1', () => {
    expect(() => planFilePayload({ ...preview, schemaVersion: 1 } as unknown as PlanPreview)).toThrow(
      'Unsupported plan preview schema version: 1',
    );
  });

  it('converts a preview into an old-cook Plan payload without preview-only fields', () => {
    const payload = planFilePayload(preview);

    expect(payload).toEqual({
      mode: 'brownfield',
      scope_handoff_required: false,
      spec: preview.spec,
      epics: preview.epics,
      slices: preview.slices,
    });
    expect(payload).not.toHaveProperty('schemaVersion');
    expect(payload).not.toHaveProperty('sideEffects');
  });

  it('writes one bounded spec-scoped plan.yaml plus provenance with explicit overwrite semantics', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-plan-file-'));
    const source = { graphLsn: 18, visibility: 'active' as const };
    const result = await writePlanFile({ cwd, preview, source });

    expect(result).toEqual({
      path: planFilePath(cwd, '42'),
      provenancePath: planProvenancePath(cwd, '42'),
      writeMode: 'overwrite',
      sideEffects: [
        { kind: 'write_file', path: planFilePath(cwd, '42'), ifExists: 'overwrite' },
        { kind: 'write_file', path: planProvenancePath(cwd, '42'), ifExists: 'overwrite' },
      ],
    });
    expect(JSON.parse(await readFile(planFilePath(cwd, '42'), 'utf8'))).toEqual(planFilePayload(preview));
    await expect(readPlanFileProvenance({ cwd, specId: '42' })).resolves.toEqual({
      schemaVersion: 1,
      specId: '42',
      mode: 'brownfield',
      source,
    });
  });
});
