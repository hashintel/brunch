import { createFileRoute, redirect } from '@tanstack/react-router';

import {
  areAllWorkflowPhasesClosed,
  getCurrentOpenPhase,
  getPhaseRoutePath,
  groundingWorkflowPhase,
} from '@/shared/phase-descriptors.js';
import type { SpecificationState } from '@/shared/specification.js';

export const Route = createFileRoute('/specification/$id/')({
  loader: async ({ params }) => {
    const res = await fetch(`/api/specifications/${params.id}`);
    if (!res.ok) {
      throw redirect({ to: getPhaseRoutePath(groundingWorkflowPhase), params });
    }
    const specificationState = (await res.json()) as SpecificationState;
    const phases = specificationState.workflow.phases;
    if (areAllWorkflowPhasesClosed(phases)) {
      throw redirect({
        to: '/specification/$id/export',
        params,
      });
    }

    const activePhase = getCurrentOpenPhase(phases) ?? groundingWorkflowPhase;

    throw redirect({
      to: getPhaseRoutePath(activePhase),
      params,
    });
  },
});
