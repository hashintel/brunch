import { createFileRoute } from '@tanstack/react-router';

import { ContinuousWorkspaceView } from './-continuous-workspace-view.js';

function AcceptanceReviewView() {
  return <ContinuousWorkspaceView initialPhase="criteria" />;
}

export const Route = createFileRoute('/specification/$id/_view/acceptance-review')({
  component: AcceptanceReviewView,
});
