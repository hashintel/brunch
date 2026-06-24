// @vitest-environment happy-dom

/**
 * Behavioral contract for the live `useForceLayout` hook.
 *
 * The hook drives node positions frame-by-frame from a per-instance d3 simulation
 * built from the shared `graphForces` config: nodes start at the simulation's seed
 * positions, glide as the simulation ticks, and settle into the SAME layout the
 * synchronous `forceLayout` pass produces — then the frame loop parks itself.
 *
 * These tests own `requestAnimationFrame` so the otherwise-animated behavior is
 * deterministic: draining the frame queue runs exactly as many ticks as the loop
 * schedules, which is also when it self-terminates.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { forceLayout } from '@/client/components/graph/forceLayout.js';
import type { SimModel } from '@/client/components/graph/graphForces.js';
import type { GraphNodeData, GraphNodeKind } from '@/client/components/graph/types.js';
import { useForceLayout } from '@/client/components/graph/useForceLayout.js';
import { workflowLayout } from '@/client/components/graph/workflowLayout.js';

function nodeData(kind: GraphNodeKind = 'term'): GraphNodeData {
  return { kind, degree: 0, selected: false, dimmed: false, referenceCode: '', content: '', rationale: '' };
}

function model(): SimModel {
  return {
    nodes: [
      { id: 'a', data: nodeData('goal') },
      { id: 'b', data: nodeData('requirement') },
      { id: 'c', data: nodeData('criterion') },
      { id: 'd', data: nodeData('term') },
    ],
    edges: [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ],
  };
}

let frameQueue: FrameRequestCallback[] = [];

beforeEach(() => {
  frameQueue = [];
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
    frameQueue.push(cb);
    return frameQueue.length;
  };
  globalThis.cancelAnimationFrame = () => {};
});

afterEach(() => {
  frameQueue = [];
});

/** Drain the frame queue until the loop stops scheduling (self-termination) or a guard trips. */
function settle(): number {
  let frames = 0;
  act(() => {
    while (frameQueue.length > 0) {
      if (frames++ > 5000) throw new Error('frame loop never settled');
      const cb = frameQueue.shift()!;
      cb(0);
    }
  });
  return frames;
}

/** Run up to `n` scheduled frames without requiring the loop to settle (a pinned sim never parks). */
function flush(n: number): void {
  act(() => {
    for (let i = 0; i < n && frameQueue.length > 0; i++) {
      const cb = frameQueue.shift()!;
      cb(0);
    }
  });
}

function positionsById(nodes: ReadonlyArray<{ id: string; position: { x: number; y: number } }>) {
  return new Map(nodes.map((n) => [n.id, n.position]));
}

