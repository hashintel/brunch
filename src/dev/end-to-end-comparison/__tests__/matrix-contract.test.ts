import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  writeExecutionAttemptImmutable,
  type ExecutionAttempt,
} from '../../execution-comparison/artifact-contract.js';
import { sha256Bytes } from '../handoff-contract.js';
import { loadEndToEndMatrix, type EndToEndMatrixManifest, type MatrixCell } from '../matrix-contract.js';

const roots: string[] = [];
const HASH = `sha256:${'d'.repeat(64)}`;

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })));
});

function attempt(attemptId: string, lane: ExecutionAttempt['lane']): ExecutionAttempt {
  const baseSha = 'a'.repeat(40);
  const reviewSha = 'b'.repeat(40);
  return {
    schemaVersion: 1,
    attemptId,
    caseId: 'minimal-petri-net-editor-v1',
    lane,
    publicPacketSha256: HASH,
    oraclePackSha256: HASH,
    startedAt: '2026-07-21T13:00:00.000Z',
    endedAt: '2026-07-21T13:30:00.000Z',
    budget: { elapsedMinutes: 90, mechanicalInterventions: 0, substantiveHumanInterventions: 0 },
    versions: {
      product: lane,
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      harness: 'end-to-end-comparison/v1',
      actorRecipe: `${lane}-empty-dir/v1`,
      node: '24.18.0',
      npm: '11.6.2',
      os: 'darwin',
      architecture: 'arm64',
    },
    repository: {
      baseSha,
      reviewSha,
      finalGitRange: `${baseSha}..${reviewSha}`,
    },
    terminal: { outcome: 'success', reason: 'promotion prepared', productStatus: 'promotion_prepared' },
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

describe('end-to-end matrix contract', () => {
  it('loads exactly the two-specification-by-two-executor matrix and verifies attempt bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-e2e-matrix-'));
    roots.push(root);
    await mkdir(join(root, 'attempts'));
    const cells: MatrixCell[] = [];
    for (const specSource of ['brunch_spec', 'claude_spec'] as const) {
      for (const executor of ['brunch', 'claude_code'] as const) {
        const attemptId = `${specSource.replaceAll('_', '-')}-${executor.replaceAll('_', '-')}`;
        const path = await writeExecutionAttemptImmutable(
          join(root, 'attempts'),
          attempt(attemptId, executor),
        );
        const bytes = await readFile(path);
        cells.push({
          id: `${specSource}--${executor}`,
          specSource,
          executor,
          handoffSha256: HASH,
          attempt: {
            path: relative(root, path),
            sha256: sha256Bytes(bytes),
          },
        });
      }
    }
    const manifest: EndToEndMatrixManifest = {
      schemaVersion: 1,
      studyContractSha256: HASH,
      cells,
    };

    const loaded = await loadEndToEndMatrix({ bundleRoot: root, value: manifest });
    expect(loaded.cells).toHaveLength(4);
    expect(loaded.cells.map((cell) => cell.attempt.lane).sort()).toEqual([
      'brunch',
      'brunch',
      'claude_code',
      'claude_code',
    ]);
  });

  it('rejects missing, duplicate, lane-mismatched, escaped, and drifted cells', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-e2e-matrix-'));
    roots.push(root);
    await mkdir(join(root, 'attempts'));
    const path = await writeExecutionAttemptImmutable(join(root, 'attempts'), attempt('one', 'brunch'));
    const bytes = await readFile(path);
    const cell: MatrixCell = {
      id: 'brunch_spec--brunch',
      specSource: 'brunch_spec',
      executor: 'brunch',
      handoffSha256: HASH,
      attempt: { path: relative(root, path), sha256: sha256Bytes(bytes) },
    };
    const base: EndToEndMatrixManifest = {
      schemaVersion: 1,
      studyContractSha256: HASH,
      cells: [cell],
    };
    await expect(loadEndToEndMatrix({ bundleRoot: root, value: base })).rejects.toThrow(
      'invalid end-to-end matrix manifest',
    );
    await expect(
      loadEndToEndMatrix({
        bundleRoot: root,
        value: {
          ...base,
          cells: [
            cell,
            cell,
            { ...cell, id: 'claude_spec--brunch', specSource: 'claude_spec' },
            { ...cell, id: 'claude_spec--claude_code', specSource: 'claude_spec', executor: 'claude_code' },
          ],
        },
      }),
    ).rejects.toThrow('invalid end-to-end matrix manifest');
  });
});
