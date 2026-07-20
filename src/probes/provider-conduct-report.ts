import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import Database from 'better-sqlite3';
import { Value } from 'typebox/value';
import { z } from 'zod';

import { MutateGraphParams } from '../.pi/extensions/brunch-data/graph/tool-schemas.js';
import { WORKSPACE_DB_FILENAME } from '../constants.js';
import {
  parseAskParams,
  zPresentDigestDetails,
  zPresentReviewSetDetails,
  zPresentDigestParams,
  zPresentReviewSetParams,
  zRequestDetails,
  zMutateGraphSuccess,
} from '../exchanges/schemas/index.js';
import { openActiveSessionBranch } from '../session/active-session-branch.js';

const HUMAN_JUDGMENTS = [
  'digest_fidelity',
  'question_materiality',
  'proposition_cohesion',
  'fatigue',
] as const;
const verdictSchema = z.enum(['pass', 'fail', 'not_observed']);
const rivalSchema = z.enum([
  'heavyweight_digest_review',
  'post_digest_clarification',
  'standalone_choice_ask',
  'advisory_laundering',
  'post_approval_mutation',
]);
const citationSchema = z.object({ entryId: z.string().min(1), toolCallId: z.string().min(1) }).strict();
const markerSchema = z.object({ observed: z.boolean(), citations: z.array(citationSchema) }).strict();
const identitySchema = z
  .object({
    runId: z.string().min(1),
    generatedAt: z.iso.datetime(),
    branch: z.string().min(1),
    commit: z.string().min(1),
    piVersion: z.string().min(1),
    provider: z.string().min(1),
    model: z.string().min(1),
    thinking: z.string().min(1),
    seedRef: z.string().min(1),
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/u),
    sessionPath: z.string().min(1),
    activeLeaf: z.string().min(1),
    specId: z.number().int().positive(),
    beforeLsn: z.number().int().nonnegative(),
    afterLsn: z.number().int().nonnegative(),
  })
  .strict();
const reportSchema = z
  .object({
    schemaVersion: z.literal(1),
    identity: identitySchema,
    markers: z
      .object({
        digestPresented: markerSchema,
        terminalFeedbackAfterDigest: markerSchema,
        boundedQuestionnaire: markerSchema.extend({
          rawQuestionCount: z.number().int().nonnegative(),
          questionIdsInOrder: z.array(z.string().min(1)),
        }),
        standaloneChoiceAskRival: markerSchema,
        firstMappingMutationAfterClarification: markerSchema,
        advisorySourceMaterialBeforeReview: markerSchema,
        reviewSetPresented: markerSchema,
        reviewSettlementReceipt: markerSchema,
        postApprovalMutationRival: markerSchema,
      })
      .strict(),
    verdict: z
      .object({
        sample: z.enum(['valid', 'mechanically_invalid']),
        R8: verdictSchema,
        R9: verdictSchema,
        R10: verdictSchema,
        forbiddenRivals: z.array(rivalSchema),
        humanJudgmentsRequired: z.tuple([
          z.literal('digest_fidelity'),
          z.literal('question_materiality'),
          z.literal('proposition_cohesion'),
          z.literal('fatigue'),
        ]),
      })
      .strict(),
  })
  .strict();
export type ProviderConductReport = z.infer<typeof reportSchema>;
export type ProviderConductIdentity = z.infer<typeof identitySchema>;

export interface ProviderConductInput {
  identity: ProviderConductIdentity;
  entries?: SessionEntry[];
  graphReadback: { available: boolean; reviewLsns: readonly number[] };
}

type Call = { index: number; name: string; id: string; args: unknown; entryId: string };
type Result = { index: number; name: string; id: string; details: unknown; entryId: string };
type Event = Call & {
  details: unknown;
  resultIndex: number;
  citation: { entryId: string; toolCallId: string };
};
const rec = (v: unknown): Record<string, unknown> | undefined =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : undefined;

