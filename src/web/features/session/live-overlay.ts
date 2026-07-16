import type { SessionPresentationEntry } from '../../../projections/session/session-presentation.js';
import type { LiveSessionEvent } from '../../../session/live-session-host.js';

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
    };
    const existing = entries.findIndex((entry) => entry.id === id);
    return existing < 0
      ? [...entries, next]
      : entries.map((entry, index) => (index === existing ? next : entry));
  }
  return entries;
}
