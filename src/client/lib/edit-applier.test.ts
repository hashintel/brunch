import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DrillDownPatch, EdgePatch, EditPatch } from '@/client/components/patch-list-host.js';

import { makeDrillDownApplier, makeEdgeApplier, makeEditApplier } from './edit-applier.js';

const SPEC_ID = 1;

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeEditPatch(overrides?: Partial<EditPatch>): EditPatch {
  return {
    id: 'patch-edit-1',
    kind: 'edit',
    summary: 'edit summary',
    anchor: { kind: 'goal', itemId: 42 },
    newContent: 'New content',
    newRationale: 'New rationale',
    createdAt: 0,
    ...overrides,
  } as EditPatch;
}

function makeEdgePatch(overrides?: Partial<EdgePatch>): EdgePatch {
  return {
    id: 'patch-edge-1',
    kind: 'edge',
    summary: 'edge summary',
    anchor: { kind: 'criterion', itemId: 7 },
    targetAnchor: { kind: 'requirement', itemId: 9 },
    relation: 'verifies',
    createdAt: 0,
    ...overrides,
  } as EdgePatch;
}

function makeDrillDownPatch(overrides?: Partial<DrillDownPatch>): DrillDownPatch {
  return {
    id: 'patch-drill-1',
    kind: 'drill-down',
    summary: 'drill summary',
    anchor: { kind: 'goal', itemId: 42 },
    focusArea: 'observability',
    createdAt: 0,
    ...overrides,
  } as DrillDownPatch;
}

describe('makeEditApplier', () => {
  it('PATCHes content+rationale and returns an undo that re-PATCHes the previous values', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          impact: 'soft',
          affectedItems: [],
          updated: true,
          previousContent: 'Old content',
          previousRationale: 'Old rationale',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          impact: 'soft',
          affectedItems: [],
          updated: true,
          previousContent: 'New content',
          previousRationale: 'New rationale',
        }),
      );

    const applier = makeEditApplier(SPEC_ID);
    const patch = makeEditPatch();

    const result = await applier(patch);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/specifications/${SPEC_ID}/knowledge-items/${patch.anchor.itemId}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ content: 'New content', rationale: 'New rationale' }),
      }),
    );

    await result.undo();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/specifications/${SPEC_ID}/knowledge-items/${patch.anchor.itemId}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ content: 'Old content', rationale: 'Old rationale' }),
      }),
    );
  });

  it('returns a deferred-applied marker on hard-impact response so the patch leaves staged cleanly', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    // V3.0: hard-impact apply now mutates source content and opens reconciliation needs,
    // but card 1 keeps the deferred banner active by detecting impact === 'hard' on the
    // client. Card 2 will replace the banner with the Pending review surface.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        impact: 'hard',
        affectedItems: [],
        updated: true,
        previousContent: 'Old content',
        previousRationale: 'Old rationale',
        openedNeedIds: [101, 102],
      }),
    );

    const applier = makeEditApplier(SPEC_ID);
    const result = await applier(makeEditPatch());
    expect(result.applied).toEqual({
      deferred: true,
      impact: 'hard',
      message: 'Hard impact — cascade pending review',
    });
    // Undo is a no-op for V3.0 deferred-banner behavior; card 2 will introduce real undo
    // semantics (resolve / re-open needs) once the patch list overlay surfaces them.
    await expect(result.undo()).resolves.toBeUndefined();
  });

  it('throws when the server returns updated: true without previous values', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ impact: 'soft', affectedItems: [], updated: true }));

    const applier = makeEditApplier(SPEC_ID);
    await expect(applier(makeEditPatch())).rejects.toThrow();
  });

  it('resolves undo when the restore edit comes back as hard-impact', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          impact: 'soft',
          affectedItems: [],
          updated: true,
          previousContent: 'Old content',
          previousRationale: 'Old rationale',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          impact: 'hard',
          affectedItems: [],
          updated: true,
          previousContent: 'New content',
          previousRationale: 'New rationale',
          openedNeedIds: [201],
        }),
      );

    const applier = makeEditApplier(SPEC_ID);
    const result = await applier(makeEditPatch());

    await expect(result.undo()).resolves.toBeUndefined();
  });
});

describe('makeEdgeApplier', () => {
  it('POSTs edge creation and returns an undo that DELETEs the same edge', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ created: true }, 201))
      .mockResolvedValueOnce(jsonResponse({ deleted: true }));

    const applier = makeEdgeApplier(SPEC_ID);
    const patch = makeEdgePatch();

    const result = await applier(patch);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/specifications/${SPEC_ID}/knowledge-edges`,
      expect.objectContaining({ method: 'POST' }),
    );

    await result.undo();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/specifications/${SPEC_ID}/knowledge-edges`,
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ fromItemId: 7, toItemId: 9, relation: 'verifies' }),
      }),
    );
  });

  it('throws when the server reports the edge could not be created', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ created: false, reason: 'Relationship not allowed' }));

    const applier = makeEdgeApplier(SPEC_ID);
    await expect(applier(makeEdgePatch())).rejects.toThrow(/Relationship not allowed/);
  });

  it('uses a no-op undo when the edge already existed', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ created: false, alreadyExisted: true }));

    const applier = makeEdgeApplier(SPEC_ID);
    const result = await applier(makeEdgePatch());

    await result.undo();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.applied).toEqual({ created: false, alreadyExisted: true });
  });

  it('throws during undo when the server reports the edge was not deleted', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ created: true }, 201))
      .mockResolvedValueOnce(jsonResponse({ deleted: false, reason: 'Source item not found' }));

    const applier = makeEdgeApplier(SPEC_ID);
    const result = await applier(makeEdgePatch());

    await expect(result.undo()).rejects.toThrow(/Source item not found/);
  });
});

describe('makeDrillDownApplier', () => {
  it('throws a "not yet implemented in V2" error so the patch-list reports failure honestly', async () => {
    const applier = makeDrillDownApplier(SPEC_ID);
    await expect(applier(makeDrillDownPatch())).rejects.toThrow(/drill-down.*V2/i);
  });

  it('does not call fetch', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const applier = makeDrillDownApplier(SPEC_ID);
    await expect(applier(makeDrillDownPatch())).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
