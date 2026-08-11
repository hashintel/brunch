import type { z } from 'zod';

import {
  zPresentCandidatesDetails,
  zPresentDigestDetails,
  zPresentReviewSetDetails,
} from '../../exchanges/schemas/present.js';
import type {
  PresentCandidatesDetails,
  PresentDigestDetails,
  PresentReviewSetDetails,
} from '../../exchanges/schemas/present.js';
import type { QuestionnaireQuestion } from '../../exchanges/schemas/questionnaire.js';
import {
  zAskDetails,
  zRequestChoiceDetails,
  zRequestDigestReviewDetails,
  zRequestReviewSetDetails,
} from '../../exchanges/schemas/request.js';
import type {
  AnsweredOptionEcho,
  AskDetails,
  AskDigestConfirmationDetails,
  AskQuestionEcho,
  AskQuestionnaireDetails,
  RequestDigestReviewDetails,
  SelectedChoice,
} from '../../exchanges/schemas/request.js';
import { loadJsonlTranscriptEntries } from '../../session/brunch-session-envelope.js';
import type { SessionTarget } from '../../session/live-session-host.js';

export type SessionPresentationEntry =
  | {
      readonly id: string;
      readonly cursor: string;
      readonly kind: 'message';
      readonly role: 'user' | 'assistant';
      readonly text: string;
    }
  | {
      readonly id: string;
      readonly cursor: string;
      readonly kind: 'present_candidates';
      readonly exchangeId: string;
      readonly heading: string;
      readonly body?: string | undefined;
      readonly candidates: PresentCandidatesDetails['candidates'];
      readonly continuation?: {
        readonly tool: 'ask';
        readonly request: 'request_choice';
        readonly exchangeId: string;
        readonly question: string;
        readonly options?: NonNullable<PresentCandidatesDetails['continuation']>['params']['options'];
      };
    }
  | {
      readonly id: string;
      readonly cursor: string;
      readonly kind: 'present_review_set';
      readonly exchangeId: string;
      readonly heading: string;
      readonly body?: string | undefined;
      readonly reviewSet: PresentReviewSetDetails['review_set'];
      readonly continuation?: NonNullable<PresentReviewSetDetails['continuation']>;
    }
  | {
      readonly id: string;
      readonly cursor: string;
      readonly kind: 'present_digest';
      readonly exchangeId: string;
      readonly heading: string;
      readonly body?: string | undefined;
      readonly digest: PresentDigestDetails['digest'];
      readonly continuation?: NonNullable<PresentDigestDetails['continuation']>;
    }
  | {
      readonly id: string;
      readonly cursor: string;
      readonly kind: 'ask';
      readonly exchangeId: string;
      readonly question: string;
      readonly mode?: 'multi-select';
      readonly options?: NonNullable<AskQuestionEcho['options']>;
      readonly questions?: readonly QuestionnaireQuestion[];
      readonly terminal?: AskTerminal;
    };

type DigestReviewAnswered = Extract<RequestDigestReviewDetails, { answered: unknown }>['answered'];
type RequestReviewSetDetails = z.infer<typeof zRequestReviewSetDetails>;
type ReviewSetAnswered = Extract<RequestReviewSetDetails, { answered: unknown }>['answered'];

type AskTerminal =
  | {
      readonly status: 'answered';
      readonly value:
        | { readonly text: string; readonly comment?: string | undefined }
        | {
            readonly choice: SelectedChoice;
            readonly options: readonly AnsweredOptionEcho[];
            readonly comment?: string | undefined;
          }
        | {
            readonly choices: readonly SelectedChoice[];
            readonly options: readonly AnsweredOptionEcho[];
            readonly comment?: string | undefined;
          }
        | {
            readonly questionnaire: AskQuestionnaireDetails['questionnaire'];
            readonly acceptsDigest: AskQuestionnaireDetails['accepts_digest'];
            readonly acceptedAbstract: string;
          }
        | {
            readonly choice: AskDigestConfirmationDetails['answered']['choice'];
            readonly options: AskDigestConfirmationDetails['answered']['options'];
            readonly comment?: string | undefined;
            readonly acceptsDigest: AskDigestConfirmationDetails['accepts_digest'];
            readonly acceptedAbstract: string;
          }
        | {
            readonly decision: DigestReviewAnswered['decision'];
            readonly comment?: string | undefined;
            readonly acceptedAbstract?: string | undefined;
          }
        | ReviewSetAnswered;
    }
  | { readonly status: 'cancelled'; readonly value: { readonly message?: string | undefined } }
  | { readonly status: 'unavailable'; readonly value: { readonly message: string } };

