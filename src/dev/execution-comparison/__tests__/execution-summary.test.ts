import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runExecutionComparisonOperatorCli } from '../../execution-comparison-operator.js';
import type { ExecutionAttempt } from '../artifact-contract.js';
import { formatExecutionComparisonSummary, loadExecutionComparisonSummary } from '../execution-summary.js';

const roots: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })));
});

describe('execution comparison final summary', () => {
  it('loads immutable attempts and explains invalidity in a concise final summary', async () => {
    const runDirectory = await createRun([
      attempt({
        attemptId: 'brunch-attempt-1',
        lane: 'brunch',
        startedAt: '2026-07-23T10:00:00.000Z',
        validity: { status: 'invalid', reasons: ['The run was landed after promotion preparation.'] },
        terminal: {
          outcome: 'invalid',
          reason: 'landed out of bounds',
          productStatus: 'promotion_prepared',
        },
        commands: [command('test', 'passed'), command('build', 'failed')],
      }),
      attempt({
        attemptId: 'claude-code-attempt-1',
        lane: 'claude_code',
        startedAt: '2026-07-23T11:00:00.000Z',
      }),
    ]);

    const summary = await loadExecutionComparisonSummary(runDirectory);
    const rendered = formatExecutionComparisonSummary(summary, join(runDirectory, '..'));

    expect(rendered).toContain('Execution comparison complete');
    expect(rendered).toContain('Case: minimal-petri-net-editor-v1');
    expect(rendered).toContain('Brunch\n  Status: invalid\n  Terminal: promotion_prepared');
    expect(rendered).toContain('Checks: test passed, build failed, browser not run');
    expect(rendered).toContain('Reason: The run was landed after promotion preparation.');
    expect(rendered).toContain('Claude Code\n  Status: valid\n  Terminal: promotion_prepared');
    expect(rendered).not.toContain('cleanup clean');
    expect(rendered).toContain('Cleanup: done');
    expect(rendered).toContain(`- Report: ${join(runDirectory, 'report.md')}`);
    expect(rendered).toContain(join(runDirectory, 'attempt-records/brunch-attempt-1/attempt.json'));
    expect(rendered).toContain(
      `- Brunch oracle: ${join(runDirectory, 'lanes/brunch/attempt-staging/browser/report.json')}`,
    );
    expect(rendered).toContain(
      `- Claude Code oracle: ${join(runDirectory, 'lanes/claude_code/attempt-staging/browser/report.json')}`,
    );
  });

  it('preserves a repository-relative oracle path already rooted inside the run', async () => {
    const runDirectory = await createRun([]);
    const baseDirectory = join(runDirectory, '..');
    const oraclePath = join(runDirectory, 'lanes/claude_code/attempt-staging/browser/report.json');
    await writeAttempt(
      runDirectory,
      attempt({
        attemptId: 'claude-code-attempt-3',
        browser: {
          status: 'passed',
          reportPath: relative(baseDirectory, oraclePath),
        },
      }),
    );

    const summary = await loadExecutionComparisonSummary(runDirectory);
    const rendered = formatExecutionComparisonSummary(summary, baseDirectory);

    expect(rendered).toContain(`- Claude Code oracle: ${oraclePath}`);
  });

  it('prints the deterministic summary through the operator command', async () => {
    const runDirectory = await createRun([attempt({ attemptId: 'claude-code-attempt-2' })]);
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runExecutionComparisonOperatorCli(['summary', '--run-directory', runDirectory]);

    expect(stdout).toHaveBeenCalledOnce();
    expect(stdout.mock.calls[0]?.[0]).toContain('Execution comparison complete');
    expect(stdout.mock.calls[0]?.[0]).toContain('Claude Code\n  Status: valid');
  });

  it('refuses to summarize before the final report exists', async () => {
    const runDirectory = await mkdtemp(join(tmpdir(), 'brunch-execution-summary-'));
    roots.push(runDirectory);

    await expect(loadExecutionComparisonSummary(runDirectory)).rejects.toThrow(
      'execution comparison report is missing',
    );
  });
});

async function createRun(attempts: readonly ExecutionAttempt[]): Promise<string> {
  const runDirectory = await mkdtemp(join(tmpdir(), 'brunch-execution-summary-'));
  roots.push(runDirectory);
  await writeFile(join(runDirectory, 'report.md'), '# Report\n');
  for (const selected of attempts) {
    await writeAttempt(runDirectory, selected);
  }
  return runDirectory;
}

async function writeAttempt(runDirectory: string, selected: ExecutionAttempt): Promise<void> {
  const attemptDirectory = join(runDirectory, 'attempt-records', selected.attemptId);
  await mkdir(attemptDirectory, { recursive: true });
  await writeFile(join(attemptDirectory, 'attempt.json'), `${JSON.stringify(selected)}\n`);
}

function attempt(overrides: Partial<ExecutionAttempt>): ExecutionAttempt {
  return {
    schemaVersion: 1,
    attemptId: 'claude-code-attempt-1',
    caseId: 'minimal-petri-net-editor-v1',
    lane: 'claude_code',
    publicPacketSha256: `sha256:${'a'.repeat(64)}`,
    oraclePackSha256: `sha256:${'b'.repeat(64)}`,
    startedAt: '2026-07-23T12:00:00.000Z',
    endedAt: '2026-07-23T12:10:00.000Z',
    budget: {
      elapsedMinutes: 90,
      mechanicalInterventions: 2,
      substantiveHumanInterventions: 0,
    },
    versions: {
      product: '@hashintel/brunch@1.0.0-alpha.11',
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      harness: 'execution-comparison/v1',
      actorRecipe: 'claude-code/v1',
      node: '24.18.0',
      npm: '11.6.2',
      os: 'darwin',
      architecture: 'arm64',
    },
    repository: {
      baseSha: '1'.repeat(40),
      reviewSha: '2'.repeat(40),
      finalGitRange: `${'1'.repeat(40)}..${'2'.repeat(40)}`,
    },
    terminal: {
      outcome: 'success',
      reason: 'promotion prepared',
      productStatus: 'promotion_prepared',
    },
    validity: { status: 'valid', reasons: [] },
    commands: [command('test', 'passed'), command('build', 'passed')],
    browser: { status: 'not_run', reportPath: 'browser/report.json' },
    interventions: [],
    commonMetrics: {
      elapsedMs: 600_000,
      inputTokens: 'not_assessable',
      outputTokens: 'not_assessable',
      costUsd: 'not_assessable',
      permissionPrompts: 'not_assessable',
    },
    evidence: {
      finalTreePath: 'repository/final-tree.txt',
      finalDiffPath: 'repository/final.diff',
      visibleProcessPath: 'process/visible.jsonl',
    },
    cleanup: { status: 'clean', liveProcesses: 0, liveSessions: 0 },
    ...overrides,
  };
}

function command(id: string, status: 'passed' | 'failed' | 'not_run'): ExecutionAttempt['commands'][number] {
  return {
    id,
    status,
    exitCode: status === 'passed' ? 0 : status === 'failed' ? 1 : 'not_assessable',
    stdoutPath: `commands/${id}.stdout.txt`,
    stderrPath: `commands/${id}.stderr.txt`,
  };
}
