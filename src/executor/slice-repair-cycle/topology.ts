import type {
  ExecutorArc,
  ExecutorPlace,
  ExecutorSubnet,
  ExecutorTransition,
  ReadyStep,
} from '../orchestrate-topology.js';
import type { SliceRepairPolicy, SliceRepairStage } from './model.js';

export interface SliceRepairTopologyFragment {
  readonly subnets: readonly ExecutorSubnet[];
  readonly places: readonly ExecutorPlace[];
  readonly transitions: readonly ExecutorTransition[];
}

export function attemptPlaceId(
  stage: SliceRepairStage,
  sliceId: string,
  cycle: number,
  attempt: number,
): string {
  return `slice:${sliceId}:cycle:${cycle}:${stage}_attempt:${attempt}`;
}

export function verifyResultPlaceId(sliceId: string, cycle: number, attempt: number): string {
  return `slice:${sliceId}:cycle:${cycle}:verify_result:${attempt}`;
}

export function verificationPassedPlaceId(sliceId: string, cycle: number): string {
  return `slice:${sliceId}:cycle:${cycle}:verification_passed`;
}

export function verificationFailedPlaceId(sliceId: string, cycle: number): string {
  return `slice:${sliceId}:cycle:${cycle}:verification_failed`;
}

export function attemptExhaustedPlaceId(stage: SliceRepairStage, sliceId: string, cycle: number): string {
  return `slice:${sliceId}:cycle:${cycle}:${stage}_attempts_exhausted`;
}

export function attemptRetryTransitionId(
  stage: SliceRepairStage,
  sliceId: string,
  cycle: number,
  attempt: number,
): string {
  return `${stage}_retry:${sliceId}:cycle:${cycle}:attempt:${attempt}`;
}

export function attemptExhaustedTransitionId(
  stage: SliceRepairStage,
  sliceId: string,
  cycle: number,
): string {
  return `${stage}_exhausted:${sliceId}:cycle:${cycle}`;
}

export function attemptResetTransitionId(stage: SliceRepairStage, sliceId: string, cycle: number): string {
  return `${stage}_reset:${sliceId}:cycle:${cycle}`;
}

export function attemptSuccessTransitionId(
  stage: SliceRepairStage,
  sliceId: string,
  cycle: number,
  attempt: number,
): string {
  const kind = stage === 'agent' ? 'agent_result' : 'test_result_ingested';
  return `${kind}:${sliceId}:cycle:${cycle}:attempt:${attempt}`;
}

export function verifyVerdictTransitionId(
  verdict: 'passed' | 'failed',
  sliceId: string,
  cycle: number,
  attempt: number,
): string {
  return `verify_${verdict}:${sliceId}:cycle:${cycle}:attempt:${attempt}`;
}

export function verifyRepairTransitionId(sliceId: string, sourceCycle: number): string {
  return `verify_repair:${sliceId}:cycle:${sourceCycle}`;
}

export function sliceIntegrationTransitionId(sliceId: string, cycle: number): string {
  return `slice_integrate:${sliceId}:cycle:${cycle}`;
}

