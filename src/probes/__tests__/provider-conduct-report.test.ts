import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { WORKSPACE_DB_FILENAME } from '../../constants.js';
import { createDb } from '../../db/connection.js';
import { projectAsk, projectDigestQuestionnaire } from '../../exchanges/projections/ask.js';
import { projectPresentDigest } from '../../exchanges/projections/present-digest.js';
import { projectPresentReviewSet } from '../../exchanges/projections/present-review-set.js';
import { projectRequestReview } from '../../exchanges/projections/request-response.js';
import { CommandExecutor } from '../../graph/command-executor.js';
import { extractProviderConductReport, type ProviderConductIdentity } from '../provider-conduct-report.js';

const execFileAsync = promisify(execFile);
const receipt = {
  status: 'success' as const,
  lsn: 3,
  createdNodes: { n1: { id: 1, code: 'G1' } },
  createdEdges: [],
  updatedNodes: [],
  updatedEdges: [],
  deletedNodes: [],
  deletedEdges: [],
};
const digestParams = { exchangeId: 'digest-1', heading: 'Understanding', digest: { abstract: 'Accepted' } };
const questions = [
  { id: 'q1', prompt: 'One?', kind: 'free-text' as const },
  { id: 'q2', prompt: 'Two?', kind: 'free-text' as const },
];
const reviewPayload = {
  schemaVersion: 1 as const,
  lens: 'intent' as const,
  epistemicStatus: 'asserted' as const,
  grounding: { summary: 'Grounded', support: ['source'] },
  pitch: { title: 'Review', narrative: 'One proposition' },
  entityDrafts: [
    { draftId: 'n1', proposedCode: 'G1', plane: 'intent' as const, kind: 'goal', title: 'Goal' },
  ],
  edgeDrafts: [],
};
const reviewParams = { exchangeId: 'review-1', payload: reviewPayload };

function pair(
  entry: string,
  callId: string,
  name: string,
  args: unknown,
  details: unknown,
  parentId: string | null = null,
) {
  return [
    {
      type: 'message',
      id: `${entry}-call`,
      parentId,
      timestamp: '2026-07-17T00:00:00.000Z',
      message: {
        role: 'assistant',
        provider: 'anthropic',
        model: 'model',
        content: [{ type: 'toolCall', id: callId, name, arguments: args }],
      },
    },
    {
      type: 'message',
      id: entry,
      parentId: `${entry}-call`,
      timestamp: '2026-07-17T00:00:00.000Z',
      message: { role: 'toolResult', toolName: name, toolCallId: callId, content: [], details },
    },
  ];
}
function relink(entries: any[]) {
  let parentId: string | null = null;
  return entries.map((entry) => {
    const linked = { ...entry, parentId };
    parentId = entry.id;
    return linked;
  });
}
function passing() {
  const digest = projectPresentDigest(digestParams).details;
  const feedback = projectAsk({
    exchangeId: 'feedback',
    question: { body: digest.continuation!.params.body },
    status: 'answered',
    answer: 'Confirmed',
  });
  const questionnaireArgs = {
    exchangeId: 'questions',
    acceptsDigest: 'digest-1',
    questions,
    body: 'Questionnaire',
  };
  const questionnaire = projectDigestQuestionnaire({
    exchangeId: 'questions',
    acceptsDigest: 'digest-1',
    acceptedAbstract: 'Accepted',
    questions,
    answers: [
      { questionId: 'q1', kind: 'free-text', text: 'A' },
      { questionId: 'q2', kind: 'free-text', text: 'B' },
    ],
  });
  const advisoryArgs = {
    createSettlement: 'advisory',
    ops: [{ op: 'create_node', ref: 'a1', plane: 'intent', kind: 'goal', title: 'Source sketch' }],
  };
  const mutationResult = { ...receipt, lsn: 2, createdNodes: { a1: { id: 2, code: 'G2' } } };
  const review = projectPresentReviewSet(reviewParams).details;
  const settlement = projectRequestReview({
    exchangeId: 'review-1',
    respondsToPresentTool: 'present_review_set',
    status: 'answered',
    review: 'approve',
    receipt,
  });
  return relink([
    ...pair('digest', 'c-digest', 'present_digest', digestParams, digest),
    ...pair('feedback', 'c-feedback', 'ask', { continues: 'digest-1' }, feedback),
    ...pair('questions', 'c-questions', 'ask', questionnaireArgs, questionnaire),
    ...pair('advisory', 'c-advisory', 'mutate_graph', advisoryArgs, mutationResult),
    ...pair('review', 'c-review', 'present_review_set', reviewParams, review),
    ...pair('settlement', 'c-settlement', 'ask', { continues: 'review-1' }, settlement),
  ]);
}
const identity: ProviderConductIdentity = {
  runId: 'run',
  generatedAt: '2026-07-17T00:00:00.000Z',
  branch: 'branch',
  commit: 'abc',
  piVersion: '0.80.7',
  provider: 'anthropic',
  model: 'model',
  thinking: 'low',
  seedRef: 'seed',
  sourceSha256: 'a'.repeat(64),
  sessionPath: '/tmp/session.jsonl',
  activeLeaf: 'settlement',
  specId: 1,
  beforeLsn: 1,
  afterLsn: 3,
};
const report = (entries: unknown[], patch: Partial<ProviderConductIdentity> = {}, reviewLsns = [3]) =>
  extractProviderConductReport({
    identity: { ...identity, ...patch },
    entries: entries as never[],
    graphReadback: { available: true, reviewLsns },
  });

