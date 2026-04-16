/**
 * Pattern: Review set — synthesized requirement list with per-item
 * expand/comment/reject, stats bar, batch review submission, user-created
 * items, and phase completion.
 */
import { Check, ChevronDown, ChevronRight, MessageSquare, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/client/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';
import { Textarea } from '@/client/components/ui/textarea';
import { cn } from '@/client/lib/utils';

// ── Data types ───────────────────────────────────────────────────────

interface GroundingRef {
  code: string;
}

interface ReviewItem {
  id: string;
  content: string;
  rationale: string;
  grounding: GroundingRef[];
  isUserCreated?: boolean;
  isRevised?: boolean;
}

interface ReviewItemState {
  comment: string;
  rejected: boolean;
}

// ── Fixture data ─────────────────────────────────────────────────────

const initialItems: ReviewItem[] = [
  {
    id: 'REQ-1',
    content: 'Live cursor presence indicators for all active collaborators',
    rationale:
      'Multiple stakeholders emphasized real-time awareness as critical for concurrent editing workflows.',
    grounding: [{ code: 'GOL-1' }, { code: 'GOL-2' }, { code: 'CTX-3' }, { code: 'DEC-1' }],
  },
  {
    id: 'REQ-2',
    content: 'Real-time synchronization of document edits across all connected clients',
    rationale:
      'Core product commitment to collaborative editing requires sub-second sync with conflict-free merge semantics.',
    grounding: [
      { code: 'GOL-1' },
      { code: 'GOL-3' },
      { code: 'CTX-1' },
      { code: 'CST-2' },
      { code: 'DEC-3' },
      { code: 'ASM-1' },
      { code: 'ASM-2' },
    ],
  },
  {
    id: 'REQ-3',
    content: 'Version history with rollback functionality',
    rationale:
      'Multiple knowledge items point to the need for audit trails and undo capability at the document level.',
    grounding: [{ code: 'GOL-2' }, { code: 'DEC-4' }, { code: 'CST-1' }],
  },
  {
    id: 'REQ-4',
    content: 'Offline editing mode with automatic conflict resolution on reconnect',
    rationale: 'Enterprise users in the field need to continue working without network connectivity.',
    grounding: [{ code: 'CTX-4' }, { code: 'CST-3' }],
  },
  {
    id: 'REQ-5',
    content: 'Granular permissions control at document, section, and field levels',
    rationale:
      'Multi-tenant architecture requires fine-grained access boundaries to prevent data leakage across teams.',
    grounding: [
      { code: 'GOL-4' },
      { code: 'CST-1' },
      { code: 'CST-4' },
      { code: 'DEC-2' },
      { code: 'ASM-3' },
    ],
  },
  {
    id: 'REQ-6',
    content: 'Document export in PDF, Markdown, and DOCX formats',
    rationale: 'Interoperability with external stakeholder toolchains was cited across multiple interviews.',
    grounding: [{ code: 'CTX-2' }, { code: 'DEC-5' }, { code: 'ASM-4' }],
  },
  {
    id: 'REQ-7',
    content: 'Collaborative annotation and commenting on document sections',
    rationale: 'Review workflows need inline discussion threads anchored to specific content ranges.',
    grounding: [
      { code: 'GOL-1' },
      { code: 'GOL-5' },
      { code: 'CTX-5' },
      { code: 'DEC-6' },
      { code: 'DEC-7' },
      { code: 'ASM-5' },
    ],
    isUserCreated: true,
  },
  {
    id: 'REQ-8',
    content: 'Notification system for document changes with configurable granularity',
    rationale:
      'Users need awareness of changes without information overload; digest frequency should be tunable.',
    grounding: [{ code: 'GOL-3' }, { code: 'CTX-6' }, { code: 'DEC-8' }, { code: 'ASM-6' }],
    isRevised: true,
  },
];

function createInitialState(items: ReviewItem[]): Record<string, ReviewItemState> {
  const state: Record<string, ReviewItemState> = {};
  for (const item of items) {
    state[item.id] = { comment: '', rejected: false };
  }
  // Pre-populate fixtures for demo
  state['REQ-3'] = {
    comment: 'This should be scoped to document-level rollback only, not field-level.',
    rejected: false,
  };
  state['REQ-4'] = { comment: '', rejected: true };
  return state;
}

// ── Stats Bar ────────────────────────────────────────────────────────

function StatsBar({
  total,
  grounding,
  commented,
  rejected,
}: {
  total: number;
  grounding: number;
  commented: number;
  rejected: number;
}) {
  return (
    <div className="flex items-center gap-6">
      <div className="flex flex-col">
        <span className="text-lg font-medium text-ink">{total}</span>
        <span className="text-xs text-hint">Requirements</span>
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-medium text-ink">{grounding}</span>
        <span className="text-xs text-hint">Grounding</span>
      </div>
      <div className="flex flex-col">
        <span className={cn('text-lg font-medium', commented > 0 ? 'text-[#d97706]' : 'text-ink')}>
          {commented}
        </span>
        <span className="text-xs text-hint">Commented</span>
      </div>
      <div className="flex flex-col">
        <span className={cn('text-lg font-medium', rejected > 0 ? 'text-[#e14640]' : 'text-ink')}>
          {rejected}
        </span>
        <span className="text-xs text-hint">Rejected</span>
      </div>
    </div>
  );
}

// ── Review Item Row ──────────────────────────────────────────────────

function ReviewItemRow({
  item,
  state,
  onCommentChange,
  onReject,
  onUnreject,
}: {
  item: ReviewItem;
  state: ReviewItemState;
  onCommentChange: (comment: string) => void;
  onReject: () => void;
  onUnreject: () => void;
}) {
  const hasComment = state.comment.trim().length > 0;

  return (
    <Collapsible>
      {/* Collapsed row */}
      <div
        className={cn(
          'flex items-center gap-3 border-b border-rule px-4 py-3',
          state.rejected && 'bg-[rgba(225,70,64,0.03)] opacity-60',
          item.isRevised && 'bg-[rgba(37,99,235,0.03)]',
        )}
      >
        {/* Reference code */}
        <span className="w-12 shrink-0 font-mono text-xs font-medium text-hint">{item.id}</span>

        {/* Content */}
        <span className="flex-1 truncate text-sm text-ink">{item.content}</span>

        {/* Badges */}
        {item.isUserCreated && (
          <span className="inline-flex h-5 items-center rounded-md bg-[rgba(37,99,235,0.08)] px-1.5 text-[11px] font-medium text-[#2070e6]">
            Added by you
          </span>
        )}
        {item.isRevised && (
          <span className="inline-flex h-5 items-center rounded-md bg-[rgba(37,99,235,0.08)] px-1.5 text-[11px] font-medium text-[#2070e6]">
            Revised
          </span>
        )}

        {/* Grounding indicator */}
        <span className="flex items-center gap-0.5 text-xs text-hint">
          <span className="text-[#2070e6]">●</span>
          {item.grounding.length}
        </span>

        {/* Status badges */}
        {hasComment && <MessageSquare className="size-3.5 text-[#d97706]" />}
        {state.rejected && <X className="size-3.5 text-[#e14640]" />}

        {/* Expand chevron */}
        <CollapsibleTrigger asChild>
          <button type="button" className="flex size-6 items-center justify-center rounded-md hover:bg-wash">
            <ChevronDown className="size-4 text-hint" />
          </button>
        </CollapsibleTrigger>
      </div>

      {/* Expanded content */}
      <CollapsibleContent>
        <div className="flex flex-col gap-3 border-b border-rule bg-tint px-4 py-4">
          {/* Full content */}
          <p className="text-sm text-ink">{item.content}</p>

          {/* Rationale */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-sub">Rationale</span>
            <p className="text-sm leading-relaxed text-sub italic">{item.rationale}</p>
          </div>

          {/* Grounding links */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-sub">Grounded by</span>
            <div className="flex flex-wrap gap-1.5">
              {item.grounding.map((ref) => (
                <span
                  key={ref.code}
                  className="inline-flex h-5 items-center rounded-md bg-wash px-1.5 font-mono text-[11px] font-medium text-sub"
                >
                  {ref.code}
                </span>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-sub">Comment</span>
            <Textarea
              value={state.comment}
              onChange={(e) => onCommentChange(e.target.value)}
              placeholder="Add a revision request or note…"
              className="min-h-16 rounded-xl border-rule bg-white text-sm"
            />
          </div>

          {/* Reject / Un-reject */}
          <div className="flex justify-end">
            {state.rejected ? (
              <Button variant="ghost" size="sm" onClick={onUnreject}>
                Restore
              </Button>
            ) : (
              <Button variant="destructive" size="sm" onClick={onReject}>
                <X data-icon="inline-start" />
                Reject
              </Button>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Add Requirement Inline ───────────────────────────────────────────

function AddRequirementRow({ onAdd }: { onAdd: (content: string, rationale: string) => void }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [rationale, setRationale] = useState('');

  const canAdd = content.trim().length > 0 && rationale.trim().length > 0;

  function handleAdd() {
    if (!canAdd) return;
    onAdd(content.trim(), rationale.trim());
    setContent('');
    setRationale('');
    setOpen(false);
  }

  return (
    <div className="border-b border-rule">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 px-4 py-3 text-sm text-[#2070e6] hover:bg-tint"
        >
          <Plus className="size-3.5" />
          Add requirement
        </button>
      ) : (
        <div className="flex flex-col gap-3 bg-tint px-4 py-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-sub">Requirement</span>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Declarative requirement statement…"
              className="min-h-12 rounded-xl border-rule bg-white text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-sub">Rationale</span>
            <Textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why does this requirement exist?"
              className="min-h-12 rounded-xl border-rule bg-white text-sm"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!canAdd} onClick={handleAdd}>
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Phase Completion Card ────────────────────────────────────────────

function PhaseCompletionCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-wash p-5">
      <div className="flex items-center gap-2">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[rgba(22,163,106,0.1)]">
          <Check className="size-3.5 text-[#16a34a]" />
        </div>
        <p className="text-sm font-medium text-ink">Requirements phase is complete</p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-sub">
        All requirements have been reviewed and finalized. You can proceed to acceptance criteria.
      </p>
      <Button className="mt-3" variant="outline" onClick={() => console.log('Continue')}>
        Continue to acceptance criteria
        <ChevronRight data-icon="inline-end" />
      </Button>
    </div>
  );
}

// ── Interactive Review Set ───────────────────────────────────────────

function InteractiveReviewSet() {
  const [items, setItems] = useState<ReviewItem[]>(initialItems);
  const [itemStates, setItemStates] = useState<Record<string, ReviewItemState>>(
    createInitialState(initialItems),
  );
  const [approved, setApproved] = useState(false);

  // Derived stats
  const totalGrounding = items.reduce((sum, item) => sum + item.grounding.length, 0);
  const commentedCount = items.filter(
    (item) => (itemStates[item.id]?.comment ?? '').trim().length > 0,
  ).length;
  const rejectedCount = items.filter((item) => itemStates[item.id]?.rejected).length;

  // Has any edits? (compared to initial state)
  const hasEdits =
    commentedCount !==
      Object.values(createInitialState(initialItems)).filter((s) => s.comment.trim().length > 0).length ||
    rejectedCount !== Object.values(createInitialState(initialItems)).filter((s) => s.rejected).length ||
    items.length !== initialItems.length;

  function updateItemState(id: string, update: Partial<ReviewItemState>) {
    setItemStates((prev) => ({
      ...prev,
      [id]: { ...prev[id]!, ...update },
    }));
  }

  function handleDiscard() {
    setItems(initialItems);
    setItemStates(createInitialState(initialItems));
  }

  function handleAddItem(content: string, rationale: string) {
    const newId = `REQ-${items.length + 1}`;
    const newItem: ReviewItem = {
      id: newId,
      content,
      rationale,
      grounding: [],
      isUserCreated: true,
    };
    setItems((prev) => [...prev, newItem]);
    setItemStates((prev) => ({
      ...prev,
      [newId]: { comment: '', rejected: false },
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky header */}
      <div className="overflow-hidden rounded-xl border border-rule bg-white p-5">
        <h3 className="text-base font-medium text-ink">Requirements</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-sub">
          Review the synthesized requirements. Comment on items that need revision, reject items to remove, or
          approve the list to proceed.
        </p>
        <div className="mt-4">
          <StatsBar
            total={items.length}
            grounding={totalGrounding}
            commented={commentedCount}
            rejected={rejectedCount}
          />
        </div>
      </div>

      {/* Item list */}
      <div className="overflow-hidden rounded-xl border border-rule bg-white">
        {items.map((item) => (
          <ReviewItemRow
            key={item.id}
            item={item}
            state={itemStates[item.id] ?? { comment: '', rejected: false }}
            onCommentChange={(comment) => updateItemState(item.id, { comment })}
            onReject={() => updateItemState(item.id, { rejected: true })}
            onUnreject={() => updateItemState(item.id, { rejected: false })}
          />
        ))}
        <AddRequirementRow onAdd={handleAddItem} />
      </div>

      {/* Review actions */}
      <div className="flex items-center justify-end gap-2">
        {hasEdits ? (
          <>
            <Button variant="ghost" onClick={handleDiscard}>
              Discard review
            </Button>
            <Button onClick={() => console.log('Submit review', itemStates)}>Submit review</Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => setApproved(true)}>
            <Check data-icon="inline-start" />
            Approve
          </Button>
        )}
      </div>

      {/* Phase completion */}
      {approved && <PhaseCompletionCard />}
    </div>
  );
}

// ── Static Item State Variants ───────────────────────────────────────

function StaticReviewItem({
  item,
  state,
  label,
}: {
  item: ReviewItem;
  state: ReviewItemState;
  label: string;
}) {
  const hasComment = state.comment.trim().length > 0;

  return (
    <div>
      <p className="mb-2 text-xs text-hint">{label}</p>
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border border-rule bg-white px-4 py-3',
          state.rejected && 'bg-[rgba(225,70,64,0.03)] opacity-60',
          item.isRevised && 'bg-[rgba(37,99,235,0.03)]',
        )}
      >
        <span className="w-12 shrink-0 font-mono text-xs font-medium text-hint">{item.id}</span>
        <span className="flex-1 truncate text-sm text-ink">{item.content}</span>

        {item.isUserCreated && (
          <span className="inline-flex h-5 items-center rounded-md bg-[rgba(37,99,235,0.08)] px-1.5 text-[11px] font-medium text-[#2070e6]">
            Added by you
          </span>
        )}
        {item.isRevised && (
          <span className="inline-flex h-5 items-center rounded-md bg-[rgba(37,99,235,0.08)] px-1.5 text-[11px] font-medium text-[#2070e6]">
            Revised
          </span>
        )}

        <span className="flex items-center gap-0.5 text-xs text-hint">
          <span className="text-[#2070e6]">●</span>
          {item.grounding.length}
        </span>

        {hasComment && <MessageSquare className="size-3.5 text-[#d97706]" />}
        {state.rejected && <X className="size-3.5 text-[#e14640]" />}

        <ChevronDown className="size-4 text-hint" />
      </div>
    </div>
  );
}

// ── Main Story Component ─────────────────────────────────────────────

export function ReviewSetPage() {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">
          Pattern — Review Set
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          Synthesized requirement list with per-item expand/comment/reject, collection-level stats, batch
          review submission, user-created items, and phase completion.
        </p>

        <Separator className="my-8" />

        {/* ── Section 1: Interactive Review Set ─────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Interactive Review Set</h2>
          <p className="mt-1 text-sm text-sub">
            Full interactive demo with expandable items, commenting, reject/restore, add requirement, and
            three-state review action buttons.
          </p>

          <div className="mt-6 max-w-3xl">
            <InteractiveReviewSet />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Section 2: Item State Variants ─────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Item State Variants</h2>
          <p className="mt-1 text-sm text-sub">
            Each review item state shown individually: pending, commented, rejected, user-created, and
            revised.
          </p>

          <div className="mt-6 flex max-w-3xl flex-col gap-4">
            <StaticReviewItem
              label="Pending (no action taken)"
              item={initialItems[0]!}
              state={{ comment: '', rejected: false }}
            />
            <StaticReviewItem
              label="Commented"
              item={initialItems[2]!}
              state={{ comment: 'This should be scoped to document-level rollback only.', rejected: false }}
            />
            <StaticReviewItem
              label="Rejected"
              item={initialItems[3]!}
              state={{ comment: '', rejected: true }}
            />
            <StaticReviewItem
              label="User-created"
              item={initialItems[6]!}
              state={{ comment: '', rejected: false }}
            />
            <StaticReviewItem
              label="Revised (re-presented after modification)"
              item={initialItems[7]!}
              state={{ comment: '', rejected: false }}
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Section 3: Phase Completion ────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Phase Completion</h2>
          <p className="mt-1 text-sm text-sub">The completion card shown after the review is approved.</p>

          <div className="mt-6 max-w-3xl">
            <PhaseCompletionCard />
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