function projectAskTerminal(details: AskDetails): AskTerminal | undefined {
  if ('questionnaire' in details)
    return {
      status: 'answered',
      value: {
        questionnaire: details.questionnaire,
        acceptsDigest: details.accepts_digest,
        acceptedAbstract: details.answered.accepted_abstract,
      },
    };
  if ('accepts_digest' in details)
    return {
      status: 'answered',
      value: {
        choice: details.answered.choice,
        options: details.answered.options,
        ...(details.answered.comment ? { comment: details.answered.comment } : {}),
        acceptsDigest: details.accepts_digest,
        acceptedAbstract: details.answered.accepted_abstract,
      },
    };
  if ('answered' in details && 'text' in details.answered)
    return { status: 'answered', value: details.answered };
  if ('answered' in details && ('choice' in details.answered || 'choices' in details.answered))
    return { status: 'answered', value: details.answered };
  if ('cancelled' in details) return { status: 'cancelled', value: details.cancelled };
  if ('unavailable' in details) return { status: 'unavailable', value: details.unavailable };
  return undefined;
}

export interface SessionPresentation {
  readonly target: SessionTarget;
  readonly cursor: string | null;
  readonly entries: readonly SessionPresentationEntry[];
}

export type SessionPresentationResult =
  | { readonly status: 'ready'; readonly presentation: SessionPresentation }
  | {
      readonly status: 'malformed_detail';
      readonly entryId: string;
      readonly family: 'ask' | 'present_candidates' | 'present_digest' | 'present_review_set';
    };

export async function projectSessionPresentationFile(input: {
  readonly target: SessionTarget;
  readonly sessionFile: string;
}): Promise<SessionPresentationResult> {
  return projectSessionPresentation(input.target, await loadJsonlTranscriptEntries(input.sessionFile));
}

