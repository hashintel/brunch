import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import type {
  GitStateSnapshot,
  HostLandingOracleCheck,
  HostLandingOracleReport,
  HostLandingScenario,
} from './types.js';

const execFileAsync = promisify(execFile);
const REQUIRED_CONTENT_PATHS = ['src/a.ts', 'src/b.ts', 'src/c.ts'] as const;

export async function evaluateHostLandingGitOutcome(input: {
  readonly scenario: HostLandingScenario;
  readonly hostDir: string;
  readonly targetDir?: string;
  readonly metadataPath: string;
  readonly canonicalExpectedTree: string;
  readonly before: GitStateSnapshot;
  readonly preConfirm: GitStateSnapshot;
  readonly terminalEvidence?: readonly string[];
  readonly providerActivity?: boolean;
}): Promise<Omit<HostLandingOracleReport, 'schemaVersion' | 'caseId' | 'oracleId' | 'scenario'>> {
  const destination = input.targetDir ?? input.hostDir;
  const after = await snapshotGitState(input.hostDir, input.metadataPath);
  const destinationExists = await gitSucceeds(destination, ['rev-parse', '--git-dir']);
  const actualTree = destinationExists ? await gitOutput(destination, ['rev-parse', 'HEAD^{tree}']) : '';
  const changedPaths = destinationExists
    ? (await gitOutput(destination, ['ls-tree', '-r', '--name-only', 'HEAD'])).split('\n').filter(Boolean)
    : [];
  const metadata = parseRecord(after.runMetadataBytes);
  const preflightPassed =
    sameSnapshot(input.before, input.preConfirm) &&
    input.providerActivity !== true &&
    (input.terminalEvidence ?? []).some(
      (line) => line.includes('complete') || line.includes('Nothing changed'),
    );
  const refusal = ['decline', 'dirty_host', 'conflict', 'stale_acceptance'].includes(input.scenario);
  const greenfield = input.scenario === 'greenfield_success';
  const fullRangePassed =
    !refusal &&
    !greenfield &&
    actualTree === input.canonicalExpectedTree &&
    REQUIRED_CONTENT_PATHS.every((path) => changedPaths.includes(path)) &&
    !changedPaths.some((path) => path === '.brunch' || path.startsWith('.brunch/')) &&
    metadata['status'] === 'landed';
  const materializationPassed =
    greenfield &&
    actualTree === input.canonicalExpectedTree &&
    (await gitOutput(destination, ['rev-list', '--count', 'HEAD'])) === '1' &&
    (await gitOutput(destination, ['log', '-1', '--format=%an <%ae>'])) === 'brunch <cook@brunch>' &&
    !changedPaths.some((path) => path === '.brunch' || path.startsWith('.brunch/')) &&
    metadata['status'] === 'landed';
  const refusalPassed =
    !refusal || (sameSnapshot(input.before, after) && metadata['status'] === 'promotion_prepared');
  const checks: HostLandingOracleCheck[] = [
    {
      id: 'public-tui-preflight',
      claims: ['AC1', 'INV1', 'REQ1'],
      status: preflightPassed ? 'passed' : 'failed',
      evidence: [
        `pre-confirm snapshot ${sameSnapshot(input.before, input.preConfirm) ? 'unchanged' : 'changed'}`,
        `provider activity ${input.providerActivity === true ? 'observed' : 'absent'}`,
      ],
    },
    {
      id: 'brownfield-full-range',
      claims: ['REQ2'],
      status: refusal || greenfield ? 'passed' : fullRangePassed ? 'passed' : 'failed',
      evidence: [
        `expected tree ${input.canonicalExpectedTree}`,
        `actual tree ${actualTree || '(missing)'}`,
        `tracked paths ${changedPaths.join(', ') || '(none)'}`,
      ],
    },
    {
      id: 'greenfield-materialization',
      claims: ['REQ3'],
      status: greenfield ? (materializationPassed ? 'passed' : 'failed') : 'passed',
      evidence: [greenfield ? `materialized tree ${actualTree || '(missing)'}` : 'not selected'],
    },
    {
      id: 'refusal-safety',
      claims: ['REQ4'],
      status: refusalPassed ? 'passed' : 'failed',
      evidence: [
        refusal ? `host ${sameSnapshot(input.before, after) ? 'unchanged' : 'changed'}` : 'not selected',
      ],
    },
  ];
  const passed = checks.every(({ status }) => status === 'passed');
  return {
    status: passed ? 'passed' : 'assertion_failed',
    checks,
    terminalEvidence: input.terminalEvidence ?? [],
    gitEvidence: {
      before: input.before,
      preConfirm: input.preConfirm,
      after,
      expectedTree: input.canonicalExpectedTree,
      actualTree,
      changedPaths,
    },
  };
}

export async function snapshotGitState(cwd: string, metadataPath: string): Promise<GitStateSnapshot> {
  const runMetadataBytes = await readFile(metadataPath, 'utf8');
  return {
    head: await gitOutput(cwd, ['rev-parse', 'HEAD']),
    tree: await gitOutput(cwd, ['rev-parse', 'HEAD^{tree}']),
    status: await gitOutput(cwd, ['status', '--porcelain=v1', '--untracked-files=no']),
    runMetadataSha256: createHash('sha256').update(runMetadataBytes).digest('hex'),
    runMetadataBytes,
  };
}

export function emptyGitStateSnapshot(): GitStateSnapshot {
  return { head: '', tree: '', status: '', runMetadataSha256: '', runMetadataBytes: '' };
}

function sameSnapshot(left: GitStateSnapshot, right: GitStateSnapshot): boolean {
  return (
    left.head === right.head &&
    left.tree === right.tree &&
    left.status === right.status &&
    left.runMetadataSha256 === right.runMetadataSha256 &&
    left.runMetadataBytes === right.runMetadataBytes
  );
}

async function gitOutput(cwd: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync('git', [...args], { cwd });
  return result.stdout.trim();
}

async function gitSucceeds(cwd: string, args: readonly string[]): Promise<boolean> {
  try {
    await execFileAsync('git', [...args], { cwd });
    return true;
  } catch {
    return false;
  }
}

function parseRecord(raw: string): Record<string, unknown> {
  const value = JSON.parse(raw) as unknown;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('run metadata must be an object');
  }
  return value as Record<string, unknown>;
}
