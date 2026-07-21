import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { ExecutionAttempt } from '../../execution-comparison/artifact-contract.js';
import { retainExecutionCell } from '../execution-cell.js';

const roots: string[] = [];
const HASH = `sha256:${'f'.repeat(64)}`;

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })));
});

function attempt(): ExecutionAttempt {
  const baseSha = 'a'.repeat(40);
  const reviewSha = 'b'.repeat(40);
  return {
    schemaVersion: 1,
    attemptId: 'brunch-spec-claude-code',
    caseId: 'minimal-petri-net-editor-v1',
    lane: 'claude_code',
    publicPacketSha256: HASH,
    oraclePackSha256: HASH,
    startedAt: '2026-07-21T13:00:00.000Z',
    endedAt: '2026-07-21T13:30:00.000Z',
    budget: {
      elapsedMinutes: 90,
      mechanicalInterventions: 0,
      substantiveHumanInterventions: 0,
    },
    versions: {
      product: 'claude-code',
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      harness: 'end-to-end-comparison/v1',
      actorRecipe: 'claude-code-empty-dir/v1',
      node: '24.18.0',
      npm: '11.6.2',
      os: 'darwin',
      architecture: 'arm64',
    },
    repository: { baseSha, reviewSha, finalGitRange: `${baseSha}..${reviewSha}` },
    terminal: { outcome: 'success', reason: 'agent completed', productStatus: 'not_applicable' },
    validity: { status: 'valid', reasons: [] },
    commands: [
      {
        id: 'test',
        status: 'passed',
        exitCode: 0,
        stdoutPath: 'commands/test.stdout',
        stderrPath: 'commands/test.stderr',
      },
    ],
    browser: { status: 'passed', reportPath: 'browser/report.json' },
    interventions: [],
    commonMetrics: {
      elapsedMs: 1_800_000,
      inputTokens: 'not_assessable',
      outputTokens: 'not_assessable',
      costUsd: 'not_assessable',
      permissionPrompts: 'not_assessable',
    },
    evidence: {
      finalTreePath: 'evidence/final-tree.txt',
      finalDiffPath: 'evidence/final.diff',
      visibleProcessPath: 'evidence/process.json',
    },
    cleanup: { status: 'clean', liveProcesses: 0, liveSessions: 0 },
  };
}

describe('execution cell retention', () => {
  it('links an exact handoff to one immutable FE-1230 attempt without widening it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-e2e-cell-'));
    roots.push(root);
    const handoffDir = join(root, 'handoffs', 'brunch_spec');
    await mkdir(handoffDir, { recursive: true });
    const handoffPath = join(handoffDir, 'handoff.json');
    await writeFile(
      handoffPath,
      `${JSON.stringify({
        schemaVersion: 1,
        elicitationRunId: 'petri-editor-e2e-r1',
        specSource: 'brunch_spec',
        sourceArtifactPath: 'lanes/brunch/final-document.md',
        specificationPath: 'spec.md',
        specificationSha256: HASH,
        approvedBy: 'operator@example.com',
        approvedAt: '2026-07-21T13:00:00.000Z',
        studyContractSha256: HASH,
      })}\n`,
    );

    const cell = await retainExecutionCell({
      bundleRoot: root,
      attemptsRoot: join(root, 'attempts'),
      specSource: 'brunch_spec',
      handoffRecordPath: handoffPath,
      attempt: attempt(),
    });
    expect(cell).toMatchObject({
      id: 'brunch_spec--claude_code',
      specSource: 'brunch_spec',
      executor: 'claude_code',
      attempt: { path: 'attempts/brunch-spec-claude-code/attempt.json' },
    });
  });
});
