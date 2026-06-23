// @vitest-environment happy-dom

/**
 * Epic integration: "Graph canvas wiring — focus-scoped labels, edges, and
 * settle-once".
 *
 * Exercises the canvas slices together through their public surfaces:
 *
 *   1. entity state -> `buildGraphModel` -> nodes + edges (graph data),
 *   2. that model -> `forceLayout` -> settled, deterministic positions
 *      (settle-once: identical positions on a repeat run, no animated fly-in),
 *   3. focus scoping (`focus.ts`): a node's incident edges reveal their labels
 *      and its neighbours stay lit while the rest dim, threaded as the
 *      `labelsShown` prop onto each `GraphEdge` exactly as the canvas does.
 *
 * `GraphEdge` reveals its label when `labelsShown || selected`. These tests pin
 * the end-to-end composition through the rendered DOM and the layout output, not
 * through any single slice in isolation.
 */

import { cleanup, render } from '@testing-library/react';
import { createElement as h, type ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { EntitiesData } from '@/shared/api-types';
import { buildGraphModel } from '@/views/graph/buildGraphModel';
import { isEdgeIncident, neighborIds } from '@/views/graph/focus';
import { forceLayout } from '@/views/graph/forceLayout';
import { GraphEdge } from '@/views/graph/GraphEdge';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixture: a small but real intent graph spanning several knowledge kinds and
// multiple relationship types, shaped like the server's `EntitiesData`. The
// requirement (id 5) is a hub — every relationship touches it.
// ---------------------------------------------------------------------------

function makeItem(id: number, kind: string, content: string) {
  return {
    specification_id: 1,
    id,
    kind,
    subtype: null,
    content,
    rationale: null,
  } as unknown as EntitiesData['goals'][number];
}

function makeEntities(): EntitiesData {
  return {
    goals: [makeItem(1, 'goal', 'Ship the graph canvas')],
    terms: [makeItem(2, 'term', 'Edge label')],
    contexts: [makeItem(3, 'context', 'Existing list view')],
    constraints: [makeItem(4, 'constraint', 'No animated fly-in')],
    requirements: [makeItem(5, 'requirement', 'Toggle reveals every label')],
    criteria: [makeItem(6, 'criterion', 'Positions settle once')],
    decisions: [makeItem(7, 'decision', 'Use d3-force')],
    assumptions: [makeItem(8, 'assumption', 'Seeded PRNG is stable')],
    relationships: [
      {
        type: 'derived_from',
        source: { collection: 'knowledge_item', kind: 'requirement', id: 5 },
        target: { collection: 'knowledge_item', kind: 'goal', id: 1 },
      },
      {
        type: 'verifies',
        source: { collection: 'knowledge_item', kind: 'criterion', id: 6 },
        target: { collection: 'knowledge_item', kind: 'requirement', id: 5 },
      },
      {
        type: 'constrains',
        source: { collection: 'knowledge_item', kind: 'constraint', id: 4 },
        target: { collection: 'knowledge_item', kind: 'requirement', id: 5 },
      },
      {
        type: 'depends_on',
        source: { collection: 'knowledge_item', kind: 'requirement', id: 5 },
        target: { collection: 'knowledge_item', kind: 'decision', id: 7 },
      },
    ],
  } as unknown as EntitiesData;
}

/** Map a model edge into `forceLayout`'s edge-input shape, as GraphCanvas does. */
function layoutEdges(edges: ReturnType<typeof buildGraphModel>['edges']) {
  return edges.map((edge, index) => ({
    id: `${edge.source}->${edge.target}#${index}`,
    source: edge.source,
    target: edge.target,
    data: edge.data,
  }));
}

/**
 * Render the model's edges exactly as the canvas threads them under a focus:
 * each edge gets `labelsShown={isEdgeIncident(edge, focusId)}`, with endpoints
 * drawn from the settled layout positions.
 */
function renderFocusedEdges(focusId: string | null): { container: HTMLElement } {
  const model = buildGraphModel(makeEntities());
  const positioned = forceLayout({ nodes: model.nodes, edges: layoutEdges(model.edges) });
  const positions = new Map(positioned.map((node) => [node.id, node.position]));

  const edgeElements: ReactElement[] = model.edges.map((edge, index) => {
    const source = positions.get(edge.source) ?? { x: 0, y: 0 };
    const target = positions.get(edge.target) ?? { x: 0, y: 0 };
    return h(GraphEdge, {
      key: index,
      relationship: edge.data.relationship,
      source,
      target,
      labelsShown: isEdgeIncident(edge, focusId),
    });
  });

  return render(h('svg', null, edgeElements));
}

function labelKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

// ---------------------------------------------------------------------------

describe('canvas wiring: graph data -> force layout -> edges', () => {
  it('projects every knowledge item and relationship into the layout pipeline', () => {
    const model = buildGraphModel(makeEntities());
    const positioned = forceLayout({ nodes: model.nodes, edges: layoutEdges(model.edges) });

    expect(model.nodes).toHaveLength(8);
    expect(model.edges).toHaveLength(4);
    expect(positioned).toHaveLength(8);

    for (const node of positioned) {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }

    const ids = new Set(positioned.map((node) => node.id));
    for (const edge of model.edges) {
      expect(ids.has(edge.source)).toBe(true);
      expect(ids.has(edge.target)).toBe(true);
    }

    const distinct = new Set(positioned.map((node) => `${node.position.x},${node.position.y}`));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('settles once: a repeated layout produces identical positions (no fly-in)', () => {
    const model = buildGraphModel(makeEntities());
    const first = forceLayout({ nodes: model.nodes, edges: layoutEdges(model.edges) });
    const second = forceLayout({ nodes: model.nodes, edges: layoutEdges(model.edges) });

    expect(second).toHaveLength(first.length);
    const firstById = new Map(first.map((node) => [node.id, node.position]));
    for (const node of second) {
      const prior = firstById.get(node.id);
      expect(prior).toBeDefined();
      expect(node.position.x).toBe(prior?.x);
      expect(node.position.y).toBe(prior?.y);
    }
  });

  it('draws each edge between its source and target settled positions', () => {
    const model = buildGraphModel(makeEntities());
    const positioned = forceLayout({ nodes: model.nodes, edges: layoutEdges(model.edges) });
    const positions = new Map(positioned.map((node) => [node.id, node.position]));

    const edge = model.edges[0];
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    expect(source).toBeDefined();
    expect(target).toBeDefined();

    const { container } = render(
      h(
        'svg',
        null,
        h(GraphEdge, { relationship: edge.data.relationship, source: source!, target: target! }),
      ),
    );

    const path = container.querySelector('path[d]');
    expect(path).not.toBeNull();
    // The bezier edge starts at the source and ends at the target endpoint.
    const coords = (path?.getAttribute('d') ?? '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    expect(coords[0]).toBeCloseTo(source!.x, 1);
    expect(coords[1]).toBeCloseTo(source!.y, 1);
    expect(coords.at(-2)).toBeCloseTo(target!.x, 1);
    expect(coords.at(-1)).toBeCloseTo(target!.y, 1);
  });
});

describe('canvas wiring: focus reveals only the focused node’s incident edge labels', () => {
  it('shows no edge labels when nothing is focused', () => {
    const { container } = renderFocusedEdges(null);
    expect(container.querySelectorAll('[data-edge-label]')).toHaveLength(0);
  });

  it('labels every edge incident to a focused hub, and only those', () => {
    const model = buildGraphModel(makeEntities());
    const hub = 'requirement:5';
    const incident = model.edges.filter((edge) => isEdgeIncident(edge, hub));

    const { container } = renderFocusedEdges(hub);
    const labels = container.querySelectorAll('[data-edge-label]');
    expect(labels).toHaveLength(incident.length);

    const rendered = Array.from(labels).map((label) => labelKey(label.textContent ?? ''));
    expect(rendered.sort()).toEqual(incident.map((edge) => edge.data.relationship).sort());
  });

  it('labels only the single incident edge when focusing a leaf node', () => {
    const model = buildGraphModel(makeEntities());
    const leaf = 'goal:1';
    const incident = model.edges.filter((edge) => isEdgeIncident(edge, leaf));
    expect(incident).toHaveLength(1);

    const { container } = renderFocusedEdges(leaf);
    expect(container.querySelectorAll('[data-edge-label]')).toHaveLength(1);
  });

  it('keeps the focused node and its neighbours as the lit set (the rest dim)', () => {
    const model = buildGraphModel(makeEntities());

    // The hub plus all four of its endpoints stay lit.
    expect(neighborIds(model.edges, 'requirement:5')).toEqual(
      new Set(['requirement:5', 'goal:1', 'criterion:6', 'constraint:4', 'decision:7']),
    );
    // A leaf lights only itself and the hub.
    expect(neighborIds(model.edges, 'goal:1')).toEqual(new Set(['goal:1', 'requirement:5']));
    // No focus lights nobody (so nothing dims).
    expect(neighborIds(model.edges, null).size).toBe(0);
  });
});
