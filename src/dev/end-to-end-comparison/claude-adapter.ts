import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { runCommand, type CommandResult, type CommandRunner } from '../../app/command-runner.js';
import type { ExecutionLaunch } from './brunch-adapter.js';
import { materializeExactExecutionPacket } from './public-packet.js';
import type { ClaudeSolutionIsolationPolicy } from './solution-isolation.js';
import { assertControllerIsolation } from './study-contract.js';
import { containedPath } from './validation.js';

const COMPARISON_GIT_IDENTITY = [
  '-c',
  'user.name=Brunch Comparison',
  '-c',
  'user.email=brunch-comparison@invalid.local',
] as const;

export interface PreparedClaudeExecutionWorkspace {
  readonly workspaceDir: string;
  readonly baseSha: string;
  readonly launch: ExecutionLaunch;
}

export interface ClaudeLaneReadyExecutionTarget {
  readonly lane: 'claude_code';
  readonly targetDir: string;
  readonly baseSha: string;
  readonly launch: ExecutionLaunch;
}

export interface ClaudeExecutionRun {
  readonly startedAt: string;
  readonly endedAt: string;
  readonly result: CommandResult;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly repository?: {
    readonly baseSha: string;
    readonly reviewSha: string;
    readonly finalGitRange: string;
  };
  readonly cleanup: {
    readonly status: 'clean';
    readonly liveProcesses: 0;
    readonly liveSessions: 0;
  };
}

export function createClaudeExecutionLaunch(input: {
  readonly workspaceDir: string;
  readonly isolationPolicy: ClaudeSolutionIsolationPolicy;
}): ExecutionLaunch {
  return {
    command: 'claude',
    args: [
      '--print',
      '--verbose',
      '--output-format',
      'stream-json',
      '--model',
      'claude-opus-4-8',
      '--effort',
      'max',
      '--permission-mode',
      input.isolationPolicy.permissionMode,
      '--no-session-persistence',
      '--disable-slash-commands',
      '--no-chrome',
      '--strict-mcp-config',
      '--mcp-config',
      '{"mcpServers":{}}',
      '--setting-sources',
      '',
      '--tools',
      input.isolationPolicy.allowedTools.join(','),
      '--allowedTools',
      ...input.isolationPolicy.allowedTools,
      '--disallowedTools',
      'WebFetch',
      'WebSearch',
      '--settings',
      JSON.stringify({
        enabledPlugins: {},
        permissions: {
          allow: input.isolationPolicy.allowedTools,
          deny: ['WebFetch', 'WebSearch'],
        },
        sandbox: {
          enabled: input.isolationPolicy.nativeSandbox.enabled,
          failIfUnavailable: input.isolationPolicy.nativeSandbox.failIfUnavailable,
          autoAllowBashIfSandboxed: true,
          allowUnsandboxedCommands: false,
          filesystem: {
            denyRead: input.isolationPolicy.nativeSandbox.deniedReadRoots,
          },
          network: {
            allowedDomains: input.isolationPolicy.nativeSandbox.allowedDomains,
            deniedDomains: input.isolationPolicy.nativeSandbox.deniedDomains,
          },
        },
      }),
      implementationPrompt(),
    ],
    cwd: input.workspaceDir,
  };
}

function createGreenfieldClaudeExecutionLaunch(workspaceDir: string): ExecutionLaunch {
  return {
    command: 'claude',
    args: [
      '--print',
      '--verbose',
      '--output-format',
      'stream-json',
      '--model',
      'claude-opus-4-8',
      '--effort',
      'max',
      '--permission-mode',
      'bypassPermissions',
      '--no-session-persistence',
      '--disable-slash-commands',
      '--no-chrome',
      implementationPrompt(),
    ],
    cwd: workspaceDir,
  };
}

export async function prepareClaudeExecutionWorkspace(
  input: {
    readonly workspaceDir: string;
    readonly controllerRoot: string;
    readonly specificationPath: string;
    readonly publicContractTemplatePath: string;
  },
  runner: CommandRunner = runCommand,
): Promise<PreparedClaudeExecutionWorkspace> {
  assertControllerIsolation({
    controllerRoot: input.controllerRoot,
    targetRoots: [input.workspaceDir],
  });
  if (containedPath(input.controllerRoot, input.specificationPath)) {
    throw new Error('specification may not come from the controller root');
  }
  await materializeExactExecutionPacket({
    specificationPath: input.specificationPath,
    publicContractTemplatePath: input.publicContractTemplatePath,
    packetDir: input.workspaceDir,
  });
  await gitChecked(runner, input.workspaceDir, ['init']);
  await gitChecked(runner, input.workspaceDir, ['add', 'public-contract.json', 'spec.md']);
  await gitChecked(runner, input.workspaceDir, [
    ...COMPARISON_GIT_IDENTITY,
    'commit',
    '-m',
    'Freeze comparison input',
  ]);
  const baseSha = (await gitChecked(runner, input.workspaceDir, ['rev-parse', 'HEAD'])).stdout.trim();
  return {
    workspaceDir: input.workspaceDir,
    baseSha,
    launch: createGreenfieldClaudeExecutionLaunch(input.workspaceDir),
  };
}

