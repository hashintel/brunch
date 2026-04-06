import type { EntitiesData, ProjectState } from '../../shared/api-types.js';

export interface WorkspaceLoaderData {
  projectState: ProjectState;
  entitySnapshot: EntitiesData;
}

async function fetchJson<T>(url: string, errorMessage: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

export async function fetchWorkspaceLoaderData(projectId: number | string): Promise<WorkspaceLoaderData> {
  const id = String(projectId);
  const [projectState, entitySnapshot] = await Promise.all([
    fetchJson<ProjectState>(`/api/projects/${id}`, 'Failed to load project'),
    fetchJson<EntitiesData>(`/api/projects/${id}/entities`, 'Failed to load project entities'),
  ]);

  return { projectState, entitySnapshot };
}
