// @vitest-environment happy-dom

import { cleanup, render } from '@testing-library/react';
import { createElement as h } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { GraphArrowLegend } from '@/views/graph/GraphArrowLegend';
import { edgeColor } from '@/views/graph/graphStyle';
import type { GraphEdgeRelationship } from '@/views/graph/types';

afterEach(() => {
  cleanup();
});

describe('GraphArrowLegend', () => {
  it('renders nothing when no relationships are present', () => {
    const { container } = render(h(GraphArrowLegend, { relationships: new Set<GraphEdgeRelationship>() }));
    expect(container.querySelector('[data-graph-arrow-legend]')).toBeNull();
  });

  it('lists each present relationship with an arrow glyph', () => {
    const present = new Set<GraphEdgeRelationship>(['depends_on', 'verifies']);
    const { container } = render(h(GraphArrowLegend, { relationships: present }));

    expect(container.querySelector('[data-graph-arrow-legend-item="depends_on"]')).not.toBeNull();
    expect(container.querySelector('[data-graph-arrow-legend-item="verifies"]')).not.toBeNull();
    expect(container.querySelector('[data-graph-arrow-legend-item="refines"]')).toBeNull();
    expect(container.querySelector('[data-graph-arrow-legend-item="depends_on"] svg')).not.toBeNull();
  });

  it('uses a distinct color per relationship type', () => {
    const all: GraphEdgeRelationship[] = ['depends_on', 'derived_from', 'constrains', 'verifies', 'refines'];
    const { container } = render(h(GraphArrowLegend, { relationships: new Set(all) }));
    const colors = all.map((relationship) => {
      const glyph = container.querySelector(`[data-graph-arrow-legend-item="${relationship}"] polygon`);
      expect(glyph?.getAttribute('fill')).toBe(edgeColor(relationship));
      return glyph?.getAttribute('fill') ?? '';
    });
    expect(new Set(colors).size).toBe(all.length);
  });
});
