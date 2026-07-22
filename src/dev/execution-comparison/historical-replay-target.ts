import { copyFile, lstat, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCommand, type CommandRunner } from '../../app/command-runner.js';
import {
  createBrunchExecutionLaunch,
  type ExecutionLaunch,
} from '../end-to-end-comparison/brunch-adapter.js';
import { createClaudeExecutionLaunch } from '../end-to-end-comparison/claude-adapter.js';
import { materializeExactExecutionPacket } from '../end-to-end-comparison/public-packet.js';
import {
  admitHistoricalReplay,
  createBrunchSolutionIsolationPolicy,
  createClaudeSolutionIsolationPolicy,
  createNetworkDeniedCommandRunner,
  materializePinnedSourceTree,
  SolutionIsolationAdmissionError,
  type BrunchSolutionIsolationPolicy,
  type ClaudeSolutionIsolationPolicy,
  type IsolationAdmissionReason,
  type NetworkDeniedCommandRunner,
} from '../end-to-end-comparison/solution-isolation.js';
import { assertControllerIsolation } from '../end-to-end-comparison/study-contract.js';
import { seedBrownfieldBrunchExecutionWorkspace } from './brunch-lane.js';
import {
  isBrowserExecutionCaseContract,
  type PinnedExecutionCaseId,
  type PublicCasePacket,
} from './case-contract.js';

const RECIPE_VERSION = 1 as const;
const COMPARISON_GIT_IDENTITY = [
  '-c',
  'user.name=Brunch Comparison',
  '-c',
  'user.email=brunch-comparison@invalid.local',
] as const;
const NO_DEPENDENCY_RECIPE = { recipe: 'none' } as const;
const PETRINAUT_DEPENDENCY_RECIPE = {
  recipe: 'petrinaut-yarn-immutable-v1',
  command: 'corepack',
  args: ['yarn', 'install', '--immutable', '--mode=skip-build'],
} as const;
type HistoricalReplayDependencyRecipe = typeof NO_DEPENDENCY_RECIPE | typeof PETRINAUT_DEPENDENCY_RECIPE;
const DEPENDENCY_RECIPE_BY_PINNED_CASE = {
  'brunch-host-landing-v1': NO_DEPENDENCY_RECIPE,
  'petrinaut-optimization-v1': PETRINAUT_DEPENDENCY_RECIPE,
} as const satisfies Record<PinnedExecutionCaseId, HistoricalReplayDependencyRecipe>;

type HistoricalReplayPreparationPhase =
  | 'source_materialization'
  | 'packet_freeze'
  | 'dependency_preparation'
  | 'admission'
  | 'lane_finalization';

interface HistoricalReplayReadyBase {
  readonly status: 'ready';
  readonly recipeVersion: typeof RECIPE_VERSION;
  readonly caseId: string;
  readonly targetDir: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly materializedCommit: string;
  readonly baseSha: string;
  readonly dependencyPreparation:
    | {
        readonly recipe: 'none';
        readonly status: 'not_required';
      }
    | {
        readonly recipe: typeof PETRINAUT_DEPENDENCY_RECIPE.recipe;
        readonly command: typeof PETRINAUT_DEPENDENCY_RECIPE.command;
        readonly args: typeof PETRINAUT_DEPENDENCY_RECIPE.args;
        readonly status: 'passed';
        readonly exitCode: 0;
      };
  readonly launch: ExecutionLaunch;
}

export interface BrunchHistoricalReplayReady extends HistoricalReplayReadyBase {
  readonly lane: 'brunch';
  readonly specId: number;
  readonly isolationPolicy: BrunchSolutionIsolationPolicy;
}

export interface ClaudeHistoricalReplayReady extends HistoricalReplayReadyBase {
  readonly lane: 'claude_code';
  readonly isolationPolicy: ClaudeSolutionIsolationPolicy;
}

export type HistoricalReplayReady = BrunchHistoricalReplayReady | ClaudeHistoricalReplayReady;

export interface HistoricalReplayCaseSelection {
  readonly caseDir: string;
  readonly packet: PublicCasePacket;
}

export interface HistoricalReplayTargetDependencies {
  readonly runner?: CommandRunner;
  readonly dependencyInstallRunner?: CommandRunner;
  readonly createVerifier?: (forbiddenReadRoots: readonly string[]) => NetworkDeniedCommandRunner;
}

export class HistoricalReplayTargetPreparationError extends Error {
  readonly status = 'setup_failed' as const;
  readonly phase: HistoricalReplayPreparationPhase;
  readonly reasons: readonly IsolationAdmissionReason[];
  override readonly cause: unknown;

