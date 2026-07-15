import { zPresentCandidatesDetails } from '../../exchanges/schemas/present.js';
import type { PresentCandidatesDetails } from '../../exchanges/schemas/present.js';
import { zAskDetails, zRequestChoiceDetails } from '../../exchanges/schemas/request.js';
import type {
  AnsweredOptionEcho,
  AskDetails,
  AskQuestionEcho,
  AskQuestionnaireDetails,
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
      readonly kind: 'ask';
      readonly exchangeId: string;
      readonly question: string;
      readonly mode?: 'multi-select';
      readonly options?: NonNullable<AskQuestionEcho['options']>;
      readonly terminal?: AskTerminal;
    };

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
            readonly acceptedAbstract: string;
          };
    }
  | { readonly status: 'cancelled'; readonly value: { readonly message?: string | undefined } }
  | { readonly status: 'unavailable'; readonly value: { readonly message: string } };

function projectAskTerminal(details: AskDetails): AskTerminal | undefined {
  if ('questionnaire' in details)
    return {
      status: 'answered',
      value: {
        questionnaire: details.questionnaire,
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
      readonly family: 'ask' | 'present_candidates';
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
