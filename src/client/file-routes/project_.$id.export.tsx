import { createFileRoute } from '@tanstack/react-router';

import { fetchExportPreviewLoaderData } from '../routes/export-loader.js';
import { ExportPreview } from '../routes/ExportPreview.js';

export const Route = createFileRoute('/project_/$id/export')({
  loader: ({ params }) => fetchExportPreviewLoaderData(params.id),
  component: ExportPreview,
});
