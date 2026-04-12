import { useLoaderData, useNavigate } from '@tanstack/react-router';

import { ProjectListScreen } from '../screens/ProjectListScreen.js';

export function ProjectList() {
  const projects = useLoaderData({ from: '/' });
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
