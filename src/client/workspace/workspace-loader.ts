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

async function fetchWorkflowDetailLoaderData(projectId: number | string): Promise<WorkspaceLoaderData> {
  const id = String(projectId);
  const [projectState, entitySnapshot] = await Promise.all([
    fetchJson<ProjectState>(`/api/projects/${id}`, 'Failed to load project'),
    fetchJson<EntitiesData>(`/api/projects/${id}/entities`, 'Failed to load project entities'),
  ]);

  return { projectState, entitySnapshot };
}

export async function fetchInterviewWorkspaceLoaderData(
  projectId: number | string,
): Promise<WorkspaceLoaderData> {
  return fetchWorkflowDetailLoaderData(projectId);
}

export async function fetchKnowledgeWorkspaceLoaderData(
  projectId: number | string,
): Promise<KnowledgeWorkspaceLoaderData> {
  const id = String(projectId);
  await fetchJson<ProjectState>(`/api/projects/${id}`, 'Failed to load project');
  const entitySnapshot = await fetchJson<EntitiesData>(
    `/api/projects/${id}/entities`,
    'Failed to load project entities',
  );

  return { entitySnapshot };
}
