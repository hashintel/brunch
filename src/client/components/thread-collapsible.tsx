import { ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/client/lib/utils';

const THREAD_KIND_LABELS: Record<string, string> = {
  side: 'Side thread',
  reconciliation: 'Reconciliation',
  qa: 'QA',
  agent_run: 'Agent run',
};

const THREAD_KIND_COLORS: Record<string, string> = {
  side: 'bg-blue-500/10 text-blue-600',
  reconciliation: 'bg-amber-500/10 text-amber-600',
  qa: 'bg-emerald-500/10 text-emerald-600',
  agent_run: 'bg-purple-500/10 text-purple-600',
};

export interface ThreadCollapsibleProps {
  readonly kind: string;
  readonly turnCount: number;
  readonly status: string;
  readonly threadId: number;
}

export function ThreadCollapsible({ kind, turnCount, status, threadId }: ThreadCollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const label = THREAD_KIND_LABELS[kind] ?? kind;
  const colorClass = THREAD_KIND_COLORS[kind] ?? 'bg-muted text-sub';

  return (
    <div
      data-testid={`thread-collapsible-${threadId}`}
      className="my-1 rounded-lg border border-rule bg-tint"
    >
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
      >
        <ChevronRight
          className={cn('size-4 shrink-0 text-hint transition-transform', isExpanded && 'rotate-90')}
        />
        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[11px] leading-none font-medium uppercase',
            colorClass,
          )}
        >
          {label}
        </span>
        <span className="text-sub">
          {turnCount} {turnCount === 1 ? 'turn' : 'turns'}
        </span>
        {status === 'closed' && <span className="ml-auto text-[11px] text-hint uppercase">closed</span>}
      </button>
      {isExpanded && (
        <div className="border-t border-rule px-3 py-3 text-sm text-sub">
          Thread content will render here.
        </div>
      )}
    </div>
  );
}
