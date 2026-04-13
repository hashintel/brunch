import { ChevronDown, Link as LinkIcon } from 'lucide-react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible';
import { cn } from '@/client/lib/utils';
import type { EdgeRelation, ReviewStatus } from '@/shared/api-types.js';
import type { KnowledgeKind } from '@/shared/knowledge.js';
import { knowledgeKindRegistry } from '@/shared/knowledge.js';

// ── ID prefix for each kind ───────────────────────────────────────────

const kindPrefix: Record<KnowledgeKind, string> = {
  goal: 'G',
  term: 'T',
  context: 'Cx',
  constraint: 'Co',
  assumption: 'A',
  decision: 'D',
  requirement: 'R',
  criterion: 'Cr',
};

export function itemLabel(kind: KnowledgeKind, id: number) {
  return `${kindPrefix[kind]}${id}`;
}

// ── Badges ────────────────────────────────────────────────────────────

const kindColor: Record<KnowledgeKind, string> = {
  goal: 'bg-[rgba(37,99,235,0.08)] text-[#2563eb]',
  term: 'bg-wash text-sub',
  context: 'bg-[rgba(234,88,12,0.08)] text-[#ea580c]',
  constraint: 'bg-[rgba(225,70,64,0.08)] text-[#e14640]',
  assumption: 'bg-[rgba(234,88,12,0.08)] text-[#ea580c]',
  decision: 'bg-[rgba(37,99,235,0.08)] text-[#2563eb]',
  requirement: 'bg-[rgba(22,163,106,0.08)] text-[#16a34a]',
  criterion: 'bg-wash text-sub',
};

export function KindBadge({ kind }: { kind: KnowledgeKind }) {
  return (
    <span
      className={cn(
        'inline-flex h-4 items-center rounded px-1 font-mono text-[9px] leading-none font-medium',
        kindColor[kind],
      )}
    >
      {kindPrefix[kind]}
    </span>
  );
}

export function ReviewBadge({ state }: { state: ReviewStatus }) {
  return (
    <span
      className={cn(
        'inline-flex h-4 items-center rounded px-1 font-mono text-[9px] leading-none font-medium',
        state === 'approved' && 'bg-[rgba(22,163,106,0.08)] text-[#16a34a]',
        state === 'rejected' && 'bg-[rgba(225,70,64,0.08)] text-[#e14640]',
        state === 'pending' && 'bg-wash text-hint',
      )}
    >
      {state === 'approved' ? 'Approved' : state === 'rejected' ? 'Rejected' : 'Pending'}
    </span>
  );
}

export function CountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex h-5 items-center rounded-md bg-wash px-1.5 font-mono text-xxs font-medium text-sub">
      {count}
    </span>
  );
}

// ── Knowledge item row — compact inline representation ────────────────

export interface KnowledgeItemData {
  id: number;
  kind: KnowledgeKind;
  content: string;
  rationale?: string;
  subtype?: string;
  reviewStatus?: ReviewStatus;
}

export interface KnowledgeEdgeData {
  type: EdgeRelation;
  label: string;
  sourceId: number;
  sourceCollection: string;
  relatedId: number;
  relatedCollection: string;
  relatedLabel?: string;
}

function getKnowledgeEdgeKey(edge: KnowledgeEdgeData): string {
  return [edge.type, edge.sourceCollection, edge.sourceId, edge.relatedCollection, edge.relatedId].join(':');
}

export function KnowledgeRow({
  item,
  indent = false,
  className,
}: {
  item: KnowledgeItemData;
  indent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn('flex items-center gap-3 border-b border-rule px-4 py-3', indent && 'bg-tint', className)}
    >
      {indent && <LinkIcon className="size-3.5 shrink-0 text-hint" />}
      <div className="flex flex-1 items-center gap-2">
        <span className="text-sm font-medium text-hint">{itemLabel(item.kind, item.id)}</span>
        <span className="text-sm text-ink">{item.content}</span>
      </div>
      {item.reviewStatus && <ReviewBadge state={item.reviewStatus} />}
    </div>
  );
}

// ── Knowledge group card — groups items by kind in card-within-card ────

