import { execFile, spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

import { SessionManager } from '@earendil-works/pi-coding-agent';

import {
  HOST_LANDING_REVIEW_REF,
  HOST_LANDING_RUN_ID,
  type HostLandingFixture,
  type HostLandingScenario,
} from './types.js';

const execFileAsync = promisify(execFile);
const GIT_IDENTITY = [
  '-c',
  'user.name=Brunch Oracle',
  '-c',
  'user.email=brunch-oracle@invalid.local',
] as const;

export async function createHostLandingFixture(
  candidateRoot: string,
  scenario: HostLandingScenario,
  sessionMode: 'settled' | 'fresh',
): Promise<HostLandingFixture> {
  const root = await mkdtemp(join(tmpdir(), 'brunch-host-landing-oracle-'));
  const hostDir = join(root, 'host');
  await mkdir(hostDir);
  await git(hostDir, ['init', '-q', '-b', 'main']);
  await commitFile(hostDir, 'base.txt', 'base\n', 'host base');
  const hostBaseSha = await gitOutput(hostDir, ['rev-parse', 'HEAD']);
  const greenfield = scenario === 'greenfield_success';
  const runRepoDir = greenfield ? join(root, 'greenfield-run') : join(root, 'run-worktree');
  if (greenfield) {
    await mkdir(runRepoDir);
    await git(runRepoDir, ['init', '-q', '-b', 'main']);
    await git(runRepoDir, [...GIT_IDENTITY, 'commit', '--allow-empty', '-q', '-m', 'empty run base']);
  } else {
    await git(hostDir, ['worktree', 'add', '--quiet', '--detach', runRepoDir, hostBaseSha]);
  }
  const runBaseSha = await gitOutput(runRepoDir, ['rev-parse', 'HEAD']);
  await commitFile(runRepoDir, 'src/a.ts', 'export const a = 1;\n', 'integrate slice a');
  await commitFile(runRepoDir, 'src/b.ts', 'export const b = 2;\n', 'integrate slice b');
  await commitFile(runRepoDir, 'src/c.ts', 'export const c = 3;\n', `promote ${HOST_LANDING_RUN_ID}`);
  const completeReviewSha = await gitOutput(runRepoDir, ['rev-parse', 'HEAD']);
  const canonicalExpectedTree = await gitOutput(runRepoDir, ['rev-parse', `${completeReviewSha}^{tree}`]);
  let reviewSha = completeReviewSha;
  if (scenario === 'final_commit_only') {
    await git(runRepoDir, ['checkout', '--quiet', '--detach', runBaseSha]);
    await commitFile(runRepoDir, 'src/c.ts', 'export const c = 3;\n', 'tip-only rival');
    reviewSha = await gitOutput(runRepoDir, ['rev-parse', 'HEAD']);
  }
  if (scenario === 'bookkeeping_retained') {
    await commitFile(runRepoDir, '.brunch/leak.json', '{"leaked":true}\n', 'bookkeeping rival');
    reviewSha = await gitOutput(runRepoDir, ['rev-parse', 'HEAD']);
  }
  await git(runRepoDir, ['update-ref', `refs/heads/${HOST_LANDING_REVIEW_REF}`, reviewSha]);
  if (scenario === 'dirty_host') await writeFile(join(hostDir, 'base.txt'), 'dirty\n');
  if (scenario === 'conflict') {
    await commitFile(hostDir, 'src/a.ts', 'export const a = 999;\n', 'host conflict');
  }
  const promotionPath = join(hostDir, '.brunch', 'cook', 'runs', HOST_LANDING_RUN_ID, 'promotion.json');
  const metadataPath = join(hostDir, '.brunch', 'cook', 'runs', HOST_LANDING_RUN_ID, 'run.json');
  await mkdir(dirname(metadataPath), { recursive: true });
  await writeFile(
    promotionPath,
    `${JSON.stringify({
      runId: HOST_LANDING_RUN_ID,
      specId: '1',
      promotion: {
        status: 'promoted',
        commitSha: reviewSha,
        reviewBranch: HOST_LANDING_REVIEW_REF,
      },
    })}\n`,
  );
  await writeFile(
    metadataPath,
    `${JSON.stringify({
      runId: HOST_LANDING_RUN_ID,
      specId: '1',
      planPath: join(root, 'plan.json'),
      status: 'promotion_prepared',
      substrate: greenfield ? 'empty_dir' : 'git_worktree',
      worktreeDir: runRepoDir,
      runBaseSha,
      promotionPath,
      promotionCommitSha: reviewSha,
      promotionBranch: HOST_LANDING_REVIEW_REF,
    })}\n`,
  );
  const sessionFile = await createSessionFixture(candidateRoot, hostDir, sessionMode);
  return {
    root,
    hostDir,
    runRepoDir,
    ...(greenfield ? { targetDir: join(root, 'materialized-target') } : {}),
    runBaseSha,
    reviewSha,
    canonicalExpectedTree,
    metadataPath,
    sessionFile,
  };
}

export async function advanceHostLandingReviewRef(fixture: HostLandingFixture): Promise<void> {
  await commitFile(fixture.runRepoDir, 'late.txt', 'late\n', 'late rival commit');
  await git(fixture.runRepoDir, [
    'update-ref',
    `refs/heads/${HOST_LANDING_REVIEW_REF}`,
    await gitOutput(fixture.runRepoDir, ['rev-parse', 'HEAD']),
    fixture.reviewSha,
  ]);
}

async function createSessionFixture(
  candidateRoot: string,
  cwd: string,
  mode: 'settled' | 'fresh',
): Promise<string> {
  const responses = await runCandidateRpc(candidateRoot, cwd, [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'workspace.activate',
      params: { decision: { action: 'newSpec', title: 'Host landing oracle' } },
    },
  ]);
  const result = responses.find((response) => response['id'] === 1)?.['result'];
  if (!record(result) || !record(result['session']) || typeof result['session']['file'] !== 'string') {
    throw new Error(
      `candidate public RPC did not create a settled-session fixture: ${JSON.stringify(responses)}`,
    );
  }
  const sessionFile = result['session']['file'];
  if (mode === 'fresh') return sessionFile;
  const manager = SessionManager.open(sessionFile, dirname(sessionFile), cwd);
  manager.appendMessage({
    role: 'assistant',
    content: [{ type: 'text', text: 'Settled controller session.' }],
    api: 'brunch-oracle',
    provider: 'controller',
    model: 'none',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: 'stop',
    timestamp: Date.now(),
  });
  return sessionFile;
}

async function runCandidateRpc(
  candidateRoot: string,
  cwd: string,
  requests: readonly Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const child = spawn(
    process.execPath,
    [join(candidateRoot, 'bin', 'brunch.js'), '--cwd', cwd, '--mode', 'rpc'],
    {
      cwd: candidateRoot,
      env: { ...process.env, PI_OFFLINE: '1', PI_SKIP_VERSION_CHECK: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk));
  child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk));
  child.stdin.end(`${requests.map((request) => JSON.stringify(request)).join('\n')}\n`);
  const exitCode = await new Promise<number | null>((resolveExit) => child.on('close', resolveExit));
  if (exitCode !== 0) throw new Error(`candidate public RPC failed: ${stderr || stdout}`);
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function commitFile(cwd: string, path: string, content: string, subject: string): Promise<void> {
  const selected = join(cwd, path);
  await mkdir(dirname(selected), { recursive: true });
  await writeFile(selected, content);
  await git(cwd, ['add', '--', path]);
  await git(cwd, [...GIT_IDENTITY, 'commit', '-q', '-m', subject]);
}

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await execFileAsync('git', [...args], { cwd });
}

async function gitOutput(cwd: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync('git', [...args], { cwd });
  return result.stdout.trim();
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
