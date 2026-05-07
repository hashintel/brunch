// Client-side fetch wrappers for edit and edge server routes (Side-chat V2).

export interface EditItemRequest {
  content: string;
  rationale?: string | null;
}

export type EditItemResponse =
  | {
      impact: 'none' | 'soft';
      affectedItems: Array<{ id: number; kind: string; referenceCode: string; content: string }>;
      updated: true;
      previousContent: string;
      previousRationale: string | null;
    }
  | {
      impact: 'hard';
      affectedItems: Array<{ id: number; kind: string; referenceCode: string; content: string }>;
      updated: false;
    };

export async function editKnowledgeItemRequest(
  specificationId: number,
  itemId: number,
  body: EditItemRequest,
): Promise<EditItemResponse> {
  const response = await fetch(`/api/specifications/${specificationId}/knowledge-items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`editKnowledgeItem failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as EditItemResponse;
}

export interface EdgeMutationRequest {
  fromItemId: number;
  toItemId: number;
  relation: string;
}

export type CreateEdgeResponse =
  | { created: true; alreadyExisted?: false; reason?: never }
  | { created: false; alreadyExisted: true; reason?: never }
  | { created: false; alreadyExisted?: false; reason?: string };

export async function createEdgeRequest(
  specificationId: number,
  body: EdgeMutationRequest,
): Promise<CreateEdgeResponse> {
  const response = await fetch(`/api/specifications/${specificationId}/knowledge-edges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`createEdge failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as CreateEdgeResponse;
}

export async function deleteEdgeRequest(
  specificationId: number,
  body: EdgeMutationRequest,
): Promise<{ deleted: boolean; reason?: string }> {
  const response = await fetch(`/api/specifications/${specificationId}/knowledge-edges`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`deleteEdge failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as { deleted: boolean; reason?: string };
}
