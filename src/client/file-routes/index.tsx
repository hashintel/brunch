import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { fetchProjectListLoaderData } from '../routes/project-list-loader.js';
import { ProjectListScreen } from '../screens/ProjectListScreen.js';

export const Route = createFileRoute('/')({
  loader: fetchProjectListLoaderData,
  component: DashboardRoute,
});

function DashboardRoute() {
  const projects = Route.useLoaderData();
  const navigate = useNavigate();

  const navigateToProject = (projectId: number) => {
    void navigate({ to: '/project/$id', params: { id: String(projectId) } });
  };

  return (
    <ProjectListScreen
      projects={projects}
      onOpenProject={navigateToProject}
      onProjectCreated={navigateToProject}
    />
  );
}
