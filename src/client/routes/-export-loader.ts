import type { ExportLoaderData } from '@/shared/api-types.js';

export async function fetchExportPreviewLoaderData(projectId: string): Promise<ExportLoaderData> {
  const id = projectId;
  const response = await fetch(`/api/projects/${id}/export`);
  if (!response.ok) {
    throw new Error('Failed to load export');
  }

  return (await response.json()) as ExportLoaderData;
}
