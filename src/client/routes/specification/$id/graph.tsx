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

  let emptyStateAction;
  if (currentReachable) {
    emptyStateAction = (
      <Link
        to={getPhaseRoutePath(currentReachable) as '/specification/$id/grounding'}
        params={{ id: specificationId }}
        className="text-xs font-medium text-[#2070e6] hover:underline"
      >
        Go to {getWorkflowPhaseLabel(currentReachable).toLowerCase()}
      </Link>
    );
  } else if (allClosed) {
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

  return <StructuredListView entityState={entityState} emptyStateAction={emptyStateAction} />;
}

export const Route = createFileRoute('/specification/$id/graph')({
  loader: ({ params }) => primeSpecificationEntitiesProjectWide(params.id),
  component: GraphRouteComponent,
});
