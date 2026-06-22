/**
 * Oracle for the pure focus helpers that drive neighbour-dimming and
 * incident-edge labelling. No React or layout coupling — just set geometry.
 */

import { describe, expect, it } from 'vitest';

import { isEdgeIncident, neighborIds, type FocusEdge } from '@/views/graph/focus';

// A small directed graph: a is a hub (→b, →c); d→a; e is an orphan.
const edges: FocusEdge[] = [
  { source: 'a', target: 'b' },
  { source: 'a', target: 'c' },
  { source: 'd', target: 'a' },
];

describe('neighborIds', () => {
  it('returns an empty set when nothing is focused', () => {
    expect(neighborIds(edges, null).size).toBe(0);
  });

  it('includes the focused node itself and every directly-connected node, either direction', () => {
    expect(neighborIds(edges, 'a')).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('lights only the focused node and its single neighbour for a leaf', () => {
    expect(neighborIds(edges, 'b')).toEqual(new Set(['b', 'a']));
  });

  it('lights only itself for a node with no edges', () => {
    expect(neighborIds(edges, 'e')).toEqual(new Set(['e']));
  });
});

describe('isEdgeIncident', () => {
  it('is false when nothing is focused', () => {
    expect(isEdgeIncident({ source: 'a', target: 'b' }, null)).toBe(false);
  });

  it('is true when the focus is the source or the target', () => {
    expect(isEdgeIncident({ source: 'a', target: 'b' }, 'a')).toBe(true);
    expect(isEdgeIncident({ source: 'd', target: 'a' }, 'a')).toBe(true);
  });

  it('is false when the focus touches neither endpoint', () => {
    expect(isEdgeIncident({ source: 'a', target: 'b' }, 'c')).toBe(false);
  });
});
