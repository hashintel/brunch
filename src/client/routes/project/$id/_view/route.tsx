import { Outlet, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import type { EntitiesData } from '@/shared/api-types.js';

const viewSearchSchema = z.object({
  view: z.enum(['chat', 'graph']).optional().default('chat'),
});

async function fetchViewLayoutLoaderData(projectId: string): Promise<EntitiesData> {
  const response = await fetch(`/api/projects/${projectId}/entities?mode=active-path`);
  if (!response.ok) {
    throw new Error('Failed to load project entities');
  }
  return (await response.json()) as EntitiesData;
}

export const Route = createFileRoute('/project/$id/_view')({
  validateSearch: viewSearchSchema,
  loader: ({ params }) => fetchViewLayoutLoaderData(params.id),
  component: function ViewLayout() {
    return <Outlet />;
  },
});
