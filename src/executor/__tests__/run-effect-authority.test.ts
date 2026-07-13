import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { populateWorktree } from '../populate.js';
import { initializeReports } from '../report.js';
import { RUN_MUTATION_ENTRY_INVENTORY } from '../run-execution-authority.js';
import { withRunExecutionAuthority } from '../run-execution-authority.js';
import { copyHostSource } from '../source-copy.js';
import { selectSourcePolicy } from '../source-policy.js';

describe('standalone run effect authority inventory', () => {
  it('requires every standalone lifecycle core entry to hold canonical run authority', async () => {
    const executorDir = join(dirname(fileURLToPath(import.meta.url)), '..');
    const files = new Set(
      Object.values(RUN_MUTATION_ENTRY_INVENTORY)
        .filter((entry) => entry.standalone)
        .map((entry) => entry.coreFile),
    );

    for (const file of files) {
      await expect(readFile(join(executorDir, file), 'utf8')).resolves.toContain('withRunExecutionAuthority');
    }
  });

  it('refuses populate, source policy/copy, and report effects under contention', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-effect-inventory-'));
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const owner = withRunExecutionAuthority({ cwd, runId: 'run-1', execute: () => held });
    await new Promise((resolve) => setImmediate(resolve));

    await expect(
      Promise.all([
        populateWorktree({ cwd, runId: 'run-1' }),
        selectSourcePolicy({ cwd, runId: 'run-1', policy: 'plan_only' }),
        copyHostSource({ cwd, runId: 'run-1' }),
        initializeReports({ cwd, runId: 'run-1' }),
      ]),
    ).resolves.toEqual(
      Array.from({ length: 4 }, () => ({
        status: 'run_execution_active',
        runStatus: 'not_started',
        runId: 'run-1',
        sideEffects: [],
      })),
    );
    release();
    await owner;
  });
});
