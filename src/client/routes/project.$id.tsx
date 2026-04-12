import { createFileRoute } from '@tanstack/react-router';

import { InterviewWorkspaceSkeleton } from '../components/route-skeletons.js';
import { fetchInterviewWorkspaceLoaderData } from '../workspace/workspace-loader.js';
import { InterviewWorkspace } from './-interview-workspace.js';

export const Route = createFileRoute('/project/$id')({
  loader: ({ params }) => fetchInterviewWorkspaceLoaderData(params.id),
  component: InterviewWorkspace,
  pendingComponent: InterviewWorkspaceSkeleton,
});