function expectOnlyOwnedFailure(value: ReturnType<typeof report>, owner: 'R8' | 'R9' | 'R10', rival: string) {
  expect(value.verdict.forbiddenRivals).toContain(rival);
  expect(value.verdict[owner]).toBe('fail');
  for (const verdict of ['R8', 'R9', 'R10'] as const)
    if (verdict !== owner) expect(value.verdict[verdict]).toBe('pass');
}

describe('provider conduct report', () => {
  it('passes production-shaped calls, preserves the closed semantic boundary, and records questionnaire order', () => {
    const value = report(passing());
    expect(value.verdict).toEqual({
      sample: 'valid',
      R8: 'pass',
      R9: 'pass',
      R10: 'pass',
      forbiddenRivals: [],
      humanJudgmentsRequired: ['digest_fidelity', 'question_materiality', 'proposition_cohesion', 'fatigue'],
    });
    expect(value.markers.boundedQuestionnaire).toMatchObject({
      rawQuestionCount: 2,
      questionIdsInOrder: ['q1', 'q2'],
    });
    expect(value.markers.digestPresented.citations).toEqual([{ entryId: 'digest', toolCallId: 'c-digest' }]);
    expect(JSON.stringify(value)).not.toMatch(/semanticVerdict|materialityVerdict|fidelityVerdict|llmJudge/i);
  });

  it.each([
    ['missing session', undefined, true],
    ['carrier-less session', [], true],
    ['missing graph', passing(), false],
  ])('classifies %s mechanically invalid', (_name, entries, graphAvailable) => {
    const value = extractProviderConductReport({
      identity,
      entries: entries as never,
      graphReadback: { available: graphAvailable, reviewLsns: [3] },
    });
    expect(value.verdict.sample).toBe('mechanically_invalid');
    expect([value.verdict.R8, value.verdict.R9, value.verdict.R10]).not.toContain('pass');
  });

  it('fails closed on malformed calls/results but tolerates a structural rejection followed by corrected success', () => {
    const malformed = passing();
    (malformed[1] as any).message.details = { status: 'success', lsn: 3 };
    expect(report(malformed).verdict.sample).toBe('mechanically_invalid');
    const corrected = passing();
    corrected.splice(
      6,
      0,
      ...pair(
        'rejected',
        'c-rejected',
        'mutate_graph',
        { ops: [] },
        { status: 'structural_illegal', diagnostics: [{ field: 'ops[0].node', message: 'Bad ref' }] },
      ),
    );
    expect(report(relink(corrected)).verdict.sample).toBe('valid');

    const inventedDiagnostic = passing();
    inventedDiagnostic.splice(
      6,
      0,
      ...pair(
        'rejected',
        'c-rejected',
        'mutate_graph',
        { ops: [] },
        { status: 'structural_illegal', diagnostics: [{ code: 'bad_ref', message: 'Bad ref' }] },
      ),
    );
    expect(report(relink(inventedDiagnostic)).verdict.sample).toBe('mechanically_invalid');
  });

  it('requires exact call/result joins by toolCallId', () => {
    const entries = passing();
    (entries[1] as any).message.toolCallId = 'wrong-id';
    expect(report(entries).verdict.sample).toBe('mechanically_invalid');
  });

  it('pairs each review with its own response and enforces the digest-to-mapping order', () => {
    const entries = passing();
    const earlyReviewParams = { ...reviewParams, exchangeId: 'early-review' };
    const earlyReview = pair(
      'early-review',
      'c-early-review',
      'present_review_set',
      earlyReviewParams,
      projectPresentReviewSet(earlyReviewParams).details,
    );
    const earlyAnswer = pair(
      'early-answer',
      'c-early-answer',
      'ask',
      { continues: 'early-review' },
      projectRequestReview({
        exchangeId: 'early-review',
        respondsToPresentTool: 'present_review_set',
        status: 'answered',
        review: 'approve',
        receipt,
      }),
    );
    entries.splice(2, 0, ...earlyReview, ...earlyAnswer);
    const value = report(relink(entries));
    expect(value.verdict.R8).toBe('fail');
    expect(value.verdict.R10).toBe('pass');
    expect(value.markers.reviewSetPresented.citations).toEqual([
      { entryId: 'review', toolCallId: 'c-review' },
    ]);

    const outOfOrder = passing();
    const feedback = outOfOrder.splice(2, 2);
    outOfOrder.splice(4, 0, ...feedback);
    expect(report(relink(outOfOrder)).verdict.R8).toBe('fail');
  });

  it('bounds acceptance readback to this run and reconciles the receipt LSN', () => {
    expect(report(passing(), { beforeLsn: 3, afterLsn: 4 }, [3]).verdict.R10).toBe('not_observed');
    expect(report(passing(), {}, [2]).verdict.R10).toBe('not_observed');
  });

  it('covers every named rival with only its owned verdict flipped', () => {
    const heavyweight = passing();
    heavyweight.splice(
      2,
      0,
      ...pair(
        'early-review',
        'c-early-review',
        'present_review_set',
        { ...reviewParams, exchangeId: 'digest-review' },
        projectPresentReviewSet({ ...reviewParams, exchangeId: 'digest-review' }).details,
      ),
    );
    expectOnlyOwnedFailure(report(relink(heavyweight)), 'R8', 'heavyweight_digest_review');

    const lateClarification = passing();
    const advisory = lateClarification.splice(6, 2);
    lateClarification.splice(4, 0, ...advisory);
    lateClarification.splice(
      8,
      0,
      ...pair(
        'corrected-mapping',
        'c-corrected-mapping',
        'mutate_graph',
        {
          createSettlement: 'settled',
          ops: [{ op: 'create_node', ref: 'm1', plane: 'intent', kind: 'goal', title: 'Mapping' }],
        },
        { ...receipt, lsn: 2, createdNodes: { m1: { id: 4, code: 'G4' } } },
      ),
    );
    expectOnlyOwnedFailure(report(relink(lateClarification)), 'R8', 'post_digest_clarification');

    const standalone = passing();
    const args = {
      exchangeId: 'choice',
      body: 'Which?',
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    };
    const details = projectAsk({
      exchangeId: 'choice',
      question: { body: 'Which?', options: args.options },
      status: 'answered',
      choice: { id: 'a', label: 'A', kind: 'listed' },
      options: args.options,
    });
    standalone.splice(4, 0, ...pair('choice', 'c-choice', 'ask', args, details));
    expectOnlyOwnedFailure(report(relink(standalone)), 'R9', 'standalone_choice_ask');

    const laundering = passing();
    (laundering[7] as any).message.details = { ...receipt, lsn: 2 };
    (laundering[6] as any).message.content[0].arguments = {
      createSettlement: 'settled',
      ops: [{ op: 'create_node', ref: 'a1', plane: 'intent', kind: 'goal', title: 'Source sketch' }],
    };
    expectOnlyOwnedFailure(report(laundering), 'R10', 'advisory_laundering');

    const postApproval = passing();
    postApproval.push(
      ...pair(
        'late',
        'c-late',
        'mutate_graph',
        { ops: [{ op: 'create_node', ref: 'late', plane: 'intent', kind: 'goal', title: 'Late' }] },
        { ...receipt, lsn: 4 },
      ),
    );
    expectOnlyOwnedFailure(report(relink(postApproval)), 'R10', 'post_approval_mutation');
  });

  it('uses only the active leaf, excluding a sibling rival branch', () => {
    const entries = passing();
    entries.push(
      ...pair(
        'sibling',
        'c-sibling',
        'mutate_graph',
        { ops: [{ op: 'create_node', ref: 'x', plane: 'intent', kind: 'goal', title: 'Sibling' }] },
        { ...receipt, lsn: 4 },
        'digest',
      ),
    );
    expect(report(entries.slice(0, -2)).verdict.R10).toBe('pass');
  });

  it('runs the source CLI through a canonical session and real workspace without mutation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'provider-conduct-'));
    const workspace = join(root, 'workspace');
    const brunch = join(workspace, '.brunch');
    await mkdir(brunch, { recursive: true });
    await execFileAsync('git', ['init', '-q'], { cwd: workspace });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: workspace });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: workspace });
    await writeFile(join(workspace, 'README.md'), 'fixture\n');
    await execFileAsync('git', ['add', '.'], { cwd: workspace });
    await execFileAsync('git', ['commit', '-qm', 'fixture'], { cwd: workspace });

    const dbPath = join(brunch, WORKSPACE_DB_FILENAME);
    const db = createDb(dbPath);
    const executor = new CommandExecutor(db);
    const created = executor.createSpec({ name: 'Spec', slug: 'spec' });
    if (created.status !== 'success') throw new Error('spec seed failed');
    const graphReview = (suffix: string, goalCode: string, requirementCode: string) => ({
      ...reviewPayload,
      entityDrafts: [
        {
          draftId: `goal-${suffix}`,
          proposedCode: goalCode,
          plane: 'intent' as const,
          kind: 'goal',
          title: `Goal ${suffix}`,
        },
        {
          draftId: `req-${suffix}`,
          proposedCode: requirementCode,
          plane: 'intent' as const,
          kind: 'requirement',
          title: `Requirement ${suffix}`,
        },
      ],
      edgeDrafts: [
        {
          category: 'realization' as const,
          abstract: { draftId: `req-${suffix}` },
          concrete: { draftId: `goal-${suffix}` },
        },
      ],
    });
    const stale = executor.acceptReviewSet({
      specId: created.specId,
      payload: graphReview('stale', 'G1', 'REQ1'),
    });
    const advisory = executor.mutateGraph({
      specId: created.specId,
      createSettlement: 'advisory',
      ops: [{ op: 'create_node', ref: 'a1', plane: 'intent', kind: 'goal', title: 'Source sketch' }],
    });
    const accepted = executor.acceptReviewSet({
      specId: created.specId,
      payload: graphReview('accepted', 'G3', 'REQ2'),
    });
    if (stale.status !== 'success' || advisory.status !== 'success' || accepted.status !== 'success')
      throw new Error(`graph seed failed: ${JSON.stringify({ stale, advisory, accepted })}`);

    const entries = passing();
    (entries[7] as any).message.details = advisory;
    (entries[11] as any).message.details = projectRequestReview({
      exchangeId: 'review-1',
      respondsToPresentTool: 'present_review_set',
      status: 'answered',
      review: 'approve',
      receipt: accepted,
    });
    const sibling = pair(
      'sibling',
      'c-sibling',
      'mutate_graph',
      { ops: [] },
      { ...receipt, lsn: 4 },
      'digest',
    );
    const session = join(root, 'session.jsonl');
    const header = {
      type: 'session',
      version: 3,
      id: 'provider-session',
      timestamp: '2026-07-17T00:00:00.000Z',
      cwd: workspace,
    };
    const thinking = {
      type: 'thinking_level_change',
      id: 'thinking',
      parentId: null,
      timestamp: '2026-07-17T00:00:00.000Z',
      thinkingLevel: 'low',
    };
    const active = relink([thinking, ...entries]);
    await writeFile(
      session,
      `${[header, ...sibling, ...active].map((row) => JSON.stringify(row)).join('\n')}\n`,
    );
    const source = join(root, 'source.md');
    await writeFile(source, 'foreign source\n');
    const beforeSession = await readFile(session);
    const beforeSource = await readFile(source);
    const sqlite = new Database(dbPath, { readonly: true });
    const snapshot = () => ({
      clock: sqlite.prepare('select count(*) n, sum(lsn) total from graph_clock').get(),
      log: sqlite.prepare('select count(*) n, group_concat(operation) operations from change_log').get(),
    });
    const beforeDb = snapshot();
    const common = [
      '--workspace',
      workspace,
      '--session',
      session,
      '--source',
      source,
      '--spec-id',
      String(created.specId),
      '--pre-run-lsn',
      '1',
      '--run-id',
      'run',
      '--seed-ref',
      'seed',
    ];
    const sourceReport = join(root, 'source.json');
    const builtReport = join(root, 'built.json');
    const sourceSummary = join(root, 'source.md.out');
    const builtSummary = join(root, 'built.md.out');
    await execFileAsync(
      'node',
      [
        '--import',
        'tsx',
        'src/probes/provider-conduct-report.ts',
        ...common,
        '--report',
        sourceReport,
        '--summary',
        sourceSummary,
      ],
      { cwd: resolve('.') },
    );
    if (process.env.PROVIDER_CONDUCT_BUILT_DIFFERENTIAL === '1') {
      await execFileAsync(
        'node',
        [
          'dist/probes/provider-conduct-report.js',
          ...common,
          '--report',
          builtReport,
          '--summary',
          builtSummary,
        ],
        { cwd: resolve('.') },
      );
      const normalize = (value: any) => {
        const copy = structuredClone(value);
        copy.identity.generatedAt = '<volatile>';
        return copy;
      };
      expect(normalize(JSON.parse(await readFile(sourceReport, 'utf8')))).toEqual(
        normalize(JSON.parse(await readFile(builtReport, 'utf8'))),
      );
      expect(await readFile(sourceSummary, 'utf8')).toBe(await readFile(builtSummary, 'utf8'));
    }
    expect(await readFile(session)).toEqual(beforeSession);
    expect(await readFile(source)).toEqual(beforeSource);
    expect(snapshot()).toEqual(beforeDb);
    sqlite.close();
  }, 30_000);

  it('rejects unknown options and positionals consistently', async () => {
    await expect(
      execFileAsync(
        'node',
        ['--import', 'tsx', 'src/probes/provider-conduct-report.ts', '--unknown', 'value'],
        { cwd: resolve('.') },
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('Unknown, duplicate, or missing CLI argument'),
    });
  });

  it.each(['--workspace', '--session', '--source'])(
    'rejects missing %s value before path resolution',
    async (missing) => {
      const args = [
        '--workspace',
        '/tmp',
        '--session',
        '/tmp/s',
        '--source',
        '/tmp/x',
        '--report',
        '/tmp/r',
        '--run-id',
        'r',
        '--seed-ref',
        's',
        '--spec-id',
        '1',
        '--pre-run-lsn',
        '0',
      ];
      const index = args.indexOf(missing);
      args.splice(index, 2);
      await expect(
        execFileAsync('node', ['--import', 'tsx', 'src/probes/provider-conduct-report.ts', ...args], {
          cwd: resolve('.'),
        }),
      ).rejects.toMatchObject({ stderr: expect.stringContaining('Usage') });
    },
  );
});
