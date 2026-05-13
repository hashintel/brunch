import { createFileRoute } from '@tanstack/react-router';

import { ContinuousWorkspaceView } from './-continuous-workspace-view.js';

function ElicitationView() {
  return <ContinuousWorkspaceView initialPhase="design" />;
}

export const Route = createFileRoute('/specification/$id/_view/elicitation')({
  component: ElicitationView,
});
