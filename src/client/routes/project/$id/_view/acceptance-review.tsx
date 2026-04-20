import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/project/$id/_view/acceptance-review')({
  loader: ({ params }) => {
    throw redirect({
      to: '/specification/$id/acceptance-review',
      params,
    });
  },
});
