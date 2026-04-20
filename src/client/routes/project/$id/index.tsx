import { createFileRoute, redirect } from '@tanstack/react-router';

import type { ProjectState } from '@/shared/api-types.js';
import { phaseOrder } from '@/shared/phase-routes.js';

const phaseRedirectTargets = {
  scope: '/project/$id/grounding',
  design: '/project/$id/elicitation',
  requirements: '/project/$id/requirements-review',
  criteria: '/project/$id/acceptance-review',
} as const;

export const Route = createFileRoute('/project/$id/')({
  loader: async ({ params }) => {
    const res = await fetch(`/api/projects/${params.id}`);
    if (!res.ok) {
      throw redirect({ to: '/project/$id/grounding', params });
    }
    const projectState = (await res.json()) as ProjectState;
    const phases = projectState.workflow.phases;
    const activePhase = phaseOrder.find((p) => phases[p].status !== 'closed') ?? phaseOrder[0];

    throw redirect({
      to: phaseRedirectTargets[activePhase],
      params,
    });
  },
});
