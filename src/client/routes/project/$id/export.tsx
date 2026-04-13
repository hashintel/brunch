import { createFileRoute } from '@tanstack/react-router';

import type { ExportLoaderData } from '@/shared/api-types.js';

import { ExportPreview } from './-export-preview.js';

export async function fetchExportLoaderData(projectId: string): Promise<ExportLoaderData> {
  const response = await fetch(`/api/projects/${projectId}/export`);
  if (!response.ok) {
    throw new Error('Failed to load export');
  }
  return (await response.json()) as ExportLoaderData;
}

export const Route = createFileRoute('/project/$id/export')({
  loader: ({ params }) => fetchExportLoaderData(params.id),
  component: ExportPreview,
});
