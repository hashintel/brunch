import { execFile } from 'node:child_process';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { extractProviderConductReport, type ProviderConductInput } from '../provider-conduct-report.js';

const humanJudgments = ['digest_fidelity', 'question_materiality', 'proposition_cohesion', 'fatigue'];
const execFileAsync = promisify(execFile);

function tool(id: string, toolName: string, details: unknown, toolCallId = `${id}-call`) {
  return {
    type: 'message',
    id,
    parentId: null,
    timestamp: '2026-07-17T00:00:00.000Z',
    message: { role: 'toolResult', toolName, toolCallId, content: [], details },
  };
}

function baseInput(entries: unknown[]): ProviderConductInput {
  return {
    identity: {
      runId: 'run-1',
      generatedAt: '2026-07-17T00:00:00.000Z',
      branch: 'ln/fe-1187-remediation-4',
      commit: 'abc123',
      piVersion: '0.80.7',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      thinking: 'low',
      seedRef: 'workspace-alpha-grounding/base',
      sourceSha256: '1679e23ab02b27f0f5e7a1be8aade97a77ebc1b981f9bc4b5d3798640a80d19c',
      sessionPath: '/tmp/session.jsonl',
      activeLeaf: 'review-answer',
      specId: 1,
      beforeLsn: 1,
      afterLsn: 2,
    },
    entries: entries as NonNullable<ProviderConductInput['entries']>,
    graphReadback: { available: true, acceptedReviewExchangeIds: ['review-1'], afterLsn: 2 },
  };
}

function passingEntries() {
  return [
    tool('digest', 'present_digest', {
      schema: 'brunch.structured_exchange.present_digest',
      v: 1,
      exchange_id: 'digest-1',
      continuation: { tool: 'ask', params: { mode: 'text' } },
    }),
    tool('digest-feedback', 'ask', {
      schema: 'brunch.structured_exchange.request',
      v: 1,
      exchange_id: 'feedback-1',
      responds_to: 'digest-1',
      answer: { text: 'Confirmed' },
    }),
    tool('questionnaire', 'ask', {
      schema: 'brunch.structured_exchange.request',
      v: 1,
      exchange_id: 'questions-1',
      accepts_digest: 'digest-1',
      questions: [
        { id: 'q1', kind: 'text', prompt: 'One?' },
        { id: 'q2', kind: 'text', prompt: 'Two?' },
      ],
      answers: [
        { question_id: 'q1', text: 'A' },
        { question_id: 'q2', text: 'B' },
      ],
    }),
    tool('advisory', 'mutate_graph', { settlement: 'advisory', sourceDerived: true }),
    tool('review', 'present_review_set', {
      schema: 'brunch.structured_exchange.present_review_set',
      v: 1,
      exchange_id: 'review-1',
      review_set: { nodes: [], edges: [] },
    }),
    tool('review-answer', 'ask', {
      schema: 'brunch.structured_exchange.request',
      v: 1,
      exchange_id: 'review-1',
      answered: { decision: 'approve', receipt: { lsn: 2 } },
    }),
  ];
}

