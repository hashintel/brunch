import { appendFile } from 'node:fs/promises';

import type { TestRunnerPort } from './execution-ports.js';
import { compileExecutorTopology, type ReadyStep, type SchedulerPlan } from './orchestrate-topology.js';
import { appendPetriEvent, inspectPetriTransitionJournal } from './petri-events.js';
import {
  petriMarkingLifecycleProvenance,
  readPetriMarkingSnapshot,
  writePetriMarkingSnapshot,
  type EpicVerificationClaim,
  type PetriMarkingSnapshot,
} from './petri-marking.js';
import { replayTransitionHistory } from './petri-replay.js';
import { readEpicVerificationVerdict } from './report-verdict.js';
import { reportsPath } from './report.js';
import { persistRunMetadata, readRunMetadata, runMetadataPath, type RunMetadata } from './run.js';

type EpicStep = Extract<ReadyStep, { readonly kind: 'epic_integrate' | 'epic_verify' | 'epic_complete' }>;

export type EpicLifecycleResult =
  | {
      readonly status: 'epic_integrated' | 'epic_verified' | 'epic_completed';
      readonly runStatus: RunMetadata['status'];
      readonly advanced: true;
      readonly skipTransition?: true;
      readonly epicVerificationPassed?: string;
    }
  | {
      readonly status:
        | 'missing_run'
        | 'epic_not_ready'
        | 'epic_test_run_failed'
        | 'epic_verification_failed'
        | 'epic_verification_interrupted';
      readonly runStatus: RunMetadata['status'] | 'not_started';
    };

