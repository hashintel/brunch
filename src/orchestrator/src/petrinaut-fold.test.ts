import { describe, expect, it } from 'vitest';

import { collectSliceIds, foldPlaceId, foldTransitionId } from './petrinaut-fold.js';

describe('foldPlaceId', () => {
  it('strips the slice:<sid>: prefix to the bare role', () => {
    expect(foldPlaceId('slice:slice-1:spec-ready')).toBe('spec-ready');
    expect(foldPlaceId('slice:slice-1:evaluate:running')).toBe('evaluate:running');
  });

  it('keeps the dependent id on per-edge dep-signal places (folds to a unique role)', () => {
    expect(foldPlaceId('slice:slice-a:dep-signal:slice-b')).toBe('dep-signal:slice-b');
  });

  it('leaves epic, pool, and bare places unchanged', () => {
    expect(foldPlaceId('epic:epic-1:done')).toBe('epic:epic-1:done');
    expect(foldPlaceId('pool:test-agent')).toBe('pool:test-agent');
    expect(foldPlaceId('completed')).toBe('completed');
  });
});

describe('collectSliceIds', () => {
  it('extracts every distinct slice id from slice-prefixed place ids', () => {
    const ids = collectSliceIds([
      'slice:slice-1:spec-ready',
      'slice:slice-1:eligible',
      'slice:slice-2:spec-ready',
      'pool:test-agent',
      'epic:epic-1:done',
    ]);
    expect(ids).toEqual(new Set(['slice-1', 'slice-2']));
  });
});

describe('foldTransitionId', () => {
  const sliceIds = new Set(['slice-1', 'slice-a', 'slice-b']);

  it('removes a leading slice-id segment (sid-prefixed transitions)', () => {
    expect(foldTransitionId('slice-1:evaluate:dispatch', sliceIds)).toBe('evaluate:dispatch');
    expect(foldTransitionId('slice-1:return-done', sliceIds)).toBe('return-done');
  });

  it('removes a trailing slice-id segment (slice-ready gate)', () => {
    expect(foldTransitionId('slice-ready:slice-a', sliceIds)).toBe('slice-ready');
  });

  it('leaves epic transitions (no slice-id segment) unchanged', () => {
    expect(foldTransitionId('epic-deps-met:epic-1', sliceIds)).toBe('epic-deps-met:epic-1');
    expect(foldTransitionId('epic-verify:epic-1:pass', sliceIds)).toBe('epic-verify:epic-1:pass');
  });
});
