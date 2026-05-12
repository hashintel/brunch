import type {
  ApplyPatchFn,
  DrillDownPatch,
  EdgePatch,
  EditPatch,
} from '@/client/components/patch-list-host.js';
import { queryClient } from '@/client/query-client.js';
import {
  invalidateOpenReconciliationNeeds,
  specificationQueryKeys,
} from '@/client/routes/specification/$id/-specification-data.js';

import { createEdgeRequest, deleteEdgeRequest, editKnowledgeItemRequest } from './edit-api.js';

// Invalidate the entity query domains so the page-visible item content
// re-fetches after an edit applies. The route loader and structured-list
// view subscribe to these query keys; without invalidation the displayed
// content stays stale until the user navigates away and back.
async function invalidateEntityQueriesAfterEdit(specificationId: number): Promise<void> {
  const specId = String(specificationId);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: specificationQueryKeys.entities(specId) }),
    queryClient.invalidateQueries({ queryKey: specificationQueryKeys.entitiesProjectWide(specId) }),
  ]);
}

export function makeEditApplier(specificationId: number): ApplyPatchFn<EditPatch> {
  return async (patch) => {
    const response = await editKnowledgeItemRequest(specificationId, patch.anchor.itemId, {
      content: patch.newContent,
      rationale: patch.newRationale,
    });
    if (response.previousContent === undefined) {
      throw new Error('Edit applier: server reported updated but did not return previousContent');
    }
    const previousContent = response.previousContent;
    const previousRationale = response.previousRationale;
    await invalidateEntityQueriesAfterEdit(specificationId);
    if (response.impact === 'hard') {
      // V3.0 card 2–3 (D139, I112): hard-impact apply mutates source and opens
      // reconciliation_need rows; Pending review surfaces the queue with per-row
      // Resolve. Undo for the source mutation is not wired — the user resolves
      // through the queue. `noUndo: true` keeps canUndo false so the Undo button
      // does not mislead.
      await invalidateOpenReconciliationNeeds(specificationId);
      return {
        undo: async () => {},
        applied: {
          impact: 'hard',
          noUndo: true,
          previousContent,
          previousRationale,
          openedNeedIds: response.openedNeedIds,
        },
      };
    }
    return {
      undo: async () => {
        const undoResponse = await editKnowledgeItemRequest(specificationId, patch.anchor.itemId, {
          content: previousContent,
          rationale: previousRationale,
        });
        await invalidateEntityQueriesAfterEdit(specificationId);
        if (undoResponse.impact === 'hard') {
          await invalidateOpenReconciliationNeeds(specificationId);
        }
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
    if (result.alreadyExisted) {
      return {
        undo: async () => {},
        applied: { created: false, alreadyExisted: true },
      };
    }
    if (!result.created) {
      throw new Error(result.reason ?? 'Edge creation failed');
    }
    return {
      undo: async () => {
        const undoResult = await deleteEdgeRequest(specificationId, {
          fromItemId: patch.anchor.itemId,
          toItemId: patch.targetAnchor.itemId,
          relation: patch.relation,
        });
        if (!undoResult.deleted) {
          throw new Error(undoResult.reason ?? 'Edge deletion failed');
        }
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
