import { createFileRoute } from '@tanstack/react-router';

import { InterviewView } from './-interview-view.js';

function RequirementsReviewView() {
  return <InterviewView phase="requirements" />;
}

export const Route = createFileRoute('/project/$id/_view/requirements-review')({
  component: RequirementsReviewView,
});
