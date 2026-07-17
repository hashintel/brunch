import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { z } from 'zod';

import { zAskDetails, zPresentDigestDetails, zPresentReviewSetDetails } from '../exchanges/schemas/index.js';
import { openActiveSessionBranch } from '../session/active-session-branch.js';

const HUMAN_JUDGMENTS = [
  'digest_fidelity',
  'question_materiality',
  'proposition_cohesion',
  'fatigue',
] as const;
const SHA256 = /^[a-f0-9]{64}$/u;

type RequirementVerdict = 'pass' | 'fail' | 'not_observed';
type Rival =
  | 'heavyweight_digest_review'
  | 'post_digest_clarification'
  | 'combinatorial_options'
  | 'advisory_laundering'
  | 'post_approval_mutation';

export interface ProviderConductIdentity {
  runId: string;
  generatedAt: string;
  branch: string;
  commit: string;
  piVersion: string;
  provider: string;
  model: string;
  thinking: string;
  seedRef: string;
  sourceSha256: string;
  sessionPath: string;
  activeLeaf: string;
  specId: number;
  beforeLsn: number;
  afterLsn: number;
}

export interface ProviderConductInput {
  identity: ProviderConductIdentity;
  entries?: SessionEntry[];
  branchResolved?: boolean;
  graphReadback: {
    available: boolean;
    acceptedReviewExchangeIds?: string[];
    afterLsn?: number;
  };
}

interface Citation {
  entryId: string;
  toolCallId: string;
}
interface Marker {
  observed: boolean;
  citations: Citation[];
}

export interface ProviderConductReport {
  schemaVersion: 1;
  identity: ProviderConductIdentity;
  markers: {
    digestPresented: Marker;
    terminalFeedbackAfterDigest: Marker;
    boundedQuestionnaire: Marker;
    combinatorialOptionsRival: Marker;
    firstMappingMutationAfterClarification: Marker;
    advisorySourceMaterialBeforeReview: Marker;
    reviewSetPresented: Marker;
    reviewSettlementReceipt: Marker;
    postApprovalMutationRival: Marker;
  };
  verdict: {
    sample: 'valid' | 'mechanically_invalid';
    R8: RequirementVerdict;
    R9: RequirementVerdict;
    R10: RequirementVerdict;
    forbiddenRivals: Rival[];
    humanJudgmentsRequired: readonly string[];
  };
}

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
    sourceSha256: z.string().regex(SHA256),
    sessionPath: z.string().min(1),
    activeLeaf: z.string().min(1),
    specId: z.number().int().positive(),
    beforeLsn: z.number().int().nonnegative(),
    afterLsn: z.number().int().nonnegative(),
  })
  .strict();

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function event(entry: SessionEntry, index: number) {
  const raw = entry as unknown as Record<string, unknown>;
  const message = record(raw.message);
  if (raw.type !== 'message' || message?.role !== 'toolResult' || typeof message.toolName !== 'string')
    return;
  const details = record(message.details);
  if (!details) return;
  // Canonical schemas remain the vocabulary owner. safeParse identifies production
  // details; the structural fallback keeps corrupt/rival fixtures inspectable.
  const canonical =
    zAskDetails.safeParse(details).success ||
    zPresentDigestDetails.safeParse(details).success ||
    zPresentReviewSetDetails.safeParse(details).success;
  const entryId = typeof raw.id === 'string' ? raw.id : `entry-${index}`;
  const toolCallId =
    typeof message.toolCallId === 'string'
      ? message.toolCallId
      : typeof details.tool_call_id === 'string'
        ? details.tool_call_id
        : entryId;
  return {
    index,
    toolName: message.toolName,
    details,
    canonical,
    citation: { entryId, toolCallId },
  };
}

function marker(
  events: ReturnType<typeof event>[],
  predicate: (item: NonNullable<ReturnType<typeof event>>) => boolean,
): Marker {
  const citations = events
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter(predicate)
    .map((item) => item.citation);
  return { observed: citations.length > 0, citations };
}

