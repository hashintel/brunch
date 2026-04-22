import { createFileRoute, redirect } from '@tanstack/react-router';

import {
  areAllWorkflowPhasesClosed,
  getCurrentOpenPhase,
  getPhaseRoutePath,
  groundingWorkflowPhase,
} from '@/shared/phase-descriptors.js';

import { primeSpecificationBundle } from './-specification-data.js';

export const Route = createFileRoute('/specification/$id/')({
  loader: async ({ params }) => {
    let specificationState;
    try {
      specificationState = await primeSpecificationBundle(params.id);
    } catch {
      throw redirect({ to: getPhaseRoutePath(groundingWorkflowPhase), params });
    }

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
