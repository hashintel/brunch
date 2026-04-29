import { useNavigate } from '@tanstack/react-router';
import { createContext, useContext } from 'react';

import { kindColor } from '@/client/components/knowledge-card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/client/components/ui/hover-card';
import type { KnowledgeKind } from '@/shared/knowledge.js';

export interface RelationChipTarget {
  kind: KnowledgeKind;
  id: number;
  referenceCode: string;
  content: string;
  rationale: string | null;
  outgoingCount: number;
  incomingCount: number;
}

type ChipActivateHandler = (target: RelationChipTarget) => void;
const ChipActivateContext = createContext<ChipActivateHandler | null>(null);
export const ChipActivateProvider = ChipActivateContext.Provider;

export function RelationChipPreview({ target }: { target: RelationChipTarget }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px] font-medium ${kindColor[target.kind]}`}
        >
          {target.referenceCode}
        </span>
        <p className="text-sm leading-snug text-ink">{target.content}</p>
      </div>
      {target.rationale && <p className="text-xs leading-relaxed text-sub">{target.rationale}</p>}
      <p className="text-xxs text-hint">
        <span>{target.outgoingCount} outgoing</span>
        <span className="px-1">·</span>
        <span>{target.incomingCount} incoming</span>
      </p>
    </div>
  );
}

export function RelationChip({ target }: { target: RelationChipTarget }) {
  const navigate = useNavigate();
  const onActivate = useContext(ChipActivateContext);
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          type="button"
          data-testid="relation-chip"
          onClick={() => {
            if (onActivate) {
              onActivate(target);
            } else {
              void navigate({ to: '.', hash: target.referenceCode });
            }
          }}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded bg-wash px-1.5 py-0.5 text-xs outline-none hover:bg-rule focus-visible:ring-2 focus-visible:ring-foreground/30"
        >
          <span
            className={`inline-flex items-center rounded px-1 py-0.5 font-mono text-[10px] font-medium ${kindColor[target.kind]}`}
          >
            {target.referenceCode}
          </span>
          <span className="max-w-xs truncate text-ink">{target.content}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <RelationChipPreview target={target} />
      </HoverCardContent>
    </HoverCard>
  );
}
