import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  executablePlanDraftArtifactPath,
  writeExecutablePlanDraftArtifact,
} from '../executable-plan-draft-artifact.js';
import type { ExecutablePlanDraft } from '../executable-plan-draft.js';

const draft: ExecutablePlanDraft = {
  schemaVersion: 2,
  specId: '7',
  mode: 'greenfield',
  epics: [],
  slices: [],
  sideEffects: [],
};

describe('writeExecutablePlanDraftArtifact', () => {
  it('writes a bounded executable-plan draft artifact under .brunch/execution-reports', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-executable-plan-draft-'));
    const result = await writeExecutablePlanDraftArtifact({ cwd, draft });

    expect(result.path).toBe(executablePlanDraftArtifactPath(cwd, '7'));
    expect(result.writeMode).toBe('overwrite');
    expect(result.sideEffects).toEqual([{ kind: 'write_file', path: result.path, ifExists: 'overwrite' }]);
    await expect(readFile(result.path, 'utf8')).resolves.toBe(`${JSON.stringify(draft, null, 2)}\n`);
  });

  it('rejects a v1 draft artifact instead of persisting an incompatible shape', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-executable-plan-draft-v1-'));
    await expect(
      writeExecutablePlanDraftArtifact({
        cwd,
        draft: { ...draft, schemaVersion: 1 } as unknown as ExecutablePlanDraft,
      }),
    ).rejects.toThrow('Unsupported executable plan draft schema version: 1');
  });
});
