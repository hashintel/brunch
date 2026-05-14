import { ChevronRight, HelpCircle, PencilLine, RefreshCw, Sparkles } from 'lucide-react';
import { useState, type ComponentType, type SVGProps } from 'react';

import { cn } from '@/client/lib/utils';

type NonInterviewThreadKind = 'side' | 'reconciliation' | 'qa' | 'agent_run';

// Mode-aligned labels (Ask/Edit/Reconcile per UNIFIED_CHAT_UX.md §2).
// `agent_run` has no user mode and falls back to a short substrate label.
const THREAD_KIND_LABEL: Record<NonInterviewThreadKind, string> = {
  side: 'Edit',
  reconciliation: 'Reconcile',
  qa: 'Ask',
  agent_run: 'Agent',
};

// Per-kind accent hex (parallel to `kindAccentHex` in knowledge-card.tsx).
// Used as a subtle chip tint + matching text color; the surrounding card
// stays neutral chrome per UNIFIED_CHAT_UX.md §7 decision 3.
const THREAD_KIND_ACCENT_HEX: Record<NonInterviewThreadKind, string> = {
  side: '#2563eb',
  reconciliation: '#d97706',
  qa: '#16a34a',
  agent_run: '#9333ea',
};

const THREAD_KIND_ICON: Record<
  NonInterviewThreadKind,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  side: PencilLine,
  reconciliation: RefreshCw,
  qa: HelpCircle,
  agent_run: Sparkles,
};

function isKnownThreadKind(kind: string): kind is NonInterviewThreadKind {
  return kind === 'side' || kind === 'reconciliation' || kind === 'qa' || kind === 'agent_run';
}

export interface ThreadCollapsibleProps {
  readonly kind: string;
  readonly turnCount: number;
  readonly status: string;
  readonly threadId: number;
}

export function ThreadCollapsible({ kind, turnCount, status, threadId }: ThreadCollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const known = isKnownThreadKind(kind);
  const label = known ? THREAD_KIND_LABEL[kind] : kind;
  const accent = known ? THREAD_KIND_ACCENT_HEX[kind] : '#5b5b5b';
  const KindIcon = known ? THREAD_KIND_ICON[kind] : null;

  return (
    <div
      data-testid={`thread-collapsible-${threadId}`}
      className="my-1 rounded-lg border border-rule bg-white shadow-[0_4px_4px_-2px_rgba(0,0,0,0.02),0_2px_2px_-1px_rgba(0,0,0,0.02),0_0_0_1px_rgba(0,0,0,0.08)]"
    >
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn('size-4 shrink-0 text-hint transition-transform', isExpanded && 'rotate-90')}
        />
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-medium leading-none"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          {KindIcon ? <KindIcon aria-hidden="true" className="size-3" /> : null}
          <span>{label}</span>
        </span>
        <span className="text-sub">
          {turnCount} {turnCount === 1 ? 'turn' : 'turns'}
        </span>
        {status === 'closed' && <span className="ml-auto text-[11px] text-hint">closed</span>}
      </button>
      {isExpanded ? (
        <div className="border-t border-rule px-3 py-3 text-sm text-sub">
          Thread content will render here.
        </div>
      ) : null}
    </div>
  );
}
