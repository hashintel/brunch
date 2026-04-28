import { createFileRoute, Link } from '@tanstack/react-router';

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

const RETURN_LINK_CLASS = 'text-xs font-medium text-[#2070e6] hover:underline';

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

function GraphRouteComponent() {
  const entityState = useSpecificationEntitiesProjectWide();
  const bundle = useSpecificationBundleData();
  const target = returnTarget(bundle.workflow, String(bundle.specification.id));

  const backToChatLink = target ? (
    <Link to={target.to} params={target.params} className={RETURN_LINK_CLASS}>
      Back to chat
    </Link>
  ) : null;

  const emptyStateAction = target ? (
    <Link to={target.to} params={target.params} className={RETURN_LINK_CLASS}>
      {target.openLabel}
    </Link>
  ) : undefined;

  const header = (
    <header data-graph-header className="flex items-center justify-between border-b border-rule pb-3">
      <h1 className="text-sm font-medium text-ink">Knowledge graph</h1>
      {backToChatLink}
    </header>
  );

  return <StructuredListView entityState={entityState} emptyStateAction={emptyStateAction} header={header} />;
}

export const Route = createFileRoute('/specification/$id/graph')({
  loader: ({ params }) => primeSpecificationEntitiesProjectWide(params.id),
  component: GraphRouteComponent,
});
