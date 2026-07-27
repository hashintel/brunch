import type { ChatStatus } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  SpecificationLanding,
  SpecificationStateTurn,
  WorkflowPhase,
  WorkflowState,
} from '@/shared/api-types.js';
import { getCurrentOpenPhase, getNextActivePhase } from '@/shared/phase-descriptors.js';
import type { PhaseIntentRequest } from '@/shared/phase-intents.js';
import { toStructuralArtifactTurnIdSet, turnNeedsObserverCapture } from '@/shared/specification-state.js';

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

function setEquals<T>(left: ReadonlySet<T>, right: ReadonlySet<T>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

function mapEquals<K, V>(left: ReadonlyMap<K, V>, right: ReadonlyMap<K, V>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const [key, value] of left) {
    if (right.get(key) !== value) {
      return false;
    }
  }

  return true;
}

function getDeferredObserverCaptureTurnIds(
  turns: readonly SpecificationStateTurn[],
  structuralArtifactTurnIds: ReadonlySet<number>,
): Set<number> {
  return new Set(
    turns.filter((turn) => turnNeedsObserverCapture(turn, structuralArtifactTurnIds)).map((turn) => turn.id),
  );
}

function getAutoObserverCaptureTurnIds({
  turns,
  workflow,
  structuralArtifactTurnIds,
}: {
  turns: readonly SpecificationStateTurn[];
  workflow: WorkflowState;
  structuralArtifactTurnIds: ReadonlySet<number>;
}): Set<number> {
  return new Set(
    turns
      .filter((turn) => {
        if (!turnNeedsObserverCapture(turn, structuralArtifactTurnIds)) {
          return false;
        }

        const phaseState = workflow.phases[turn.phase];
        return (
          phaseState.status === 'in_progress' && phaseState.turnId !== null && phaseState.turnId !== turn.id
        );
      })
      .map((turn) => turn.id),
  );
}

// Turns that should show the trailing "Still thinking…" capture state: deferred captures whose
// phase is still open. A closed phase never fires another capture, so its uncaptured turns must
// settle to a final state rather than spin forever.
function getTrailingObserverCaptureTurnIds({
  turns,
  workflow,
  structuralArtifactTurnIds,
}: {
  turns: readonly SpecificationStateTurn[];
  workflow: WorkflowState;
  structuralArtifactTurnIds: ReadonlySet<number>;
}): Set<number> {
  return new Set(
    turns
      .filter(
        (turn) =>
          turnNeedsObserverCapture(turn, structuralArtifactTurnIds) &&
          workflow.phases[turn.phase].status === 'in_progress',
      )
      .map((turn) => turn.id),
  );
}

export function resetSpecificationLifecycleRegistryForTesting() {
  autoPhaseIntentRegistry.clear();
}

