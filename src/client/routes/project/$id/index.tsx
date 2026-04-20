import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/project/$id/')({
  loader: ({ params }) => {
    throw redirect({
      to: '/specification/$id',
      params,
    });
  },
});
