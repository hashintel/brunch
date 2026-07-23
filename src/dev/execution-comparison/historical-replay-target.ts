import { copyFile, lstat, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCommand, type CommandResult, type CommandRunner } from '../../app/command-runner.js';
import {
  createBrunchExecutionLaunch,
  type ExecutionLaunch,
} from '../end-to-end-comparison/brunch-adapter.js';
import { createClaudeExecutionLaunch } from '../end-to-end-comparison/claude-adapter.js';
import { materializeExactExecutionPacket } from '../end-to-end-comparison/public-packet.js';
import {
  createBrunchSolutionIsolationPolicy,
  createClaudeSolutionIsolationPolicy,
  materializePinnedSourceTree,
  verifyPreparedHistoricalReplay,
  type BrunchSolutionIsolationPolicy,
  type ClaudeSolutionIsolationPolicy,
} from '../end-to-end-comparison/solution-isolation.js';
import { assertControllerIsolation } from '../end-to-end-comparison/study-contract.js';
import { seedBrownfieldBrunchExecutionWorkspace } from './brunch-lane.js';
import {
  isPinnedExecutionCaseContract,
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

interface PetrinautDependencyPreparationBase {
  readonly recipe: typeof PETRINAUT_DEPENDENCY_RECIPE.recipe;
  readonly command: typeof PETRINAUT_DEPENDENCY_RECIPE.command;
  readonly args: typeof PETRINAUT_DEPENDENCY_RECIPE.args;
  readonly exitCode: number;
}

export interface PetrinautDependencyPreparationResult extends PetrinautDependencyPreparationBase {
  readonly status: 'passed';
  readonly exitCode: 0;
}

export interface PetrinautDependencyPreparationFailure extends PetrinautDependencyPreparationBase {
  readonly status: 'failed';
  readonly failureStage: 'install' | 'tracked_source_cleanliness';
}

export type PetrinautDependencyPreparationOutcome =
  | PetrinautDependencyPreparationResult
  | PetrinautDependencyPreparationFailure;

export interface PetrinautDependencyPreparationObservation {
  readonly outcome: PetrinautDependencyPreparationOutcome;
  readonly commandResult: CommandResult;
  readonly trackedSourceStatus?: string;
}

export class PetrinautDependencyPreparationError extends Error {
  readonly outcome: PetrinautDependencyPreparationFailure;
  readonly observation: PetrinautDependencyPreparationObservation;

  constructor(
    outcome: PetrinautDependencyPreparationFailure,
    observation: PetrinautDependencyPreparationObservation,
  ) {
    super(
      outcome.failureStage === 'install'
        ? 'compiled Petrinaut dependency install failed'
        : 'compiled Petrinaut dependency install modified tracked source',
    );
    this.name = 'PetrinautDependencyPreparationError';
    this.outcome = outcome;
    this.observation = observation;
  }
}

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
    | PetrinautDependencyPreparationResult;
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
  readonly onPetrinautDependencyPreparation?: (
    observation: PetrinautDependencyPreparationObservation,
  ) => Promise<void> | void;
}

export class HistoricalReplayTargetPreparationError extends Error {
  readonly status = 'setup_failed' as const;
  readonly phase: HistoricalReplayPreparationPhase;
  override readonly cause: unknown;

  constructor(phase: HistoricalReplayPreparationPhase, cause: unknown) {
    super(`historical replay target preparation failed during ${phase}: ${errorMessage(cause)}`, {
      cause,
    });
    this.name = 'HistoricalReplayTargetPreparationError';
    this.phase = phase;
    this.cause = cause;
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
    if (!isPinnedExecutionCaseContract(contract)) {
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
        : await preparePetrinautHistoricalReplayDependencies({
            targetDir: input.targetDir,
            runner,
            dependencyInstallRunner: dependencies.dependencyInstallRunner ?? runCommand,
            ...(dependencies.onPetrinautDependencyPreparation === undefined
              ? {}
              : {
                  onObservation: dependencies.onPetrinautDependencyPreparation,
                }),
          });

    phase = 'admission';
    const claudePolicy = createClaudeSolutionIsolationPolicy(input.targetDir, forbiddenRoots);
    const brunchPolicy = createBrunchSolutionIsolationPolicy(input.targetDir);
    await verifyPreparedHistoricalReplay({
      prefix: {
        ...materialized,
        baseSha,
        packetFiles,
      },
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

export async function preparePetrinautHistoricalReplayDependencies(input: {
  readonly targetDir: string;
  readonly runner: CommandRunner;
  readonly dependencyInstallRunner: CommandRunner;
  readonly onObservation?: (observation: PetrinautDependencyPreparationObservation) => Promise<void> | void;
}): Promise<PetrinautDependencyPreparationResult> {
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
    const outcome: PetrinautDependencyPreparationFailure = {
      ...PETRINAUT_DEPENDENCY_RECIPE,
      status: 'failed',
      exitCode: result.exitCode,
      failureStage: 'install',
    };
    const observation = { outcome, commandResult: result };
    await input.onObservation?.(observation);
    throw new PetrinautDependencyPreparationError(outcome, observation);
  }
  const trackedSourceStatus = await readTrackedSourceStatus(input.runner, input.targetDir);
  if (trackedSourceStatus.length > 0) {
    const outcome: PetrinautDependencyPreparationFailure = {
      ...PETRINAUT_DEPENDENCY_RECIPE,
      status: 'failed',
      exitCode: result.exitCode,
      failureStage: 'tracked_source_cleanliness',
    };
    const observation = {
      outcome,
      commandResult: result,
      trackedSourceStatus,
    };
    await input.onObservation?.(observation);
    throw new PetrinautDependencyPreparationError(outcome, observation);
  }
  const outcome: PetrinautDependencyPreparationResult = {
    ...PETRINAUT_DEPENDENCY_RECIPE,
    status: 'passed',
    exitCode: 0,
  };
  await input.onObservation?.({ outcome, commandResult: result });
  return outcome;
}

async function assertTrackedSourceClean(
  runner: CommandRunner,
  targetDir: string,
  owner: string,
): Promise<void> {
  const trackedStatus = await readTrackedSourceStatus(runner, targetDir);
  if (trackedStatus.length > 0) {
    throw new Error(`${owner} modified tracked source: ${trackedStatus}`);
  }
}

async function readTrackedSourceStatus(runner: CommandRunner, targetDir: string): Promise<string> {
  return (
    await gitChecked(runner, targetDir, ['status', '--porcelain', '--untracked-files=no'])
  ).stdout.trim();
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
