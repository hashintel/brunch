import type { KnowledgeKind } from '@/shared/knowledge.js';

import { kindAccentHex } from './knowledge-card';

export interface ActiveCardProps {
  annotationId: number;
  referenceCode: string;
  itemKind: KnowledgeKind;
  summary: string;
  body: string;
  inContext: boolean;
  onDismiss: (annotationId: number) => void;
}

export function ActiveCard({
  annotationId,
  referenceCode,
  itemKind,
  summary,
  body,
  inContext,
  onDismiss,
}: ActiveCardProps) {
  const accent = kindAccentHex[itemKind];
  return (
    <li
      data-thread-item="card"
      data-annotation-id={annotationId}
      data-in-context={inContext ? 'true' : 'false'}
      className={`flex flex-col gap-1 rounded-md border-l-2 bg-white px-2 py-1.5 text-xs ${
        inContext ? '' : 'opacity-50'
      }`}
      style={{ borderLeftColor: accent }}
    >
      <div className="flex items-start gap-2">
        <span
          className="inline-flex shrink-0 items-center rounded px-1 py-0.5 font-mono text-[10px] font-medium"
          style={{ backgroundColor: `${accent}14`, color: accent }}
        >
          📝 {referenceCode}
        </span>
        <span className="flex-1 text-ink italic">«{summary}»</span>
        <button
          type="button"
          aria-label={`Dismiss note ${referenceCode}`}
          onClick={() => onDismiss(annotationId)}
          className="text-hint hover:text-ink"
        >
          ×
        </button>
      </div>
      {body ? <p className="pl-2 text-sub">{body}</p> : null}
      {!inContext ? <p className="pl-2 text-[10px] text-hint">not in context</p> : null}
    </li>
  );
}
