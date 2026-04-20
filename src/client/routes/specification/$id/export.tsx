import { createFileRoute } from '@tanstack/react-router';

import type { ExportLoaderData } from '@/shared/api-types.js';

import { ExportPreview } from '../../project/$id/-export-preview.js';

export async function fetchExportLoaderData(specificationId: string): Promise<ExportLoaderData> {
  const response = await fetch(`/api/specifications/${specificationId}/export`);
  if (!response.ok) {
    throw new Error('Failed to load export');
  }
  return (await response.json()) as ExportLoaderData;
}

export const Route = createFileRoute('/specification/$id/export')({
  loader: ({ params }) => fetchExportLoaderData(params.id),
  component: ExportPreview,
});
