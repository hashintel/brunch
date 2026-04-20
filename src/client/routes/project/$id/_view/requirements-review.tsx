import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/project/$id/_view/requirements-review')({
  loader: ({ params }) => {
    throw redirect({
      to: '/specification/$id/requirements-review',
      params,
    });
  },
});
