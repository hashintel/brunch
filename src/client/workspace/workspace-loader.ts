import type { EntitiesData, ProjectState } from '@/shared/api-types.js';

export interface WorkspaceLoaderData {
  readonly projectState: ProjectState;
  readonly entitySnapshot: EntitiesData;
}

export interface KnowledgeWorkspaceLoaderData {
  readonly entitySnapshot: EntitiesData;
}

async function fetchJson<T>(url: string, errorMessage: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}

function getEntitiesUrl(projectId: string): string {
  return `/api/projects/${projectId}/entities?mode=active-path`;
}

async function fetchWorkflowDetailLoaderData(projectId: string): Promise<WorkspaceLoaderData> {
  const id = projectId;
  const [projectState, entitySnapshot] = await Promise.all([
    fetchJson<ProjectState>(`/api/projects/${id}`, 'Failed to load project'),
    fetchJson<EntitiesData>(getEntitiesUrl(id), 'Failed to load project entities'),
  ]);

  return { projectState, entitySnapshot };
}

export async function fetchInterviewWorkspaceLoaderData(projectId: string): Promise<WorkspaceLoaderData> {
  return fetchWorkflowDetailLoaderData(projectId);
}

export async function fetchKnowledgeWorkspaceLoaderData(
  projectId: string,
): Promise<KnowledgeWorkspaceLoaderData> {
  const id = projectId;
  await fetchJson<ProjectState>(`/api/projects/${id}`, 'Failed to load project');
  const entitySnapshot = await fetchJson<EntitiesData>(getEntitiesUrl(id), 'Failed to load project entities');

  return { entitySnapshot };
}
