import { getRouteApi, useNavigate } from '@tanstack/react-router';

import type { ProjectListItem } from '@/shared/api-types.js';

import { ProjectListScreen } from '../screens/ProjectListScreen.js';

const projectListRouteApi = getRouteApi('/');

export async function fetchProjectListLoaderData(): Promise<ProjectListItem[]> {
  const response = await fetch('/api/projects');
  if (!response.ok) {
    throw new Error('Failed to load projects');
  }

  return response.json() as Promise<ProjectListItem[]>;
}

export function ProjectList() {
  const projects = projectListRouteApi.useLoaderData();
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
