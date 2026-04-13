import type { EntitiesData, ProjectState } from '@/shared/api-types.js';

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

/** ProjectLayout loader — fetches workflow state only. */
export async function fetchProjectLayoutLoaderData(projectId: string): Promise<ProjectState> {
  return fetchJson<ProjectState>(`/api/projects/${projectId}`, 'Failed to load project');
}

/** ViewLayout loader — fetches entity snapshot only. */
export async function fetchViewLayoutLoaderData(projectId: string): Promise<EntitiesData> {
  return fetchJson<EntitiesData>(getEntitiesUrl(projectId), 'Failed to load project entities');
}

export async function fetchKnowledgeWorkspaceLoaderData(
  projectId: string,
): Promise<KnowledgeWorkspaceLoaderData> {
  const id = projectId;
  await fetchJson<ProjectState>(`/api/projects/${id}`, 'Failed to load project');
  const entitySnapshot = await fetchJson<EntitiesData>(getEntitiesUrl(id), 'Failed to load project entities');

  return { entitySnapshot };
}
