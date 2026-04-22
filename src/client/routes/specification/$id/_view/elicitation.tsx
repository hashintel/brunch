import { createFileRoute } from '@tanstack/react-router';

import { InterviewView } from './-interview-view.js';

function ElicitationView() {
  return <InterviewView phase="design" />;
}

export const Route = createFileRoute('/specification/$id/_view/elicitation')({
  component: ElicitationView,
});
