import type { ChatStatus } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { EntitiesData, SpecificationLanding, WorkflowPhase, WorkflowState } from '@/shared/api-types.js';
import { getCurrentOpenPhase, getNextActivePhase } from '@/shared/phase-descriptors.js';
import type { PhaseIntentRequest } from '@/shared/phase-intents.js';
import type { SpecificationTurn } from '@/shared/specification.js';

const autoPhaseIntentRegistry = new Map<
  number,
  {
    key: string;
    status: 'pending' | 'failed';
  }
>();

function getCurrentReachablePhase(workflow: WorkflowState): WorkflowPhase | null {
  return getCurrentOpenPhase(workflow.phases);
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

  if (landing.kind !== 'kickoff' || landing.mode !== 'start' || phase === 'grounding') {
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
  specificationId,
  phase,
  workflow,
  landing,
  chatStatus,
  submitPhaseIntent,
}: {
  specificationId: number;
  phase: WorkflowPhase;
  workflow: WorkflowState;
  landing: SpecificationLanding | null;
  chatStatus: ChatStatus;
  submitPhaseIntent: (intent: PhaseIntentRequest) => Promise<boolean>;
}): boolean {
  const autoIntent = useMemo(
    () => getAutoPhaseIntent({ phase, workflow, landing }),
    [landing, phase, workflow],
  );
  const autoKey = autoIntent ? getAutoPhaseIntentKey(autoIntent) : null;
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(() => {
    const registryEntry = autoKey ? autoPhaseIntentRegistry.get(specificationId) : null;
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
      autoPhaseIntentRegistry.delete(specificationId);
      setIsAutoSubmitting(false);
      return;
    }

    if (chatStatus === 'error') {
      markAutoPhaseIntentFailed(specificationId, autoKey);
      setIsAutoSubmitting(false);
      return;
    }

    const registryEntry = autoPhaseIntentRegistry.get(specificationId);
    if (registryEntry?.key === autoKey) {
      setIsAutoSubmitting(registryEntry.status === 'pending');
      return;
    }

    if (chatStatus === 'submitted' || chatStatus === 'streaming') {
      return;
    }

    autoPhaseIntentRegistry.set(specificationId, {
      key: autoKey,
      status: 'pending',
    });
    setIsAutoSubmitting(true);

    void submitPhaseIntent(autoIntent)
      .then((didSubmit) => {
        if (didSubmit) {
          return;
        }

        markAutoPhaseIntentFailed(specificationId, autoKey);
        if (isMountedRef.current) {
          setIsAutoSubmitting(false);
        }
      })
      .catch(() => {
        markAutoPhaseIntentFailed(specificationId, autoKey);
        if (isMountedRef.current) {
          setIsAutoSubmitting(false);
        }
      });
  }, [autoIntent, autoKey, chatStatus, phase, specificationId, submitPhaseIntent, workflow]);

  return isAutoSubmitting;
}

type CaptureStatus = 'waiting' | 'applying';

function visibleCapturesAreSynced(
  turn: Pick<SpecificationTurn, 'captured_items'>,
  entityState: EntitiesData,
): boolean {
  return (turn.captured_items ?? [])
    .filter((item) => item.kind !== 'term')
    .every((item) => {
      switch (item.kind) {
        case 'goal':
          return entityState.goals.some((entity) => entity.id === item.id);
        case 'context':
          return entityState.contexts.some((entity) => entity.id === item.id);
        case 'constraint':
          return entityState.constraints.some((entity) => entity.id === item.id);
        case 'requirement':
          return entityState.requirements.some((entity) => entity.id === item.id);
        case 'criterion':
          return entityState.criteria.some((entity) => entity.id === item.id);
        case 'decision':
          return entityState.decisions.some((entity) => entity.id === item.id);
        case 'assumption':
          return entityState.assumptions.some((entity) => entity.id === item.id);
        default:
          return false;
      }
    });
}

export interface SpecificationRuntimeLifecycle {
  readonly submittedTurnId: number | null;
  readonly captureStatusByTurnId: ReadonlyMap<number, CaptureStatus>;
  readonly handleDataPart: (dataPart: { type: string; data?: unknown }) => void;
  readonly handleChatFinish: () => void;
  readonly submitTrackedTurnResponse: (turnId: number, submit: () => Promise<boolean>) => Promise<boolean>;
  readonly submitPhaseClosureCommand: (send: () => Promise<void> | void) => void;
}

