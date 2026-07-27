import { createFileRoute } from '@tanstack/react-router';

import { groundingWorkflowPhase } from '@/shared/phase-descriptors.js';

import { ContinuousWorkspaceView } from './-continuous-workspace-view.js';

function GroundingView() {
  return <ContinuousWorkspaceView initialPhase={groundingWorkflowPhase} />;
}

export const Route = createFileRoute('/specification/$id/_view/grounding')({
  component: GroundingView,
});
