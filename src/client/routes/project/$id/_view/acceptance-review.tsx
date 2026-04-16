import { createFileRoute } from '@tanstack/react-router';

import { InterviewView } from './-interview-view.js';

function AcceptanceReviewView() {
  return <InterviewView phase="criteria" />;
}

export const Route = createFileRoute('/project/$id/_view/acceptance-review')({
  component: AcceptanceReviewView,
});
