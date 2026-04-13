import { getRouteApi } from '@tanstack/react-router';

import { ExportPreviewScreen } from '../../../screens/ExportPreviewScreen.js';

const exportPreviewRouteApi = getRouteApi('/project/$id/export');

export function ExportPreview() {
  const { id } = exportPreviewRouteApi.useParams();
  const data = exportPreviewRouteApi.useLoaderData();

  return <ExportPreviewScreen projectId={id} data={data} />;
}
