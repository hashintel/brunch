import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/project/$id/_view/framing')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/project/$id/grounding', params });
  },
});
