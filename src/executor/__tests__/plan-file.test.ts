import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { cookPlanFilePayload, cookPlanFilePath, writeCookPlanFile } from '../plan-file.js';
import type { CookPlanPreview } from '../plan-preview.js';

const preview: CookPlanPreview = {
  schemaVersion: 1,
  mode: 'brownfield',
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
      verification: [{ kind: 'criterion', target: 'Feature is visible.' }],
      derived_from: ['REQ1'],
    },
  ],
  sideEffects: [],
};

describe('cook plan file writer', () => {
  it('converts a preview into an old-cook Plan payload without preview-only fields', () => {
    const payload = cookPlanFilePayload(preview);

    expect(payload).toEqual({
      mode: 'brownfield',
      spec: preview.spec,
      epics: preview.epics,
      slices: preview.slices,
    });
    expect(payload).not.toHaveProperty('schemaVersion');
    expect(payload).not.toHaveProperty('sideEffects');
  });

  it('writes one bounded spec-scoped plan.yaml with explicit overwrite semantics', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-plan-file-'));
    const result = await writeCookPlanFile({ cwd, preview });

    expect(result).toEqual({
      path: cookPlanFilePath(cwd, '42'),
      writeMode: 'overwrite',
      sideEffects: [{ kind: 'write_file', path: cookPlanFilePath(cwd, '42'), ifExists: 'overwrite' }],
    });
    expect(JSON.parse(await readFile(cookPlanFilePath(cwd, '42'), 'utf8'))).toEqual(
      cookPlanFilePayload(preview),
    );
  });
});
