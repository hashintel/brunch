import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BrunchCliOptions } from '../../app/brunch.js';
import { runDevCli, type DevCliPrompts } from '../dev-cli.js';

const seedFixtureMocks = vi.hoisted(() => ({
  listTrackedSeedRefs: vi.fn(),
  actualListTrackedSeedRefs: undefined as
    | typeof import('../../graph/seed-fixtures.js').listTrackedSeedRefs
    | undefined,
}));

vi.mock('../../graph/seed-fixtures.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../graph/seed-fixtures.js')>();
  seedFixtureMocks.actualListTrackedSeedRefs = actual.listTrackedSeedRefs;
  seedFixtureMocks.listTrackedSeedRefs.mockImplementation(actual.listTrackedSeedRefs);
  return { ...actual, listTrackedSeedRefs: seedFixtureMocks.listTrackedSeedRefs };
});

const REPO_ROOT = process.cwd();
const WORKBENCH = resolve(REPO_ROOT, '.fixtures/workbenches/workspace-alpha-grounding');
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  seedFixtureMocks.listTrackedSeedRefs.mockReset();
  seedFixtureMocks.listTrackedSeedRefs.mockImplementation(seedFixtureMocks.actualListTrackedSeedRefs!);
});

async function temporaryWorkbenchesRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'brunch-dev-cli-test-'));
  temporaryRoots.push(root);
  return root;
}

function interactiveStreams(): {
  readonly stdin: PassThrough & { isTTY: boolean };
  readonly stdout: PassThrough & { isTTY: boolean };
} {
  const stdin = new PassThrough() as PassThrough & { isTTY: boolean };
  const stdout = new PassThrough() as PassThrough & { isTTY: boolean };
  stdin.isTTY = true;
  stdout.isTTY = true;
  return { stdin, stdout };
}

