import { createFileRoute, redirect } from '@tanstack/react-router';

import type { ProjectState } from '@/shared/api-types.js';
import {
  getCurrentOpenPhase,
  getPhaseRoutePath,
  groundingWorkflowPhase,
} from '@/shared/phase-descriptors.js';

export const Route = createFileRoute('/project/$id/')({
  loader: async ({ params }) => {
    const res = await fetch(`/api/projects/${params.id}`);
    if (!res.ok) {
      throw redirect({ to: getPhaseRoutePath(groundingWorkflowPhase), params });
    }
    const projectState = (await res.json()) as ProjectState;
    const phases = projectState.workflow.phases;
    const activePhase = getCurrentOpenPhase(phases) ?? groundingWorkflowPhase;

    throw redirect({
      to: getPhaseRoutePath(activePhase),
      params,
    });
  },
});
