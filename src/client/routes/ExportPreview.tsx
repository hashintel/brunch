import { useLoaderData, useParams } from '@tanstack/react-router';

import { ExportPreviewScreen } from '../screens/ExportPreviewScreen.js';

export function ExportPreview() {
  const { id } = useParams({ from: '/project_/$id/export' });
  const data = useLoaderData({ from: '/project_/$id/export' });

  return <ExportPreviewScreen projectId={id} data={data} />;
}
