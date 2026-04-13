import { createFileRoute } from '@tanstack/react-router';

import { fetchExportPreviewLoaderData } from './-export-loader.js';
import { ExportPreview } from './-export-preview.js';

export const Route = createFileRoute('/project/$id/export')({
  loader: ({ params }) => fetchExportPreviewLoaderData(params.id),
  component: ExportPreview,
});
