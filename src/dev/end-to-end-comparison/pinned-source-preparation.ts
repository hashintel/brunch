import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runCommand, type CommandRunner } from '../../app/command-runner.js';
import { materializeExactExecutionPacket } from './public-packet.js';
import { materializePinnedSourceTree } from './solution-isolation.js';
import { assertControllerIsolation } from './study-contract.js';

const COMPARISON_GIT_IDENTITY = [
  '-c',
  'user.name=Brunch Comparison',
  '-c',
  'user.email=brunch-comparison@invalid.local',
] as const;

export const PINNED_DEPENDENCY_PREPARATION = {
  command: 'corepack',
  args: ['yarn', 'install', '--immutable', '--mode=skip-build'],
} as const;

export interface PreparedPinnedExecutionWorkspace {
  readonly lane: 'brunch' | 'claude_code';
  readonly targetDir: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly materializedCommit: string;
  readonly baseSha: string;
  readonly dependencyPreparation: {
    readonly command: typeof PINNED_DEPENDENCY_PREPARATION.command;
    readonly args: typeof PINNED_DEPENDENCY_PREPARATION.args;
    readonly status: 'passed';
    readonly exitCode: 0;
  };
}

export async function preparePinnedExecutionWorkspace(
  input: {
    readonly lane: PreparedPinnedExecutionWorkspace['lane'];
    readonly sourceRepositoryDir: string;
    readonly sourceCommit: string;
    readonly expectedSourceTree: string;
    readonly targetDir: string;
    readonly controllerRoot: string;
    readonly specificationPath: string;
    readonly publicContractTemplatePath: string;
    readonly dependencyInstallRunner?: CommandRunner;
  },
  runner: CommandRunner = runCommand,
): Promise<PreparedPinnedExecutionWorkspace> {
  assertControllerIsolation({
    controllerRoot: input.controllerRoot,
    targetRoots: [input.targetDir],
  });
  assertControllerIsolation({
    controllerRoot: input.sourceRepositoryDir,
    targetRoots: [input.targetDir],
  });
  const materialized = await materializePinnedSourceTree({
    sourceRepositoryDir: input.sourceRepositoryDir,
    sourceCommit: input.sourceCommit,
    targetDir: input.targetDir,
    runner,
  });
  if (materialized.sourceTree !== input.expectedSourceTree) {
    await rm(input.targetDir, { recursive: true, force: true });
    throw new Error('pinned source tree does not match the frozen execution contract');
  }

  const packetRoot = await mkdtemp(join(tmpdir(), 'brunch-pinned-execution-packet-'));
  try {
    const packet = await materializeExactExecutionPacket({
      specificationPath: input.specificationPath,
      publicContractTemplatePath: input.publicContractTemplatePath,
      packetDir: join(packetRoot, 'packet'),
    });
    for (const file of packet.packet.files) {
      await copyFile(join(packet.packetDir, file.path), join(input.targetDir, file.path));
    }
    await gitChecked(runner, input.targetDir, ['add', '--', 'public-contract.json', 'spec.md']);
    await gitChecked(runner, input.targetDir, [
      ...COMPARISON_GIT_IDENTITY,
      'commit',
      '-m',
      'Freeze exact comparison handoff',
    ]);
    const baseSha = (await gitChecked(runner, input.targetDir, ['rev-parse', 'HEAD'])).stdout.trim();
    const dependencyInstallRunner = input.dependencyInstallRunner ?? runCommand;
    const installed = await dependencyInstallRunner(
      PINNED_DEPENDENCY_PREPARATION.command,
      PINNED_DEPENDENCY_PREPARATION.args,
      {
        cwd: input.targetDir,
        timeoutMs: 30 * 60_000,
        maxOutputBytes: 256 * 1024,
      },
    );
    if (installed.exitCode !== 0) {
      throw new Error(
        `${PINNED_DEPENDENCY_PREPARATION.command} ${PINNED_DEPENDENCY_PREPARATION.args.join(
          ' ',
        )} controller dependency preparation failed (${installed.exitCode}): ${
          installed.stderr || installed.stdout
        }`,
      );
    }
    const trackedStatus = (
      await gitChecked(runner, input.targetDir, ['status', '--porcelain', '--untracked-files=no'])
    ).stdout.trim();
    if (trackedStatus.length > 0) {
      throw new Error(`controller dependency preparation modified tracked source: ${trackedStatus}`);
    }
    const sourceIdentity = JSON.parse(
      await readFile(join(input.targetDir, '.comparison-source.json'), 'utf8'),
    ) as {
      sourceCommit?: string;
      sourceTree?: string;
    };
    if (
      sourceIdentity.sourceCommit !== materialized.sourceCommit ||
      sourceIdentity.sourceTree !== materialized.sourceTree
    ) {
      throw new Error('materialized source identity drifted while freezing the execution handoff');
    }
    return {
      lane: input.lane,
      targetDir: input.targetDir,
      sourceCommit: materialized.sourceCommit,
      sourceTree: materialized.sourceTree,
      materializedCommit: materialized.syntheticCommit,
      baseSha,
      dependencyPreparation: {
        ...PINNED_DEPENDENCY_PREPARATION,
        status: 'passed',
        exitCode: 0,
      },
    };
  } catch (error) {
    await rm(input.targetDir, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(packetRoot, { recursive: true, force: true });
  }
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
