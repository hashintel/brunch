import { resolve } from 'node:path';
import { PassThrough } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import type { BrunchCliOptions } from '../../app/brunch.js';
import { runDevCli, type DevCliPrompts } from '../dev-cli.js';

const REPO_ROOT = process.cwd();
const WORKBENCH = resolve(REPO_ROOT, '.fixtures/workbenches/workspace-alpha-grounding');

describe('runDevCli', () => {
  it('derives the seed workbench before launching the default TUI flow', async () => {
    const events: string[] = [];
    const launchCalls: BrunchCliOptions[] = [];

    const code = await runDevCli({
      argv: ['--seed', 'workspace-alpha-grounding/base', '--reset'],
      cwd: REPO_ROOT,
      seedWorkspace: async (options) => {
        events.push('seed');
        if (!options) throw new Error('expected seed cli options');
        expect(options.argv).toEqual([
          '--workspace',
          WORKBENCH,
          '--seed',
          'workspace-alpha-grounding/base',
          '--reset',
        ]);
        return 0;
      },
      launchBrunch: async (options) => {
        events.push('launch');
        launchCalls.push(options);
        return 17;
      },
    });

    expect(code).toBe(17);
    expect(events).toEqual(['seed', 'launch']);
    expect(launchCalls).toEqual([
      expect.objectContaining({
        cwd: WORKBENCH,
        argv: ['--mode', 'tui'],
      }),
    ]);
  });

  it('forwards --no-webui for direct dev launches that suppress browser opening', async () => {
    const launches: BrunchCliOptions[] = [];

    const code = await runDevCli({
      argv: ['--workspace', WORKBENCH, '--no-webui'],
      cwd: REPO_ROOT,
      launchBrunch: async (options) => {
        launches.push(options);
        return 0;
      },
    });

    expect(code).toBe(0);
    expect(launches).toEqual([
      expect.objectContaining({
        cwd: WORKBENCH,
        argv: ['--mode', 'tui', '--no-webui'],
      }),
    ]);
  });

  it('uses the prompt flow when no workbench flag is provided', async () => {
    const chooseWorkbench = vi.fn<DevCliPrompts['chooseWorkbench']>().mockResolvedValue(WORKBENCH);
    const chooseSeed = vi.fn<DevCliPrompts['chooseSeed']>().mockResolvedValue('__current__');
    const confirmSeedReset = vi.fn<DevCliPrompts['confirmSeedReset']>();
    const confirmOpenWeb = vi.fn<DevCliPrompts['confirmOpenWeb']>().mockResolvedValue(false);
    const intro = vi.fn<DevCliPrompts['intro']>();
    const outro = vi.fn<DevCliPrompts['outro']>();
    const cancel = vi.fn<DevCliPrompts['cancel']>();
    const launches: BrunchCliOptions[] = [];
    const stdin = new PassThrough() as PassThrough & { isTTY: boolean };
    const stdout = new PassThrough() as PassThrough & { isTTY: boolean };
    stdin.isTTY = true;
    stdout.isTTY = true;

    const code = await runDevCli({
      argv: [],
      cwd: REPO_ROOT,
      stdin,
      stdout,
      prompts: {
        intro,
        outro,
        cancel,
        chooseWorkbench,
        chooseSeed,
        confirmSeedReset,
        confirmOpenWeb,
      },
      launchBrunch: async (options) => {
        launches.push(options);
        return 0;
      },
    });

    expect(code).toBe(0);
    expect(chooseWorkbench).toHaveBeenCalled();
    expect(chooseSeed).toHaveBeenCalledWith(
      [
        'workspace-alpha-grounding/base',
        'workspace-alpha-grounding/intent-settled',
        'workspace-alpha-grounding/requirements-accepted',
      ],
      '.fixtures/workbenches/workspace-alpha-grounding',
    );
    expect(confirmSeedReset).not.toHaveBeenCalled();
    expect(confirmOpenWeb).toHaveBeenCalledWith('.fixtures/workbenches/workspace-alpha-grounding');
    expect(intro).toHaveBeenCalledWith('Brunch dev launcher');
    expect(outro).toHaveBeenCalledWith('Launching .fixtures/workbenches/workspace-alpha-grounding.');
    expect(cancel).not.toHaveBeenCalled();
    expect(launches).toEqual([
      expect.objectContaining({
        cwd: WORKBENCH,
        argv: ['--mode', 'tui', '--no-webui'],
      }),
    ]);
  });

  it('treats prompt-selected seeding as an explicit reset before launch', async () => {
    const chooseWorkbench = vi.fn<DevCliPrompts['chooseWorkbench']>().mockResolvedValue(WORKBENCH);
    const chooseSeed = vi
      .fn<DevCliPrompts['chooseSeed']>()
      .mockResolvedValue('workspace-alpha-grounding/base');
    const confirmSeedReset = vi.fn<DevCliPrompts['confirmSeedReset']>().mockResolvedValue(true);
    const confirmOpenWeb = vi.fn<DevCliPrompts['confirmOpenWeb']>().mockResolvedValue(true);
    const intro = vi.fn<DevCliPrompts['intro']>();
    const outro = vi.fn<DevCliPrompts['outro']>();
    const cancel = vi.fn<DevCliPrompts['cancel']>();
    const stdin = new PassThrough() as PassThrough & { isTTY: boolean };
    const stdout = new PassThrough() as PassThrough & { isTTY: boolean };
    const events: string[] = [];
    const launches: BrunchCliOptions[] = [];
    stdin.isTTY = true;
    stdout.isTTY = true;

    const code = await runDevCli({
      argv: [],
      cwd: REPO_ROOT,
      stdin,
      stdout,
      prompts: {
        intro,
        outro,
        cancel,
        chooseWorkbench,
        chooseSeed,
        confirmSeedReset,
        confirmOpenWeb,
      },
      seedWorkspace: async (options) => {
        events.push('seed');
        if (!options) throw new Error('expected seed cli options');
        expect(options.argv).toEqual([
          '--workspace',
          WORKBENCH,
          '--seed',
          'workspace-alpha-grounding/base',
          '--reset',
        ]);
        return 0;
      },
      launchBrunch: async (options) => {
        events.push('launch');
        launches.push(options);
        return 0;
      },
    });

    expect(code).toBe(0);
    expect(events).toEqual(['seed', 'launch']);
    expect(confirmSeedReset).toHaveBeenCalledWith(
      'workspace-alpha-grounding/base',
      '.fixtures/workbenches/workspace-alpha-grounding',
    );
    expect(confirmOpenWeb).toHaveBeenCalledWith('.fixtures/workbenches/workspace-alpha-grounding');
    expect(outro).toHaveBeenCalledWith(
      'Launching .fixtures/workbenches/workspace-alpha-grounding from workspace-alpha-grounding/base.',
    );
    expect(cancel).not.toHaveBeenCalled();
    expect(launches).toEqual([
      expect.objectContaining({
        cwd: WORKBENCH,
        argv: ['--mode', 'tui'],
      }),
    ]);
  });

  it('documents canonical seed refs in usage text', async () => {
    let stdout = '';

    const code = await runDevCli({
      argv: ['help'],
      cwd: REPO_ROOT,
      stdout: (chunk) => {
        stdout += chunk;
      },
    });

    expect(code).toBe(0);
    expect(stdout).toContain('--seed <name>/<variant>');
    expect(stdout).toContain('--no-webui');
    expect(stdout).not.toContain('--open-web');
    expect(stdout).not.toContain('<name/variant>');
  });

  it('rejects non-positive export spec ids loudly', async () => {
    let stderr = '';

    const code = await runDevCli({
      argv: ['export', '--workspace', WORKBENCH, '--spec-id', '0'],
      cwd: REPO_ROOT,
      stderr: (chunk) => {
        stderr += chunk;
      },
    });

    expect(code).toBe(1);
    expect(stderr).toContain('--spec-id must be a positive integer.');
  });
});
