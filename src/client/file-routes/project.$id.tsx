import { createFileRoute } from '@tanstack/react-router';

import { InterviewWorkspaceSkeleton } from '../components/route-skeletons.js';
import { InterviewWorkspace } from '../routes/InterviewWorkspace.js';
import { fetchInterviewWorkspaceLoaderData } from '../workspace/workspace-loader.js';

export const Route = createFileRoute('/project/$id')({
  loader: ({ params }) => fetchInterviewWorkspaceLoaderData(params.id),
  component: InterviewWorkspace,
  pendingComponent: InterviewWorkspaceSkeleton,
});