export function projectSessionPresentation(
  target: SessionTarget,
  entries: readonly unknown[],
): SessionPresentationResult {
  const projected: SessionPresentationEntry[] = [];
  for (const [index, entry] of entries.entries()) {
    if (
      !isRecord(entry) ||
      entry.type !== 'message' ||
      typeof entry.id !== 'string' ||
      !isRecord(entry.message)
    )
      continue;
    const cursor = `${index}:${entry.id}`;
    const message = entry.message;
    if (message.role === 'user' || message.role === 'assistant') {
      const text = messageText(message.content);
      if (text !== null) projected.push({ id: entry.id, cursor, kind: 'message', role: message.role, text });
      continue;
    }
    if (message.role !== 'toolResult') continue;
    if (message.toolName === 'present_review_set') {
      const parsed = zPresentReviewSetDetails.safeParse(message.details);
      if (!parsed.success)
        return { status: 'malformed_detail', entryId: entry.id, family: 'present_review_set' };
      const details = parsed.data;
      projected.push({
        id: entry.id,
        cursor,
        kind: 'present_review_set',
        exchangeId: details.exchange_id,
        heading: details.display.heading,
        ...(details.display.body ? { body: details.display.body } : {}),
        reviewSet: details.review_set,
        ...(details.continuation ? { continuation: details.continuation } : {}),
      });
      continue;
    }
    if (message.toolName === 'present_digest') {
      const parsed = zPresentDigestDetails.safeParse(message.details);
      if (!parsed.success) return { status: 'malformed_detail', entryId: entry.id, family: 'present_digest' };
      const details = parsed.data;
      projected.push({
        id: entry.id,
        cursor,
        kind: 'present_digest',
        exchangeId: details.exchange_id,
        heading: details.display.heading,
        ...(details.display.body ? { body: details.display.body } : {}),
        digest: details.digest,
        ...(details.continuation ? { continuation: details.continuation } : {}),
      });
      continue;
    }
    if (message.toolName === 'present_candidates') {
      const parsed = zPresentCandidatesDetails.safeParse(message.details);
      if (!parsed.success)
        return { status: 'malformed_detail', entryId: entry.id, family: 'present_candidates' };
      const details = parsed.data;
      projected.push({
        id: entry.id,
        cursor,
        kind: 'present_candidates',
        exchangeId: details.exchange_id,
        heading: details.display.heading,
        ...(details.display.body ? { body: details.display.body } : {}),
        candidates: details.candidates,
        ...(details.continuation
          ? {
              continuation: {
                tool: 'ask' as const,
                request: 'request_choice' as const,
                exchangeId: details.exchange_id,
                question: details.continuation.params.body,
                ...(details.continuation.params.options
                  ? { options: details.continuation.params.options }
                  : {}),
              },
            }
          : {}),
      });
      continue;
    }
    if (message.toolName !== 'ask') continue;
    const parsed = zAskDetails.safeParse(message.details);
    if (!parsed.success) {
      if (isAskValidationFailureDetails(message.details)) continue;
      const reviewSet = zRequestReviewSetDetails.safeParse(message.details);
      if (reviewSet.success) {
        const details = reviewSet.data;
        const terminal: AskTerminal =
          'answered' in details
            ? {
                status: 'answered',
                value: {
                  decision: details.answered.decision,
                  ...(details.answered.comment ? { comment: details.answered.comment } : {}),
                  ...(details.answered.decision === 'approve' ? { receipt: details.answered.receipt } : {}),
                },
              }
            : 'cancelled' in details
              ? { status: 'cancelled', value: details.cancelled }
              : { status: 'unavailable', value: details.unavailable };
        projected.push({
          id: entry.id,
          cursor,
          kind: 'ask',
          exchangeId: details.exchange_id,
          question: 'Review decision',
          terminal,
        });
        continue;
      }
      const digestReview = zRequestDigestReviewDetails.safeParse(message.details);
      if (digestReview.success) {
        const details = digestReview.data;
        const terminal: AskTerminal =
          'answered' in details
            ? {
                status: 'answered',
                value: {
                  decision: details.answered.decision,
                  ...('comment' in details.answered && details.answered.comment
                    ? { comment: details.answered.comment }
                    : {}),
                  ...('accepted_abstract' in details.answered
                    ? { acceptedAbstract: details.answered.accepted_abstract }
                    : {}),
                },
              }
            : 'cancelled' in details
              ? { status: 'cancelled', value: details.cancelled }
              : { status: 'unavailable', value: details.unavailable };
        projected.push({
          id: entry.id,
          cursor,
          kind: 'ask',
          exchangeId: details.exchange_id,
          question: 'Digest review',
          terminal,
        });
        continue;
      }
      const choice = zRequestChoiceDetails.safeParse(message.details);
      if (!choice.success || choice.data.tool_meta.prev !== 'present_candidates')
        return { status: 'malformed_detail', entryId: entry.id, family: 'ask' };
      const details = choice.data;
      const terminal: AskTerminal =
        'answered' in details
          ? { status: 'answered', value: details.answered }
          : 'cancelled' in details
            ? { status: 'cancelled', value: details.cancelled }
            : { status: 'unavailable', value: details.unavailable };
      projected.push({
        id: entry.id,
        cursor,
        kind: 'ask',
        exchangeId: details.exchange_id,
        question: 'Candidate choice',
        ...('answered' in details
          ? {
              options: details.answered.options.map((option) => ({
                id: option.id,
                label: option.content,
                ...(option.rationale ? { description: option.rationale } : {}),
              })),
            }
          : {}),
        terminal,
      });
      continue;
    }
    const details = parsed.data;
    const terminal = projectAskTerminal(details);
    projected.push({
      id: entry.id,
      cursor,
      kind: 'ask',
      exchangeId: details.exchange_id,
      question: details.question.body,
      ...('multiple' in details.question && details.question.multiple === true
        ? { mode: 'multi-select' as const }
        : {}),
      ...('options' in details.question && details.question.options
        ? { options: details.question.options }
        : {}),
      ...(terminal ? { terminal } : {}),
    });
  }
  return {
    status: 'ready',
    presentation: {
      target,
      cursor: projected.at(-1)?.cursor ?? null,
      entries: projected,
    },
  };
}

function messageText(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  const text = content
    .filter(
      (block): block is { type: 'text'; text: string } =>
        isRecord(block) && block.type === 'text' && typeof block.text === 'string',
    )
    .map((block) => block.text)
    .join('');
  return text.length > 0 ? text : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAskValidationFailureDetails(value: unknown): boolean {
  if (!isRecord(value) || Array.isArray(value)) return false;
  if (Object.keys(value).some((key) => !['status', 'tool', 'diagnostics'].includes(key))) return false;
  if (value.status !== 'validation_failed' || value.tool !== 'ask' || !Array.isArray(value.diagnostics))
    return false;
  return value.diagnostics.every(
    (diagnostic) =>
      isRecord(diagnostic) &&
      !Array.isArray(diagnostic) &&
      Object.keys(diagnostic).every((key) => key === 'field' || key === 'message') &&
      typeof diagnostic.field === 'string' &&
      typeof diagnostic.message === 'string',
  );
}
