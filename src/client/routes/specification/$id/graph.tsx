import { createFileRoute, Link, useLocation } from '@tanstack/react-router';
import { ArrowLeft, ChevronsDown, ChevronsUp } from 'lucide-react';
import { useState } from 'react';

import { KnowledgeGraphIdentity } from '@/client/components/knowledge-graph-identity';
import { SideChatHost } from '@/client/components/side-chat-host.js';
import type { WorkflowState } from '@/shared/api-types.js';
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
import { StructuredListView } from './-structured-list-view.js';

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
  const target = returnTarget(bundle.workflow, String(bundle.specification.id), state?.fromPhase);
  const [rowsDefaultOpen, setRowsDefaultOpen] = useState(true);
  const [rowsRemountKey, setRowsRemountKey] = useState(0);

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

  const headerLeft = <KnowledgeGraphIdentity entityState={entityState} />;

  const headerRight = (
    <div className="flex items-center gap-3">
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
      {backToChatLink && (
        <>
          <div aria-hidden="true" className="h-4 w-px bg-rule" />
          {backToChatLink}
        </>
      )}
    </div>
  );

  return (
    <SideChatHost specificationId={bundle.specification.id}>
      <StructuredListView
        entityState={entityState}
        emptyStateAction={emptyStateAction}
        headerLeft={headerLeft}
        headerRight={headerRight}
        rowsDefaultOpen={rowsDefaultOpen}
        rowsRemountKey={rowsRemountKey}
      />
    </SideChatHost>
  );
}

export const Route = createFileRoute('/specification/$id/graph')({
  loader: ({ params }) => primeSpecificationEntitiesProjectWide(params.id),
  component: GraphRouteComponent,
});
