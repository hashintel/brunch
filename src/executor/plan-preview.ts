import type { ExecutablePlanDraft } from './executable-plan-draft.js';

export interface PlanPreviewVerificationTarget {
  readonly kind: 'criterion';
  readonly target: string;
}

export interface PlanPreviewSpecRequirement {
  readonly item_id: string;
  readonly content: string;
}

export interface PlanPreviewSpecCriterion {
  readonly item_id: string;
  readonly content: string;
  readonly verifies: readonly string[];
}

export interface PlanPreviewSpec {
  readonly spec_id: string;
  readonly requirements: readonly PlanPreviewSpecRequirement[];
  readonly criteria: readonly PlanPreviewSpecCriterion[];
}

export interface PlanPreviewEpic {
  readonly id: string;
  readonly summary: string;
  readonly depends_on: readonly string[];
  readonly verification: readonly [];
  // Old cook Plan also accepts `probe` and `reachability`, but the alpha draft
  // has no truthful boot/probe or host-blind reachability source yet.
}

export interface PlanPreviewSlice {
  readonly id: string;
  readonly epic_id: string;
  readonly scope_id?: string;
  readonly definition: string;
  readonly depends_on: readonly string[];
  readonly verification: readonly PlanPreviewVerificationTarget[];
  readonly derived_from: readonly string[];
  readonly design_context?: readonly { readonly item_id: string; readonly content: string }[];
  readonly verification_context?: readonly { readonly item_id: string; readonly content: string }[];
  // Old cook Plan also accepts `writes`, but the alpha draft has no file-layout
  // authoring source yet. Keep it absent instead of inventing ownership.
}

export interface PlanPreview {
  readonly schemaVersion: 1;
  readonly mode: ExecutablePlanDraft['mode'];
  readonly spec: PlanPreviewSpec;
  readonly epics: readonly PlanPreviewEpic[];
  readonly slices: readonly PlanPreviewSlice[];
  readonly sideEffects: readonly [];
  // Old cook Plan also accepts `profile` and `harnessNotes`; both remain absent
  // until alpha has a profile/toolchain detection or harness-prior-art source.
}

export function previewPlan(draft: ExecutablePlanDraft): PlanPreview {
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
      ...(slice.scopeId ? { scope_id: slice.scopeId } : {}),
      definition: slice.definition,
      depends_on: slice.dependsOn,
      verification: slice.verification.map((target) => ({ kind: target.kind, target: target.target })),
      derived_from: slice.requirementIds,
      ...(slice.designContext.length > 0
        ? {
            design_context: slice.designContext.map((item) => ({
              item_id: item.itemId,
              content: item.content,
            })),
          }
        : {}),
      ...(slice.verificationContext.length > 0
        ? {
            verification_context: slice.verificationContext.map((item) => ({
              item_id: item.itemId,
              content: item.content,
            })),
          }
        : {}),
    })),
    sideEffects: [],
  };
}

function previewSpec(draft: ExecutablePlanDraft): PlanPreviewSpec {
  const requirements = new Map<string, PlanPreviewSpecRequirement>();
  const criteria = new Map<string, PlanPreviewSpecCriterion>();

  for (const slice of draft.slices) {
    const scopedRequirements =
      slice.requirements && slice.requirements.length > 0
        ? slice.requirements
        : slice.requirementIds.map((requirementId) => ({
            itemId: requirementId,
            content: slice.definition,
          }));
    for (const requirement of scopedRequirements) {
      if (!requirements.has(requirement.itemId)) {
        requirements.set(requirement.itemId, {
          item_id: requirement.itemId,
          content: requirement.content,
        });
      }
    }

    for (const target of slice.verification) {
      const verifies = target.verifies && target.verifies.length > 0 ? target.verifies : slice.requirementIds;
      const existing = criteria.get(target.criterionId);
      if (existing) {
        criteria.set(target.criterionId, {
          ...existing,
          verifies: Array.from(new Set([...existing.verifies, ...verifies])),
        });
      } else {
        criteria.set(target.criterionId, {
          item_id: target.criterionId,
          content: target.target,
          verifies: [...verifies],
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