export function useSpecificationRuntimeLifecycle({
  specificationId,
  phase,
  workflow,
  entityState,
  stablePhaseTurns,
  refreshReadModel,
  navigateToPhase,
}: {
  specificationId: number;
  phase: WorkflowPhase;
  workflow: WorkflowState;
  entityState: EntitiesData;
  stablePhaseTurns: readonly SpecificationTurn[];
  refreshReadModel: () => Promise<void>;
  navigateToPhase: (phase: WorkflowPhase) => Promise<void> | void;
}): SpecificationRuntimeLifecycle {
  const [submittedTurnId, setSubmittedTurnId] = useState<number | null>(null);
  const [captureStatusByTurnId, setCaptureStatusByTurnId] = useState<Map<number, CaptureStatus>>(
    () => new Map(),
  );
  const [pendingCaptureSyncTurnIds, setPendingCaptureSyncTurnIds] = useState<Set<number>>(() => new Set());
  const [pendingCloseNavigation, setPendingCloseNavigation] = useState(false);
  const pendingCloseRef = useRef(false);

  useEffect(() => {
    setSubmittedTurnId(null);
    setCaptureStatusByTurnId(new Map());
    setPendingCaptureSyncTurnIds(new Set());
    setPendingCloseNavigation(false);
    pendingCloseRef.current = false;
  }, [specificationId, phase]);

  useEffect(() => {
    if (submittedTurnId === null) {
      return;
    }

    const phaseState = workflow.phases[phase];
    if (phaseState.status === 'closed' || phaseState.turnId !== submittedTurnId) {
      setSubmittedTurnId(null);
    }
  }, [phase, submittedTurnId, workflow]);

  useEffect(() => {
    const syncedTurnIds = stablePhaseTurns
      .filter((turn) => pendingCaptureSyncTurnIds.has(turn.id) && visibleCapturesAreSynced(turn, entityState))
      .map((turn) => turn.id);

    if (syncedTurnIds.length === 0) {
      return;
    }

    setPendingCaptureSyncTurnIds((current) => {
      const next = new Set(current);
      for (const turnId of syncedTurnIds) {
        next.delete(turnId);
      }
      return next;
    });
    setCaptureStatusByTurnId((current) => {
      const next = new Map(current);
      for (const turnId of syncedTurnIds) {
        next.delete(turnId);
      }
      return next;
    });
  }, [entityState, pendingCaptureSyncTurnIds, stablePhaseTurns]);

  useEffect(() => {
    if (!pendingCloseNavigation || workflow.phases[phase].status !== 'closed') {
      return;
    }

    setPendingCloseNavigation(false);
    const nextPhase = getNextActivePhase(workflow.phases, phase);
    if (nextPhase) {
      void navigateToPhase(nextPhase);
    }
  }, [navigateToPhase, pendingCloseNavigation, phase, workflow]);

  const handleDataPart = useCallback(
    (dataPart: { type: string; data?: unknown }) => {
      if (dataPart.type !== 'data-observer-result') {
        return;
      }

      const observerTurnId =
        typeof dataPart.data === 'object' &&
        dataPart.data !== null &&
        'turnId' in dataPart.data &&
        typeof dataPart.data.turnId === 'number'
          ? dataPart.data.turnId
          : submittedTurnId;

      if (observerTurnId === null) {
        return;
      }

      setCaptureStatusByTurnId((current) => new Map(current).set(observerTurnId, 'applying'));
      setPendingCaptureSyncTurnIds((current) => new Set(current).add(observerTurnId));
    },
    [submittedTurnId],
  );

  const handleChatFinish = useCallback(() => {
    if (pendingCloseRef.current) {
      pendingCloseRef.current = false;
      setPendingCloseNavigation(true);
    }

    void refreshReadModel();
  }, [refreshReadModel]);

  const submitTrackedTurnResponse = useCallback(async (turnId: number, submit: () => Promise<boolean>) => {
    setSubmittedTurnId(turnId);
    setCaptureStatusByTurnId((current) => new Map(current).set(turnId, 'waiting'));

    const didSubmit = await submit();
    if (!didSubmit) {
      setSubmittedTurnId(null);
      setCaptureStatusByTurnId((current) => {
        const next = new Map(current);
        next.delete(turnId);
        return next;
      });
    }

    return didSubmit;
  }, []);

  const submitPhaseClosureCommand = useCallback((send: () => Promise<void> | void) => {
    pendingCloseRef.current = true;
    void Promise.resolve(send());
  }, []);

  const effectiveCaptureStatusByTurnId = useMemo(() => {
    const next = new Map(captureStatusByTurnId);
    for (const turnId of pendingCaptureSyncTurnIds) {
      next.set(turnId, 'applying');
    }
    return next;
  }, [captureStatusByTurnId, pendingCaptureSyncTurnIds]);

  return {
    submittedTurnId,
    captureStatusByTurnId: effectiveCaptureStatusByTurnId,
    handleDataPart,
    handleChatFinish,
    submitTrackedTurnResponse,
    submitPhaseClosureCommand,
  };
}
