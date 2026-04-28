import { useNavigate } from '@tanstack/react-router';

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

export function RelationChipPreview({ target }: { target: RelationChipTarget }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[11px] font-medium text-hint">{target.referenceCode}</span>
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
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          type="button"
          data-testid="relation-chip"
          onClick={() => {
            void navigate({ to: '.', hash: target.referenceCode });
          }}
          className="inline-flex items-center gap-1.5 rounded bg-wash px-1.5 py-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
        >
          <span className="font-mono text-[10px] font-medium text-hint">{target.referenceCode}</span>
          <span className="max-w-xs truncate text-ink">{target.content}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <RelationChipPreview target={target} />
      </HoverCardContent>
    </HoverCard>
  );
}