export function extractProviderConductReport(input: ProviderConductInput): ProviderConductReport {
  const validIdentity = identitySchema.safeParse(input.identity).success;
  const mechanicallyInvalid =
    !validIdentity ||
    !input.entries ||
    input.branchResolved === false ||
    !input.graphReadback?.available ||
    input.entries.length === 0;
  const events = (input.entries ?? []).map(event);
  const digest = events.find((item) => item?.toolName === 'present_digest');
  const review = events.find((item) => item?.toolName === 'present_review_set');
  const questionnaire = events.find((item) => {
    const details = item?.details;
    return item?.toolName === 'ask' && Array.isArray(details?.questions) && details.questions.length > 1;
  });
  const feedback = events.find((item) => {
    const details = item?.details;
    return (
      item?.toolName === 'ask' &&
      item.index > (digest?.index ?? Infinity) &&
      !Array.isArray(details?.questions)
    );
  });
  const mutations = events.filter((item) => item?.toolName === 'mutate_graph');
  const advisory = mutations.find((item) => item && item.details.settlement === 'advisory');
  const settlement = events.find((item) => {
    const details = item?.details;
    const answered = record(details?.answered);
    return item?.toolName === 'ask' && answered?.decision === 'approve' && record(answered.receipt);
  });
  const heavyweight = Boolean(feedback && record(feedback.details.answered)?.decision);
  const combinatorial = Boolean(questionnaire && Array.isArray(questionnaire.details.options));
  const postDigestClarification = Boolean(questionnaire && advisory && questionnaire.index > advisory.index);
  const advisoryLaundering = Boolean(review && (!advisory || advisory.index > review.index));
  const postApprovalMutation = Boolean(
    settlement && mutations.some((item) => item && item.index > settlement.index),
  );
  const rivals: Rival[] = [];
  if (heavyweight) rivals.push('heavyweight_digest_review');
  if (postDigestClarification) rivals.push('post_digest_clarification');
  if (combinatorial) rivals.push('combinatorial_options');
  if (advisoryLaundering) rivals.push('advisory_laundering');
  if (postApprovalMutation) rivals.push('post_approval_mutation');

  const mappingMutation = mutations.find((item) => item && questionnaire && item.index > questionnaire.index);
  const r8Observed = Boolean(digest && feedback && questionnaire && mappingMutation);
  const r9Observed = Boolean(questionnaire);
  const accepted =
    review && input.graphReadback.acceptedReviewExchangeIds?.includes(String(review.details.exchange_id));
  const r10Observed = Boolean(advisory && review && settlement && accepted);
  const requirement = (observed: boolean, failed: boolean): RequirementVerdict =>
    mechanicallyInvalid ? 'not_observed' : failed ? 'fail' : observed ? 'pass' : 'not_observed';

  return {
    schemaVersion: 1,
    identity: input.identity,
    markers: {
      digestPresented: marker(events, (item) => item.toolName === 'present_digest'),
      terminalFeedbackAfterDigest: marker(events, (item) => item === feedback),
      boundedQuestionnaire: marker(events, (item) => item === questionnaire),
      combinatorialOptionsRival: marker(events, (item) => item === questionnaire && combinatorial),
      firstMappingMutationAfterClarification: marker(events, (item) => item === mappingMutation),
      advisorySourceMaterialBeforeReview: marker(
        events,
        (item) => item === advisory && Boolean(review) && item.index < review!.index,
      ),
      reviewSetPresented: marker(events, (item) => item === review),
      reviewSettlementReceipt: marker(events, (item) => item === settlement),
      postApprovalMutationRival: marker(
        events,
        (item) => Boolean(settlement) && item.toolName === 'mutate_graph' && item.index > settlement!.index,
      ),
    },
    verdict: {
      sample: mechanicallyInvalid ? 'mechanically_invalid' : 'valid',
      R8: requirement(r8Observed, heavyweight || postDigestClarification),
      R9: requirement(r9Observed, combinatorial),
      R10: requirement(r10Observed, advisoryLaundering || postApprovalMutation),
      forbiddenRivals: rivals,
      humanJudgmentsRequired: HUMAN_JUDGMENTS,
    },
  };
}

export function providerConductSummary(report: ProviderConductReport): string {
  return [
    `Provider conduct ${report.identity.runId}: ${report.verdict.sample}`,
    `R8 ${report.verdict.R8} · R9 ${report.verdict.R9} · R10 ${report.verdict.R10}`,
    report.verdict.forbiddenRivals.length
      ? `Forbidden rivals: ${report.verdict.forbiddenRivals.join(', ')}`
      : 'Forbidden rivals: none',
    `Human judgments required: ${report.verdict.humanJudgmentsRequired.join(', ')}`,
  ].join('\n');
}

async function main(argv: string[]): Promise<number> {
  const inputAt = argv.indexOf('--input');
  const reportAt = argv.indexOf('--report');
  const summaryAt = argv.indexOf('--summary');
  const inputPath = argv[inputAt + 1];
  const reportPath = argv[reportAt + 1];
  if (inputAt < 0 || reportAt < 0 || !inputPath || !reportPath)
    throw new Error(
      'Usage: provider-conduct-report --input input.json --report report.json [--summary report.md]',
    );
  const config = JSON.parse(await readFile(resolve(inputPath), 'utf8')) as Omit<
    ProviderConductInput,
    'entries'
  >;
  const branch = openActiveSessionBranch(resolve(config.identity.sessionPath));
  const report = extractProviderConductReport({ ...config, entries: branch.entries, branchResolved: true });
  const summary = providerConductSummary(report);
  await writeFile(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`);
  const summaryPath = argv[summaryAt + 1];
  if (summaryAt >= 0 && summaryPath) await writeFile(resolve(summaryPath), `${summary}\n`);
  process.stdout.write(`${summary}\n`);
  return report.verdict.R8 === 'pass' && report.verdict.R9 === 'pass' && report.verdict.R10 === 'pass'
    ? 0
    : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
