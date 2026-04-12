import { useLoaderData, useParams } from '@tanstack/react-router';

import { ExportPreviewScreen } from '../screens/ExportPreviewScreen.js';

export function ExportPreview() {
  const { id } = useParams({ from: '/project/$id/export' });
  const data = useLoaderData({ from: '/project/$id/export' });

  return <ExportPreviewScreen projectId={id} data={data} />;
}
