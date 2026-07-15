import { zAskDetails } from '../../exchanges/schemas/request.js';
import type {
  AnsweredOptionEcho,
  AskDetails,
  AskQuestionEcho,
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
          };
    }
  | { readonly status: 'cancelled'; readonly value: { readonly message?: string | undefined } }
  | { readonly status: 'unavailable'; readonly value: { readonly message: string } };

function projectAskTerminal(details: AskDetails): AskTerminal | undefined {
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
  | { readonly status: 'malformed_detail'; readonly entryId: string; readonly family: 'ask' };

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
    if (message.role !== 'toolResult' || message.toolName !== 'ask') continue;
    const parsed = zAskDetails.safeParse(message.details);
    if (!parsed.success) return { status: 'malformed_detail', entryId: entry.id, family: 'ask' };
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
