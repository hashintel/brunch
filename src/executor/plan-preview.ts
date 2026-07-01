import type { ExecutablePlanDraft } from './executable-plan-draft.js';

export interface CookPlanPreviewVerificationTarget {
  readonly kind: 'criterion';
  readonly target: string;
}

export interface CookPlanPreviewSpecRequirement {
  readonly item_id: string;
  readonly content: string;
}

export interface CookPlanPreviewSpecCriterion {
  readonly item_id: string;
  readonly content: string;
  readonly verifies: readonly string[];
}

export interface CookPlanPreviewSpec {
  readonly spec_id: string;
  readonly requirements: readonly CookPlanPreviewSpecRequirement[];
  readonly criteria: readonly CookPlanPreviewSpecCriterion[];
}

export interface CookPlanPreviewEpic {
  readonly id: string;
  readonly summary: string;
  readonly depends_on: readonly string[];
  readonly verification: readonly [];
  // Old cook Plan also accepts `probe` and `reachability`, but the alpha draft
  // has no truthful boot/probe or host-blind reachability source yet.
}

export interface CookPlanPreviewSlice {
  readonly id: string;
  readonly epic_id: string;
  readonly definition: string;
  readonly depends_on: readonly string[];
  readonly verification: readonly CookPlanPreviewVerificationTarget[];
  readonly derived_from: readonly string[];
  // Old cook Plan also accepts `writes`, but the alpha draft has no file-layout
  // authoring source yet. Keep it absent instead of inventing ownership.
}

export interface CookPlanPreview {
  readonly schemaVersion: 1;
  readonly mode: ExecutablePlanDraft['mode'];
  readonly spec: CookPlanPreviewSpec;
  readonly epics: readonly CookPlanPreviewEpic[];
  readonly slices: readonly CookPlanPreviewSlice[];
  readonly sideEffects: readonly [];
  // Old cook Plan also accepts `profile` and `harnessNotes`; both remain absent
  // until alpha has a profile/toolchain detection or harness-prior-art source.
}

export function previewCookPlan(draft: ExecutablePlanDraft): CookPlanPreview {
  return {
    schemaVersion: 1,
    mode: draft.mode,
    spec: previewSpec(draft),
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

function previewSpec(draft: ExecutablePlanDraft): CookPlanPreviewSpec {
  const requirements = new Map<string, CookPlanPreviewSpecRequirement>();
  const criteria = new Map<string, CookPlanPreviewSpecCriterion>();

  for (const slice of draft.slices) {
    if (!requirements.has(slice.requirementId)) {
      requirements.set(slice.requirementId, { item_id: slice.requirementId, content: slice.definition });
    }

    for (const target of slice.verification) {
      const existing = criteria.get(target.criterionId);
      if (existing) {
        criteria.set(target.criterionId, {
          ...existing,
          verifies: Array.from(new Set([...existing.verifies, slice.requirementId])),
        });
      } else {
        criteria.set(target.criterionId, {
          item_id: target.criterionId,
          content: target.target,
          verifies: [slice.requirementId],
        });
      }
    }
  }

  return {
    spec_id: draft.specId,
    requirements: Array.from(requirements.values()),
    criteria: Array.from(criteria.values()),
  };
}
