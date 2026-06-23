// @vitest-environment happy-dom

import { cleanup, render } from '@testing-library/react';
import { createElement as h } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { kindAccentHex } from '@/client/components/knowledge-card';
// The component under test. Lives alongside the other graph view modules.
import { GraphEdge } from '@/views/graph/GraphEdge';
import { edgeStyle } from '@/views/graph/graphStyle';
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
function renderEdge(props: {
  relationship: GraphEdgeRelationship;
  selected?: boolean;
  dimmed?: boolean;
  labelsShown?: boolean;
}): { container: HTMLElement; root: Element } {
  const { container } = render(h('svg', null, h(GraphEdge, { source, target, ...props })));
  const root = container.querySelector('[data-graph-edge]');
  if (root === null) {
    throw new Error('GraphEdge did not render an element marked with data-graph-edge');
  }
  return { container, root };
}

/** Normalize a human label back toward its relationship key for comparison. */
function toKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

describe('GraphEdge', () => {
  it('strokes the edge with the neutral edge color at the edgeStyle width', () => {
    const { container } = renderEdge({ relationship: 'depends_on' });
    const stroked = container.querySelector('line, path[d]');
    expect(stroked).not.toBeNull();
    expect(stroked?.getAttribute('stroke')).toBe(edgeStyle.stroke);
    expect(stroked?.getAttribute('stroke-width')).toBe(String(edgeStyle.strokeWidth));
  });

  it('uses one uniform neutral stroke, never a node kind accent color', () => {
    const accents = Object.values(kindAccentHex).map((c) => c.toLowerCase());
    for (const relationship of allRelationships) {
      const { container } = renderEdge({ relationship });
      const stroked = container.querySelector('line, path[d]');
      const stroke = (stroked?.getAttribute('stroke') ?? '').toLowerCase();
      expect(stroke).toBe(edgeStyle.stroke.toLowerCase());
      expect(accents).not.toContain(stroke);
      cleanup();
    }
  });

  it('distinguishes relationship types by arrowhead shape', () => {
    const shapes = allRelationships.map((relationship) => {
      const { container } = renderEdge({ relationship });
      const shape = container.querySelector('marker > *');
      const signature =
        shape === null
          ? ''
          : `${shape.tagName}:${shape.getAttribute('points') ?? shape.getAttribute('r') ?? shape.getAttribute('width') ?? ''}`;
      cleanup();
      return signature;
    });
    expect(new Set(shapes).size).toBe(allRelationships.length);
  });

  it('renders a directional arrowhead marker that the edge references', () => {
    const { container } = renderEdge({ relationship: 'depends_on' });
    const stroked = container.querySelector('line, path[d]');
    const markerEnd = stroked?.getAttribute('marker-end') ?? '';
    expect(markerEnd).toMatch(/^url\(#.+\)$/);

    const id = markerEnd.replace(/^url\(#/, '').replace(/\)$/, '');
    const marker = Array.from(container.querySelectorAll('marker')).find((m) => m.id === id);
    expect(marker, 'edge must define the arrowhead marker it references').toBeDefined();

    const shape = marker?.querySelector('path, polygon, polyline, circle, rect');
    expect(shape, 'arrowhead marker must contain a drawable shape').not.toBeNull();
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

describe('GraphEdge — global labelsShown toggle', () => {
  it('reveals the relationship label when labelsShown is on, even if unselected', () => {
    const { container } = renderEdge({ relationship: 'depends_on', labelsShown: true });
    const label = container.querySelector('[data-edge-label]');
    expect(label).not.toBeNull();
    expect(toKey(label?.textContent ?? '')).toContain('depends_on');
  });

  it('reveals a label for every relationship type when labelsShown is on', () => {
    for (const relationship of allRelationships) {
      const { container } = renderEdge({ relationship, labelsShown: true });
      const label = container.querySelector('[data-edge-label]');
      expect(label, `expected a visible label for ${relationship}`).not.toBeNull();
      expect(toKey(label?.textContent ?? '')).toContain(relationship);
      cleanup();
    }
  });

  it('keeps the label visible when labelsShown is on and the edge is also selected', () => {
    const { container } = renderEdge({ relationship: 'verifies', labelsShown: true, selected: true });
    expect(container.querySelector('[data-edge-label]')).not.toBeNull();
  });

  it('falls back to hidden when labelsShown is off and the edge is unselected', () => {
    const { container } = renderEdge({ relationship: 'derived_from', labelsShown: false });
    expect(container.querySelector('[data-edge-label]')).toBeNull();
  });
});