function events(entries: SessionEntry[]): { events: Event[]; malformedRelevant: boolean } {
  const calls: Call[] = [];
  const results = new Map<string, Result>();
  let malformedRelevant = false;
  entries.forEach((entry, index) => {
    const raw = entry as unknown as Record<string, unknown>;
    const message = rec(raw.message);
    const entryId = typeof raw.id === 'string' ? raw.id : `entry-${index}`;
    if (raw.type !== 'message' || !message) return;
    if (message.role === 'assistant' && Array.isArray(message.content)) {
      for (const part of message.content) {
        const p = rec(part);
        if (p?.type !== 'toolCall') continue;
        if (typeof p.name !== 'string' || typeof p.id !== 'string') {
          malformedRelevant = true;
          continue;
        }
        calls.push({ index, name: p.name, id: p.id, args: p.arguments, entryId });
      }
    } else if (
      message.role === 'toolResult' &&
      typeof message.toolName === 'string' &&
      typeof message.toolCallId === 'string'
    ) {
      results.set(message.toolCallId, {
        index,
        name: message.toolName,
        id: message.toolCallId,
        details: message.details,
        entryId,
      });
    }
  });
  const joined: Event[] = [];
  for (const call of calls) {
    if (!['present_digest', 'ask', 'mutate_graph', 'present_review_set'].includes(call.name)) continue;
    const result = results.get(call.id);
    if (!result || result.name !== call.name) {
      malformedRelevant = true;
      continue;
    }
    const argsOk =
      call.name === 'present_digest'
        ? zPresentDigestParams.safeParse(call.args).success
        : call.name === 'present_review_set'
          ? zPresentReviewSetParams.safeParse(call.args).success
          : call.name === 'ask'
            ? parseAskParams(call.args).success
            : Value.Check(MutateGraphParams, call.args);
    const mutationOutcome = call.name === 'mutate_graph' ? mutationResultOutcome(result.details) : undefined;
    const detailsOk =
      call.name === 'present_digest'
        ? zPresentDigestDetails.safeParse(result.details).success
        : call.name === 'present_review_set'
          ? zPresentReviewSetDetails.safeParse(result.details).success
          : call.name === 'ask'
            ? zRequestDetails.safeParse(result.details).success
            : mutationOutcome !== 'malformed';
    if (!argsOk || !detailsOk) {
      if (process.env.DEBUG_PROVIDER_REPORT) console.error(call.name, { argsOk, detailsOk });
      malformedRelevant = true;
      continue;
    }
    if (mutationOutcome !== 'structural_illegal') {
      joined.push({
        ...call,
        details: result.details,
        resultIndex: result.index,
        citation: { entryId: result.entryId, toolCallId: call.id },
      });
    }
  }
  return { events: joined, malformedRelevant };
}
function mutationResultOutcome(v: unknown): 'success' | 'structural_illegal' | 'malformed' {
  if (zMutateGraphSuccess.safeParse(v).success) return 'success';
  const x = rec(v);
  if (
    x?.status === 'structural_illegal' &&
    Array.isArray(x.diagnostics) &&
    x.diagnostics.every((item) => {
      const diagnostic = rec(item);
      return typeof diagnostic?.field === 'string' && typeof diagnostic.message === 'string';
    })
  )
    return 'structural_illegal';
  return 'malformed';
}
function mark(items: Event[]): z.infer<typeof markerSchema> {
  return { observed: items.length > 0, citations: items.map((x) => x.citation) };
}

