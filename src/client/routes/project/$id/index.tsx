import { createFileRoute, redirect } from '@tanstack/react-router';

import {
  getCurrentOpenPhase,
  getPhaseRoutePath,
  groundingWorkflowPhase,
} from '@/shared/phase-descriptors.js';
import type { SpecificationState } from '@/shared/specification.js';

export const Route = createFileRoute('/project/$id/')({
  loader: async ({ params }) => {
    const res = await fetch(`/api/projects/${params.id}`);
    if (!res.ok) {
      throw redirect({ to: getPhaseRoutePath(groundingWorkflowPhase), params });
    }
    const specificationState = (await res.json()) as SpecificationState;
    const phases = specificationState.workflow.phases;
    const activePhase = getCurrentOpenPhase(phases) ?? groundingWorkflowPhase;

    throw redirect({
      to: getPhaseRoutePath(activePhase),
      params,
    });
  },
});
