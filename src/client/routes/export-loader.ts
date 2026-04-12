export interface ExportLoaderData {
  ready: boolean;
  markdown?: string;
}

export async function fetchExportPreviewLoaderData(projectId: number | string): Promise<ExportLoaderData> {
  const id = String(projectId);
  const response = await fetch(`/api/projects/${id}/export`);
  if (!response.ok) {
    throw new Error('Failed to load export');
  }

  return response.json() as Promise<ExportLoaderData>;
}
