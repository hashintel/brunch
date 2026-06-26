import { resolve } from 'node:path';
import { PassThrough } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import type { BrunchCliOptions } from '../../app/brunch.js';
import { runDevCli, type DevCliPrompts } from '../dev-cli.js';

const REPO_ROOT = process.cwd();
const WORKBENCH = resolve(REPO_ROOT, '.fixtures/workbenches/live-graph-observer');

describe('runDevCli', () => {
  it('seeds explicitly before launching the default TUI flow', async () => {
    const events: string[] = [];
    const launchCalls: BrunchCliOptions[] = [];

    const code = await runDevCli({
      argv: [
        '--workspace',
        '.fixtures/workbenches/live-graph-observer',
        '--seed',
        'workspace-spread/alpha-grounding',
        '--reset',
        '--open-web',
      ],
      cwd: REPO_ROOT,
      seedWorkspace: async (options) => {
        events.push('seed');
        if (!options) throw new Error('expected seed cli options');
        expect(options.argv).toEqual([
          '--workspace',
          WORKBENCH,
          '--seed',
          'workspace-spread/alpha-grounding',
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
        argv: ['--mode', 'tui', '--open-web'],
      }),
    ]);
  });

  it('uses the prompt flow when no workbench flag is provided', async () => {
    const chooseWorkbench = vi.fn<DevCliPrompts['chooseWorkbench']>();
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
    expect(chooseWorkbench).not.toHaveBeenCalled();
    expect(chooseSeed).toHaveBeenCalledWith(expect.any(Array), '.fixtures/workbenches/live-graph-observer');
    expect(confirmSeedReset).not.toHaveBeenCalled();
    expect(confirmOpenWeb).toHaveBeenCalledWith('.fixtures/workbenches/live-graph-observer');
    expect(intro).toHaveBeenCalledWith('Brunch dev launcher');
    expect(outro).toHaveBeenCalledWith('Launching .fixtures/workbenches/live-graph-observer.');
    expect(cancel).not.toHaveBeenCalled();
    expect(launches).toEqual([
      expect.objectContaining({
        cwd: WORKBENCH,
        argv: ['--mode', 'tui'],
      }),
    ]);
  });
});
