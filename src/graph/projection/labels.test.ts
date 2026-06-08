import { describe, expect, it } from 'vitest';

import { edgeLabel } from './labels.js';

describe('edgeLabel', () => {
  it('renders direction-aware base headings from the anchor perspective', () => {
    expect(edgeLabel({ category: 'dependency', anchorRole: 'source' })).toBe('required by');
    expect(edgeLabel({ category: 'dependency', anchorRole: 'target' })).toBe('depends on');
    expect(edgeLabel({ category: 'realization', anchorRole: 'source' })).toBe('realized by');
    expect(edgeLabel({ category: 'realization', anchorRole: 'target' })).toBe('realizes');
    expect(edgeLabel({ category: 'composition', anchorRole: 'source' })).toBe('contains');
    expect(edgeLabel({ category: 'composition', anchorRole: 'target' })).toBe('part of');
    expect(edgeLabel({ category: 'supersession', anchorRole: 'source' })).toBe('supersedes');
    expect(edgeLabel({ category: 'supersession', anchorRole: 'target' })).toBe('superseded by');
    expect(edgeLabel({ category: 'association', anchorRole: 'source' })).toBe('related to');
  });

  it('splits stance-bearing categories by stance', () => {
    expect(edgeLabel({ category: 'proof', anchorRole: 'target', stance: 'for' })).toBe('witnessed by');
    expect(edgeLabel({ category: 'proof', anchorRole: 'target', stance: 'against' })).toBe('challenged by');
    expect(edgeLabel({ category: 'support', anchorRole: 'target', stance: 'for' })).toBe('motivated by');
    expect(edgeLabel({ category: 'support', anchorRole: 'source', stance: 'against' })).toBe(
      'argues against',
    );
  });

  it('applies Tier-2 refinement only when both endpoint kinds are supplied', () => {
    // Base, no kinds:
    expect(edgeLabel({ category: 'realization', anchorRole: 'target' })).toBe('realizes');
    // Refined: requirement → module reads as implementation.
    expect(
      edgeLabel({
        category: 'realization',
        anchorRole: 'target',
        sourceKind: 'requirement',
        targetKind: 'module',
      }),
    ).toBe('implements');
    expect(
      edgeLabel({
        category: 'realization',
        anchorRole: 'source',
        sourceKind: 'requirement',
        targetKind: 'module',
      }),
    ).toBe('implemented by');
    // requirement → slice reads as establishment.
    expect(
      edgeLabel({
        category: 'realization',
        anchorRole: 'source',
        sourceKind: 'requirement',
        targetKind: 'slice',
      }),
    ).toBe('established by');
  });

  it('falls back to the base heading for unrefined kind tuples', () => {
    expect(
      edgeLabel({
        category: 'realization',
        anchorRole: 'target',
        sourceKind: 'goal',
        targetKind: 'context',
      }),
    ).toBe('realizes');
  });
});
