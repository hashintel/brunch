import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { runCommand, type CommandResult, type CommandRunner } from '../../app/command-runner.js';

const RECIPE_VERSION = 1 as const;
const SOURCE_IDENTITY_FILE = '.comparison-source.json';
const COMPARISON_GIT_IDENTITY = [
  '-c',
  'user.name=Brunch Comparison',
  '-c',
  'user.email=brunch-comparison@invalid.local',
] as const;

export interface MaterializedPinnedSourceTree {
  readonly recipeVersion: typeof RECIPE_VERSION;
  readonly targetDir: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly syntheticCommit: string;
}

export interface MaterializedHistoricalReplayPrefix extends MaterializedPinnedSourceTree {
  readonly baseSha: string;
  readonly packetFiles: readonly {
    readonly path: 'public-contract.json' | 'spec.md';
    readonly sha256: string;
  }[];
}

export interface ClaudeSolutionIsolationPolicy {
  readonly executor: 'claude_code';
  readonly recipeVersion: typeof RECIPE_VERSION;
  readonly targetRoot: string;
  readonly strictMcp: true;
  readonly mcpServers: readonly [];
  readonly webTools: false;
  readonly ambientSettings: false;
  readonly ambientPlugins: false;
  readonly permissionMode: 'dontAsk';
  readonly nativeSandbox: {
    readonly enabled: true;
    readonly failIfUnavailable: true;
    readonly allowedDomains: readonly [];
    readonly deniedDomains: readonly [];
    readonly deniedReadRoots: readonly string[];
  };
  readonly allowedTools: readonly ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Write'];
}

export interface BrunchSolutionIsolationPolicy {
  readonly executor: 'brunch';
  readonly recipeVersion: typeof RECIPE_VERSION;
  readonly targetRoot: string;
  readonly foregroundWebTools: false;
  readonly specifySubagents: false;
  readonly foregroundFileRoot: string;
  readonly executionSubagents: readonly ['planner', 'worker'];
}

export type SolutionIsolationPolicy = ClaudeSolutionIsolationPolicy | BrunchSolutionIsolationPolicy;

export async function materializePinnedSourceTree(input: {
  readonly sourceRepositoryDir: string;
  readonly sourceCommit: string;
  readonly targetDir: string;
  readonly runner?: CommandRunner;
}): Promise<MaterializedPinnedSourceTree> {
  const runner = input.runner ?? runCommand;
  const sourceCommit = (
    await gitChecked(runner, input.sourceRepositoryDir, [
      'rev-parse',
      '--verify',
      `${input.sourceCommit}^{commit}`,
    ])
  ).stdout.trim();
  const sourceTree = (
    await gitChecked(runner, input.sourceRepositoryDir, ['rev-parse', '--verify', `${sourceCommit}^{tree}`])
  ).stdout.trim();
  const archiveDir = await mkdtemp(join(tmpdir(), 'brunch-pinned-source-'));
  const archivePath = join(archiveDir, 'source.tar');
  let targetCreated = false;
  try {
    await mkdir(dirname(input.targetDir), { recursive: true });
    await mkdir(input.targetDir);
    targetCreated = true;
    await commandChecked(runner, input.sourceRepositoryDir, 'git', [
      'archive',
      '--format=tar',
      `--output=${archivePath}`,
      sourceCommit,
    ]);
    await commandChecked(runner, input.targetDir, 'tar', ['-xf', archivePath]);
    await writeFile(
      join(input.targetDir, SOURCE_IDENTITY_FILE),
      `${JSON.stringify({ recipeVersion: RECIPE_VERSION, sourceCommit, sourceTree }, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );
    await gitChecked(runner, input.targetDir, ['init', '--initial-branch=main']);
    await gitChecked(runner, input.targetDir, ['add', '--all']);
    await gitChecked(runner, input.targetDir, [
      ...COMPARISON_GIT_IDENTITY,
      'commit',
      '-m',
      'Materialize pinned comparison source',
    ]);
    const syntheticCommit = (await gitChecked(runner, input.targetDir, ['rev-parse', 'HEAD'])).stdout.trim();
    return {
      recipeVersion: RECIPE_VERSION,
      targetDir: input.targetDir,
      sourceCommit,
      sourceTree,
      syntheticCommit,
    };
  } catch (error) {
    if (targetCreated) await rm(input.targetDir, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(archiveDir, { recursive: true, force: true });
  }
}

export function createClaudeSolutionIsolationPolicy(
  targetRoot: string,
  forbiddenRoots: readonly string[] = [],
): ClaudeSolutionIsolationPolicy {
  return {
    executor: 'claude_code',
    recipeVersion: RECIPE_VERSION,
    targetRoot: resolve(targetRoot),
    strictMcp: true,
    mcpServers: [],
    webTools: false,
    ambientSettings: false,
    ambientPlugins: false,
    permissionMode: 'dontAsk',
    nativeSandbox: {
      enabled: true,
      failIfUnavailable: true,
      allowedDomains: [],
      deniedDomains: [],
      deniedReadRoots: [...new Set(forbiddenRoots.map((root) => resolve(root)))],
    },
    allowedTools: ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Write'],
  };
}

export function createBrunchSolutionIsolationPolicy(targetRoot: string): BrunchSolutionIsolationPolicy {
  const root = resolve(targetRoot);
  return {
    executor: 'brunch',
    recipeVersion: RECIPE_VERSION,
    targetRoot: root,
    foregroundWebTools: false,
    specifySubagents: false,
    foregroundFileRoot: root,
    executionSubagents: ['planner', 'worker'],
  };
}

export async function verifyPreparedHistoricalReplay(input: {
  readonly prefix: MaterializedHistoricalReplayPrefix;
  readonly runner?: CommandRunner;
}): Promise<void> {
  const runner = input.runner ?? runCommand;
  const identity = JSON.parse(
    await readFile(join(input.prefix.targetDir, SOURCE_IDENTITY_FILE), 'utf8'),
  ) as Partial<MaterializedPinnedSourceTree>;
  if (
    identity.recipeVersion !== RECIPE_VERSION ||
    identity.sourceCommit !== input.prefix.sourceCommit ||
    identity.sourceTree !== input.prefix.sourceTree
  ) {
    throw new Error('materialized source identity does not match the frozen case');
  }
  const remotes = (await gitChecked(runner, input.prefix.targetDir, ['remote'])).stdout.trim();
  if (remotes !== '') throw new Error('historical replay target must not have Git remotes');
  const trackedStatus = (
    await gitChecked(runner, input.prefix.targetDir, ['status', '--porcelain', '--untracked-files=no'])
  ).stdout.trim();
  if (trackedStatus !== '') throw new Error('historical replay target has tracked source changes');
  for (const file of input.prefix.packetFiles) {
    const digest = `sha256:${createHash('sha256')
      .update(await readFile(join(input.prefix.targetDir, file.path)))
      .digest('hex')}`;
    if (digest !== file.sha256) throw new Error(`historical replay packet drifted: ${file.path}`);
  }
}

async function gitChecked(
  runner: CommandRunner,
  cwd: string,
  args: readonly string[],
): Promise<CommandResult> {
  return await commandChecked(runner, cwd, 'git', args);
}

async function commandChecked(
  runner: CommandRunner,
  cwd: string,
  command: string,
  args: readonly string[],
): Promise<CommandResult> {
  const result = await runner(command, args, { cwd });
  if (result.exitCode !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}
