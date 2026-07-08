import { Link } from '@tanstack/react-router';
import { type ReactNode, useRef, useState } from 'react';

import type { GraphSlice } from '../../../graph/queries.js';
import { NODE_KIND_METADATA, type NodeKind } from '../../../graph/schema/nodes.js';
import { ChevronIcon, EyeIcon, EyeOffIcon } from '../../components/icons.js';
import { NodeRefChip, nodeRefCode, planeAccent } from '../../components/node-card.js';
import type { RunTraceEntry } from '../../queries/execute.js';
import { buildKindSections, type KindSection } from './kind-display.js';

type GraphNode = GraphSlice['nodes'][number];

// ── Spec knowledge-graph view ─────────────────────────────────────────
//
// Read-only structured list ported from the prior trunk's
// `-structured-list-view.tsx`, stripped of chat / annotation / inline-edit
// affordances (none are wired in the web sidecar). Retains the header +
// filter-bar + grouped-section shell. Accents are plane-based per D72-L.

export function KnowledgeGraphView({
  overview,
  runTraces,
  specTitle,
}: {
  overview: GraphSlice;
  runTraces?: readonly RunTraceEntry[];
  specTitle?: string;
}) {
  const sections = buildKindSections(overview.nodes);
  const [hiddenKinds, setHiddenKinds] = useState<ReadonlySet<NodeKind>>(new Set());
  const sectionRefs = useRef(new Map<NodeKind, HTMLElement | null>());

  const itemCount = overview.nodes.length;
  const connectionCount = overview.edges.length;

  const visibleSections = sections.filter((section) => !hiddenKinds.has(section.kind));
  const view: 'empty' | 'all-hidden' | 'list' =
    sections.length === 0 ? 'empty' : visibleSections.length === 0 ? 'all-hidden' : 'list';

  const toggleKind = (kind: NodeKind) => {
    setHiddenKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const scrollToKind = (kind: NodeKind) => {
    setHiddenKinds((current) => {
      if (!current.has(kind)) return current;
      const next = new Set(current);
      next.delete(kind);
      return next;
    });
    requestAnimationFrame(() => {
      sectionRefs.current.get(kind)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div data-graph-structured-list className="flex h-full flex-col bg-white">
      <div className="border-rule flex h-16 shrink-0 items-center justify-between gap-4 border-b px-6">
        <div aria-label="Knowledge graph summary" data-graph-counts>
          <p className="text-hint text-xxs font-mono">Knowledge Graph</p>
          <p className="mt-0.5 text-sm">
            <strong className="text-ink font-medium">{itemCount}</strong>{' '}
            <span className="text-sub">{itemCount === 1 ? 'Item' : 'Items'}</span>
            <span className="text-hint px-1.5">·</span>
            <strong className="text-ink font-medium">{connectionCount}</strong>{' '}
            <span className="text-sub">{connectionCount === 1 ? 'Connection' : 'Connections'}</span>
          </p>
        </div>
        {specTitle ? <span className="text-sub truncate text-sm">{specTitle}</span> : null}
      </div>

      {view !== 'empty' && (
        <div className="border-rule bg-tint flex w-full shrink-0 flex-wrap items-center gap-1.5 border-b px-6 py-2.5">
          {sections.map((section) => (
            <KindChip
              key={section.kind}
              section={section}
              hidden={hiddenKinds.has(section.kind)}
              onScroll={() => scrollToKind(section.kind)}
              onToggle={() => toggleKind(section.kind)}
            />
          ))}
          {hiddenKinds.size > 0 && (
            <button
              type="button"
              onClick={() => setHiddenKinds(new Set())}
              className="text-sub hover:bg-wash hover:text-ink focus-visible:ring-link/40 ml-auto shrink-0 cursor-pointer rounded px-2 py-0.5 text-xs outline-none focus-visible:ring-2"
            >
              Show all
            </button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 pt-6 pb-10">
          {view === 'empty' && (
            <EmptyState
              title="No knowledge captured yet"
              description="Knowledge appears here as the interview progresses."
            />
          )}
          {view === 'all-hidden' && (
            <EmptyState
              title="All kinds are hidden"
              description="Show at least one kind to see the knowledge graph."
              action={
                <button
                  type="button"
                  onClick={() => setHiddenKinds(new Set())}
                  className="border-rule hover:bg-wash text-ink mt-2 rounded-lg border bg-white px-3 py-1.5 text-sm"
                >
                  Show all kinds
                </button>
              }
            />
          )}
          {view === 'list' &&
            visibleSections.map((section) => (
              <KindSectionBlock
                key={section.kind}
                section={section}
                runTraces={runTraces ?? []}
                registerRef={(el) => sectionRefs.current.set(section.kind, el)}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

function KindChip({
  section,
  hidden,
  onScroll,
  onToggle,
}: {
  section: KindSection;
  hidden: boolean;
  onScroll: () => void;
  onToggle: () => void;
}) {
  const accent = planeAccent(section.plane);
  return (
    <span
      data-graph-kind-chip={section.kind}
      className={`inline-flex h-7 items-stretch overflow-hidden rounded-full border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${
        hidden ? 'border-rule border-dashed' : 'border-rule'
      }`}
    >
      <button
        type="button"
        onClick={onScroll}
        aria-label={hidden ? `Show ${section.label} and scroll to it` : `Scroll to ${section.label}`}
        className={`hover:bg-wash focus-visible:ring-link/40 flex cursor-pointer items-center gap-1.5 px-2 outline-none focus-visible:ring-2 ${
          hidden ? 'text-hint' : 'text-ink'
        }`}
      >
        <span
          className="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-medium"
          style={hidden ? { color: accent.text } : { color: accent.text, backgroundColor: accent.bg }}
        >
          {NODE_KIND_METADATA[section.kind].label}
        </span>
        <span className="text-xs font-medium">{section.label}</span>
        <span className="font-mono text-[10px] opacity-70">{section.nodes.length}</span>
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={!hidden}
        aria-label={hidden ? `Show ${section.label}` : `Hide ${section.label}`}
        className={`border-rule hover:bg-wash focus-visible:ring-link/40 flex w-7 cursor-pointer items-center justify-center border-l outline-none focus-visible:ring-2 ${
          hidden ? 'text-hint' : 'text-sub'
        }`}
      >
        {hidden ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
      </button>
    </span>
  );
}

function KindSectionBlock({
  section,
  runTraces,
  registerRef,
}: {
  section: KindSection;
  runTraces: readonly RunTraceEntry[];
  registerRef: (el: HTMLElement | null) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section ref={registerRef} data-graph-section={section.kind}>
      <div className="mb-2 flex w-full items-center justify-between gap-2 pr-1">
        <h2 className="text-sub text-sm font-medium">{section.label}</h2>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label={`Toggle ${section.label}`}
          className="text-hint hover:bg-wash hover:text-ink focus-visible:ring-link/40 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded outline-none focus-visible:ring-2"
        >
          <ChevronIcon className={`size-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-2">
          {section.nodes.map((node) => (
            <ItemRow
              key={node.id}
              node={node}
              runTraces={runTraces.filter(
                (trace) => trace.nodeCode === nodeRefCode(node.kind, node.kindOrdinal),
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ItemRow({ node, runTraces }: { node: GraphNode; runTraces: readonly RunTraceEntry[] }) {
  return (
    <article
      data-graph-row
      className="border-rule rounded-xl border bg-white p-3 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-baseline gap-2">
        <NodeRefChip kind={node.kind} plane={node.plane} kindOrdinal={node.kindOrdinal} />
        <p className="text-ink text-sm">{node.title}</p>
      </div>
      {node.body ? <p className="text-sub mt-1.5 pl-1 text-xs leading-relaxed">{node.body}</p> : null}
      {runTraces.length === 0 ? null : (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-1">
          {runTraces.map((trace) => (
            <Link
              key={`${trace.runId}-${trace.nodeCode}`}
              to="/runs/$runId"
              params={{ runId: trace.runId }}
              className="bg-wash text-sub hover:text-ink rounded px-1.5 py-0.5 font-mono text-[10px]"
            >
              {traceLabel(trace)}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}

function traceLabel(trace: RunTraceEntry): string {
  if (trace.failedSliceIds.length === 1) return `${trace.failedSliceIds[0]} failed`;
  if (trace.failedSliceIds.length > 1) return `${trace.failedSliceIds.length} failed slices`;
  if (trace.sliceIds.length === 1)
    return `${trace.sliceIds[0]} ${trace.completedSliceIds.length > 0 ? 'completed' : 'pending'}`;
  return `${trace.sliceIds.length} slices`;
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-rule bg-tint flex flex-col items-center gap-2 rounded-xl border p-8 text-center">
      <p className="text-ink text-sm font-medium">{title}</p>
      <p className="text-sub max-w-md text-xs">{description}</p>
      {action}
    </div>
  );
}