export function KnowledgeGroupCard({
  kind,
  items,
  edges,
}: {
  kind: KnowledgeKind;
  items: KnowledgeItemData[];
  edges?: KnowledgeEdgeData[];
}) {
  const meta = knowledgeKindRegistry.find((e) => e.kind === kind);
  if (!meta) return null;

  const confirmed = items.filter((i) => i.reviewStatus === 'approved').length;
  const total = items.length;

  if (total === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-tint">
      {/* White header card — border overlaps parent via negative margin */}
      <div className="-m-px overflow-hidden rounded-xl border border-rule bg-white shadow-[var(--shadow-card)]">
        {/* Header row: kind label + count + stats */}
        <div className="flex items-center gap-8 border-b border-rule p-4">
          <div className="flex flex-1 items-center gap-2">
            <KindBadge kind={kind} />
            <span className="text-base font-medium text-ink">{meta.label}</span>
            <CountBadge count={total} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-hint">
              <span className="text-sub">
                {confirmed} / {total}
              </span>{' '}
              confirmed
            </span>
            <div className="flex h-1 w-40 items-center rounded-full bg-[rgba(32,112,230,0.06)]">
              <div
                className="h-1 rounded-full bg-[#2070e6]"
                style={{
                  width: `${total > 0 ? (confirmed / total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Collapsible item list */}
        <Collapsible defaultOpen>
          <div className="flex items-center border-b border-rule px-4 py-3">
            <CollapsibleTrigger className="flex flex-1 items-center gap-3 text-sm text-sub">
              {total} {total === 1 ? 'item' : 'items'}
              <ChevronDown className="size-4" />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            {items.map((item) => (
              <KnowledgeRow key={item.id} item={item} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Edges section (in tinted body below white card) */}
      {edges && edges.length > 0 && (
        <Collapsible defaultOpen>
          <div className="px-4 pt-3 pb-3">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-sub">
              Connections
              <ChevronDown className="size-4" />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="flex flex-col gap-1.5 px-4 pb-4">
              {edges.map((edge) => {
                const relatedText = edge.relatedLabel ?? `item #${edge.relatedId}`;
                return (
                  <div
                    key={getKnowledgeEdgeKey(edge)}
                    className="rounded-lg bg-white p-3 text-sm shadow-[var(--shadow-card-ring)]"
                  >
                    <span className="font-medium text-hint">{edge.label}</span>
                    <span className="text-ink"> {relatedText}</span>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ── Knowledge detail card — expanded view with rationale + edges ──────

export function KnowledgeDetailCard({
  item,
  edges,
}: {
  item: KnowledgeItemData;
  edges?: KnowledgeEdgeData[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-tint">
      {/* White header */}
      <div className="rounded-xl bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-medium text-hint">{itemLabel(item.kind, item.id)}</span>
              <KindBadge kind={item.kind} />
            </div>
            <p className="text-base text-ink">{item.content}</p>
          </div>
          {item.reviewStatus && <ReviewBadge state={item.reviewStatus} />}
        </div>
      </div>

      {/* Body sections */}
      <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
        {item.rationale && (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-sub">Rationale</p>
            <div className="rounded-lg bg-white p-3 shadow-[var(--shadow-card-ring)]">
              <p className="text-sm leading-relaxed text-ink">{item.rationale}</p>
            </div>
          </div>
        )}

        {item.subtype && (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-sub">Subtype</p>
            <div className="rounded-lg bg-white p-3 shadow-[var(--shadow-card-ring)]">
              <p className="text-sm text-ink">{item.subtype}</p>
            </div>
          </div>
        )}

        {edges && edges.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-sub">Connections</p>
            {edges.map((edge) => {
              const relatedText = edge.relatedLabel ?? `item #${edge.relatedId}`;
              return (
                <div
                  key={getKnowledgeEdgeKey(edge)}
                  className="rounded-lg bg-white p-3 shadow-[var(--shadow-card-ring)]"
                >
                  <span className="text-sm font-medium text-hint">{edge.label}</span>
                  <span className="text-sm text-ink"> {relatedText}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Metadata row ──────────────────────────────────────────────────────

export function MetadataRow({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="flex gap-6">
      {items.map((item) => (
        <div key={item.label}>
          <span className="text-xxs text-hint">{item.label}</span>
          <p className="text-sm font-medium text-ink">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
