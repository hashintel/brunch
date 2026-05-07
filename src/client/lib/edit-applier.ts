import type {
  ApplyPatchFn,
  DrillDownPatch,
  EdgePatch,
  EditPatch,
} from '@/client/components/patch-list-host.js';

import { createEdgeRequest, deleteEdgeRequest, editKnowledgeItemRequest } from './edit-api.js';

export function makeEditApplier(specificationId: number): ApplyPatchFn<EditPatch> {
  return async (patch) => {
    const response = await editKnowledgeItemRequest(specificationId, patch.anchor.itemId, {
      content: patch.newContent,
      rationale: patch.newRationale,
    });
    if (!response.updated) {
      throw new Error('Edit deferred: hard impact detected — apply via V3 cascade preview');
    }
    if (response.previousContent === undefined) {
      throw new Error('Edit applier: server reported updated but did not return previousContent');
    }
    const previousContent = response.previousContent;
    const previousRationale = response.previousRationale;
    return {
      undo: async () => {
        await editKnowledgeItemRequest(specificationId, patch.anchor.itemId, {
          content: previousContent,
          rationale: previousRationale ?? undefined,
        });
      },
      applied: { impact: response.impact, previousContent, previousRationale },
    };
  };
}

export function makeEdgeApplier(specificationId: number): ApplyPatchFn<EdgePatch> {
  return async (patch) => {
    const result = await createEdgeRequest(specificationId, {
      fromItemId: patch.anchor.itemId,
      toItemId: patch.targetAnchor.itemId,
      relation: patch.relation,
    });
    if (!result.created) {
      throw new Error(result.reason ?? 'Edge creation failed');
    }
    return {
      undo: async () => {
        await deleteEdgeRequest(specificationId, {
          fromItemId: patch.anchor.itemId,
          toItemId: patch.targetAnchor.itemId,
          relation: patch.relation,
        });
      },
      applied: { created: true },
    };
  };
}

export function makeDrillDownApplier(_specificationId: number): ApplyPatchFn<DrillDownPatch> {
  return async (_patch) => {
    throw new Error(
      'drill-down patches are not yet implemented in V2; the patch ontology accepts them but the applier lands with V3',
    );
  };
}
