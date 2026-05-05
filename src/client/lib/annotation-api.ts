// Client-side fetch wrappers for the annotation server seam (Card A).
// Exposes a factory that produces the `annotate` applier consumed by
// PatchListProvider (Card B); the applier returns an undo handle that
// closes over the created annotation's id.

import type { ApplyPatchFn, AnnotatePatch } from '@/client/components/patch-list-host.js';
import type { KnowledgeKind } from '@/shared/knowledge.js';

export interface CreateAnnotationPayload {
  itemKind: KnowledgeKind;
  itemId: number;
  summary: string;
  body: string;
  selectionStart?: number;
  selectionEnd?: number;
}

export interface CreatedAnnotation {
  id: number;
  specification_id: number;
  knowledge_item_id: number;
  summary: string;
  body: string;
  selection_start: number | null;
  selection_end: number | null;
  created_at: string;
}

export interface AnnotationApiOptions {
  fetch?: typeof fetch;
  onCreated?: (annotationId: number, patch: AnnotatePatch) => void;
}

export async function createAnnotationRequest(
  specificationId: number,
  payload: CreateAnnotationPayload,
  options: AnnotationApiOptions = {},
): Promise<CreatedAnnotation> {
  const fetchImpl = options.fetch ?? fetch;
  const body: Record<string, unknown> = {
    itemKind: payload.itemKind,
    itemId: payload.itemId,
    summary: payload.summary,
    body: payload.body,
  };
  if (payload.selectionStart !== undefined && payload.selectionEnd !== undefined) {
    body.selectionStart = payload.selectionStart;
    body.selectionEnd = payload.selectionEnd;
  }
  const response = await fetchImpl(`/api/specifications/${specificationId}/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`createAnnotation failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as CreatedAnnotation;
}

export async function listAnnotationsForSpecificationRequest(
  specificationId: number,
  options: AnnotationApiOptions = {},
): Promise<CreatedAnnotation[]> {
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(`/api/specifications/${specificationId}/annotations`);
  if (!response.ok) {
    throw new Error(`listAnnotations failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as CreatedAnnotation[];
}

export async function deleteAnnotationRequest(
  annotationId: number,
  options: AnnotationApiOptions = {},
): Promise<void> {
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(`/api/annotations/${annotationId}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`deleteAnnotation failed: ${response.status} ${response.statusText}`);
  }
}

export function makeAnnotateApplier(
  specificationId: number,
  options: AnnotationApiOptions = {},
): ApplyPatchFn<AnnotatePatch> {
  return async (patch) => {
    const created = await createAnnotationRequest(
      specificationId,
      {
        itemKind: patch.anchor.kind,
        itemId: patch.anchor.itemId,
        summary: patch.summary,
        body: patch.body,
        selectionStart: patch.selectionRange?.start,
        selectionEnd: patch.selectionRange?.end,
      },
      options,
    );
    options.onCreated?.(created.id, patch);
    return {
      undo: async () => {
        await deleteAnnotationRequest(created.id, options);
      },
      applied: { id: created.id, summary: created.summary, body: created.body },
    };
  };
}