  constructor(phase: HistoricalReplayPreparationPhase, cause: unknown) {
    super(`historical replay target preparation failed during ${phase}: ${errorMessage(cause)}`, {
      cause,
    });
    this.name = 'HistoricalReplayTargetPreparationError';
    this.phase = phase;
    this.cause = cause;
    this.reasons = cause instanceof SolutionIsolationAdmissionError ? cause.reasons : [];
  }
}

export async function prepareHistoricalReplayTarget(
  input: {
    readonly lane: HistoricalReplayReady['lane'];
    readonly selectedCase: HistoricalReplayCaseSelection;
    readonly sourceRepositoryDir: string;
    readonly targetDir: string;
    readonly controllerRoot: string;
    readonly forbiddenRoots?: readonly string[];
  },
  dependencies: HistoricalReplayTargetDependencies = {},
): Promise<HistoricalReplayReady> {
  const runner = dependencies.runner ?? runCommand;
  let phase: HistoricalReplayPreparationPhase = 'source_materialization';
  let targetOwned = false;
  try {
    await validateInput(input);
    const contract = input.selectedCase.packet.contract;
    if (isBrowserExecutionCaseContract(contract) || contract.case.repository.substrate !== 'pinned_git') {
      throw new Error('historical replay preparation requires a pinned brownfield case');
    }
    const forbiddenRoots = uniqueRoots([
      input.sourceRepositoryDir,
      input.controllerRoot,
      repositoryRoot(),
      ...(input.forbiddenRoots ?? []),
    ]);
    const materialized = await materializePinnedSourceTree({
      sourceRepositoryDir: input.sourceRepositoryDir,
      sourceCommit: contract.case.repository.parentCommit,
      targetDir: input.targetDir,
      runner,
    });
    targetOwned = true;
    if (
      materialized.sourceCommit !== contract.case.repository.parentCommit ||
      materialized.sourceTree !== contract.case.repository.parentTree
    ) {
      throw new Error('pinned source identity does not match the frozen execution contract');
    }

    phase = 'packet_freeze';
    const packetRoot = await mkdtemp(join(tmpdir(), 'brunch-historical-replay-packet-'));
    let packetFiles: typeof input.selectedCase.packet.files;
    try {
      const packet = await materializeExactExecutionPacket({
        specificationPath: join(
          input.selectedCase.caseDir,
          input.selectedCase.packet.contract.case.specification,
        ),
        publicContractTemplatePath: join(input.selectedCase.caseDir, 'public-contract.json'),
        packetDir: join(packetRoot, 'packet'),
      });
      if (packet.packet.packetSha256 !== input.selectedCase.packet.packetSha256) {
        throw new Error('exact execution packet drifted from the frozen selected case');
      }
      packetFiles = packet.packet.files;
      for (const file of packetFiles) {
        await copyFile(join(packet.packetDir, file.path), join(input.targetDir, file.path));
      }
    } finally {
      await rm(packetRoot, { recursive: true, force: true });
    }
    await gitChecked(runner, input.targetDir, ['add', '--', 'public-contract.json', 'spec.md']);
    await gitChecked(runner, input.targetDir, [
      ...COMPARISON_GIT_IDENTITY,
      'commit',
      '-m',
      'Freeze exact comparison handoff',
    ]);
    const baseSha = (await gitChecked(runner, input.targetDir, ['rev-parse', 'HEAD'])).stdout.trim();

    phase = 'dependency_preparation';
    const dependencyRecipe = DEPENDENCY_RECIPE_BY_PINNED_CASE[contract.case.id];
    const dependencyPreparation =
      dependencyRecipe.recipe === 'none'
        ? ({ ...dependencyRecipe, status: 'not_required' } as const)
        : await preparePetrinautDependencies({
            targetDir: input.targetDir,
            runner,
            dependencyInstallRunner: dependencies.dependencyInstallRunner ?? runCommand,
          });

    phase = 'admission';
    const claudePolicy = createClaudeSolutionIsolationPolicy(input.targetDir, forbiddenRoots);
    const brunchPolicy = createBrunchSolutionIsolationPolicy(input.targetDir);
    await admitHistoricalReplay({
      prefix: {
        ...materialized,
        baseSha,
        packetFiles,
      },
      policies: [claudePolicy, brunchPolicy],
      forbiddenRoots,
      networkProbeUrls: [],
      verifier:
        dependencies.createVerifier?.(forbiddenRoots) ??
        createNetworkDeniedCommandRunner({ forbiddenReadRoots: forbiddenRoots }),
      localChecks: [],
      runner,
    });

    phase = 'lane_finalization';
    const common = {
      status: 'ready' as const,
      recipeVersion: RECIPE_VERSION,
      caseId: contract.case.id,
      targetDir: input.targetDir,
      sourceCommit: materialized.sourceCommit,
      sourceTree: materialized.sourceTree,
      materializedCommit: materialized.syntheticCommit,
      baseSha,
      dependencyPreparation,
    };
    if (input.lane === 'brunch') {
      const seeded = await seedBrownfieldBrunchExecutionWorkspace({ workspaceDir: input.targetDir });
      await assertTrackedSourceClean(runner, input.targetDir, 'Brunch graph preparation');
      return {
        ...common,
        lane: 'brunch',
        specId: seeded.specId,
        isolationPolicy: brunchPolicy,
        launch: createBrunchExecutionLaunch({
          workspaceDir: input.targetDir,
          specId: seeded.specId,
          forbiddenRoots,
        }),
      };
    }
    return {
      ...common,
      lane: 'claude_code',
      isolationPolicy: claudePolicy,
      launch: createClaudeExecutionLaunch({
        workspaceDir: input.targetDir,
        isolationPolicy: claudePolicy,
      }),
    };
  } catch (error) {
    if (targetOwned) {
      await rm(input.targetDir, { recursive: true, force: true });
    }
    throw new HistoricalReplayTargetPreparationError(phase, error);
  }
}