function markAutoPhaseIntentFailed(specificationId: number, autoKey: string) {
  const latestEntry = autoPhaseIntentRegistry.get(specificationId);
  if (latestEntry?.key === autoKey) {
    autoPhaseIntentRegistry.set(specificationId, {
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

export interface SpecificationRuntimeLifecycle {
  readonly submittedTurnId: number | null;
  readonly captureStatusByTurnId: ReadonlyMap<number, CaptureStatus>;
  readonly handleObserverResult: (
    dataPart: { type: string; data?: unknown },
    sync: () => Promise<void>,
  ) => void;
  readonly handleChatFinish: () => void;
  readonly submitTrackedTurnResponse: (
    turn: Pick<SpecificationStateTurn, 'id' | 'phase'>,
    submit: () => Promise<boolean>,
  ) => Promise<boolean>;
  readonly submitPhaseClosureCommand: (send: () => Promise<void> | void) => void;
}

export function useSpecificationRuntimeLifecycle({
  specificationId,
  phase,
  workflow,
  turns,
  structuralArtifactTurnIds: rawStructuralIds,
  refreshReadModel,
  refreshEntities,
  navigateToPhase,
}: {
  specificationId: number;
  phase: WorkflowPhase;
  workflow: WorkflowState;
  turns: readonly SpecificationStateTurn[];
  structuralArtifactTurnIds?: readonly number[];
  refreshReadModel: () => Promise<void>;
  refreshEntities: () => Promise<void>;
  navigateToPhase: (phase: WorkflowPhase) => Promise<void> | void;
}): SpecificationRuntimeLifecycle {
  const [submittedTurnId, setSubmittedTurnId] = useState<number | null>(null);
  const [captureStatusByTurnId, setCaptureStatusByTurnId] = useState<Map<number, CaptureStatus>>(
    () => new Map(),
  );
  const [pendingCaptureTurnIds, setPendingCaptureTurnIds] = useState<Set<number>>(() => new Set());
  const [failedCaptureTurnIds, setFailedCaptureTurnIds] = useState<Set<number>>(() => new Set());
  const [inFlightCaptureTurnId, setInFlightCaptureTurnId] = useState<number | null>(null);
  const [pendingCloseNavigation, setPendingCloseNavigation] = useState(false);
  const pendingCloseRef = useRef(false);

  const structuralArtifactTurnIds = useMemo(
    () => toStructuralArtifactTurnIdSet(rawStructuralIds),
    [rawStructuralIds],
  );
  const deferredObserverCaptureTurnIds = useMemo(
    () => getDeferredObserverCaptureTurnIds(turns, structuralArtifactTurnIds),
    [turns, structuralArtifactTurnIds],
  );
  const autoObserverCaptureTurnIds = useMemo(
    () => getAutoObserverCaptureTurnIds({ turns, workflow, structuralArtifactTurnIds }),
    [turns, workflow, structuralArtifactTurnIds],
  );
  const trailingObserverCaptureTurnIds = useMemo(
    () => getTrailingObserverCaptureTurnIds({ turns, workflow, structuralArtifactTurnIds }),
    [turns, workflow, structuralArtifactTurnIds],
  );

  useEffect(() => {
    setSubmittedTurnId(null);
    setCaptureStatusByTurnId(new Map());
    setPendingCaptureTurnIds(new Set());
    setFailedCaptureTurnIds(new Set());
    setInFlightCaptureTurnId(null);
    setPendingCloseNavigation(false);
    pendingCloseRef.current = false;
  }, [specificationId]);

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
    if (!pendingCloseNavigation || workflow.phases[phase].status !== 'closed') {
      return;
    }

    setPendingCloseNavigation(false);
    const nextPhase = getNextActivePhase(workflow.phases, phase);
    if (nextPhase) {
      void navigateToPhase(nextPhase);
    }
  }, [navigateToPhase, pendingCloseNavigation, phase, workflow]);

  useEffect(() => {
    setCaptureStatusByTurnId((current) => {
      const next = new Map<number, CaptureStatus>();
      for (const turnId of deferredObserverCaptureTurnIds) {
        const isApplying = current.get(turnId) === 'applying';
        // Only keep the trailing spinner while a capture is in flight or its phase is still open.
        // Closed phases never capture again, so their uncaptured turns settle instead of spinning.
        if (!isApplying && !trailingObserverCaptureTurnIds.has(turnId)) {
          continue;
        }
        next.set(turnId, isApplying ? 'applying' : 'waiting');
      }
      return mapEquals(current, next) ? current : next;
    });

    setPendingCaptureTurnIds((current) => {
      const next = new Set<number>();
      for (const turnId of autoObserverCaptureTurnIds) {
        if (turnId !== inFlightCaptureTurnId && !failedCaptureTurnIds.has(turnId)) {
          next.add(turnId);
        }
      }
      return setEquals(current, next) ? current : next;
    });

    if (inFlightCaptureTurnId !== null && !deferredObserverCaptureTurnIds.has(inFlightCaptureTurnId)) {
      setInFlightCaptureTurnId(null);
    }

    setFailedCaptureTurnIds((current) => {
      const next = new Set([...current].filter((turnId) => deferredObserverCaptureTurnIds.has(turnId)));
      return setEquals(current, next) ? current : next;
    });
  }, [
    autoObserverCaptureTurnIds,
    deferredObserverCaptureTurnIds,
    trailingObserverCaptureTurnIds,
    failedCaptureTurnIds,
    inFlightCaptureTurnId,
  ]);

  useEffect(() => {
    if (inFlightCaptureTurnId !== null || pendingCaptureTurnIds.size === 0) {
      return;
    }

    const [nextTurnId] = pendingCaptureTurnIds;
    if (nextTurnId === undefined) {
      return;
    }

    setPendingCaptureTurnIds((current) => {
      const next = new Set(current);
      next.delete(nextTurnId);
      return next;
    });
    setInFlightCaptureTurnId(nextTurnId);
    setCaptureStatusByTurnId((current) => new Map(current).set(nextTurnId, 'applying'));

    void Promise.resolve(
      fetch(`/api/specifications/${specificationId}/turns/${nextTurnId}/observer-capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to capture observer result');
        }

        await Promise.all([refreshReadModel(), refreshEntities()]);
        setFailedCaptureTurnIds((current) => {
          if (!current.has(nextTurnId)) {
            return current;
          }

          const next = new Set(current);
          next.delete(nextTurnId);
          return next;
        });
      })
      .catch(() => {
        setFailedCaptureTurnIds((current) => new Set(current).add(nextTurnId));
      })
      .finally(() => {
        setInFlightCaptureTurnId((current) => (current === nextTurnId ? null : current));
      });
  }, [inFlightCaptureTurnId, pendingCaptureTurnIds, refreshEntities, refreshReadModel, specificationId]);

  const handleObserverResult = useCallback(
    (dataPart: { type: string; data?: unknown }, sync: () => Promise<void>) => {
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
      void sync().finally(() => {
        setCaptureStatusByTurnId((current) => {
          if (!current.has(observerTurnId)) {
            return current;
          }

          const next = new Map(current);
          next.delete(observerTurnId);
          return next;
        });
      });
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

  const submitTrackedTurnResponse = useCallback(
    async (turn: Pick<SpecificationStateTurn, 'id' | 'phase'>, submit: () => Promise<boolean>) => {
      const turnId = turn.id;

      setSubmittedTurnId(turnId);
      setFailedCaptureTurnIds((current) => {
        if (!current.has(turnId)) {
          return current;
        }

        const next = new Set(current);
        next.delete(turnId);
        return next;
      });
      setCaptureStatusByTurnId((current) => new Map(current).set(turnId, 'waiting'));

      const didSubmit = await submit();
      if (!didSubmit) {
        setSubmittedTurnId(null);
        setCaptureStatusByTurnId((current) => {
          if (!current.has(turnId)) {
            return current;
          }

          const next = new Map(current);
          next.delete(turnId);
          return next;
        });
        setPendingCaptureTurnIds((current) => {
          if (!current.has(turnId)) {
            return current;
          }

          const next = new Set(current);
          next.delete(turnId);
          return next;
        });
        return didSubmit;
      }

      setPendingCaptureTurnIds((current) => new Set(current).add(turnId));
      return didSubmit;
    },
    [],
  );

  const submitPhaseClosureCommand = useCallback((send: () => Promise<void> | void) => {
    pendingCloseRef.current = true;
    void Promise.resolve(send());
  }, []);

  return {
    submittedTurnId,
    captureStatusByTurnId,
    handleObserverResult,
    handleChatFinish,
    submitTrackedTurnResponse,
    submitPhaseClosureCommand,
  };
}
