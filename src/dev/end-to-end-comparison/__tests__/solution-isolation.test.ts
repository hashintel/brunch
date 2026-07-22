import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runCommand } from '../../../app/command-runner.js';
import {
  admitHistoricalReplay,
  createBrunchSolutionIsolationPolicy,
  createClaudeSolutionIsolationPolicy,
  createNetworkDeniedCommandRunner,
  materializePinnedSourceTree,
  SolutionIsolationAdmissionError,
  type NetworkDeniedCommandRunner,
  type SolutionIsolationPolicy,
} from '../solution-isolation.js';

const roots: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })));
});

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const result = await runCommand('git', args, { cwd });
  if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

async function sourceRepository(root: string): Promise<{
  readonly repositoryDir: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
}> {
  const repositoryDir = join(root, 'source');
  await mkdir(repositoryDir);
  await git(repositoryDir, ['init']);
  await writeFile(join(repositoryDir, 'package.json'), '{"scripts":{"verify":"node verify.mjs"}}\n');
  await writeFile(join(repositoryDir, 'verify.mjs'), "process.stdout.write('local-ok')\n");
  await git(repositoryDir, ['add', '.']);
  await git(repositoryDir, [
    '-c',
    'user.name=Isolation Test',
    '-c',
    'user.email=isolation@invalid.local',
    'commit',
    '-m',
    'Pinned source',
  ]);
  const sourceCommit = await git(repositoryDir, ['rev-parse', 'HEAD']);
  const sourceTree = await git(repositoryDir, ['rev-parse', 'HEAD^{tree}']);
  return { repositoryDir, sourceCommit, sourceTree };
}

async function localProbeUrl(): Promise<string> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('reachable');
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('expected TCP server address');
  return `http://127.0.0.1:${address.port}`;
}

function strictPolicies(
  targetDir: string,
  forbiddenRoots: readonly string[],
): readonly SolutionIsolationPolicy[] {
  return [
    createClaudeSolutionIsolationPolicy(targetDir, forbiddenRoots),
    createBrunchSolutionIsolationPolicy(targetDir),
  ];
}

