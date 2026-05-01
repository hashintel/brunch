import { Eye, EyeOff } from 'lucide-react';

import { kindColor, kindTextColor } from '@/client/components/knowledge-card';
import type { knowledgeKindRegistry, KnowledgeKind } from '@/shared/knowledge.js';

type KindEntry = (typeof knowledgeKindRegistry)[number];

export interface KindToggleChipProps {
  entry: KindEntry;
  count: number;
  isHidden: boolean;
  onNavigate: (kind: KnowledgeKind) => void;
  onToggle: (kind: KnowledgeKind) => void;
}

export function KindToggleChip({ entry, count, isHidden, onNavigate, onToggle }: KindToggleChipProps) {
  const swatchClass = isHidden ? kindTextColor[entry.kind] : kindColor[entry.kind];
  const shellClass = `inline-flex h-7 items-stretch overflow-hidden rounded-full border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${
    isHidden ? 'border-rule border-dashed' : 'border-rule'
  }`;
  const bodyClass = `flex items-center gap-1.5 px-2.5 cursor-pointer hover:bg-wash outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 ${
    isHidden ? 'text-hint' : 'text-ink'
  }`;
  const toggleClass = `flex w-7 items-center justify-center cursor-pointer border-l border-rule hover:bg-wash outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 ${
    isHidden ? 'text-hint' : 'text-sub'
  }`;

  return (
    <span data-graph-kind-chip={entry.kind} className={shellClass}>
      <button
        type="button"
        data-graph-kind-body={entry.kind}
        onClick={() => onNavigate(entry.kind)}
        aria-label={isHidden ? `Show ${entry.label} and scroll to it` : `Scroll to ${entry.label}`}
        className={bodyClass}
      >
        <span
          className={`inline-flex items-center rounded px-1 py-0.5 font-mono text-[10px] font-medium ${swatchClass}`}
        >
          {entry.label}
        </span>
        <span className="font-mono text-[10px] opacity-70">{count}</span>
      </button>
      <button
        type="button"
        data-graph-kind-toggle={entry.kind}
        aria-pressed={!isHidden}
        aria-label={isHidden ? `Show ${entry.label}` : `Hide ${entry.label}`}
        onClick={() => onToggle(entry.kind)}
        className={toggleClass}
      >
        {isHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </span>
  );
}
