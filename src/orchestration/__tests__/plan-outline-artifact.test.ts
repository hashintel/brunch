import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ExecutionPlanOutline } from '../execute-plan-outline.js';
import { planOutlineArtifactPath, writePlanOutlineArtifact } from '../plan-outline-artifact.js';

const outline: ExecutionPlanOutline = {
  schemaVersion: 1,
  specId: '7',
  mode: 'greenfield',
  frontiers: [],
  sideEffects: [],
};

describe('writePlanOutlineArtifact', () => {
  it('writes a reviewable alpha plan outline artifact under .brunch/execution-reports', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-plan-outline-'));
    const result = await writePlanOutlineArtifact({ cwd, outline });

    expect(result.path).toBe(planOutlineArtifactPath(cwd, '7'));
    expect(result.writeMode).toBe('overwrite');
    expect(result.sideEffects).toEqual([{ kind: 'write_file', path: result.path, ifExists: 'overwrite' }]);
    await expect(readFile(result.path, 'utf8')).resolves.toBe(`${JSON.stringify(outline, null, 2)}\n`);
  });
});
