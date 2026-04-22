import { createFileRoute } from '@tanstack/react-router';

import { InterviewView } from './-interview-view.js';

function AcceptanceReviewView() {
  return <InterviewView phase="criteria" />;
}

export const Route = createFileRoute('/specification/$id/_view/acceptance-review')({
  component: AcceptanceReviewView,
});
