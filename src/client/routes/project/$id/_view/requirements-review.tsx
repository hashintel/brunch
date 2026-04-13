import { createFileRoute } from '@tanstack/react-router';

import { InterviewWorkspace } from './-interview-workspace.js';

export const Route = createFileRoute('/project/$id/_view/requirements-review')({
  component: InterviewWorkspace,
});
