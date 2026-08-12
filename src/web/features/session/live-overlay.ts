import type { SessionPresentationEntry } from '../../../projections/session/session-presentation.js';
import type { LiveSessionEvent } from '../../../session/live-session-host.js';

export function settleConfirmedAnswer(
  entries: readonly SessionPresentationEntry[],
  exchangeId: string,
  answer: string,
): readonly SessionPresentationEntry[] {
  return entries.map((entry) => {
    if (entry.kind !== 'ask' || entry.exchangeId !== exchangeId) return entry;
    const selected = answer.split(',').flatMap((id) => {
      const option = entry.options?.find((candidate) => candidate.id === id);
      return option ? [{ kind: 'listed' as const, id: option.id, label: option.label }] : [];
    });
    const value = !entry.options
      ? { text: answer }
      : entry.mode === 'multi-select'
        ? {
            choices: selected,
            options: entry.options.map((option) => ({
              id: option.id,
              content: option.label,
              ...(option.description ? { rationale: option.description } : {}),
            })),
          }
        : {
            choice: selected[0]!,
            options: entry.options.map((option) => ({
              id: option.id,
              content: option.label,
              ...(option.description ? { rationale: option.description } : {}),
            })),
          };
    return { ...entry, terminal: { status: 'answered' as const, value } };
  });
}

export function mergeSessionPresentation(
  canonical: readonly SessionPresentationEntry[],
  overlay: readonly SessionPresentationEntry[],
  closed: ReadonlySet<string> = new Set(),
): readonly SessionPresentationEntry[] {
  const canonicalAsks = new Map(
    canonical.flatMap((entry) => (entry.kind === 'ask' ? [[entry.exchangeId, entry] as const] : [])),
  );
  const localTerminals = new Set(
    overlay.flatMap((entry) => (entry.kind === 'ask' && entry.terminal ? [entry.exchangeId] : [])),
  );
  return [
    ...canonical.filter(
      (entry) =>
        entry.kind !== 'ask' ||
        entry.terminal ||
        (!closed.has(entry.exchangeId) && !localTerminals.has(entry.exchangeId)),
    ),
    ...overlay.filter((entry) => {
      if (entry.kind !== 'ask') return true;
      const durable = canonicalAsks.get(entry.exchangeId);
      return !closed.has(entry.exchangeId) && (!durable || (!durable.terminal && entry.terminal));
    }),
  ];
}

export function reduceLiveSessionOverlay(
  entries: readonly SessionPresentationEntry[],
  event: LiveSessionEvent,
): readonly SessionPresentationEntry[] {
  const delta = event.delta;
  if (delta.type === 'assistant_text_delta') {
    const id = `live:${delta.runId}`;
    const existing = entries.findIndex((entry) => entry.id === id);
    const message = existing < 0 ? undefined : entries[existing];
    const next: SessionPresentationEntry = {
      id,
      cursor: id,
      kind: 'message',
      role: 'assistant',
      text: `${message?.kind === 'message' ? message.text : ''}${delta.text}`,
    };
    return existing < 0
      ? [...entries, next]
      : entries.map((entry, index) => (index === existing ? next : entry));
  }
  if (delta.type === 'ask_opened') {
    const id = `live:ask:${delta.ask.exchangeId}`;
    const next: SessionPresentationEntry = {
      id,
      cursor: id,
      kind: 'ask',
      exchangeId: delta.ask.exchangeId,
      question: delta.ask.question.body,
      ...(delta.ask.mode === 'multi-select' ? { mode: 'multi-select' as const } : {}),
      ...((delta.ask.mode === 'single-select' || delta.ask.mode === 'multi-select') &&
      delta.ask.question.options
        ? { options: delta.ask.question.options }
        : {}),
      ...(delta.ask.mode === 'questionnaire' ? { questions: delta.ask.question.questions } : {}),
    };
    const existing = entries.findIndex((entry) => entry.id === id);
    return existing < 0
      ? [...entries, next]
      : entries.map((entry, index) => (index === existing ? next : entry));
  }
  return entries;
}
