import { Outlet, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { fetchViewLayoutLoaderData } from '../../../../workspace/workspace-loader.js';

const viewSearchSchema = z.object({
  view: z.enum(['chat', 'graph']).optional().default('chat'),
});

export const Route = createFileRoute('/project/$id/_view')({
  validateSearch: viewSearchSchema,
  loader: ({ params }) => fetchViewLayoutLoaderData(params.id),
  component: function ViewLayout() {
    return <Outlet />;
  },
});
