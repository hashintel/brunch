// @vitest-environment happy-dom

/**
 * Epic integration: "Graph canvas wiring — edge label toggle, edges, and
 * settle-once".
 *
 * This test exercises the three canvas slices together through their public
 * surfaces, reproducing exactly the wiring the `GraphCanvas` performs:
 *
 *   1. entity state -> `buildGraphModel` -> nodes + edges (graph data),
 *   2. that model -> `forceLayout` -> settled, deterministic positions
 *      (settle-once: identical positions on a repeat run, no animated fly-in),
 *   3. the global edge-label toggle (`?edgeLabels` URL param, parsed by
 *      `parseEdgeLabelsVisible`) threaded as the `labelsShown` prop onto every
 *      `GraphEdge` so flipping one switch reveals/hides every edge's
 *      relationship label at once.
 *
 * The canvas threads the toggle into each edge via `labelsShown={labelsVisible}`
 * (see `GraphFlowEdge` in GraphCanvas), and `GraphEdge` reveals its label when
 * `labelsShown || selected`. These tests pin that end-to-end composition through
 * the rendered DOM and the layout output, not through any single slice in
 * isolation.
 */

import { cleanup, render } from '@testing-library/react';
import { createElement as h, type ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { EntitiesData } from '@/shared/api-types';
import { buildGraphModel } from '@/views/graph/buildGraphModel';
import {
  DEFAULT_EDGE_LABELS_VISIBLE,
  edgeLabelsToSearch,
  EDGE_LABELS_PARAM,
  parseEdgeLabelsVisible,
  toggleEdgeLabels,
} from '@/views/graph/EdgeLabelToggle';
import { forceLayout } from '@/views/graph/forceLayout';
import { GraphEdge } from '@/views/graph/GraphEdge';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixture: a small but real intent graph spanning several knowledge kinds and
// multiple relationship types, shaped like the server's `EntitiesData`.
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
 * Render the model's edges exactly as the canvas threads them: every edge gets
 * `labelsShown={labelsVisible}` (the canvas's `GraphFlowEdge` wiring), with the
 * endpoints drawn from the settled layout positions.
 */
function renderCanvasEdges(visible: boolean): { container: HTMLElement } {
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
      labelsShown: visible,
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

    // All eight knowledge kinds become nodes, and all four relationships edges.
    expect(model.nodes).toHaveLength(8);
    expect(model.edges).toHaveLength(4);
    expect(positioned).toHaveLength(8);

    // Every layout position is a real, finite coordinate (force ran, not NaN).
    for (const node of positioned) {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }

    // Every edge connects two ids that exist as laid-out nodes.
    const ids = new Set(positioned.map((node) => node.id));
    for (const edge of model.edges) {
      expect(ids.has(edge.source)).toBe(true);
      expect(ids.has(edge.target)).toBe(true);
    }

    // The force actually spread the nodes — they are not all stacked at one
    // point (guards against a no-op layout that would still settle "once").
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

    const line = container.querySelector('line');
    expect(line).not.toBeNull();
    expect(Number(line?.getAttribute('x1'))).toBe(source!.x);
    expect(Number(line?.getAttribute('y1'))).toBe(source!.y);
    expect(Number(line?.getAttribute('x2'))).toBe(target!.x);
    expect(Number(line?.getAttribute('y2'))).toBe(target!.y);
  });
});

describe('canvas wiring: global edge-label toggle reveals every edge label', () => {
  it('hides every edge label when the toggle is off (default param state)', () => {
    expect(parseEdgeLabelsVisible(undefined)).toBe(DEFAULT_EDGE_LABELS_VISIBLE);

    const { container } = renderCanvasEdges(parseEdgeLabelsVisible(undefined));
    expect(container.querySelectorAll('[data-edge-label]')).toHaveLength(0);
  });

  it('reveals a label on every edge when the toggle is on', () => {
    const visible = parseEdgeLabelsVisible('on');
    expect(visible).toBe(true);

    const model = buildGraphModel(makeEntities());
    const { container } = renderCanvasEdges(visible);

    const labels = container.querySelectorAll('[data-edge-label]');
    expect(labels).toHaveLength(model.edges.length);

    // Each rendered label corresponds to one of the model's relationships.
    const rendered = Array.from(labels).map((label) => labelKey(label.textContent ?? ''));
    const expected = model.edges.map((edge) => edge.data.relationship);
    expect(rendered.sort()).toEqual(expected.sort());
  });

  it('flips the entire edge set when the toggle changes, driven by the URL param', () => {
    const model = buildGraphModel(makeEntities());

    // Start: param absent -> default (off) -> no labels.
    const offVisible = parseEdgeLabelsVisible(undefined);
    const { container: off } = renderCanvasEdges(offVisible);
    expect(off.querySelectorAll('[data-edge-label]')).toHaveLength(0);
    cleanup();

    // Toggle once and serialise to the search param, as the control does.
    const toggled = toggleEdgeLabels(offVisible);
    const search = edgeLabelsToSearch(toggled);
    expect(search[EDGE_LABELS_PARAM]).toBe('on');

    // Re-read the param off the URL and re-thread it: every edge now labelled.
    const onVisible = parseEdgeLabelsVisible(search[EDGE_LABELS_PARAM]);
    expect(onVisible).toBe(true);
    const { container: on } = renderCanvasEdges(onVisible);
    expect(on.querySelectorAll('[data-edge-label]')).toHaveLength(model.edges.length);
  });

  it('round-trips the toggle through the param so the choice survives a refresh', () => {
    const initial = parseEdgeLabelsVisible(undefined);
    expect(initial).toBe(false);

    const afterFirst = parseEdgeLabelsVisible(
      edgeLabelsToSearch(toggleEdgeLabels(initial))[EDGE_LABELS_PARAM],
    );
    expect(afterFirst).toBe(true);

    const afterSecond = parseEdgeLabelsVisible(
      edgeLabelsToSearch(toggleEdgeLabels(afterFirst))[EDGE_LABELS_PARAM],
    );
    expect(afterSecond).toBe(false);
  });
});
