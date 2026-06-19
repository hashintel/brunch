import { describe, expect, it } from 'vitest';

import { kindAccentHex } from '@/client/components/knowledge-card';
import { arrowheadConfig, edgeStyle, nodeColor, nodeSize } from '@/views/graph/nodeStyle';
import type { GraphNodeKind } from '@/views/graph/types';

// The eight knowledge kinds a graph node can represent. Mirrors the
// GraphNodeKind union in src/views/graph/types.ts.
const allKinds: GraphNodeKind[] = [
  'goal',
  'term',
  'context',
  'constraint',
  'requirement',
  'criterion',
  'decision',
  'assumption',
];

describe('nodeColor', () => {
  it('maps every node kind to its accent color from the kindAccentHex palette', () => {
    for (const kind of allKinds) {
      expect(nodeColor(kind)).toBe(kindAccentHex[kind]);
    }
  });

  it('returns a hex color string', () => {
    for (const kind of allKinds) {
      expect(nodeColor(kind)).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('distinguishes kinds that have distinct palette entries', () => {
    expect(nodeColor('goal')).not.toBe(nodeColor('requirement'));
    expect(nodeColor('constraint')).not.toBe(nodeColor('context'));
  });
});

describe('nodeSize', () => {
  it('gives an isolated node (degree 0) a positive base size', () => {
    expect(nodeSize(0)).toBeGreaterThan(0);
  });

  it('renders more-connected nodes larger than less-connected ones', () => {
    expect(nodeSize(8)).toBeGreaterThan(nodeSize(1));
    expect(nodeSize(1)).toBeGreaterThan(nodeSize(0));
  });

  it('never shrinks as degree grows (monotonic non-decreasing)', () => {
    for (let degree = 0; degree < 25; degree += 1) {
      expect(nodeSize(degree + 1)).toBeGreaterThanOrEqual(nodeSize(degree));
    }
  });

  it('keeps even extreme degrees within a finite, bounded size', () => {
    const huge = nodeSize(100_000);
    expect(Number.isFinite(huge)).toBe(true);
    expect(huge).toBeGreaterThan(nodeSize(0));
    expect(huge).toBeLessThanOrEqual(1000);
  });
});

describe('edgeStyle', () => {
  it('exposes a neutral stroke color as a hex string', () => {
    expect(typeof edgeStyle.stroke).toBe('string');
    expect(edgeStyle.stroke).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('uses a positive stroke width', () => {
    expect(typeof edgeStyle.strokeWidth).toBe('number');
    expect(edgeStyle.strokeWidth).toBeGreaterThan(0);
  });

  it('is neutral — not tinted with any kind accent color', () => {
    const accents = Object.values(kindAccentHex).map((c) => c.toLowerCase());
    expect(accents).not.toContain(edgeStyle.stroke.toLowerCase());
  });
});

describe('arrowheadConfig', () => {
  it('describes a directional arrowhead with positive dimensions', () => {
    expect(arrowheadConfig.width).toBeGreaterThan(0);
    expect(arrowheadConfig.height).toBeGreaterThan(0);
  });

  it('carries a color string for the arrowhead', () => {
    expect(typeof arrowheadConfig.color).toBe('string');
    expect(arrowheadConfig.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
