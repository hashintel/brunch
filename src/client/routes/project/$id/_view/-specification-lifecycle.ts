import { useEffect, useMemo, useRef, useState } from 'react';

import type { SpecificationLanding, WorkflowPhase, WorkflowState } from '@/shared/api-types.js';
import type { PhaseIntentRequest } from '@/shared/phase-intents.js';
import { phaseOrder } from '@/shared/phase-routes.js';

const autoPhaseIntentRegistry = new Map<
  number,
  {
    key: string;
    status: 'pending' | 'failed';
  }
>();

function getCurrentReachablePhase(workflow: WorkflowState): WorkflowPhase | null {
  return phaseOrder.find((phase) => workflow.phases[phase].status !== 'closed') ?? null;
}

function getAutoPhaseIntent({
  phase,
  workflow,
  landing,
}: {
  phase: WorkflowPhase;
  workflow: WorkflowState;
  landing: SpecificationLanding | null;
}): PhaseIntentRequest | null {
  const currentReachablePhase = getCurrentReachablePhase(workflow);
  if (phase !== currentReachablePhase || !landing || landing.phase !== phase) {
    return null;
  }

  if (landing.kind === 'recovery') {
    return {
      kind: 'phase-continue',
      phase,
    };
  }

  if (landing.kind !== 'kickoff' || landing.mode !== 'start' || phase === 'scope') {
    return null;
  }

  return {
    kind: 'phase-entry',
    phase,
  };
}

function getAutoPhaseIntentKey(intent: PhaseIntentRequest): string {
  return `${intent.kind}:${intent.phase}${
    intent.kind === 'phase-entry' && intent.mode ? `:${intent.mode}` : ''
  }`;
}

export function resetSpecificationLifecycleRegistryForTesting() {
  autoPhaseIntentRegistry.clear();
}

function markAutoPhaseIntentFailed(projectId: number, autoKey: string) {
  const latestEntry = autoPhaseIntentRegistry.get(projectId);
  if (latestEntry?.key === autoKey) {
    autoPhaseIntentRegistry.set(projectId, {
      key: autoKey,
      status: 'failed',
    });
  }
}

export function useSpecificationScopedAutoPhaseIntent({
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
    () => getAutoPhaseIntent({ phase, workflow, landing }),
    [landing, phase, workflow],
  );
  const autoKey = autoIntent ? getAutoPhaseIntentKey(autoIntent) : null;
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(() => {
    const registryEntry = autoKey ? autoPhaseIntentRegistry.get(projectId) : null;
    return registryEntry?.key === autoKey && registryEntry.status === 'pending';
  });
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const currentReachablePhase = getCurrentReachablePhase(workflow);
    if (phase !== currentReachablePhase) {
      setIsAutoSubmitting(false);
      return;
    }

    if (!autoKey || !autoIntent) {
      autoPhaseIntentRegistry.delete(projectId);
      setIsAutoSubmitting(false);
      return;
    }

    const registryEntry = autoPhaseIntentRegistry.get(projectId);
    if (registryEntry?.key === autoKey) {
      setIsAutoSubmitting(registryEntry.status === 'pending');
      return;
    }

    if (isChatLoading) {
      return;
    }

    autoPhaseIntentRegistry.set(projectId, {
      key: autoKey,
      status: 'pending',
    });
    setIsAutoSubmitting(true);

    void submitPhaseIntent(autoIntent)
      .then((didSubmit) => {
        if (didSubmit) {
          return;
        }

        markAutoPhaseIntentFailed(projectId, autoKey);
        if (isMountedRef.current) {
          setIsAutoSubmitting(false);
        }
      })
      .catch(() => {
        markAutoPhaseIntentFailed(projectId, autoKey);
        if (isMountedRef.current) {
          setIsAutoSubmitting(false);
        }
      });
  }, [autoIntent, autoKey, isChatLoading, phase, projectId, submitPhaseIntent, workflow]);

  return isAutoSubmitting;
}
