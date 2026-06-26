import { execFile } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const projectRoot = dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))));

const foregroundPromptExpectations = [
  {
    system: 'src/agents/prompts/elicitor.md',
    oldNested: 'src/agents/prompts/elicitor/SYSTEM.md',
    legacyFlat: 'src/.pi/agents/elicitor.md',
    needles: ['# Agent: elicitor', 'multi-spec discipline'],
  },
  {
    system: 'src/agents/prompts/executor.md',
    oldNested: 'src/agents/prompts/executor/SYSTEM.md',
    needles: ['# Agent: executor', 'execute mode'],
  },
];

const backgroundSubagentExpectations = [
  {
    system: 'src/agents/subagents/reviewer.md',
    oldNested: 'src/agents/prompts/reviewer/SYSTEM.md',
    legacyFlat: 'src/.pi/agents/reviewer.md',
    needles: ['name: reviewer', 'checking candidate'],
  },
  {
    system: 'src/agents/subagents/explorer.md',
    oldNested: 'src/agents/prompts/explorer/SYSTEM.md',
    needles: ['name: explorer', 'read-only reconnaissance agent'],
  },
  {
    system: 'src/agents/subagents/researcher.md',
    oldNested: 'src/agents/prompts/researcher/SYSTEM.md',
    needles: ['name: researcher', 'web-research agent'],
  },
  {
    system: 'src/agents/subagents/projector.md',
    oldNested: 'src/agents/prompts/projector/SYSTEM.md',
    needles: ['name: projector', 'candidate-proposal'],
  },
];

async function expectMissing(path: string): Promise<void> {
  await expect(access(join(projectRoot, path))).rejects.toThrow();
}

describe('agent prompt bodies', () => {
  it('keeps foreground agent body resources as flat prompt files', async () => {
    for (const expectation of foregroundPromptExpectations) {
      const content = await readFile(join(projectRoot, expectation.system), 'utf8');
      for (const needle of expectation.needles) {
        expect(content).toContain(needle);
      }
      await expectMissing(expectation.oldNested);
      if (expectation.legacyFlat) await expectMissing(expectation.legacyFlat);
    }
  });

  it('keeps background subagent bodies out of the foreground prompt home', async () => {
    for (const expectation of backgroundSubagentExpectations) {
      const content = await readFile(join(projectRoot, expectation.system), 'utf8');
      for (const needle of expectation.needles) {
        expect(content).toContain(needle);
      }
      await expectMissing(expectation.oldNested);
      if (expectation.legacyFlat) await expectMissing(expectation.legacyFlat);
    }

    await expectMissing('src/agents/prompts/pi-coder/SYSTEM.md');
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

  it('records the foreground/background split in local READMEs', async () => {
    const promptsReadme = await readFile(join(projectRoot, 'src/agents/prompts/README.md'), 'utf8');
    const subagentsReadme = await readFile(join(projectRoot, 'src/agents/subagents/README.md'), 'utf8');

    expect(promptsReadme).toContain('Flat foreground files are canonical');
    expect(promptsReadme).toContain('src/agents/prompts/{elicitor,executor}.md');
    expect(promptsReadme).toContain('src/agents/subagents/');
    expect(promptsReadme).toContain('retired orchestrator / pi-coder body aliases are not preserved');
    expect(subagentsReadme).toContain('BACKGROUND_SUBAGENT_IDS');
    expect(subagentsReadme).toContain('Unlisted files are not spawnable');
  });
});
