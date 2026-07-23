import { execFile } from 'node:child_process';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';

import { prepareBrunchExecutionWorkspace } from './brunch-lane.js';
import {
  isBrowserExecutionCaseContract,
  loadPublicCasePacket,
  type PublicCasePacket,
} from './case-contract.js';
import {
  prepareHistoricalReplayTarget,
  type HistoricalReplayReady,
  type HistoricalReplayTargetDependencies,
} from './historical-replay-target.js';

const execFileAsync = promisify(execFile);
const SAFE_CASE_ID = /^[a-z0-9][a-z0-9-]*$/u;
const EMPTY_REPOSITORY_COMMIT_ENV = {
  GIT_AUTHOR_NAME: 'brunch',
  GIT_AUTHOR_EMAIL: 'cook@brunch',
  GIT_COMMITTER_NAME: 'brunch',
  GIT_COMMITTER_EMAIL: 'cook@brunch',
};

export interface ExecutionCaseSummary {
  readonly directoryId: string;
  readonly caseId: string;
}

export interface ResolvedExecutionCase extends ExecutionCaseSummary {
  readonly caseDir: string;
  readonly packet: PublicCasePacket;
}

export type PreparedExecutionTarget =
  | (ResolvedExecutionCase & {
      readonly preparation: 'legacy_brunch';
      readonly lane: 'brunch';
      readonly targetDir: string;
      readonly specId: number;
    })
  | (ResolvedExecutionCase & {
      readonly preparation: 'empty_git';
      readonly lane: 'claude_code';
      readonly targetDir: string;
      readonly baseSha: string;
    })
  | (ResolvedExecutionCase &
      HistoricalReplayReady & {
        readonly preparation: 'historical_replay';
      });

export async function listExecutionCases(casesRoot: string): Promise<ExecutionCaseSummary[]> {
  const entries = await readdir(casesRoot, { withFileTypes: true });
  const cases: ExecutionCaseSummary[] = [];
  for (const entry of entries.sort((left, right) => codePointCompare(left.name, right.name))) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || !SAFE_CASE_ID.test(entry.name)) continue;
    const caseDir = join(casesRoot, entry.name);
    if (!(await isRegularFile(join(caseDir, 'spec.md')))) continue;
    if (!(await isRegularFile(join(caseDir, 'public-contract.json')))) continue;
    const packet = await loadPublicCasePacket(caseDir);
    cases.push({ directoryId: entry.name, caseId: packet.contract.case.id });
  }
  return cases;
}

export async function resolveExecutionCase(
  reference: string,
  casesRoot: string,
): Promise<ResolvedExecutionCase> {
  assertSafeCaseReference(reference);
  const available = await listExecutionCases(casesRoot);
  const exactDirectory = available.find((candidate) => candidate.directoryId === reference);
  const candidates =
    exactDirectory === undefined
      ? available.filter((candidate) => candidate.caseId === reference)
      : [exactDirectory];
  if (candidates.length === 0) {
    throw new Error(`unknown execution case id: ${reference}`);
  }
  if (candidates.length > 1) {
    throw new Error(`ambiguous execution case id: ${reference}`);
  }
  const selected = candidates[0]!;
  const caseDir = join(casesRoot, selected.directoryId);
  return {
    ...selected,
    caseDir,
    packet: await loadPublicCasePacket(caseDir),
  };
}

export async function prepareExecutionTarget(
  input: {
    readonly lane: 'brunch' | 'claude_code';
    readonly caseReference: string;
    readonly casesRoot: string;
    readonly targetDir: string;
    readonly controllerRoot?: string;
    readonly sourceRepositoryDir?: string;
  },
  dependencies: HistoricalReplayTargetDependencies = {},
): Promise<PreparedExecutionTarget> {
  const selected = await resolveExecutionCase(input.caseReference, input.casesRoot);
  const contract = selected.packet.contract;
  if (!isBrowserExecutionCaseContract(contract) && contract.case.repository.substrate === 'pinned_git') {
    if (input.sourceRepositoryDir === undefined) {
      throw new Error('pinned execution case requires --source-repository');
    }
    if (input.controllerRoot === undefined) {
      throw new Error('pinned execution case requires an absolute controller root');
    }
    const prepared = await prepareHistoricalReplayTarget(
      {
        lane: input.lane,
        selectedCase: selected,
        sourceRepositoryDir: input.sourceRepositoryDir,
        targetDir: input.targetDir,
        controllerRoot: input.controllerRoot,
      },
      dependencies,
    );
    return {
      ...selected,
      ...prepared,
      preparation: 'historical_replay',
    };
  }
  if (
    input.sourceRepositoryDir !== undefined ||
    dependencies.runner !== undefined ||
    dependencies.dependencyInstallRunner !== undefined
  ) {
    throw new Error('--source-repository is valid only for pinned execution cases');
  }
  if (input.lane === 'brunch') {
    const prepared = await prepareBrunchExecutionWorkspace({
      workspaceDir: input.targetDir,
      caseDir: selected.caseDir,
    });
    return {
      ...selected,
      preparation: 'legacy_brunch',
      lane: 'brunch',
      targetDir: input.targetDir,
      specId: prepared.specId,
    };
  }

  await ensureEmptyDirectory(input.targetDir);
  await initializeEmptyRepository(input.targetDir);
  for (const file of selected.packet.files) {
    await writeFile(join(input.targetDir, file.path), await readFile(join(selected.caseDir, file.path)), {
      flag: 'wx',
    });
  }
  const baseSha = await gitOutput(['rev-parse', 'HEAD'], input.targetDir);
  return {
    ...selected,
    preparation: 'empty_git',
    lane: 'claude_code',
    targetDir: input.targetDir,
    baseSha,
  };
}

function assertSafeCaseReference(reference: string): void {
  if (isAbsolute(reference)) {
    throw new Error('execution case reference must not be an absolute path');
  }
  if (
    reference.includes('/') ||
    reference.includes('\\') ||
    reference === '.' ||
    reference === '..' ||
    reference.toLowerCase().includes('controller')
  ) {
    throw new Error('execution case reference must not contain traversal or controller paths');
  }
  if (!SAFE_CASE_ID.test(reference)) {
    throw new Error('execution case id must contain only lowercase letters, digits, and hyphens');
  }
}

async function ensureEmptyDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  if ((await readdir(path)).length !== 0) {
    throw new Error('execution comparison target must start empty');
  }
}

async function initializeEmptyRepository(cwd: string): Promise<void> {
  await git(['init', '-q', '-b', 'main'], cwd);
  await git(['commit', '--allow-empty', '-q', '-m', 'brunch: empty execution comparison base'], cwd, {
    ...process.env,
    ...EMPTY_REPOSITORY_COMMIT_ENV,
  });
}

async function git(
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  try {
    await execFileAsync('git', [...args], { cwd, env });
  } catch (error) {
    throw new Error(`git ${args.join(' ')} failed: ${commandFailure(error)}`);
  }
}

async function gitOutput(args: readonly string[], cwd: string): Promise<string> {
  try {
    const result = await execFileAsync('git', [...args], { cwd, env: process.env });
    return result.stdout.trim();
  } catch (error) {
    throw new Error(`git ${args.join(' ')} failed: ${commandFailure(error)}`);
  }
}

async function isRegularFile(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isFile();
  } catch {
    return false;
  }
}

function commandFailure(error: unknown): string {
  if (typeof error !== 'object' || error === null) return String(error);
  const failure = error as { stderr?: string; stdout?: string; message?: string };
  return failure.stderr?.trim() || failure.stdout?.trim() || failure.message || 'unknown error';
}

function codePointCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
