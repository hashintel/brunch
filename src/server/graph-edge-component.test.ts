// @vitest-environment happy-dom

import { createElement as h } from 'react';

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { kindAccentHex } from '@/client/components/knowledge-card';
// The component under test. Lives alongside the other graph view modules.
import { GraphEdge } from '@/views/graph/GraphEdge';
import { arrowheadConfig, edgeStyle } from '@/views/graph/nodeStyle';
import type { GraphEdgeRelationship } from '@/views/graph/types';

afterEach(() => {
  cleanup();
});

const allRelationships: GraphEdgeRelationship[] = [
  'depends_on',
  'derived_from',
  'constrains',
  'verifies',
  'refines',
];

const source = { x: 0, y: 0 };
const target = { x: 120, y: 60 };

/**
 * Render a GraphEdge inside an <svg> host (edges are SVG content) and return
 * the container plus the edge's root element (marked with data-graph-edge).
 */
function renderEdge(
  props: {
    relationship: GraphEdgeRelationship;
    selected?: boolean;
    dimmed?: boolean;
  },
): { container: HTMLElement; root: Element } {
  const { container } = render(
    h('svg', null, h(GraphEdge, { source, target, ...props })),
  );
  const root = container.querySelector('[data-graph-edge]');
  if (root === null) {
    throw new Error('GraphEdge did not render an element marked with data-graph-edge');
  }
  return { container, root };
}

/** Normalize a human label back toward its relationship key for comparison. */
function toKey(text: string): string {
  return text.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

describe('GraphEdge', () => {
  it('strokes the edge with the neutral edgeStyle constants from nodeStyle.ts', () => {
    const { container } = renderEdge({ relationship: 'depends_on' });
    const stroked = container.querySelector('line, path[d]');
    expect(stroked).not.toBeNull();
    expect(stroked?.getAttribute('stroke')).toBe(edgeStyle.stroke);
    expect(stroked?.getAttribute('stroke-width')).toBe(String(edgeStyle.strokeWidth));
  });

  it('uses one uniform neutral stroke for every relationship type', () => {
    const strokes = allRelationships.map((relationship) => {
      const { container } = renderEdge({ relationship });
      const stroked = container.querySelector('line, path[d]');
      return stroked?.getAttribute('stroke');
    });
    for (const stroke of strokes) {
      expect(stroke).toBe(edgeStyle.stroke);
    }
  });

  it('keeps the rendered edge color neutral — never tinted by a node kind accent color', () => {
    const accents = Object.values(kindAccentHex).map((c) => c.toLowerCase());
    for (const relationship of allRelationships) {
      const { container } = renderEdge({ relationship });
      const stroked = container.querySelector('line, path[d]');
      const stroke = (stroked?.getAttribute('stroke') ?? '').toLowerCase();
      expect(stroke.length).toBeGreaterThan(0);
      expect(accents).not.toContain(stroke);
      cleanup();
    }
  });

  it('renders a directional arrowhead marker that the edge references', () => {
    const { container } = renderEdge({ relationship: 'depends_on' });
    const stroked = container.querySelector('line, path[d]');
    const markerEnd = stroked?.getAttribute('marker-end') ?? '';
    expect(markerEnd).toMatch(/^url\(#.+\)$/);

    const id = markerEnd.replace(/^url\(#/, '').replace(/\)$/, '');
    const marker = Array.from(container.querySelectorAll('marker')).find((m) => m.id === id);
    expect(marker, 'edge must define the arrowhead marker it references').toBeDefined();

    const shape = marker?.querySelector('path, polygon');
    expect(shape, 'arrowhead marker must contain a drawable shape').not.toBeNull();
    // The arrowhead shape is colored from the shared arrowheadConfig constant.
    expect(shape?.getAttribute('fill')).toBe(arrowheadConfig.color);
  });

  it('exposes the relationship as a machine-readable data attribute', () => {
    for (const relationship of allRelationships) {
      const { root } = renderEdge({ relationship });
      expect(root.getAttribute('data-relationship')).toBe(relationship);
      cleanup();
    }
  });

  it('does not reveal the relationship as a visible label by default', () => {
    const { container } = renderEdge({ relationship: 'depends_on' });
    expect(container.querySelector('[data-edge-label]')).toBeNull();
  });

  it('reveals the relationship as a visible label when the edge is selected', () => {
    const { container } = renderEdge({ relationship: 'derived_from', selected: true });
    const label = container.querySelector('[data-edge-label]');
    expect(label).not.toBeNull();
    expect(toKey(label?.textContent ?? '')).toContain('derived_from');
  });

  it('always carries the relationship in a hover tooltip (title)', () => {
    const { root } = renderEdge({ relationship: 'constrains' });
    const title = root.getAttribute('title') ?? root.querySelector('title')?.textContent ?? '';
    expect(title.length).toBeGreaterThan(0);
    expect(toKey(title)).toContain('constrains');
  });

  it('gives distinct tooltips to distinct relationship types', () => {
    const titleFor = (relationship: GraphEdgeRelationship): string => {
      const { root } = renderEdge({ relationship });
      const t = root.getAttribute('title') ?? root.querySelector('title')?.textContent ?? '';
      cleanup();
      return t;
    };
    expect(titleFor('depends_on')).not.toBe(titleFor('verifies'));
  });

  it('reflects the selected state for highlight styling', () => {
    const { root: unselected } = renderEdge({ relationship: 'refines' });
    expect(unselected.getAttribute('data-selected')).toBe('false');
    cleanup();
    const { root: selected } = renderEdge({ relationship: 'refines', selected: true });
    expect(selected.getAttribute('data-selected')).toBe('true');
  });

  it('reflects the dimmed state and changes styling when dimmed', () => {
    const { root: normal } = renderEdge({ relationship: 'refines' });
    expect(normal.getAttribute('data-dimmed')).toBe('false');
    const normalClass = normal.getAttribute('class') ?? '';
    cleanup();
    const { root: dimmed } = renderEdge({ relationship: 'refines', dimmed: true });
    expect(dimmed.getAttribute('data-dimmed')).toBe('true');
    const dimmedClass = dimmed.getAttribute('class') ?? '';
    expect(dimmedClass).not.toBe(normalClass);
  });

  it('defaults to an unselected, undimmed edge with no visible label', () => {
    const { container, root } = renderEdge({ relationship: 'depends_on' });
    expect(root.getAttribute('data-selected')).toBe('false');
    expect(root.getAttribute('data-dimmed')).toBe('false');
    expect(container.querySelector('[data-edge-label]')).toBeNull();
  });
});