export async function executeEpicLifecycleStep(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly step: EpicStep;
  readonly plan: SchedulerPlan | undefined;
  readonly testRunner: TestRunnerPort;
  readonly currentMarking?: Record<string, number>;
  readonly firedTransitionCount?: number;
  readonly markingSnapshot?: PetriMarkingSnapshot;
  readonly signal?: AbortSignal;
}): Promise<EpicLifecycleResult> {
  const metadataPath = runMetadataPath(args.cwd, args.runId);
  const metadata = await readRunMetadata(metadataPath);
  if (!metadata) return { status: 'missing_run', runStatus: 'not_started' };
  const epic = args.plan?.epics?.find((candidate) => candidate.id === args.step.epicId);
  if (!epic || !metadata.worktreeDir) {
    return { status: 'epic_not_ready', runStatus: metadata.status };
  }
  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);

  switch (args.step.kind) {
    case 'epic_integrate': {
      const memberIds = (args.plan?.slices ?? [])
        .filter((slice) => slice.epic_id === epic.id)
        .map((slice) => slice.id);
      if (!memberIds.every((sliceId) => metadata.completedSliceIds?.includes(sliceId))) {
        return { status: 'epic_not_ready', runStatus: metadata.status };
      }
      await appendFile(
        reportPath,
        `${JSON.stringify({ event: 'epic_integrated', runId: args.runId, epicId: epic.id, status: 'integrated' })}\n`,
        'utf8',
      );
      await persistRunMetadata(metadataPath, {
        ...metadata,
        integratedEpicIds: appendId(metadata.integratedEpicIds, epic.id),
      });
      return { status: 'epic_integrated', runStatus: metadata.status, advanced: true };
    }
    case 'epic_verify': {
      if (!epic.verification?.length || !metadata.integratedEpicIds?.includes(epic.id)) {
        return { status: 'epic_not_ready', runStatus: metadata.status };
      }
      if (args.currentMarking === undefined || args.firedTransitionCount === undefined) {
        return { status: 'epic_not_ready', runStatus: metadata.status };
      }
      const snapshot =
        args.markingSnapshot ?? (await readPetriMarkingSnapshot({ cwd: args.cwd, runId: args.runId }));
      const journal = await readEpicVerificationJournal(args.cwd, args.runId, epic.id);
      if (journal.status !== 'readable') {
        throw new Error(`epic verification journal is ${journal.status}`);
      }
      const claim =
        snapshot?.epicVerificationClaims?.find((candidate) => candidate.epicId === epic.id) ??
        (journal.claimed
          ? {
              epicId: epic.id,
              phase: journal.transitioned ? ('transitioned' as const) : ('claimed' as const),
            }
          : undefined);
      if (claim?.phase === 'transitioned') {
        if (!journal.transitioned) {
          return { status: 'epic_verification_interrupted', runStatus: metadata.status };
        }
        const claimedSnapshot =
          snapshot ?? verificationClaimSnapshot(args, metadata, { epicId: epic.id, phase: 'transitioned' });
        const updated = {
          ...metadata,
          verifiedEpicIds: appendId(metadata.verifiedEpicIds, epic.id),
          epicTransitionHistory: appendId(metadata.epicTransitionHistory, `epic_verify:${epic.id}`),
        };
        await persistRunMetadata(metadataPath, updated);
        await writePetriMarkingSnapshot({
          cwd: args.cwd,
          runId: args.runId,
          snapshot: {
            ...claimedSnapshot,
            lifecycleProvenance: petriMarkingLifecycleProvenance(updated),
            epicVerificationClaims: withoutEpicClaim(claimedSnapshot.epicVerificationClaims, epic.id),
          },
        });
        return {
          status: 'epic_verified',
          runStatus: metadata.status,
          advanced: true,
          skipTransition: true,
        };
      }
      if (claim?.phase === 'claimed') {
        const claimedSnapshot =
          snapshot ?? verificationClaimSnapshot(args, metadata, { epicId: epic.id, phase: 'claimed' });
        const verdict = await readEpicVerificationVerdict({
          reportsPath: reportPath,
          expectedEpicIds: [epic.id],
        });
        if (verdict.status === 'failed') {
          return { status: 'epic_verification_failed', runStatus: metadata.status };
        }
        if (verdict.status === 'missing') {
          return { status: 'epic_verification_interrupted', runStatus: metadata.status };
        }
        if (journal.transitioned) {
          const transitioned = transitionEpicVerificationMarking(args.plan, epic.id, args.currentMarking);
          await writeTransitionedClaim({
            ...args,
            metadata,
            epicId: epic.id,
            currentMarking: transitioned,
            firedTransitionCount: args.firedTransitionCount,
            claims: claimedSnapshot.epicVerificationClaims ?? [],
          });
          const updated = {
            ...metadata,
            verifiedEpicIds: appendId(metadata.verifiedEpicIds, epic.id),
            epicTransitionHistory: appendId(metadata.epicTransitionHistory, `epic_verify:${epic.id}`),
          };
          await persistRunMetadata(metadataPath, updated);
          await writePetriMarkingSnapshot({
            cwd: args.cwd,
            runId: args.runId,
            snapshot: {
              currentMarking: transitioned,
              firedTransitionCount: args.firedTransitionCount + 1,
              lifecycleProvenance: petriMarkingLifecycleProvenance(updated),
              epicVerificationClaims: withoutEpicClaim(claimedSnapshot.epicVerificationClaims, epic.id),
            },
          });
          return {
            status: 'epic_verified',
            runStatus: metadata.status,
            advanced: true,
            skipTransition: true,
          };
        }
        return {
          status: 'epic_verified',
          runStatus: metadata.status,
          advanced: true,
          epicVerificationPassed: epic.id,
        };
      }

      const claims = snapshot?.epicVerificationClaims ?? [];
      await appendPetriEvent({
        cwd: args.cwd,
        runId: args.runId,
        event: {
          kind: 'epic_verification_claimed',
          runId: args.runId,
          runStatus: metadata.status,
          epicId: epic.id,
          step: 'epic_verify',
        },
      });
      await writePetriMarkingSnapshot({
        cwd: args.cwd,
        runId: args.runId,
        snapshot: {
          currentMarking: args.currentMarking,
          firedTransitionCount: args.firedTransitionCount,
          lifecycleProvenance: petriMarkingLifecycleProvenance(metadata),
          epicVerificationClaims: [...claims, { epicId: epic.id, phase: 'claimed' }],
        },
      });
      let result: Awaited<ReturnType<TestRunnerPort['run']>>;
      try {
        result = await args.testRunner.run({
          worktreeDir: metadata.worktreeDir,
          ...(metadata.executionActions ? { executionActions: metadata.executionActions } : {}),
          ...(metadata.verifyTarget ? { verifyTarget: metadata.verifyTarget } : {}),
          ...(args.signal ? { signal: args.signal } : {}),
        });
      } catch (error) {
        await appendEpicTestReport(reportPath, {
          runId: args.runId,
          epicId: epic.id,
          status: 'failed',
          verification: epic.verification,
          reason: 'epic_test_runner_threw',
          message: error instanceof Error ? error.message : 'epic test runner threw',
        });
        return { status: 'epic_test_run_failed', runStatus: metadata.status };
      }
      const status = result.status === 'completed' ? result.verdict : 'failed';
      await appendEpicTestReport(reportPath, {
        runId: args.runId,
        epicId: epic.id,
        status,
        verification: epic.verification,
        ...(result.status === 'completed'
          ? {
              exitCode: result.exitCode,
              ...(result.target ? { target: result.target } : {}),
              ...(result.actions ? { actions: result.actions } : {}),
            }
          : { message: result.message }),
      });
      if (result.status !== 'completed') {
        return { status: 'epic_test_run_failed', runStatus: metadata.status };
      }
      if (result.verdict !== 'passed') {
        return { status: 'epic_verification_failed', runStatus: metadata.status };
      }
      return {
        status: 'epic_verified',
        runStatus: metadata.status,
        advanced: true,
        epicVerificationPassed: epic.id,
      };
    }
    case 'epic_complete': {
      const ready = epic.verification?.length
        ? metadata.verifiedEpicIds?.includes(epic.id)
        : metadata.integratedEpicIds?.includes(epic.id);
      if (!ready) return { status: 'epic_not_ready', runStatus: metadata.status };
      await appendFile(
        reportPath,
        `${JSON.stringify({ event: 'epic_completed', runId: args.runId, epicId: epic.id, status: 'completed' })}\n`,
        'utf8',
      );
      await persistRunMetadata(metadataPath, {
        ...metadata,
        completedEpicIds: appendId(metadata.completedEpicIds, epic.id),
      });
      return { status: 'epic_completed', runStatus: metadata.status, advanced: true };
    }
  }
}

