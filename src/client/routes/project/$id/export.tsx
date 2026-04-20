import { createFileRoute, redirect } from '@tanstack/react-router';

export { fetchExportLoaderData } from '../../specification/$id/export.js';

export const Route = createFileRoute('/project/$id/export')({
  loader: ({ params }) => {
    throw redirect({
      to: '/specification/$id/export',
      params,
    });
  },
});