export function compileSliceRepairTopology(args: {
  readonly sliceId: string;
  readonly epicId?: string;
  readonly derivedFrom?: readonly string[];
  readonly integratedPlaceId: string;
  readonly policy: SliceRepairPolicy;
}): SliceRepairTopologyFragment {
  const { sliceId, policy } = args;
  const cycles = range(policy.maxRepairCycles);
  const subnets = cycles.flatMap<ExecutorSubnet>((cycle) =>
    (['agent', 'verify'] as const).map((stage) => ({
      id: `attempt:${sliceId}:cycle:${cycle}:${stage}`,
      kind: 'attempt_control',
      sliceId,
      ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
      ...(args.derivedFrom === undefined ? {} : { derivedFrom: args.derivedFrom }),
      transitionIds: [
        ...range(policy.maxStageAttempts).map((attempt) =>
          attemptSuccessTransitionId(stage, sliceId, cycle, attempt),
        ),
        ...(stage === 'verify'
          ? range(policy.maxStageAttempts).flatMap((attempt) => [
              verifyVerdictTransitionId('passed', sliceId, cycle, attempt),
              verifyVerdictTransitionId('failed', sliceId, cycle, attempt),
            ])
          : []),
        ...range(policy.maxStageAttempts - 1).map((attempt) =>
          attemptRetryTransitionId(stage, sliceId, cycle, attempt),
        ),
        attemptExhaustedTransitionId(stage, sliceId, cycle),
        attemptResetTransitionId(stage, sliceId, cycle),
        ...(stage === 'verify'
          ? [
              sliceIntegrationTransitionId(sliceId, cycle),
              ...(cycle < policy.maxRepairCycles ? [verifyRepairTransitionId(sliceId, cycle)] : []),
            ]
          : []),
      ],
    })),
  );
  const places = subnets.flatMap<ExecutorPlace>((subnet) => {
    const { cycle, stage } = subnetIdentity(subnet.id);
    return [
      ...range(policy.maxStageAttempts).flatMap<ExecutorPlace>((attempt) => [
        {
          id: attemptPlaceId(stage, sliceId, cycle, attempt),
          subnetId: subnet.id,
          name: `${stage} cycle ${cycle} attempt ${attempt}`,
        },
        ...(stage === 'verify'
          ? [
              {
                id: verifyResultPlaceId(sliceId, cycle, attempt),
                subnetId: subnet.id,
                name: `verify cycle ${cycle} result ${attempt}`,
              },
            ]
          : []),
      ]),
      {
        id: attemptExhaustedPlaceId(stage, sliceId, cycle),
        subnetId: subnet.id,
        name: `${stage} cycle ${cycle} attempts exhausted`,
      },
      ...(stage === 'verify'
        ? [
            {
              id: verificationPassedPlaceId(sliceId, cycle),
              subnetId: subnet.id,
              name: `verification cycle ${cycle} passed`,
            },
            {
              id: verificationFailedPlaceId(sliceId, cycle),
              subnetId: subnet.id,
              name: `verification cycle ${cycle} failed`,
            },
          ]
        : []),
    ];
  });
  const transitions = subnets.flatMap<ExecutorTransition>((subnet) => {
    const { cycle, stage } = subnetIdentity(subnet.id);
    return [
      ...range(policy.maxStageAttempts).map<ExecutorTransition>((attempt) => ({
        id: attemptSuccessTransitionId(stage, sliceId, cycle, attempt),
        subnetId: subnet.id,
        ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
        ...(args.derivedFrom === undefined ? {} : { derivedFrom: args.derivedFrom }),
        step: sliceStep(stage === 'agent' ? 'agent_result' : 'test_result', args),
        inputArcs: [arc(attemptPlaceId(stage, sliceId, cycle, attempt))],
        outputArcs: [
          arc(
            stage === 'agent'
              ? attemptPlaceId('verify', sliceId, cycle, 1)
              : verifyResultPlaceId(sliceId, cycle, attempt),
          ),
        ],
        guard: { kind: 'active_slice', sliceId },
        contract: { kind: 'mechanical', lane: 'attempt' },
      })),
      ...(stage === 'verify'
        ? range(policy.maxStageAttempts).flatMap<ExecutorTransition>((attempt) =>
            (['passed', 'failed'] as const).map((verdict) => ({
              id: verifyVerdictTransitionId(verdict, sliceId, cycle, attempt),
              subnetId: subnet.id,
              ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
              ...(args.derivedFrom === undefined ? {} : { derivedFrom: args.derivedFrom }),
              inputArcs: [arc(verifyResultPlaceId(sliceId, cycle, attempt))],
              outputArcs: [
                arc(
                  verdict === 'passed'
                    ? verificationPassedPlaceId(sliceId, cycle)
                    : verificationFailedPlaceId(sliceId, cycle),
                ),
              ],
              contract: { kind: 'structural', lane: 'attempt' },
            })),
          )
        : []),
      ...range(policy.maxStageAttempts - 1).map<ExecutorTransition>((attempt) => ({
        id: attemptRetryTransitionId(stage, sliceId, cycle, attempt),
        subnetId: subnet.id,
        inputArcs: [arc(attemptPlaceId(stage, sliceId, cycle, attempt))],
        outputArcs: [arc(attemptPlaceId(stage, sliceId, cycle, attempt + 1))],
        contract: { kind: 'structural', lane: 'attempt' },
      })),
      {
        id: attemptExhaustedTransitionId(stage, sliceId, cycle),
        subnetId: subnet.id,
        inputArcs: [arc(attemptPlaceId(stage, sliceId, cycle, policy.maxStageAttempts))],
        outputArcs: [arc(attemptExhaustedPlaceId(stage, sliceId, cycle))],
        contract: { kind: 'structural', lane: 'attempt' },
      },
      {
        id: attemptResetTransitionId(stage, sliceId, cycle),
        subnetId: subnet.id,
        inputArcs: [arc(attemptExhaustedPlaceId(stage, sliceId, cycle))],
        outputArcs: [arc(attemptPlaceId(stage, sliceId, cycle, 1))],
        contract: { kind: 'structural', lane: 'attempt' },
      },
      ...(stage === 'verify'
        ? [
            {
              id: sliceIntegrationTransitionId(sliceId, cycle),
              subnetId: subnet.id,
              ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
              ...(args.derivedFrom === undefined ? {} : { derivedFrom: args.derivedFrom }),
              step: sliceStep('slice_integrate', args),
              inputArcs: [arc(verificationPassedPlaceId(sliceId, cycle))],
              outputArcs: [arc(args.integratedPlaceId)],
              guard: { kind: 'active_slice' as const, sliceId },
              contract: { kind: 'mechanical' as const, lane: 'slice' as const },
            },
            ...(cycle < policy.maxRepairCycles
              ? [
                  {
                    id: verifyRepairTransitionId(sliceId, cycle),
                    subnetId: subnet.id,
                    ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
                    ...(args.derivedFrom === undefined ? {} : { derivedFrom: args.derivedFrom }),
                    inputArcs: [arc(verificationFailedPlaceId(sliceId, cycle))],
                    outputArcs: [arc(attemptPlaceId('agent', sliceId, cycle + 1, 1))],
                    contract: { kind: 'structural' as const, lane: 'attempt' as const },
                  } satisfies ExecutorTransition,
                ]
              : []),
          ]
        : []),
    ];
  });
  return { subnets, places, transitions };
}

function sliceStep(
  kind: 'agent_result' | 'test_result' | 'slice_integrate',
  args: { readonly sliceId: string; readonly epicId?: string; readonly derivedFrom?: readonly string[] },
): ReadyStep {
  return {
    kind,
    sliceId: args.sliceId,
    ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
    ...(args.derivedFrom === undefined ? {} : { derivedFrom: args.derivedFrom }),
  };
}

function subnetIdentity(id: string): { readonly cycle: number; readonly stage: SliceRepairStage } {
  const parts = id.split(':');
  return { cycle: Number(parts[3]), stage: parts[4] as SliceRepairStage };
}

function arc(placeId: string): ExecutorArc {
  return { placeId, weight: 1 };
}

function range(length: number): number[] {
  return Array.from({ length }, (_, index) => index + 1);
}