function verificationClaimSnapshot(
  args: {
    readonly currentMarking?: Record<string, number>;
    readonly firedTransitionCount?: number;
  },
  metadata: RunMetadata,
  claim: EpicVerificationClaim,
): PetriMarkingSnapshot {
  if (args.currentMarking === undefined || args.firedTransitionCount === undefined) {
    throw new Error('epic verification authority snapshot is unavailable');
  }
  return {
    currentMarking: args.currentMarking,
    firedTransitionCount: args.firedTransitionCount,
    lifecycleProvenance: petriMarkingLifecycleProvenance(metadata),
    epicVerificationClaims: [claim],
  };
}

async function appendEpicTestReport(reportPath: string, event: Record<string, unknown>): Promise<void> {
  await appendFile(reportPath, `${JSON.stringify({ event: 'epic_test_result', ...event })}\n`, 'utf8');
}

function withoutEpicClaim(
  claims: readonly EpicVerificationClaim[] | undefined,
  epicId: string,
): readonly EpicVerificationClaim[] {
  return (claims ?? []).filter((claim) => claim.epicId !== epicId);
}

function transitionEpicVerificationMarking(
  plan: SchedulerPlan | undefined,
  epicId: string,
  currentMarking: Record<string, number>,
): Record<string, number> {
  const topology = compileExecutorTopology(plan);
  const transition = topology.transitions.find((candidate) => candidate.id === `epic_verify:${epicId}`);
  if (!transition) throw new Error(`missing epic verification transition for ${epicId}`);
  const replay = replayTransitionHistory({ transitions: [transition], initialMarking: currentMarking }, [
    transition.id,
  ]);
  if (!replay) throw new Error(`epic verification transition is not enabled for ${epicId}`);
  return replay.currentMarking;
}

async function writeTransitionedClaim(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly metadata: RunMetadata;
  readonly epicId: string;
  readonly currentMarking: Record<string, number>;
  readonly firedTransitionCount: number;
  readonly claims: readonly EpicVerificationClaim[];
}): Promise<void> {
  await writePetriMarkingSnapshot({
    cwd: args.cwd,
    runId: args.runId,
    snapshot: {
      currentMarking: args.currentMarking,
      firedTransitionCount: args.firedTransitionCount + 1,
      lifecycleProvenance: petriMarkingLifecycleProvenance(args.metadata),
      epicVerificationClaims: args.claims.map((claim) =>
        claim.epicId === args.epicId ? { ...claim, phase: 'transitioned' } : claim,
      ),
    },
  });
}

async function readEpicVerificationJournal(
  cwd: string,
  runId: string,
  epicId: string,
): Promise<
  | { readonly status: 'missing' | 'unavailable' | 'unreadable' }
  | { readonly status: 'readable'; readonly claimed: boolean; readonly transitioned: boolean }
> {
  try {
    const journal = await inspectPetriTransitionJournal({ cwd, runId });
    if (journal.status !== 'readable') return journal;
    let claimed = false;
    let transitioned = false;
    for (const event of journal.events) {
      if (event.kind === 'epic_verification_claimed' && event.epicId === epicId) claimed = true;
      if (event.kind === 'transition_fired' && event.transitionId === `epic_verify:${epicId}`) {
        transitioned = true;
      }
    }
    return { status: 'readable', claimed, transitioned };
  } catch {
    return { status: 'unavailable' };
  }
}

function appendId(ids: readonly string[] | undefined, id: string): readonly string[] {
  return ids?.includes(id) ? ids : [...(ids ?? []), id];
}
