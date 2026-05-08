import type {
  ApplyPatchFn,
  DrillDownPatch,
  EdgePatch,
  EditPatch,
} from '@/client/components/patch-list-host.js';
import { queryClient } from '@/client/query-client.js';
import { specificationQueryKeys } from '@/client/routes/specification/$id/-specification-data.js';

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
    if (response.impact === 'hard') {
      // V3.0 card 1: hard-impact apply now mutates the source and opens
      // reconciliation_need rows on the server (D139, I112). The patch list
      // overlay's Pending review surface lands in card 2; until then the
      // deferred banner stays as the user-visible signal so the patch leaves
      // staged cleanly. Undo is a no-op for the deferred-banner phase — card 2
      // wires real resolution actions through the queue. Entity queries are
      // invalidated because content did mutate.
      await invalidateEntityQueriesAfterEdit(specificationId);
      return {
        undo: async () => {},
        applied: {
          deferred: true,
          impact: response.impact,
          message: 'Hard impact — cascade pending review',
        },
      };
    }
    if (response.previousContent === undefined) {
      throw new Error('Edit applier: server reported updated but did not return previousContent');
    }
    const previousContent = response.previousContent;
    const previousRationale = response.previousRationale;
    await invalidateEntityQueriesAfterEdit(specificationId);
    return {
      undo: async () => {
        const undoResponse = await editKnowledgeItemRequest(specificationId, patch.anchor.itemId, {
          content: previousContent,
          rationale: previousRationale,
        });
        if (undoResponse.impact === 'hard') {
          throw new Error(
            'Edit undo blocked: restore reclassified as hard-impact cascade — resolve via patch list',
          );
        }
        await invalidateEntityQueriesAfterEdit(specificationId);
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
