// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { GraphEdge, GraphModel, GraphNode } from '@/views/graph/buildGraphModel.js';
import { useGraphSelection } from '@/views/graph/useGraphSelection.js';

/**
 * Build a small, fully-controlled graph model for selection tests.
 *
 * Topology (edge direction shown with `->`):
 *   goal:1   -> term:2          (depends_on)
 *   context:3 -> goal:1         (refines)
 *   term:2   -> constraint:4    (constrains)
 *
 * With `goal:1` selected, its neighbours are `term:2` (outgoing) and
 * `context:3` (incoming); `constraint:4` is unreachable in one hop and must be
 * dimmed. The two edges touching `goal:1` are highlighted, the third dimmed.
 */
function makeModel(): GraphModel {
  const node = (id: string, kind: GraphNode['data']['kind']): GraphNode => ({
    id,
    data: { kind, degree: 0, selected: false, dimmed: false },
  });

  const edge = (
    source: string,
    target: string,
    relationship: GraphEdge['data']['relationship'],
  ): GraphEdge => ({
    source,
    target,
    data: { relationship },
  });

  return {
    nodes: [
      node('goal:1', 'goal'),
      node('term:2', 'term'),
      node('context:3', 'context'),
      node('constraint:4', 'constraint'),
    ],
    edges: [
      edge('goal:1', 'term:2', 'depends_on'),
      edge('context:3', 'goal:1', 'refines'),
      edge('term:2', 'constraint:4', 'constrains'),
    ],
  };
}

function nodeById(model: GraphModel, id: string): GraphNode {
  const found = model.nodes.find((n) => n.id === id);
  if (!found) throw new Error(`node ${id} not found in result`);
  return found;
}

function edgeBetween(model: GraphModel, source: string, target: string): GraphEdge {
  const found = model.edges.find((e) => e.source === source && e.target === target);
  if (!found) throw new Error(`edge ${source}->${target} not found in result`);
  return found;
}

describe('useGraphSelection', () => {
  it('marks the selected node as selected and not dimmed', () => {
    const model = makeModel();
    const { result } = renderHook(() => useGraphSelection(model, 'goal:1'));

    const selected = nodeById(result.current, 'goal:1');
    expect(selected.data.selected).toBe(true);
    expect(selected.data.dimmed).toBe(false);
  });

  it('highlights the selected node and its connected neighbours (both edge directions)', () => {
    const model = makeModel();
    const { result } = renderHook(() => useGraphSelection(model, 'goal:1'));

    // Outgoing neighbour and incoming neighbour are both highlighted.
    expect(nodeById(result.current, 'term:2').data.dimmed).toBe(false);
    expect(nodeById(result.current, 'context:3').data.dimmed).toBe(false);
    // Neighbours themselves are not "selected".
    expect(nodeById(result.current, 'term:2').data.selected).toBe(false);
    expect(nodeById(result.current, 'context:3').data.selected).toBe(false);
  });

  it('dims nodes that are not connected to the selected node', () => {
    const model = makeModel();
    const { result } = renderHook(() => useGraphSelection(model, 'goal:1'));

    const unrelated = nodeById(result.current, 'constraint:4');
    expect(unrelated.data.dimmed).toBe(true);
    expect(unrelated.data.selected).toBe(false);
  });

  it('highlights edges incident to the selected node and dims the rest', () => {
    const model = makeModel();
    const { result } = renderHook(() => useGraphSelection(model, 'goal:1'));

    expect(edgeBetween(result.current, 'goal:1', 'term:2').data.dimmed).toBe(false);
    expect(edgeBetween(result.current, 'context:3', 'goal:1').data.dimmed).toBe(false);
    expect(edgeBetween(result.current, 'term:2', 'constraint:4').data.dimmed).toBe(true);
  });

  it('dims and selects nothing when there is no selection', () => {
    const model = makeModel();
    const { result } = renderHook(() => useGraphSelection(model, null));

    for (const n of result.current.nodes) {
      expect(n.data.selected).toBe(false);
      expect(n.data.dimmed).toBe(false);
    }
    for (const e of result.current.edges) {
      expect(e.data.dimmed).toBe(false);
    }
  });

  it('does not mutate the input model', () => {
    const model = makeModel();
    renderHook(() => useGraphSelection(model, 'goal:1'));

    for (const n of model.nodes) {
      expect(n.data.selected).toBe(false);
      expect(n.data.dimmed).toBe(false);
    }
  });
});
