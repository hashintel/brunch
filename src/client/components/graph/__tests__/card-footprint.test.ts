/**
 * Unit tests for the single uniform collapsed card footprint.
 *
 * The graph view is moving from a degree-based `nodeSize` (each node a
 * different diameter) to ONE uniform collapsed card footprint that collision /
 * packing has a single, predictable box to work against. These tests pin that
 * contract: a `cardFootprint` with a positive numeric `width` and `height` that
 * is constant — independent of any node's degree or kind.
 */

import { describe, expect, it } from 'vitest';

import { cardFootprint } from '@/client/components/graph/cardFootprint';

describe('cardFootprint', () => {
  it('exposes a positive finite width', () => {
    expect(typeof cardFootprint.width).toBe('number');
    expect(Number.isFinite(cardFootprint.width)).toBe(true);
    expect(cardFootprint.width).toBeGreaterThan(0);
  });

  it('exposes a positive finite height', () => {
    expect(typeof cardFootprint.height).toBe('number');
    expect(Number.isFinite(cardFootprint.height)).toBe(true);
    expect(cardFootprint.height).toBeGreaterThan(0);
  });

  it('is a single shared footprint — the same value on every import', async () => {
    const reimport = await import('@/client/components/graph/cardFootprint');
    expect(reimport.cardFootprint).toBe(cardFootprint);
    expect(reimport.cardFootprint.width).toBe(cardFootprint.width);
    expect(reimport.cardFootprint.height).toBe(cardFootprint.height);
  });

  it('is uniform — exposes scalar width/height, not a degree-indexed function', () => {
    // A uniform footprint is a fixed box, never something you call with a degree.
    expect(typeof cardFootprint).toBe('object');
    expect(typeof (cardFootprint as unknown)).not.toBe('function');
    // Exactly the two dimensions packing needs, both plain numbers.
    expect(Object.keys(cardFootprint).sort()).toEqual(['height', 'width']);
  });

  it('is a card-shaped box wide enough to be at least as wide as it is tall', () => {
    // A collapsed *card* reads horizontally; the footprint should not be taller
    // than it is wide (it is a card, not a dot).
    expect(cardFootprint.width).toBeGreaterThanOrEqual(cardFootprint.height);
  });
});