export function extractProviderConductReport(input: ProviderConductInput): ProviderConductReport {
  const projected = events(input.entries ?? []);
  const mechanical =
    !identitySchema.safeParse(input.identity).success ||
    !input.entries?.length ||
    projected.events.length === 0 ||
    !input.graphReadback.available ||
    projected.malformedRelevant;
  const xs = projected.events;
  const digest = xs.find((x) => x.name === 'present_digest');
  const reviews = xs.filter((x) => x.name === 'present_review_set');
  const asks = xs.filter((x) => x.name === 'ask');
  const feedback = asks.find(
    (x) =>
      x.index > (digest?.resultIndex ?? Infinity) && rec(x.args)?.continues === rec(digest?.args)?.exchangeId,
  );
  const questionnaire = asks.find(
    (x) =>
      Array.isArray(rec(x.args)?.questions) && rec(x.args)?.acceptsDigest === rec(digest?.args)?.exchangeId,
  );
  const questionnaireQuestions = Array.isArray(rec(questionnaire?.args)?.questions)
    ? (rec(questionnaire?.args)?.questions as unknown[])
    : [];
  const mutations = xs.filter((x) => x.name === 'mutate_graph');
  const clarificationOrdered = Boolean(
    digest &&
    feedback &&
    questionnaire &&
    digest.resultIndex < feedback.index &&
    feedback.resultIndex < questionnaire.index,
  );
  const clarificationCompleteIndex = clarificationOrdered ? questionnaire!.resultIndex : Infinity;
  const mapping = mutations.find((x) => x.index > clarificationCompleteIndex);
  const reviewPairs = reviews.flatMap((candidate) => {
    const response = asks.find(
      (ask) =>
        ask.index > candidate.resultIndex &&
        rec(ask.args)?.continues === rec(candidate.args)?.exchangeId &&
        rec(rec(ask.details)?.answered)?.decision === 'approve',
    );
    return response ? [{ review: candidate, response }] : [];
  });
  const settledPair = reviewPairs.find(
    ({ review: candidate }) => candidate.index > (mapping?.resultIndex ?? Infinity),
  );
  const review = settledPair?.review;
  const standaloneChoice = asks.find(
    (x) =>
      x.index > (digest?.resultIndex ?? Infinity) &&
      x.index < (review?.index ?? Infinity) &&
      Array.isArray(rec(x.args)?.options) &&
      rec(x.args)?.acceptsDigest === undefined,
  );
  const advisory = mutations.find((x) => {
    const args = rec(x.args);
    return args?.createSettlement === 'advisory' && Array.isArray(args.ops) && args.ops.length > 0;
  });
  const settlementCandidate = settledPair?.response;
  const settlementReceipt = rec(rec(rec(settlementCandidate?.details)?.answered)?.receipt);
  const settlement =
    settlementCandidate &&
    typeof settlementReceipt?.lsn === 'number' &&
    settlementReceipt.lsn > input.identity.beforeLsn &&
    settlementReceipt.lsn <= input.identity.afterLsn &&
    input.graphReadback.reviewLsns.includes(settlementReceipt.lsn)
      ? settlementCandidate
      : undefined;
  const earlyMapping = mutations.find(
    (x) => x.index > (digest?.resultIndex ?? Infinity) && x.index < clarificationCompleteIndex,
  );
  const late = settlement ? mutations.filter((x) => x.index > settlement.resultIndex) : [];
  const heavyweight = Boolean(
    digest &&
    reviews.some(
      (candidate) =>
        candidate !== review &&
        candidate.index > digest.resultIndex &&
        candidate.index < (feedback?.index ?? questionnaire?.index ?? Infinity),
    ),
  );
  const postDigestClarification = !clarificationOrdered || Boolean(earlyMapping);
  const laundering = Boolean(review && (!advisory || advisory.index > review.index));
  const rivals = [
    heavyweight && 'heavyweight_digest_review',
    postDigestClarification && 'post_digest_clarification',
    standaloneChoice && 'standalone_choice_ask',
    laundering && 'advisory_laundering',
    late.length && 'post_approval_mutation',
  ].filter(Boolean);
  const requirement = (ok: boolean, fail: boolean) =>
    mechanical ? 'not_observed' : fail ? 'fail' : ok ? 'pass' : 'not_observed';
  return reportSchema.parse({
    schemaVersion: 1,
    identity: input.identity,
    markers: {
      digestPresented: mark(digest ? [digest] : []),
      terminalFeedbackAfterDigest: mark(feedback ? [feedback] : []),
      boundedQuestionnaire: {
        ...mark(questionnaire ? [questionnaire] : []),
        rawQuestionCount: questionnaireQuestions.length,
        questionIdsInOrder: questionnaireQuestions
          .map((question) => rec(question)?.id)
          .filter((id): id is string => typeof id === 'string'),
      },
      standaloneChoiceAskRival: mark(standaloneChoice ? [standaloneChoice] : []),
      firstMappingMutationAfterClarification: mark(mapping ? [mapping] : []),
      advisorySourceMaterialBeforeReview: mark(
        advisory && review && advisory.index < review.index ? [advisory] : [],
      ),
      reviewSetPresented: mark(review ? [review] : []),
      reviewSettlementReceipt: mark(settlement ? [settlement] : []),
      postApprovalMutationRival: mark(late),
    },
    verdict: {
      sample: mechanical ? 'mechanically_invalid' : 'valid',
      R8: requirement(
        Boolean(digest && feedback && questionnaire && mapping),
        heavyweight || postDigestClarification,
      ),
      R9: requirement(Boolean(questionnaire), Boolean(standaloneChoice)),
      R10: requirement(Boolean(advisory && review && settlement), laundering || late.length > 0),
      forbiddenRivals: rivals,
      humanJudgmentsRequired: HUMAN_JUDGMENTS,
    },
  });
}

export function providerConductSummary(r: ProviderConductReport): string {
  return `Provider conduct ${r.identity.runId}: ${r.verdict.sample}\nR8 ${r.verdict.R8} · R9 ${r.verdict.R9} · R10 ${r.verdict.R10}\nForbidden rivals: ${r.verdict.forbiddenRivals.join(', ') || 'none'}\nHuman judgments required: ${r.verdict.humanJudgmentsRequired.join(', ')}`;
}

