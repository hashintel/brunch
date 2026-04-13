import { Outlet, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const viewSearchSchema = z.object({
  view: z.enum(['chat', 'graph']).optional().default('chat'),
});

export const Route = createFileRoute('/project/$id/_view')({
  validateSearch: viewSearchSchema,
  component: function ViewLayout() {
    return <Outlet />;
  },
});
