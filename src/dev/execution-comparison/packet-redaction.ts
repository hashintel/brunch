import type { ExecutionAttempt } from './artifact-contract.js';
import type { ExecutionCasePublicContract } from './case-contract.js';

export interface VisibleExecutionEvent {
  readonly sequence: number;
  readonly elapsedMs: number;
  readonly actor: 'controller' | 'target' | 'product';
  readonly action: string;
  readonly response: string;
  readonly status: 'working' | 'ready' | 'failed' | 'exhausted' | 'invalid';
}

export function createMaskedOutcomePacket(input: {
  readonly label: string;
  readonly attempt: ExecutionAttempt;
  readonly publicContract: ExecutionCasePublicContract;
  readonly finalTree: string;
  readonly finalDiff: string;
}) {
  return {
    schemaVersion: 1 as const,
    pass: 'masked_outcome' as const,
    label: input.label,
    caseId: input.attempt.caseId,
    publicPacketSha256: input.attempt.publicPacketSha256,
    publicContract: input.publicContract,
    terminal: { outcome: input.attempt.terminal.outcome },
    validity: { status: input.attempt.validity.status },
    finalTree: input.finalTree,
    finalDiff: input.finalDiff,
    mechanical: {
      commands: input.attempt.commands.map((command) => ({
        id: command.id,
        status: command.status,
        exitCode: command.exitCode,
      })),
      browser: { status: input.attempt.browser.status },
    },
    cleanup: {
      status: input.attempt.cleanup.status,
      liveProcesses: input.attempt.cleanup.liveProcesses,
      liveSessions: input.attempt.cleanup.liveSessions,
    },
  };
}

export function createUnblindedProcessPacket(input: {
  readonly attempt: ExecutionAttempt;
  readonly publicContract: ExecutionCasePublicContract;
  readonly visibleEvents: readonly VisibleExecutionEvent[];
}) {
  return {
    schemaVersion: 1 as const,
    pass: 'unblinded_process' as const,
    lane: input.attempt.lane,
    product: input.attempt.versions.product,
    caseId: input.attempt.caseId,
    publicPacketSha256: input.attempt.publicPacketSha256,
    publicContract: input.publicContract,
    budget: input.attempt.budget,
    configuration: {
      provider: input.attempt.versions.provider,
      model: input.attempt.versions.model,
      harness: input.attempt.versions.harness,
      actorRecipe: input.attempt.versions.actorRecipe,
    },
    visibleEvents: input.visibleEvents.map((event) => ({
      sequence: event.sequence,
      elapsedMs: event.elapsedMs,
      actor: event.actor,
      action: event.action,
      response: event.response,
      status: event.status,
    })),
    interventions: input.attempt.interventions.map((intervention) => ({
      index: intervention.index,
      kind: intervention.kind,
      description: intervention.description,
      at: intervention.at,
    })),
    terminal: {
      outcome: input.attempt.terminal.outcome,
      reason: input.attempt.terminal.reason,
    },
    validity: input.attempt.validity,
    cleanup: input.attempt.cleanup,
  };
}
