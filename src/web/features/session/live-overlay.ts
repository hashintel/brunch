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
    if (entry.options && selected.length !== answer.split(',').length) return entry;
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
  const localTerminalEntries = new Map(
    overlay.flatMap((entry) =>
      entry.kind === 'ask' && entry.terminal ? ([[entry.exchangeId, entry]] as const) : [],
    ),
  );
  const mergedCanonical = canonical.flatMap((entry) => {
    if (entry.kind !== 'ask' || entry.terminal) return [entry];
    if (closed.has(entry.exchangeId)) return [];
    return [localTerminalEntries.get(entry.exchangeId) ?? entry];
  });
  const unmatchedCanonical = canonical
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.kind !== 'ask');
  const unmatchedOverlay = overlay.filter((entry) => {
    if (entry.kind === 'ask') {
      const durable = canonicalAsks.get(entry.exchangeId);
      return !closed.has(entry.exchangeId) && !durable;
    }
    const match = unmatchedCanonical.findIndex(({ entry: candidate }) =>
      presentationEntriesMatch(candidate, entry),
    );
    if (match < 0) return true;
    unmatchedCanonical.splice(match, 1);
    return false;
  });
  return [...mergedCanonical, ...unmatchedOverlay];
}

function presentationEntriesMatch(
  canonical: SessionPresentationEntry,
  overlay: SessionPresentationEntry,
): boolean {
  if (canonical.kind !== overlay.kind) return false;
  if (canonical.id === overlay.id || canonical.cursor === overlay.cursor) return true;
  if (canonical.kind === 'message' && overlay.kind === 'message') {
    return canonical.role === overlay.role && canonical.text === overlay.text;
  }
  const omitIdentity = ({ id: _id, cursor: _cursor, ...content }: SessionPresentationEntry) => content;
  return JSON.stringify(omitIdentity(canonical)) === JSON.stringify(omitIdentity(overlay));
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