describe('useForceLayout', () => {
  it('seeds a finite position for every node before any frame runs', () => {
    const m = model();
    const { result } = renderHook(() => useForceLayout(m));

    const nodes = result.current.nodes;
    expect(nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    for (const node of nodes) {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }
  });

  it('renders the settled forceLayout layout on mount, with no entrance animation', () => {
    const m = model();
    const { result } = renderHook(() => useForceLayout(m));

    const live = positionsById(result.current.nodes);
    for (const expected of forceLayout(m)) {
      const actual = live.get(expected.id)!;
      expect(actual.x).toBeCloseTo(expected.position.x, 4);
      expect(actual.y).toBeCloseTo(expected.position.y, 4);
    }
    // No frame loop is scheduled on mount: the graph is static until interaction.
    expect(frameQueue.length).toBe(0);
  });

  it('returns no nodes and schedules no frames for an empty model', () => {
    const empty: SimModel = { nodes: [], edges: [] };
    const { result } = renderHook(() => useForceLayout(empty));

    expect(result.current.nodes).toEqual([]);
    expect(frameQueue.length).toBe(0);
  });
});

describe('useForceLayout — static modes (workflow, free)', () => {
  it('free mode lays out from forceLayout but never schedules a simulation frame', () => {
    const m = model();
    const { result } = renderHook(() => useForceLayout(m, 'free'));

    const live = positionsById(result.current.nodes);
    for (const expected of forceLayout(m)) {
      const actual = live.get(expected.id)!;
      expect(actual.x).toBeCloseTo(expected.position.x, 4);
      expect(actual.y).toBeCloseTo(expected.position.y, 4);
    }
    expect(frameQueue.length).toBe(0);
  });

  it('workflow mode lays out from workflowLayout but never schedules a simulation frame', () => {
    const m = model();
    const { result } = renderHook(() => useForceLayout(m, 'workflow'));

    const live = positionsById(result.current.nodes);
    for (const expected of workflowLayout(m)) {
      const actual = live.get(expected.id)!;
      expect(actual.x).toBeCloseTo(expected.position.x, 4);
      expect(actual.y).toBeCloseTo(expected.position.y, 4);
    }
    expect(frameQueue.length).toBe(0);
  });

  it('seeds saved manual positions over the computed layout in static modes', () => {
    const m = model();
    const overrides = new Map([['a', { x: 777, y: -333 }]]);
    const overridesFor = () => overrides;
    const { result } = renderHook(() => useForceLayout(m, 'workflow', overridesFor));

    const live = positionsById(result.current.nodes);
    // The overridden node sits exactly where it was saved...
    expect(live.get('a')).toEqual({ x: 777, y: -333 });
    // ...while un-saved nodes keep the layered workflow position.
    const layout = new Map(workflowLayout(m).map((node) => [node.id, node.position]));
    expect(live.get('b')).toEqual(layout.get('b'));
  });

  it('does not reflow on drag: dragging a node leaves its neighbors untouched', () => {
    const m = model();
    const { result } = renderHook(() => useForceLayout(m, 'free'));
    const before = positionsById(result.current.nodes).get('b')!;

    // React Flow owns positions in static modes; the hook's drag handlers no-op,
    // so no simulation reheats and no frames are scheduled.
    act(() => result.current.onNodeDragStart('a'));
    act(() => result.current.onNodeDrag('a', { x: 900, y: -400 }));

    const after = positionsById(result.current.nodes).get('b')!;
    expect(after.x).toBeCloseTo(before.x, 4);
    expect(after.y).toBeCloseTo(before.y, 4);
    expect(frameQueue.length).toBe(0);
  });
});

describe('useForceLayout — drag', () => {
  function positionOf(
    result: { current: { nodes: ReadonlyArray<{ id: string; position: { x: number; y: number } }> } },
    id: string,
  ) {
    const node = result.current.nodes.find((n) => n.id === id);
    if (node === undefined) throw new Error(`no node ${id}`);
    return node.position;
  }

  it('pins a dragged node under the pointer', () => {
    const m = model();
    const { result } = renderHook(() => useForceLayout(m));
    settle();

    act(() => result.current.onNodeDragStart('a'));
    act(() => result.current.onNodeDrag('a', { x: 900, y: -400 }));
    flush(3);

    const a = positionOf(result, 'a');
    expect(a.x).toBeCloseTo(900, 3);
    expect(a.y).toBeCloseTo(-400, 3);
  });

  it('reflows neighbors while a connected node is dragged', () => {
    const m = model();
    const { result } = renderHook(() => useForceLayout(m));
    settle();
    const before = positionOf(result, 'b');

    act(() => result.current.onNodeDragStart('a'));
    act(() => result.current.onNodeDrag('a', { x: 1200, y: 600 }));
    flush(8);

    const after = positionOf(result, 'b');
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(1);
  });

  it('eases a released node back off the drop point', () => {
    const m = model();
    const { result } = renderHook(() => useForceLayout(m));
    settle();

    act(() => result.current.onNodeDragStart('a'));
    act(() => result.current.onNodeDrag('a', { x: 1500, y: 0 }));
    flush(4);
    expect(positionOf(result, 'a').x).toBeCloseTo(1500, 3);

    act(() => result.current.onNodeDragStop('a'));
    const frames = settle();

    expect(positionOf(result, 'a').x).toBeLessThan(1500 - 1);
    expect(frames).toBeGreaterThan(0);
    expect(frameQueue.length).toBe(0);
  });
});