export async function runClaudeExecutionWorkspace(
  input: {
    readonly prepared: PreparedClaudeExecutionWorkspace | ClaudeLaneReadyExecutionTarget;
    readonly evidenceDir: string;
    readonly elapsedMinutes: number;
  },
  runner: CommandRunner = runCommand,
): Promise<ClaudeExecutionRun> {
  if (!Number.isSafeInteger(input.elapsedMinutes) || input.elapsedMinutes <= 0) {
    throw new Error('Claude execution budget must be a positive whole number of minutes');
  }
  await mkdir(input.evidenceDir);
  const workspaceDir = 'targetDir' in input.prepared ? input.prepared.targetDir : input.prepared.workspaceDir;
  const startedAt = new Date().toISOString();
  // ceiling: retain at most 10 MiB per provider stream; raise or stream to disk if real runs exceed it.
  const result = await runner(input.prepared.launch.command, input.prepared.launch.args, {
    cwd: workspaceDir,
    timeoutMs: input.elapsedMinutes * 60_000,
    maxOutputBytes: 10 * 1024 * 1024,
  });
  const endedAt = new Date().toISOString();
  const stdoutPath = join(input.evidenceDir, 'claude.stdout.ndjson');
  const stderrPath = join(input.evidenceDir, 'claude.stderr.txt');
  await writeFile(stdoutPath, result.stdout, { encoding: 'utf8', flag: 'wx' });
  await writeFile(stderrPath, result.stderr, { encoding: 'utf8', flag: 'wx' });
  let repository: ClaudeExecutionRun['repository'];
  try {
    repository = await finalizeClaudeExecutionWorkspace(
      { workspaceDir, baseSha: input.prepared.baseSha },
      runner,
    );
  } catch {
    repository = undefined;
  }
  return {
    startedAt,
    endedAt,
    result,
    stdoutPath,
    stderrPath,
    ...(repository === undefined ? {} : { repository }),
    cleanup: { status: 'clean', liveProcesses: 0, liveSessions: 0 },
  };
}

export async function finalizeClaudeExecutionWorkspace(
  input: {
    readonly workspaceDir: string;
    readonly baseSha?: string;
  },
  runner: CommandRunner = runCommand,
): Promise<{
  readonly baseSha: string;
  readonly reviewSha: string;
  readonly finalGitRange: string;
}> {
  const baseSha =
    input.baseSha ??
    (await gitChecked(runner, input.workspaceDir, ['rev-list', '--max-parents=0', 'HEAD'])).stdout
      .trim()
      .split('\n')[0]!;
  const resolvedBase = (
    await gitChecked(runner, input.workspaceDir, ['rev-parse', '--verify', `${baseSha}^{commit}`])
  ).stdout.trim();
  if (resolvedBase !== baseSha) {
    throw new Error('Claude execution base does not match the lane-ready descriptor');
  }
  const status = await gitChecked(runner, input.workspaceDir, ['status', '--porcelain']);
  if (status.stdout.trim().length > 0) {
    await gitChecked(runner, input.workspaceDir, ['add', '--all']);
    await gitChecked(runner, input.workspaceDir, [
      ...COMPARISON_GIT_IDENTITY,
      'commit',
      '-m',
      'Retain comparison output',
    ]);
  }
  const reviewSha = (await gitChecked(runner, input.workspaceDir, ['rev-parse', 'HEAD'])).stdout.trim();
  if (reviewSha === baseSha) {
    throw new Error('Claude execution produced no retained implementation changes');
  }
  return {
    baseSha,
    reviewSha,
    finalGitRange: `${baseSha}..${reviewSha}`,
  };
}

async function gitChecked(
  runner: CommandRunner,
  cwd: string,
  args: readonly string[],
): ReturnType<CommandRunner> {
  const result = await runner('git', args, { cwd });
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}

function implementationPrompt(): string {
  return [
    'Implement the exact approved specification in spec.md.',
    'Treat public-contract.json as the only additional delivery and interoperability baseline.',
    'Work only inside the current Git repository. Do not inspect parent directories or external project files.',
    'Do not reinterpret, normalize, or repair the specification.',
    'Run npm test and npm run build. Leave the complete implementation in the working tree when both pass.',
    'Do not create or use browser-oracle files; those are controller-owned and unavailable.',
  ].join(' ');
}
