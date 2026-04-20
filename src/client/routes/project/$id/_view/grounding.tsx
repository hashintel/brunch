import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/project/$id/_view/grounding')({
  loader: ({ params }) => {
    throw redirect({
      to: '/specification/$id/grounding',
      params,
    });
  },
});