describe('brownfield historical-solution isolation', () => {
  it('materializes a pinned tree as one history-free target with retained source identity', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-solution-isolation-'));
    roots.push(root);
    const source = await sourceRepository(root);
    const targetDir = join(root, 'target');
    await writeFile(join(source.repositoryDir, 'historical-reference.patch'), 'must not enter target\n');

    const materialized = await materializePinnedSourceTree({
      sourceRepositoryDir: source.repositoryDir,
      sourceCommit: source.sourceCommit,
      targetDir,
    });

    expect(materialized).toMatchObject({
      targetDir,
      sourceCommit: source.sourceCommit,
      sourceTree: source.sourceTree,
      recipeVersion: 1,
    });
    expect(JSON.parse(await readFile(join(targetDir, '.comparison-source.json'), 'utf8'))).toEqual({
      recipeVersion: 1,
      sourceCommit: source.sourceCommit,
      sourceTree: source.sourceTree,
    });
    expect(await git(targetDir, ['rev-list', '--count', 'HEAD'])).toBe('1');
    expect(await git(targetDir, ['remote'])).toBe('');
    expect((await git(targetDir, ['for-each-ref', '--format=%(refname)'])).split('\n')).toEqual([
      'refs/heads/main',
    ]);
    expect(await readdir(targetDir)).not.toContain('historical-reference.patch');
  });

  it('admits both executor policies only when paths and target commands stay sealed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-solution-isolation-'));
    roots.push(root);
    const source = await sourceRepository(root);
    const targetDir = join(root, 'target');
    const materialized = await materializePinnedSourceTree({
      sourceRepositoryDir: source.repositoryDir,
      sourceCommit: source.sourceCommit,
      targetDir,
    });
    const probeUrl = await localProbeUrl();
    const forbiddenRoots = [
      source.repositoryDir,
      join(root, 'controller'),
      join(root, 'harness'),
      join(root, 'historical-reference'),
    ];
    await Promise.all(forbiddenRoots.slice(1).map(async (path) => await mkdir(path)));

    const admission = await admitHistoricalReplay({
      materialized,
      policies: strictPolicies(targetDir, forbiddenRoots),
      forbiddenRoots,
      networkProbeUrls: [probeUrl, 'https://github.com', 'https://linear.app', 'https://www.notion.so'],
      verifier: createNetworkDeniedCommandRunner({ forbiddenReadRoots: forbiddenRoots }),
      localChecks: [{ command: process.execPath, args: ['verify.mjs'] }],
    });

    expect(admission).toEqual({
      status: 'admitted',
      recipeVersion: 1,
      sourceCommit: source.sourceCommit,
      sourceTree: source.sourceTree,
      executors: ['claude_code', 'brunch'],
      localChecks: [{ command: process.execPath, args: ['verify.mjs'], exitCode: 0 }],
    });
  });

  it('retains specific reasons for weakened policy, extra Git reachability, path escape, and network', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-solution-isolation-'));
    roots.push(root);
    const source = await sourceRepository(root);
    const targetDir = join(root, 'target');
    const materialized = await materializePinnedSourceTree({
      sourceRepositoryDir: source.repositoryDir,
      sourceCommit: source.sourceCommit,
      targetDir,
    });
    const probeUrl = await localProbeUrl();
    const forbiddenRoots = [source.repositoryDir, join(root, 'controller')];
    await mkdir(forbiddenRoots[1]!);
    const baseInput = {
      materialized,
      forbiddenRoots,
      networkProbeUrls: [probeUrl, 'https://github.com', 'https://linear.app', 'https://www.notion.so'],
      verifier: createNetworkDeniedCommandRunner({ forbiddenReadRoots: forbiddenRoots }),
      localChecks: [{ command: process.execPath, args: ['verify.mjs'] }],
    } as const;

    await expect(
      admitHistoricalReplay({
        ...baseInput,
        policies: [
          {
            ...createClaudeSolutionIsolationPolicy(targetDir, forbiddenRoots),
            strictMcp: false,
          } as unknown as SolutionIsolationPolicy,
          createBrunchSolutionIsolationPolicy(targetDir),
        ],
      }),
    ).rejects.toMatchObject({
      reasons: [expect.objectContaining({ code: 'policy_weakened', executor: 'claude_code' })],
    });

    await expect(
      admitHistoricalReplay({
        ...baseInput,
        policies: [createBrunchSolutionIsolationPolicy(targetDir)],
      }),
    ).rejects.toMatchObject({
      reasons: [expect.objectContaining({ code: 'policy_weakened' })],
    });

    await writeFile(join(targetDir, 'historical-reference.patch'), 'must not be target-visible\n');
    await expect(
      admitHistoricalReplay({
        ...baseInput,
        policies: strictPolicies(targetDir, forbiddenRoots),
      }),
    ).rejects.toMatchObject({
      reasons: [expect.objectContaining({ code: 'git_worktree_changes_present' })],
    });
    await rm(join(targetDir, 'historical-reference.patch'));

    await git(targetDir, ['remote', 'add', 'origin', 'https://github.com/hashintel/brunch.git']);
    await git(targetDir, ['branch', 'later-solution']);
    await expect(
      admitHistoricalReplay({
        ...baseInput,
        policies: strictPolicies(targetDir, forbiddenRoots),
      }),
    ).rejects.toMatchObject({
      reasons: expect.arrayContaining([
        expect.objectContaining({ code: 'git_remote_present' }),
        expect.objectContaining({ code: 'git_ref_present' }),
      ]),
    });
    await git(targetDir, ['remote', 'remove', 'origin']);
    await git(targetDir, ['branch', '-D', 'later-solution']);

    await expect(
      admitHistoricalReplay({
        ...baseInput,
        forbiddenRoots: [join(targetDir, 'nested-controller')],
        policies: strictPolicies(targetDir, [join(targetDir, 'nested-controller')]),
      }),
    ).rejects.toMatchObject({
      reasons: expect.arrayContaining([expect.objectContaining({ code: 'path_boundary_weakened' })]),
    });

    const controllerDir = join(root, 'controller');
    await writeFile(join(controllerDir, 'reference.txt'), 'historical solution\n');
    await symlink(join(controllerDir, 'reference.txt'), join(targetDir, 'escaped-reference.txt'));
    await expect(
      admitHistoricalReplay({
        ...baseInput,
        policies: strictPolicies(targetDir, forbiddenRoots),
      }),
    ).rejects.toMatchObject({
      reasons: expect.arrayContaining([
        expect.objectContaining({
          code: 'path_boundary_weakened',
          detail: 'target symlink escapes isolation root: escaped-reference.txt',
        }),
      ]),
    });
    await rm(join(targetDir, 'escaped-reference.txt'));

    const networkCapableVerifier = {
      recipeVersion: 1 as const,
      platform: 'darwin' as const,
      forbiddenReadRoots: forbiddenRoots,
      run: runCommand,
    } as unknown as NetworkDeniedCommandRunner;
    await expect(
      admitHistoricalReplay({
        ...baseInput,
        verifier: networkCapableVerifier,
        policies: strictPolicies(targetDir, forbiddenRoots),
      }),
    ).rejects.toBeInstanceOf(SolutionIsolationAdmissionError);
    await expect(
      admitHistoricalReplay({
        ...baseInput,
        verifier: networkCapableVerifier,
        policies: strictPolicies(targetDir, forbiddenRoots),
      }),
    ).rejects.toMatchObject({
      reasons: [expect.objectContaining({ code: 'policy_weakened' })],
    });
  });

  it('fails closed when the host cannot provide the versioned isolation recipe', () => {
    expect(() => createNetworkDeniedCommandRunner({ platform: 'linux' })).toThrow(
      'solution isolation recipe v1 is unsupported on linux',
    );
  });
});
