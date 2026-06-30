import type { ExecutablePlanDraft } from './executable-plan-draft.js';

export interface CookPlanPreviewVerificationTarget {
  readonly kind: 'criterion';
  readonly target: string;
}

export interface CookPlanPreviewEpic {
  readonly id: string;
  readonly summary: string;
  readonly depends_on: readonly string[];
  readonly verification: readonly [];
}

export interface CookPlanPreviewSlice {
  readonly id: string;
  readonly epic_id: string;
  readonly definition: string;
  readonly depends_on: readonly string[];
  readonly verification: readonly CookPlanPreviewVerificationTarget[];
  readonly derived_from: readonly string[];
}

export interface CookPlanPreview {
  readonly schemaVersion: 1;
  readonly mode: ExecutablePlanDraft['mode'];
  readonly epics: readonly CookPlanPreviewEpic[];
  readonly slices: readonly CookPlanPreviewSlice[];
  readonly sideEffects: readonly [];
}

export function previewCookPlan(draft: ExecutablePlanDraft): CookPlanPreview {
  return {
    schemaVersion: 1,
    mode: draft.mode,
    epics: draft.epics.map((epic) => ({
      id: epic.id,
      summary: epic.title,
      depends_on: epic.dependsOn,
      verification: [],
    })),
    slices: draft.slices.map((slice) => ({
      id: slice.id,
      epic_id: slice.epicId,
      definition: slice.definition,
      depends_on: slice.dependsOn,
      verification: slice.verification.map((target) => ({ kind: target.kind, target: target.target })),
      derived_from: [slice.requirementId],
    })),
    sideEffects: [],
  };
}
