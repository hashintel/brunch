import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, ChevronsDown, ChevronsUp } from 'lucide-react';
import { useState } from 'react';

import { KnowledgeGraphIdentity } from '@/client/components/knowledge-graph-identity';
import type { WorkflowState } from '@/shared/api-types.js';
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

function returnTarget(workflow: WorkflowState, specificationId: string): ReturnTarget | null {
  const currentReachable = getCurrentOpenPhase(workflow.phases);
  if (currentReachable) {
    return {
      to: getPhaseRoutePath(currentReachable) as '/specification/$id/grounding',
      params: { id: specificationId },
      openLabel: `Go to ${getWorkflowPhaseLabel(currentReachable).toLowerCase()}`,
    };
  }
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
  const target = returnTarget(bundle.workflow, String(bundle.specification.id));
  const [rowsDefaultOpen, setRowsDefaultOpen] = useState(true);
  const [rowsRemountKey, setRowsRemountKey] = useState(0);

  const toggleAllRows = () => {
    setRowsDefaultOpen((prev) => !prev);
    setRowsRemountKey((k) => k + 1);
  };

  const toggleLabel = rowsDefaultOpen ? 'Collapse all' : 'Expand all';
  const ToggleIcon = rowsDefaultOpen ? ChevronsUp : ChevronsDown;

  const backToChatLink = target ? (
    <Link to={target.to} params={target.params} className={BACK_LINK_CLASS}>
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
    <header data-graph-header className="flex items-center justify-between">
      <KnowledgeGraphIdentity entityState={entityState} />
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
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
        </div>
        {backToChatLink && (
          <>
            <div aria-hidden="true" className="h-4 w-px bg-rule" />
            {backToChatLink}
          </>
        )}
      </div>
    </header>
  );

  return (
    <StructuredListView
      entityState={entityState}
      emptyStateAction={emptyStateAction}
      header={header}
      rowsDefaultOpen={rowsDefaultOpen}
      rowsRemountKey={rowsRemountKey}
    />
  );
}

export const Route = createFileRoute('/specification/$id/graph')({
  loader: ({ params }) => primeSpecificationEntitiesProjectWide(params.id),
  component: GraphRouteComponent,
});
