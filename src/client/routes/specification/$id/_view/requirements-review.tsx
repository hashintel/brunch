import { createFileRoute } from '@tanstack/react-router';

import { ContinuousWorkspaceView } from './-continuous-workspace-view.js';

function RequirementsReviewView() {
  return <ContinuousWorkspaceView initialPhase="requirements" />;
}

export const Route = createFileRoute('/specification/$id/_view/requirements-review')({
  component: RequirementsReviewView,
});
