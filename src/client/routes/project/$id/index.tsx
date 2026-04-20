import { createFileRoute, redirect } from '@tanstack/react-router';

import type { ProjectState } from '@/shared/api-types.js';
import { getPhaseRoutePath, groundingWorkflowPhase, phaseOrder } from '@/shared/phase-routes.js';

export const Route = createFileRoute('/project/$id/')({
  loader: async ({ params }) => {
    const res = await fetch(`/api/projects/${params.id}`);
    if (!res.ok) {
      throw redirect({ to: getPhaseRoutePath(groundingWorkflowPhase), params });
    }
    const projectState = (await res.json()) as ProjectState;
    const phases = projectState.workflow.phases;
    const activePhase =
      phaseOrder.find((phase) => phases[phase].status !== 'closed') ?? groundingWorkflowPhase;

    throw redirect({
      to: getPhaseRoutePath(activePhase),
      params,
    });
  },
});
