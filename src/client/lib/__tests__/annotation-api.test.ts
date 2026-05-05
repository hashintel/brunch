import { describe, expect, it, vi } from 'vitest';

import type { AnnotatePatch } from '@/client/components/patch-list-host.js';

import { createAnnotationRequest, makeAnnotateApplier, type CreatedAnnotation } from '../annotation-api.js';

function makeMockFetch(response: Partial<CreatedAnnotation> = {}) {
  const fetchMock = vi.fn<typeof fetch>();
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        id: 1,
        specification_id: 1,
        knowledge_item_id: 5,
        summary: 's',
        body: 'b',
        selection_start: null,
        selection_end: null,
        created_at: '2026-05-05T00:00:00Z',
        ...response,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    ),
  );
  return fetchMock;
}

function readBody(init: RequestInit | undefined): Record<string, unknown> {
  return JSON.parse(init?.body as string) as Record<string, unknown>;
}

describe('createAnnotationRequest', () => {
  it('forwards selectionStart/selectionEnd when provided', async () => {
    const fetchMock = makeMockFetch();
    await createAnnotationRequest(
      1,
      {
        itemKind: 'decision',
        itemId: 5,
        summary: 's',
        body: 'b',
        selectionStart: 3,
        selectionEnd: 9,
      },
      { fetch: fetchMock },
    );
    const init = fetchMock.mock.calls[0]?.[1];
    expect(readBody(init)).toMatchObject({
      selectionStart: 3,
      selectionEnd: 9,
    });
  });

  it('omits selection fields when not provided', async () => {
    const fetchMock = makeMockFetch();
    await createAnnotationRequest(
      1,
      { itemKind: 'decision', itemId: 5, summary: 's', body: 'b' },
      { fetch: fetchMock },
    );
    const init = fetchMock.mock.calls[0]?.[1];
    const body = readBody(init);
    expect(body).not.toHaveProperty('selectionStart');
    expect(body).not.toHaveProperty('selectionEnd');
  });
});

describe('makeAnnotateApplier', () => {
  it('passes patch.selectionRange through to the create request', async () => {
    const fetchMock = makeMockFetch({ id: 42 });
    const applier = makeAnnotateApplier(1, { fetch: fetchMock });
    const patch: AnnotatePatch = {
      id: 'p1',
      kind: 'annotate',
      anchor: { kind: 'decision', itemId: 5 },
      summary: 'phrase',
      body: '',
      selectionRange: { start: 2, end: 8 },
      createdAt: 0,
    };
    await applier(patch);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(readBody(init)).toMatchObject({
      selectionStart: 2,
      selectionEnd: 8,
    });
  });

  it('returns the created annotation id under `applied`', async () => {
    const fetchMock = makeMockFetch({ id: 42 });
    const applier = makeAnnotateApplier(1, { fetch: fetchMock });
    const patch: AnnotatePatch = {
      id: 'p1',
      kind: 'annotate',
      anchor: { kind: 'decision', itemId: 5 },
      summary: 'x',
      body: '',
      createdAt: 0,
    };
    const result = (await applier(patch)) as { undo: () => Promise<void>; applied?: unknown };
    expect(result.applied).toEqual({ id: 42 });
  });

  it('invokes onCreated with annotation id and patch when provided', async () => {
    const fetchMock = makeMockFetch({ id: 99 });
    const onCreated = vi.fn<(id: number, patch: AnnotatePatch) => void>();
    const applier = makeAnnotateApplier(1, {
      fetch: fetchMock,
      onCreated,
    });
    const patch: AnnotatePatch = {
      id: 'p1',
      kind: 'annotate',
      anchor: { kind: 'decision', itemId: 5 },
      summary: 'x',
      body: '',
      createdAt: 0,
    };
    await applier(patch);
    expect(onCreated).toHaveBeenCalledWith(99, patch);
  });
});
