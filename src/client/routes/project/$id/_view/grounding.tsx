import { createFileRoute } from '@tanstack/react-router';

import { groundingWorkflowPhase } from '@/shared/phase-routes.js';

import { InterviewView } from './-interview-view.js';

function GroundingView() {
  return <InterviewView phase={groundingWorkflowPhase} />;
}

export const Route = createFileRoute('/project/$id/_view/grounding')({
  component: GroundingView,
});
