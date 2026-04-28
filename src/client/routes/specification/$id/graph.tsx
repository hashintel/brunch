import { createFileRoute, Link } from '@tanstack/react-router';

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

function GraphRouteComponent() {
  const entityState = useSpecificationEntitiesProjectWide();
  const bundle = useSpecificationBundleData();
  const specificationId = String(bundle.specification.id);

  const currentReachable = getCurrentOpenPhase(bundle.workflow.phases);
  const allClosed = areAllWorkflowPhasesClosed(bundle.workflow.phases);

  let backToChatLink = null;
  let emptyStateAction;

  if (currentReachable) {
    const phaseLabel = getWorkflowPhaseLabel(currentReachable).toLowerCase();
    const phaseTo = getPhaseRoutePath(currentReachable) as '/specification/$id/grounding';
    backToChatLink = (
      <Link
        to={phaseTo}
        params={{ id: specificationId }}
        className="text-xs font-medium text-[#2070e6] hover:underline"
      >
        Back to chat
      </Link>
    );
    emptyStateAction = (
      <Link
        to={phaseTo}
        params={{ id: specificationId }}
        className="text-xs font-medium text-[#2070e6] hover:underline"
      >
        Go to {phaseLabel}
      </Link>
    );
  } else if (allClosed) {
    backToChatLink = (
      <Link
        to="/specification/$id/export"
        params={{ id: specificationId }}
        className="text-xs font-medium text-[#2070e6] hover:underline"
      >
        Back to chat
      </Link>
    );
    emptyStateAction = (
      <Link
        to="/specification/$id/export"
        params={{ id: specificationId }}
        className="text-xs font-medium text-[#2070e6] hover:underline"
      >
        View output
      </Link>
    );
  }

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
