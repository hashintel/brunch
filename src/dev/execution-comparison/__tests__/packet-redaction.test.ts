import { describe, expect, it } from 'vitest';

import type { ExecutionAttempt } from '../artifact-contract.js';
import type { ExecutionCasePublicContract } from '../case-contract.js';
import { createMaskedOutcomePacket, createUnblindedProcessPacket } from '../packet-redaction.js';

const contract = {
  schemaVersion: 1,
  case: {
    id: 'minimal-petri-net-editor-v1',
    specification: 'spec.md',
    specificationSha256: 'a'.repeat(64),
    provider: 'anthropic',
    model: 'claude-opus-4-8',
    repository: { substrate: 'empty_dir', base: 'fresh-empty-commit' },
  },
  budgets: {
    elapsedMinutes: 90,
    mechanicalInterventions: 2,
    substantiveHumanInterventions: 0,
  },
  delivery: {
    test: { command: 'npm', args: ['test'] },
    build: { command: 'npm', args: ['run', 'build'] },
    staticOutput: 'dist',
    runtimeNetwork: 'forbidden',
    dependencyInstallNetwork: 'package-registry-only',
  },
  accessibility: {
    application: { role: 'application', name: 'Petri net editor' },
    canvas: { role: 'region', name: 'Petri net canvas' },
    controls: [{ role: 'button', name: 'Add place' }],
    dynamic: {
      place: { role: 'button', namePattern: '^Place: .+$' },
      transition: { role: 'button', namePattern: '^Transition: .+$' },
      arc: { role: 'button', namePattern: '^Arc: .+$' },
    },
    inspectorFields: [{ role: 'textbox', name: 'Label' }],
    feedbackRoles: ['status', 'alert'],
  },
  interactions: { select: 'Activate one item.' },
  rules: ['Stay in the target repository.'],
} as ExecutionCasePublicContract;

const attempt = {
  schemaVersion: 1,
  attemptId: 'brunch-success-1',
  caseId: 'minimal-petri-net-editor-v1',
  lane: 'brunch',
  publicPacketSha256: `sha256:${'a'.repeat(64)}`,
  oraclePackSha256: `sha256:${'b'.repeat(64)}`,
  startedAt: '2026-07-20T12:00:00.000Z',
  endedAt: '2026-07-20T12:10:00.000Z',
  budget: contract.budgets,
  versions: {
    product: '@hashintel/brunch@1.0.0-alpha.5',
    provider: 'anthropic',
    model: 'claude-opus-4-8',
    harness: 'execution-comparison/v1',
    actorRecipe: 'brunch-empty-dir/v1',
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
  terminal: { outcome: 'success', reason: 'done', productStatus: 'promotion_prepared' },
  validity: { status: 'valid', reasons: [] },
  commands: [
    {
      id: 'build',
      status: 'passed',
      exitCode: 0,
      stdoutPath: 'private/brunch-build.txt',
      stderrPath: 'private/brunch-build-errors.txt',
    },
  ],
  browser: { status: 'passed', reportPath: 'controller/private-browser.json' },
  interventions: [],
  commonMetrics: {
    elapsedMs: 600_000,
    inputTokens: 'not_assessable',
    outputTokens: 'not_assessable',
    costUsd: 'not_assessable',
    permissionPrompts: 'not_assessable',
  },
  evidence: {
    finalTreePath: 'private/tree.txt',
    finalDiffPath: 'private/diff.txt',
    visibleProcessPath: 'private/process.jsonl',
  },
  cleanup: { status: 'clean', liveProcesses: 0, liveSessions: 0 },
} satisfies ExecutionAttempt;

describe('execution comparison judgment packet boundaries', () => {
  it('masks outcome identity and excludes paths plus product-private diagnostics', () => {
    const packet = createMaskedOutcomePacket({
      label: 'A',
      attempt,
      publicContract: contract,
      finalTree: 'index.html\nsrc/app.ts\n',
      finalDiff: 'diff --git a/src/app.ts b/src/app.ts\n',
    });
    const serialized = JSON.stringify(packet);

    expect(packet).toMatchObject({
      pass: 'masked_outcome',
      label: 'A',
      finalTree: 'index.html\nsrc/app.ts\n',
      mechanical: {
        commands: [{ id: 'build', status: 'passed', exitCode: 0 }],
        browser: { status: 'passed' },
      },
    });
    expect(serialized).not.toMatch(/brunch|controller|private-browser|actorRecipe|productStatus/iu);
  });

  it('keeps process identity visible while dropping hidden reasoning and private diagnostics', () => {
    const packet = createUnblindedProcessPacket({
      attempt,
      publicContract: contract,
      visibleEvents: [
        {
          sequence: 1,
          elapsedMs: 100,
          actor: 'target',
          action: 'wrote package.json',
          response: 'created project manifest',
          status: 'working',
        },
      ],
      hiddenReasoning: 'secret chain of thought',
      controllerFixture: { expectedMarking: { p1: 2 } },
      brunchDiagnostics: { petriPath: '/private/petri.json' },
    } as never);
    const serialized = JSON.stringify(packet);

    expect(packet).toMatchObject({
      pass: 'unblinded_process',
      lane: 'brunch',
      product: '@hashintel/brunch@1.0.0-alpha.5',
      visibleEvents: [{ action: 'wrote package.json' }],
    });
    expect(serialized).not.toMatch(/secret chain|expectedMarking|petriPath|oraclePackSha256/iu);
  });
});
