import { createFileRoute, Link, useLocation, useSearch } from '@tanstack/react-router';
import { ArrowLeft, ChevronsDown, ChevronsUp } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { ChatShellLayout } from '@/client/components/chat-shell-layout';
import { GraphCanvas, type KindHighlight } from '@/client/components/graph/GraphCanvas.js';
import { GRAPH_VIEW_PARAM, parseViewMode, ViewToggle } from '@/client/components/graph/ViewToggle.js';
import { KnowledgeGraphIdentity } from '@/client/components/knowledge-graph-identity';
import type { WorkflowState } from '@/shared/api-types.js';
import { knowledgeKindRegistry, type KnowledgeKind } from '@/shared/knowledge.js';
import type { WorkflowPhase } from '@/shared/phase-close.js';
import {
  areAllWorkflowPhasesClosed,
  getCurrentOpenPhase,
  getPhaseRoutePath,
  getWorkflowPhaseLabel,
} from '@/shared/phase-descriptors.js';

import {
  primeSpecificationEntitiesProjectWide,
  useSpecificationBundleData,
  useSpecificationEntitiesProjectWide,
} from './-specification-data.js';
import { KindFilterBar, StructuredListView, type PopulatedKind } from './-structured-list-view.js';

const BACK_LINK_CLASS = 'inline-flex items-center gap-1 text-xs text-hint transition-colors hover:text-ink';
const RETURN_LINK_CLASS = 'inline-flex items-center gap-1 text-xs font-medium text-link hover:underline';

interface ReturnTarget {
  to: '/specification/$id/grounding' | '/specification/$id/export';
  params: { id: string };
  openLabel: string;
}

function targetForPhase(phase: WorkflowPhase, specificationId: string): ReturnTarget {
  return {
    to: getPhaseRoutePath(phase) as '/specification/$id/grounding',
    params: { id: specificationId },
    openLabel: `Go to ${getWorkflowPhaseLabel(phase).toLowerCase()}`,
  };
}

function returnTarget(
  workflow: WorkflowState,
  specificationId: string,
  origin: WorkflowPhase | undefined,
): ReturnTarget | null {
  if (origin) return targetForPhase(origin, specificationId);
  const currentReachable = getCurrentOpenPhase(workflow.phases);
  if (currentReachable) return targetForPhase(currentReachable, specificationId);
  if (areAllWorkflowPhasesClosed(workflow.phases)) {
    return {
      to: '/specification/$id/export',
      params: { id: specificationId },
      openLabel: 'View output',
    };
  }
  return null;
}

const ROW_TOGGLE_CLASS =
  'flex size-6 shrink-0 items-center justify-center rounded text-hint outline-none hover:bg-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30';

function GraphRouteComponent() {
  const entityState = useSpecificationEntitiesProjectWide();
  const bundle = useSpecificationBundleData();
  const { state } = useLocation();
  const search = useSearch({ strict: false }) as { [GRAPH_VIEW_PARAM]?: string };
  const view = parseViewMode(search[GRAPH_VIEW_PARAM]);
  const target = returnTarget(bundle.workflow, String(bundle.specification.id), state?.fromPhase);
  const [rowsDefaultOpen, setRowsDefaultOpen] = useState(true);
  const [rowsRemountKey, setRowsRemountKey] = useState(0);
  const [hiddenKinds, setHiddenKinds] = useState<ReadonlySet<KnowledgeKind>>(new Set());
  const [highlight, setHighlight] = useState<KindHighlight | null>(null);
  const highlightNonce = useRef(0);

  const populatedKinds = useMemo<PopulatedKind[]>(
    () =>
      knowledgeKindRegistry
        .map((entry) => ({ entry, count: entityState[entry.collectionKey].length }))
        .filter(({ count }) => count > 0),
    [entityState],
  );

  const toggleKind = (kind: KnowledgeKind) =>
    setHiddenKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const focusKind = (kind: KnowledgeKind) => {
    setHiddenKinds((current) => {
      if (!current.has(kind)) return current;
      const next = new Set(current);
      next.delete(kind);
      return next;
    });
    highlightNonce.current += 1;
    setHighlight({ kind, nonce: highlightNonce.current });
  };

  const toggleAllRows = () => {
    setRowsDefaultOpen((prev) => !prev);
    setRowsRemountKey((k) => k + 1);
  };

  const toggleLabel = rowsDefaultOpen ? 'Collapse all' : 'Expand all';
  const ToggleIcon = rowsDefaultOpen ? ChevronsUp : ChevronsDown;

  const restoreScrollState = state?.fromScrollY != null ? { scrollY: state.fromScrollY } : undefined;

  const backToChatLink = target ? (
    <Link to={target.to} params={target.params} state={restoreScrollState} className={BACK_LINK_CLASS}>
      <ArrowLeft className="size-3" />
      <span>Back to chat</span>
    </Link>
  ) : null;

  const emptyStateAction = target ? (
    <Link to={target.to} params={target.params} className={RETURN_LINK_CLASS}>
      {target.openLabel}
    </Link>
  ) : undefined;

  const header = (
    <div
      data-graph-header-bar
      className="flex h-16 w-full shrink-0 items-center justify-between border-b border-rule px-6"
    >
      <KnowledgeGraphIdentity entityState={entityState} />
      <div className="flex items-center gap-3">
        {view === 'list' && (
          <button
            type="button"
            data-graph-action="toggle-all-rows"
            aria-label={toggleLabel}
            aria-pressed={!rowsDefaultOpen}
            title={toggleLabel}
            onClick={toggleAllRows}
            className={ROW_TOGGLE_CLASS}
          >
            <ToggleIcon className="size-3.5" />
          </button>
        )}
        <ViewToggle />
        {backToChatLink && (
          <>
            <div aria-hidden="true" className="h-4 w-px bg-rule" />
            {backToChatLink}
          </>
        )}
      </div>
    </div>
  );

  const graphFilterBar =
    view === 'graph' && populatedKinds.length > 0 ? (
      <KindFilterBar
        populatedKinds={populatedKinds}
        hiddenKinds={hiddenKinds}
        onToggle={toggleKind}
        onNavigate={focusKind}
        onShowAll={() => setHiddenKinds(new Set())}
      />
    ) : null;

  const activeView =
    view === 'graph' ? (
      <GraphCanvas
        entityState={entityState}
        emptyStateAction={emptyStateAction}
        hiddenKinds={hiddenKinds}
        highlight={highlight}
      />
    ) : (
      <StructuredListView
        entityState={entityState}
        emptyStateAction={emptyStateAction}
        rowsDefaultOpen={rowsDefaultOpen}
        rowsRemountKey={rowsRemountKey}
      />
    );

  return (
    <ChatShellLayout
      specificationId={String(bundle.specification.id)}
      center={
        <div className="flex h-full flex-col bg-background">
          {header}
          {graphFilterBar}
          <div className="min-h-0 flex-1">{activeView}</div>
        </div>
      }
    />
  );
}

export const Route = createFileRoute('/specification/$id/graph')({
  loader: ({ params }) => primeSpecificationEntitiesProjectWide(params.id),
  component: GraphRouteComponent,
});
