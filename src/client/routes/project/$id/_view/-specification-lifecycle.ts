import { useEffect, useMemo, useState } from 'react';

import type { SpecificationLanding, WorkflowPhase, WorkflowState } from '@/shared/api-types.js';
import type { PhaseIntentRequest } from '@/shared/phase-intents.js';
import { phaseOrder } from '@/shared/phase-routes.js';

const autoPhaseEntryRegistry = new Map<number, string>();

function getCurrentReachablePhase(workflow: WorkflowState): WorkflowPhase | null {
  return phaseOrder.find((phase) => workflow.phases[phase].status !== 'closed') ?? null;
}

function getAutoPresentPhaseEntryIntent({
  phase,
  workflow,
  landing,
}: {
  phase: WorkflowPhase;
  workflow: WorkflowState;
  landing: SpecificationLanding | null;
}): PhaseIntentRequest | null {
  const currentReachablePhase = getCurrentReachablePhase(workflow);
  if (phase !== currentReachablePhase) {
    return null;
  }

  if (!landing || landing.kind !== 'kickoff' || landing.phase !== phase || landing.mode !== 'start') {
    return null;
  }

  if (phase === 'scope') {
    return null;
  }

  return {
    kind: 'phase-entry',
    phase,
  };
}

function getAutoPhaseEntryKey(intent: PhaseIntentRequest): string {
  return `${intent.kind}:${intent.phase}${
    intent.kind === 'phase-entry' && intent.mode ? `:${intent.mode}` : ''
  }`;
}

export function resetSpecificationLifecycleRegistryForTesting() {
  autoPhaseEntryRegistry.clear();
}

export function useSpecificationScopedAutoPhaseEntry({
  projectId,
  phase,
  workflow,
  landing,
  isChatLoading,
  submitPhaseIntent,
}: {
  projectId: number;
  phase: WorkflowPhase;
  workflow: WorkflowState;
  landing: SpecificationLanding | null;
  isChatLoading: boolean;
  submitPhaseIntent: (intent: PhaseIntentRequest) => Promise<boolean>;
}): boolean {
  const autoIntent = useMemo(
    () => getAutoPresentPhaseEntryIntent({ phase, workflow, landing }),
    [landing, phase, workflow],
  );
  const autoKey = autoIntent ? getAutoPhaseEntryKey(autoIntent) : null;
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(
    () => Boolean(autoKey) && autoPhaseEntryRegistry.get(projectId) === autoKey,
  );

  useEffect(() => {
    const currentReachablePhase = getCurrentReachablePhase(workflow);
    if (phase !== currentReachablePhase) {
      setIsAutoSubmitting(false);
      return;
    }

    if (!autoKey || !autoIntent) {
      autoPhaseEntryRegistry.delete(projectId);
      setIsAutoSubmitting(false);
      return;
    }

    if (autoPhaseEntryRegistry.get(projectId) === autoKey) {
      setIsAutoSubmitting(true);
      return;
    }

    if (isChatLoading) {
      return;
    }

    autoPhaseEntryRegistry.set(projectId, autoKey);
    setIsAutoSubmitting(true);

    let cancelled = false;
    void submitPhaseIntent(autoIntent).then((didSubmit) => {
      if (didSubmit) {
        return;
      }

      if (autoPhaseEntryRegistry.get(projectId) === autoKey) {
        autoPhaseEntryRegistry.delete(projectId);
      }
      if (!cancelled) {
        setIsAutoSubmitting(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [autoIntent, autoKey, isChatLoading, phase, projectId, submitPhaseIntent, workflow]);

  return isAutoSubmitting;
}
