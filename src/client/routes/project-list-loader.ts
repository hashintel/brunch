import type { ProjectListItem } from '@/shared/api-types.js';

export async function fetchProjectListLoaderData(): Promise<ProjectListItem[]> {
  const response = await fetch('/api/projects');
  if (!response.ok) {
    throw new Error('Failed to load projects');
  }

  return response.json() as Promise<ProjectListItem[]>;
}