async function main(argv: string[]): Promise<number> {
  const valueOptions = new Set([
    '--workspace',
    '--session',
    '--source',
    '--report',
    '--summary',
    '--run-id',
    '--seed-ref',
    '--spec-id',
    '--pre-run-lsn',
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!option || !valueOptions.has(option) || !value || value.startsWith('--') || values.has(option))
      throw new Error(`Unknown, duplicate, or missing CLI argument near: ${option ?? '<end>'}`);
    values.set(option, value);
  }
  const arg = (name: string) => values.get(name);
  const workspaceArg = arg('--workspace');
  const sessionArg = arg('--session');
  const sourceArg = arg('--source');
  const reportPath = arg('--report');
  const runId = arg('--run-id');
  const seedRef = arg('--seed-ref');
  const specId = Number(arg('--spec-id'));
  const beforeLsn = Number(arg('--pre-run-lsn'));
  if (
    !workspaceArg ||
    !sessionArg ||
    !sourceArg ||
    !reportPath ||
    !runId ||
    !seedRef ||
    !Number.isInteger(specId) ||
    specId <= 0 ||
    !Number.isInteger(beforeLsn) ||
    beforeLsn < 0
  )
    throw new Error(
      'Usage: --workspace PATH --session PATH --source PATH --spec-id N --pre-run-lsn N --run-id ID --seed-ref REF --report PATH [--summary PATH]',
    );
  const workspace = resolve(workspaceArg);
  const sessionPath = resolve(sessionArg);
  const sourcePath = resolve(sourceArg);
  const branch = openActiveSessionBranch(sessionPath);
  const dbPath = join(workspace, '.brunch', WORKSPACE_DB_FILENAME);
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const clock = db.prepare('select lsn from graph_clock where spec_id = ?').get(specId) as
    | { lsn: number }
    | undefined;
  const reviewLsns = (
    db
      .prepare(
        "select lsn from change_log where spec_id = ? and operation = 'accept_review_set' and lsn > ? and lsn <= ?",
      )
      .all(specId, beforeLsn, clock?.lsn ?? -1) as { lsn: number }[]
  ).map((x) => x.lsn);
  db.close();
  const assistant = [...branch.entries]
    .reverse()
    .map((e) => rec(rec(e as unknown)?.message))
    .find((m) => m?.role === 'assistant' && typeof m.provider === 'string' && typeof m.model === 'string');
  const thinkingEntry = [...branch.entries]
    .reverse()
    .map((e) => e as unknown as Record<string, unknown>)
    .find((e) => e.type === 'thinking_level_change');
  const identity = {
    runId,
    generatedAt: new Date().toISOString(),
    branch: execFileSync('git', ['branch', '--show-current'], { cwd: workspace, encoding: 'utf8' }).trim(),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim(),
    piVersion: JSON.parse(
      await readFile(resolve('node_modules/@earendil-works/pi-coding-agent/package.json'), 'utf8'),
    ).version as string,
    provider: typeof assistant?.provider === 'string' ? assistant.provider : '',
    model: typeof assistant?.model === 'string' ? assistant.model : '',
    thinking:
      typeof thinkingEntry?.thinkingLevel === 'string'
        ? thinkingEntry.thinkingLevel
        : typeof thinkingEntry?.level === 'string'
          ? thinkingEntry.level
          : '',
    seedRef,
    sourceSha256: createHash('sha256')
      .update(await readFile(sourcePath))
      .digest('hex'),
    sessionPath,
    activeLeaf: String((branch.entries.at(-1) as unknown as { id?: string })?.id ?? ''),
    specId,
    beforeLsn,
    afterLsn: clock?.lsn ?? -1,
  };
  const report = extractProviderConductReport({
    identity,
    entries: branch.entries,
    graphReadback: { available: Boolean(clock), reviewLsns },
  });
  const parsed = reportSchema.parse(report);
  const summary = providerConductSummary(parsed);
  await writeFile(resolve(reportPath), `${JSON.stringify(parsed, null, 2)}\n`);
  if (arg('--summary')) await writeFile(resolve(arg('--summary')!), `${summary}\n`);
  process.stdout.write(`${summary}\n`);
  return parsed.verdict.R8 === 'pass' && parsed.verdict.R9 === 'pass' && parsed.verdict.R10 === 'pass'
    ? 0
    : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main(process.argv.slice(2))
    .then((c) => {
      process.exitCode = c;
    })
    .catch((e) => {
      process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
      process.exitCode = 1;
    });
