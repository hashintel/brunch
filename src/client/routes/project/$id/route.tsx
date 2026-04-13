import { Outlet, createFileRoute, useLoaderData, useParams } from '@tanstack/react-router';

import { PhaseNavigationSidebar } from '../../../components/phase-navigation-sidebar.js';
import { InterviewWorkspaceSkeleton } from '../../../components/route-skeletons.js';
import { fetchProjectLayoutLoaderData } from '../../../workspace/workspace-loader.js';

export const Route = createFileRoute('/project/$id')({
  loader: ({ params }) => fetchProjectLayoutLoaderData(params.id),
  pendingComponent: InterviewWorkspaceSkeleton,
  component: function ProjectLayout() {
    const projectState = useLoaderData({ from: '/project/$id' });
    const { id } = useParams({ from: '/project/$id' });
    return (
      <div className="flex h-full">
        <PhaseNavigationSidebar projectId={id} workflow={projectState.workflow} />
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    );
  },
});
