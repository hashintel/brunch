import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/project/$id/_view/elicitation')({
  loader: ({ params }) => {
    throw redirect({
      to: '/specification/$id/elicitation',
      params,
    });
  },
});