describe('provider conduct report', () => {
  it('passes R8-R10 with exact entry/toolCall citations and preserves the semantic boundary', () => {
    const report = extractProviderConductReport(baseInput(passingEntries()));
    expect(report.verdict).toEqual({
      sample: 'valid',
      R8: 'pass',
      R9: 'pass',
      R10: 'pass',
      forbiddenRivals: [],
      humanJudgmentsRequired: humanJudgments,
    });
    expect(report.markers.digestPresented.citations).toEqual([
      { entryId: 'digest', toolCallId: 'digest-call' },
    ]);
    expect(report.markers.reviewSettlementReceipt.citations).toEqual([
      { entryId: 'review-answer', toolCallId: 'review-answer-call' },
    ]);
    expect(JSON.stringify(report)).not.toMatch(/semanticVerdict|keyword|llmJudge/i);
  });

  const rivalCases: ReadonlyArray<
    readonly [string, (entries: ReturnType<typeof passingEntries>) => void, 'R8' | 'R9' | 'R10']
  > = [
    [
      'heavyweight_digest_review',
      (xs) => {
        xs[1]!.message.details = {
          ...(xs[1]!.message.details as Record<string, unknown>),
          answered: { decision: 'approve' },
        };
      },
      'R8',
    ],
    [
      'post_digest_clarification',
      (xs) => {
        xs.splice(4, 0, xs.splice(2, 1)[0]!);
      },
      'R8',
    ],
    [
      'combinatorial_options',
      (xs) => {
        (xs[2]!.message.details as Record<string, unknown>).options = [{ id: 'a+b', label: 'A and B' }];
      },
      'R9',
    ],
    [
      'advisory_laundering',
      (xs) => {
        (xs[3]!.message.details as Record<string, unknown>).settlement = 'settled';
      },
      'R10',
    ],
    [
      'post_approval_mutation',
      (xs) => {
        xs.push(tool('late', 'mutate_graph', { settlement: 'settled' }));
      },
      'R10',
    ],
  ];

  it.each(rivalCases)('rejects %s without changing unrelated verdicts', (rival, mutate, owner) => {
    const entries = passingEntries();
    mutate(entries);
    const report = extractProviderConductReport(baseInput(entries));
    expect(report.verdict.forbiddenRivals).toContain(rival);
    expect(report.verdict[owner]).toBe('fail');
    for (const requirement of ['R8', 'R9', 'R10'] as const) {
      if (requirement !== owner) expect(report.verdict[requirement]).toBe('pass');
    }
  });

  it.each([
    ['missing session', { entries: undefined }],
    ['unresolved branch', { branchResolved: false }],
    ['missing graph', { graphReadback: { available: false } }],
    ['carrier-less', { entries: [] }],
  ])('classifies %s as mechanically invalid', (_name, patch) => {
    const report = extractProviderConductReport({
      ...baseInput(passingEntries()),
      ...patch,
    } as ProviderConductInput);
    expect(report.verdict.sample).toBe('mechanically_invalid');
    expect([report.verdict.R8, report.verdict.R9, report.verdict.R10]).not.toContain('pass');
  });

  it('source and built CLIs emit normalized-equivalent validated reports and summaries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'provider-report-cli-'));
    const sessionPath = join(dir, 'session.jsonl');
    let parentId: string | null = null;
    const entries = passingEntries().map((entry) => {
      const next = { ...entry, parentId };
      parentId = entry.id;
      return next;
    });
    const header = {
      type: 'session',
      version: 3,
      id: 'provider-report-session',
      timestamp: '2026-07-17T00:00:00.000Z',
      cwd: dir,
    };
    await writeFile(sessionPath, `${[header, ...entries].map((row) => JSON.stringify(row)).join('\n')}\n`);
    const input = baseInput(entries);
    input.identity.sessionPath = sessionPath;
    input.identity.activeLeaf = parentId!;
    const configPath = join(dir, 'input.json');
    const { entries: _entries, ...config } = input;
    await writeFile(configPath, JSON.stringify(config));
    const sourceReport = join(dir, 'source.json');
    const builtReport = join(dir, 'built.json');
    const sourceSummary = join(dir, 'source.md');
    const builtSummary = join(dir, 'built.md');
    await execFileAsync(
      'node',
      [
        '--import',
        'tsx',
        'src/probes/provider-conduct-report.ts',
        '--input',
        configPath,
        '--report',
        sourceReport,
        '--summary',
        sourceSummary,
      ],
      { cwd: resolve('.') },
    );
    await execFileAsync(
      'node',
      [
        'dist/probes/provider-conduct-report.js',
        '--input',
        configPath,
        '--report',
        builtReport,
        '--summary',
        builtSummary,
      ],
      { cwd: resolve('.') },
    );
    const source = JSON.parse(await readFile(sourceReport, 'utf8'));
    const built = JSON.parse(await readFile(builtReport, 'utf8'));
    expect(source).toEqual(built);
    expect(await readFile(sourceSummary, 'utf8')).toBe(await readFile(builtSummary, 'utf8'));
    expect(source.schemaVersion).toBe(1);
  });

  it('uses only the supplied active branch and never mutates the session or graph readback', async () => {
    const input = baseInput(passingEntries());
    const before = structuredClone(input);
    extractProviderConductReport(input);
    expect(input).toEqual(before);

    const dir = await mkdtemp(join(tmpdir(), 'provider-report-'));
    const session = join(dir, 'session.jsonl');
    await writeFile(session, 'source evidence');
    const beforeStat = await stat(session);
    extractProviderConductReport(input);
    expect(await readFile(session, 'utf8')).toBe('source evidence');
    expect((await stat(session)).mtimeMs).toBe(beforeStat.mtimeMs);
  });
});