function promptStubs(overrides: Partial<DevCliPrompts>): DevCliPrompts {
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    chooseLaunchSource: vi.fn().mockResolvedValue('temporary'),
    enterWorkbenchName: vi.fn().mockResolvedValue('new-workbench'),
    chooseExistingWorkbench: vi.fn(),
    chooseSeed: vi.fn(),
    confirmSeedReset: vi.fn().mockResolvedValue(true),
    confirmOpenWeb: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

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

  it('launches a bare temporary workspace', async () => {
    const workbenchesRoot = await temporaryWorkbenchesRoot();
    const workspace = join(workbenchesRoot, 'generated-temp');
    const launches: BrunchCliOptions[] = [];

    const code = await runDevCli({
      argv: ['--temp', '--no-webui'],
      cwd: REPO_ROOT,
      createTempWorkspace: vi.fn().mockResolvedValue(workspace),
      launchBrunch: async (options) => {
        launches.push(options);
        return 0;
      },
    });

    expect(code).toBe(0);
    expect(launches).toEqual([
      expect.objectContaining({ cwd: workspace, argv: ['--mode', 'tui', '--no-webui'] }),
    ]);
  });

  it('does not require seed fixtures for an interactive temporary workspace', async () => {
    const workbenchesRoot = await temporaryWorkbenchesRoot();
    const workspace = join(workbenchesRoot, 'generated-temp');
    const chooseLaunchSource = vi.fn<DevCliPrompts['chooseLaunchSource']>().mockResolvedValue('temporary');
    const { stdin, stdout } = interactiveStreams();
    seedFixtureMocks.listTrackedSeedRefs.mockRejectedValueOnce(new Error('seed directory is absent'));

    const code = await runDevCli({
      argv: [],
      cwd: REPO_ROOT,
      stdin,
      stdout,
      workbenchesRoot,
      prompts: promptStubs({ chooseLaunchSource }),
      createTempWorkspace: vi.fn().mockResolvedValue(workspace),
      launchBrunch: async () => 0,
    });

    expect(code).toBe(0);
    expect(chooseLaunchSource).toHaveBeenCalledOnce();
    expect(seedFixtureMocks.listTrackedSeedRefs).not.toHaveBeenCalled();
  });

  it('creates and launches a named workbench under the workbenches root', async () => {
    const workbenchesRoot = await temporaryWorkbenchesRoot();
    const launches: BrunchCliOptions[] = [];

    const code = await runDevCli({
      argv: ['--workbench', 'my-new-instance'],
      cwd: REPO_ROOT,
      workbenchesRoot,
      launchBrunch: async (options) => {
        launches.push(options);
        return 0;
      },
    });

    expect(code).toBe(0);
    expect(launches).toEqual([expect.objectContaining({ cwd: join(workbenchesRoot, 'my-new-instance') })]);
  });

  it('opens an existing workbench without seeding through the prompt flow', async () => {
    const workbenchesRoot = await temporaryWorkbenchesRoot();
    const existing = join(workbenchesRoot, 'existing-workbench');
    await runDevCli({
      argv: ['--workbench', 'existing-workbench', '--mode', 'print'],
      cwd: REPO_ROOT,
      workbenchesRoot,
      launchBrunch: async () => 0,
    });
    const chooseLaunchSource = vi.fn<DevCliPrompts['chooseLaunchSource']>().mockResolvedValue('existing');
    const chooseExistingWorkbench = vi
      .fn<DevCliPrompts['chooseExistingWorkbench']>()
      .mockResolvedValue(existing);
    const confirmOpenWeb = vi.fn<DevCliPrompts['confirmOpenWeb']>().mockResolvedValue(false);
    const launches: BrunchCliOptions[] = [];
    const { stdin, stdout } = interactiveStreams();

    const code = await runDevCli({
      argv: [],
      cwd: REPO_ROOT,
      stdin,
      stdout,
      workbenchesRoot,
      prompts: promptStubs({ chooseLaunchSource, chooseExistingWorkbench, confirmOpenWeb }),
      seedWorkspace: vi.fn().mockRejectedValue(new Error('must not seed')),
      launchBrunch: async (options) => {
        launches.push(options);
        return 0;
      },
    });

    expect(code).toBe(0);
    expect(chooseExistingWorkbench).toHaveBeenCalledWith([
      { label: 'existing-workbench', workspace: existing },
    ]);
    expect(confirmOpenWeb).toHaveBeenCalledWith('.fixtures/workbenches/existing-workbench');
    expect(launches).toEqual([
      expect.objectContaining({ cwd: existing, argv: ['--mode', 'tui', '--no-webui'] }),
    ]);
  });

  it('creates or resets a workbench from a prompt-selected seed fixture', async () => {
    const workbenchesRoot = await temporaryWorkbenchesRoot();
    const workspace = join(workbenchesRoot, 'workspace-alpha-grounding');
    const chooseLaunchSource = vi.fn<DevCliPrompts['chooseLaunchSource']>().mockResolvedValue('seed');
    const chooseSeed = vi
      .fn<DevCliPrompts['chooseSeed']>()
      .mockResolvedValue('workspace-alpha-grounding/base');
    const confirmSeedReset = vi.fn<DevCliPrompts['confirmSeedReset']>().mockResolvedValue(true);
    const events: string[] = [];
    const { stdin, stdout } = interactiveStreams();

    const code = await runDevCli({
      argv: [],
      cwd: REPO_ROOT,
      stdin,
      stdout,
      workbenchesRoot,
      prompts: promptStubs({ chooseLaunchSource, chooseSeed, confirmSeedReset }),
      seedWorkspace: async (options) => {
        events.push('seed');
        expect(options?.argv).toEqual([
          '--workspace',
          workspace,
          '--seed',
          'workspace-alpha-grounding/base',
          '--reset',
        ]);
        return 0;
      },
      launchBrunch: async () => {
        events.push('launch');
        return 0;
      },
    });

    expect(code).toBe(0);
    expect(events).toEqual(['seed', 'launch']);
    expect(confirmSeedReset).toHaveBeenCalledWith(
      'workspace-alpha-grounding/base',
      '.fixtures/workbenches/workspace-alpha-grounding',
    );
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

  it('rejects path-like workbench names', async () => {
    let stderr = '';

    const code = await runDevCli({
      argv: ['--workbench', '../outside'],
      cwd: REPO_ROOT,
      stderr: (chunk) => {
        stderr += chunk;
      },
    });

    expect(code).toBe(1);
    expect(stderr).toContain('--workbench must start with a letter or number');
  });

  it('explains the first-character constraint for invalid workbench names', async () => {
    let stderr = '';

    const code = await runDevCli({
      argv: ['--workbench', '.hidden'],
      cwd: REPO_ROOT,
      stderr: (chunk) => {
        stderr += chunk;
      },
    });

    expect(code).toBe(1);
    expect(stderr).toContain('must start with a letter or number');
  });

  it('rejects explicit --reset without --seed before entering the prompt flow', async () => {
    let stderr = '';

    const code = await runDevCli({
      argv: ['--reset'],
      cwd: REPO_ROOT,
      stderr: (chunk) => {
        stderr += chunk;
      },
    });

    expect(code).toBe(1);
    expect(stderr).toContain('--reset only applies when paired with --seed.');
  });

  it('documents every launch source in usage text', async () => {
    let stdout = '';

    const code = await runDevCli({
      argv: ['help'],
      cwd: REPO_ROOT,
      stdout: (chunk) => {
        stdout += chunk;
      },
    });

    expect(code).toBe(0);
    expect(stdout).toContain('npm run dev-cli');
    expect(stdout).toContain('--temp');
    expect(stdout).toContain('--workbench <name>');
    expect(stdout).toContain('--workspace <dir>');
    expect(stdout).toContain('--seed <name>/<variant>');
    expect(stdout).toContain('--no-webui');
    expect(stdout).not.toContain('dev:raw');
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
