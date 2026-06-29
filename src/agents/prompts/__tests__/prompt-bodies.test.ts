import { execFile } from 'node:child_process';
import { access, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import {
  BACKGROUND_SUBAGENT_IDS,
  loadSubagentDefinitions,
  subagentAgentsDir,
} from '../../../.pi/extensions/subagents/agents.js';
import { BUNDLED_AGENT_BODY_IDS, bundledAgentBodyLocation } from '../../registry.js';

const execFileAsync = promisify(execFile);

const projectRoot = dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))));

async function expectMissing(path: string): Promise<void> {
  await expect(access(join(projectRoot, path))).rejects.toThrow();
}

describe('agent prompt bodies', () => {
  it('loads foreground bodies through the code-owned registry', async () => {
    for (const id of BUNDLED_AGENT_BODY_IDS) {
      await expect(access(bundledAgentBodyLocation(id))).resolves.toBeUndefined();
    }
  });

  it('loads background subagents through their explicit registry', async () => {
    const definitions = await loadSubagentDefinitions(subagentAgentsDir());
    expect([...definitions.keys()].sort()).toEqual([...BACKGROUND_SUBAGENT_IDS].sort());
  });

  it('builds generated agent assets without retired nested prompt-body directories', async () => {
    await execFileAsync('npm', ['run', 'build:pi-assets'], { cwd: projectRoot });

    await expectMissing('dist/agents/prompts/elicitor/SYSTEM.md');
    await expectMissing('dist/agents/prompts/executor/SYSTEM.md');
    await expectMissing('dist/agents/prompts/explorer/SYSTEM.md');
    await expectMissing('dist/agents/prompts/pi-coder/SYSTEM.md');
    await expectMissing('dist/agents/prompts/projector/SYSTEM.md');
    await expectMissing('dist/agents/prompts/researcher/SYSTEM.md');
    await expectMissing('dist/agents/prompts/reviewer/SYSTEM.md');
    expect((await readdir(join(projectRoot, 'dist/agents/prompts'))).sort()).toEqual([
      'elicitor.md',
      'executor.md',
    ]);
    expect((await readdir(join(projectRoot, 'dist/agents/subagents'))).sort()).toEqual([
      'explorer.md',
      'projector.md',
      'researcher.md',
      'reviewer.md',
    ]);
  });
});
