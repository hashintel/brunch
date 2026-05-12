import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { inspectFixtureCandidate } from './fixture-candidate.js';

describe('fixture candidate checkpoint', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeTempDir(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  it('reports a complete artifact directory as parse-ready and structure-ready with normalization debt', () => {
    const dir = makeTempDir('brunch-fixture-complete-');
    writeCandidate(dir, { includeWorkspaceState: true });

    const report = inspectFixtureCandidate(dir, { expectWorkspaceState: true });

    expect(report.parseReady).toBe(true);
    expect(report.structureReady).toBe(true);
    expect(report.files).toMatchObject({
      'artifact-bundle.json': { present: true, validJson: true },
      'summary.json': { present: true, validJson: true },
      'raw-jsonl.ndjson': { present: true, validJson: true },
      'final-chat.json': { present: true, validJson: true },
    });
    expect(report.workspaceState).toEqual({
      expected: true,
      present: true,
      path: join(dir, 'workspace-state'),
    });
    expect(report.normalizationDebt).toEqual(
      expect.arrayContaining([
        'summary.durationMs',
        'artifact-bundle.environment.nodeVersion',
        'artifact-bundle.environment.platform',
        'artifact-bundle.environment.arch',
        'artifact-bundle.workspace.cwd',
        'artifact-bundle.workspace.preservedStatePath',
        'artifact-bundle.summary.durationMs',
        'raw-jsonl request/response ids and resource ids',
        'final-chat generated question wording',
      ]),
    );
    expect(report.errors).toEqual([]);
  });

  it('flags a missing expected workspace-state fixture', () => {
    const dir = makeTempDir('brunch-fixture-missing-workspace-');
    writeCandidate(dir, { includeWorkspaceState: false });

    const report = inspectFixtureCandidate(dir, { expectWorkspaceState: true });

    expect(report.parseReady).toBe(true);
    expect(report.structureReady).toBe(false);
    expect(report.workspaceState).toEqual({
      expected: true,
      present: false,
      path: join(dir, 'workspace-state'),
    });
    expect(report.errors).toContain('workspace-state is missing');
  });

  it('rejects parseable artifacts with invalid structure or inconsistent duplicated fields', () => {
    const dir = makeTempDir('brunch-fixture-invalid-');
    writeCandidate(dir, { includeWorkspaceState: false });
    const bundlePath = join(dir, 'artifact-bundle.json');
    const bundle = JSON.parse(readFileSync(bundlePath, 'utf8')) as Record<string, unknown>;
    bundle.schemaVersion = 2;
    bundle.summary = { turnsAnswered: 'two' };
    bundle.finalChat = null;
    bundle.rawJsonlTranscript = [];
    delete bundle.commandSequence;
    writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);

    const report = inspectFixtureCandidate(dir);

    expect(report.parseReady).toBe(true);
    expect(report.structureReady).toBe(false);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        'artifact-bundle.json schemaVersion must be 1',
        'artifact-bundle.json commandSequence must be an array',
        'artifact-bundle.summary does not match summary.json',
        'artifact-bundle.finalChat does not match final-chat.json',
        'artifact-bundle.rawJsonlTranscript does not match raw-jsonl.ndjson',
      ]),
    );
  });

  it('accepts an error-run candidate while reporting failure status and normalization debt', () => {
    const dir = makeTempDir('brunch-fixture-error-run-');
    writeCandidate(dir, { includeWorkspaceState: false, errorRun: true });

    const report = inspectFixtureCandidate(dir, { expectWorkspaceState: false });

    expect(report.parseReady).toBe(true);
    expect(report.structureReady).toBe(true);
    expect(report.runStatus).toEqual({ kind: 'error-run', turnsAnswered: 0, errorCount: 1 });
    expect(report.workspaceState).toEqual({
      expected: false,
      present: false,
      path: join(dir, 'workspace-state'),
    });
    expect(report.normalizationDebt).toContain('error messages may need provider-specific redaction review');
    expect(report.errors).toEqual([]);
  });
});

function writeCandidate(
  dir: string,
  { includeWorkspaceState, errorRun = false }: { includeWorkspaceState: boolean; errorRun?: boolean },
): void {
  const summary = {
    turnsAnswered: errorRun ? 0 : 2,
    finalFrontierState: errorRun ? 'awaiting_response' : 'answered',
    durationMs: 23446,
    questionAnswers: errorRun
      ? []
      : [
          {
            question: 'What is this project?',
            answer: 'A repeatable fixture candidate.',
          },
        ],
    errors: errorRun
      ? [
          {
            requestId: 'policy-1',
            capability: 'probe.responsePolicy',
            code: 'policy_failed',
            message: 'redacted',
          },
        ]
      : [],
  };
  const finalChat = {
    frontier: { state: summary.finalFrontierState, turnId: 101 },
    turns: summary.questionAnswers.map((pair, index) => ({ id: index + 100, ...pair })),
  };
  const bundle = {
    schemaVersion: 1,
    scenario: { name: 'candidate', brief: 'fixture brief', specName: 'Fixture spec' },
    workspace: {
      cwd: '/var/folders/example/brunch-probe-workspace-abc123',
      preservedStatePath: includeWorkspaceState ? join(dir, 'workspace-state') : null,
    },
    commandSequence: ['spec.create', 'chat.getPrimary', 'chat.ensureReady'],
    rawJsonlTranscript: [
      {
        direction: 'request',
        payload: { id: 'create', capability: 'spec.create', input: { name: 'Fixture spec' } },
      },
      { direction: 'response', payload: { id: 'create', ok: true, output: { specId: 1 } } },
    ],
    parsedEvents: [],
    finalChat,
    summary,
    errors: summary.errors,
    simulatedUserEvents: [],
    environment: { nodeVersion: 'v24.15.0', platform: 'darwin', arch: 'arm64' },
  };

  writeFileSync(join(dir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(join(dir, 'final-chat.json'), `${JSON.stringify(finalChat, null, 2)}\n`);
  writeFileSync(join(dir, 'artifact-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  writeFileSync(
    join(dir, 'raw-jsonl.ndjson'),
    `${bundle.rawJsonlTranscript.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
  );

  if (includeWorkspaceState) {
    mkdirSync(join(dir, 'workspace-state', '.brunch'), { recursive: true });
    writeFileSync(join(dir, 'workspace-state', '.brunch', 'brunch.db'), 'sqlite');
  }
}