async function preparePetrinautDependencies(input: {
  readonly targetDir: string;
  readonly runner: CommandRunner;
  readonly dependencyInstallRunner: CommandRunner;
}): Promise<{
  readonly recipe: typeof PETRINAUT_DEPENDENCY_RECIPE.recipe;
  readonly command: typeof PETRINAUT_DEPENDENCY_RECIPE.command;
  readonly args: typeof PETRINAUT_DEPENDENCY_RECIPE.args;
  readonly status: 'passed';
  readonly exitCode: 0;
}> {
  const result = await input.dependencyInstallRunner(
    PETRINAUT_DEPENDENCY_RECIPE.command,
    PETRINAUT_DEPENDENCY_RECIPE.args,
    {
      cwd: input.targetDir,
      timeoutMs: 30 * 60_000,
      maxOutputBytes: 256 * 1024,
    },
  );
  if (result.exitCode !== 0) {
    throw new Error(
      `${PETRINAUT_DEPENDENCY_RECIPE.command} ${PETRINAUT_DEPENDENCY_RECIPE.args.join(
        ' ',
      )} controller dependency preparation failed (${result.exitCode}): ${result.stderr || result.stdout}`,
    );
  }
  await assertTrackedSourceClean(input.runner, input.targetDir, 'controller dependency preparation');
  return {
    ...PETRINAUT_DEPENDENCY_RECIPE,
    status: 'passed',
    exitCode: 0,
  };
}

async function assertTrackedSourceClean(
  runner: CommandRunner,
  targetDir: string,
  owner: string,
): Promise<void> {
  const trackedStatus = (
    await gitChecked(runner, targetDir, ['status', '--porcelain', '--untracked-files=no'])
  ).stdout.trim();
  if (trackedStatus.length > 0) {
    throw new Error(`${owner} modified tracked source: ${trackedStatus}`);
  }
}

async function validateInput(input: {
  readonly sourceRepositoryDir: string;
  readonly targetDir: string;
  readonly controllerRoot: string;
}): Promise<void> {
  if (!isAbsolute(input.sourceRepositoryDir)) {
    throw new Error('pinned source repository must be an absolute path');
  }
  if (!isAbsolute(input.targetDir)) {
    throw new Error('historical replay target must be an absolute path');
  }
  if (!isAbsolute(input.controllerRoot)) {
    throw new Error('historical replay preparation requires an absolute controller root');
  }
  const source = await lstat(input.sourceRepositoryDir);
  if (!source.isDirectory() || source.isSymbolicLink()) {
    throw new Error('pinned source repository must be a real directory, not a symlink');
  }
  assertControllerIsolation({
    controllerRoot: input.controllerRoot,
    targetRoots: [input.targetDir],
  });
  assertControllerIsolation({
    controllerRoot: input.sourceRepositoryDir,
    targetRoots: [input.targetDir],
  });
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

function uniqueRoots(roots: readonly string[]): string[] {
  return [...new Set(roots.map((root) => resolve(root)))];
}

function repositoryRoot(): string {
  return fileURLToPath(new URL('../../../', import.meta.url));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
