import type { ExecutionPlanOutline } from './execute-plan-outline.js';

export interface ExecutablePlanDraftVerificationTarget {
  readonly kind: 'criterion';
  readonly target: string;
  readonly criterionId: string;
}

export interface ExecutablePlanDraftSlice {
  readonly id: string;
  readonly epicId: string;
  readonly title: string;
  readonly definition: string;
  readonly requirementId: string;
  readonly dependsOn: readonly string[];
  readonly verification: readonly ExecutablePlanDraftVerificationTarget[];
}

export interface ExecutablePlanDraftEpic {
  readonly id: string;
  readonly title: string;
  readonly sliceIds: readonly string[];
  readonly dependsOn: readonly string[];
}

export interface ExecutablePlanDraft {
  readonly schemaVersion: 1;
  readonly specId: string;
  readonly mode: ExecutionPlanOutline['mode'];
  readonly epics: readonly ExecutablePlanDraftEpic[];
  readonly slices: readonly ExecutablePlanDraftSlice[];
  readonly sideEffects: readonly [];
}

export function draftExecutablePlan(outline: ExecutionPlanOutline): ExecutablePlanDraft {
  const epics = outline.frontiers.map((frontier) => ({
    id: frontier.id,
    title: frontier.title,
    sliceIds: frontier.tasks.map((task) => task.id),
    dependsOn: [],
  }));
  const slices = outline.frontiers.flatMap((frontier) =>
    frontier.tasks.map((task) => ({
      id: task.id,
      epicId: frontier.id,
      title: task.title,
      definition: task.summary,
      requirementId: task.requirementId,
      dependsOn: [],
      verification: task.acceptanceCriteria.map((criterion) => ({
        kind: 'criterion' as const,
        criterionId: criterion.criterionId,
        target: criterion.content,
      })),
    })),
  );

  return {
    schemaVersion: 1,
    specId: outline.specId,
    mode: outline.mode,
    epics,
    slices,
    sideEffects: [],
  };
}
