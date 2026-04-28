import { createFileRoute } from '@tanstack/react-router';

import {
  primeSpecificationEntitiesProjectWide,
  useSpecificationEntitiesProjectWide,
} from './-specification-data.js';
import { StructuredListView } from './-structured-list-view.js';

function GraphRouteComponent() {
  const entityState = useSpecificationEntitiesProjectWide();
  return <StructuredListView entityState={entityState} />;
}

export const Route = createFileRoute('/specification/$id/graph')({
  loader: ({ params }) => primeSpecificationEntitiesProjectWide(params.id),
  component: GraphRouteComponent,
});
