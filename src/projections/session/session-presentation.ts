import { zAskDetails } from '../../exchanges/schemas/request.js';
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
      readonly answer?: string;
    };

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
    projected.push({
      id: entry.id,
      cursor,
      kind: 'ask',
      exchangeId: details.exchange_id,
      question: details.question.body,
      ...('answered' in details && 'text' in details.answered ? { answer: details.answered.text } : {}),
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
