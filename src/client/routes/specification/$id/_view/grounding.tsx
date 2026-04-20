import { createFileRoute } from '@tanstack/react-router';

import { groundingWorkflowPhase } from '@/shared/phase-descriptors.js';

import { InterviewView } from '../../../project/$id/_view/-interview-view.js';

function GroundingView() {
  return <InterviewView phase={groundingWorkflowPhase} />;
}

export const Route = createFileRoute('/specification/$id/_view/grounding')({
  component: GroundingView,
});
