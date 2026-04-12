import { exportLoaderDataSchema, type ExportLoaderData } from '@/shared/api-types.js';

export async function fetchExportPreviewLoaderData(projectId: number | string): Promise<ExportLoaderData> {
  const id = String(projectId);
  const response = await fetch(`/api/projects/${id}/export`);
  if (!response.ok) {
    throw new Error('Failed to load export');
  }

  return exportLoaderDataSchema.parse(await response.json());
}
