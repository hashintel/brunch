import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  readOrCreateWorkspaceState,
  readWorkspaceState,
  writeWorkspaceDefaults,
} from '../workspace-state-store.js';

describe('workspace state store', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'brunch-workspace-state-store-'));
  });

  it('creates workspace.json from cwd project identity without opening session or graph stores', async () => {
    await writeFile(join(cwd, 'package.json'), JSON.stringify({ name: '@hashintel/brunch-demo' }));

    const state = await readOrCreateWorkspaceState(cwd);

    expect(state).toEqual({
      schemaVersion: 1,
      project: { name: '@hashintel/brunch-demo', slug: 'hashintel-brunch-demo' },
      defaults: null,
      posture: { certainty: '', stakes: '', audience: '', horizon: '', migration: '', dependencies: '' },
    });
    await expect(readWorkspaceState(cwd)).resolves.toEqual(state);
  });

  it('persists default spec/session selection while preserving project and posture fields', async () => {
    const created = await readOrCreateWorkspaceState(cwd);

    await writeWorkspaceDefaults(cwd, 42, 'session-1');

    await expect(readWorkspaceState(cwd)).resolves.toEqual({
      ...created,
      defaults: { specId: 42, sessionId: 'session-1' },
    });
  });

  it('treats malformed or schema-invalid workspace.json as absent', async () => {
    await mkdir(join(cwd, '.brunch'), { recursive: true });
    await writeFile(
      join(cwd, '.brunch', 'workspace.json'),
      '{"schemaVersion":1,"defaults":{"specId":"nope"}}',
    );

    await expect(readWorkspaceState(cwd)).resolves.toBeNull();
  });
});
