import { Outlet, createFileRoute } from '@tanstack/react-router';

import { InterviewWorkspaceSkeleton } from '../../../components/route-skeletons.js';
import { fetchInterviewWorkspaceLoaderData } from '../../../workspace/workspace-loader.js';

export const Route = createFileRoute('/project/$id')({
  loader: ({ params }) => fetchInterviewWorkspaceLoaderData(params.id),
  pendingComponent: InterviewWorkspaceSkeleton,
  component: function ProjectLayout() {
    return (
      <div className="flex h-full">
        <Outlet />
      </div>
    );
  },
});
