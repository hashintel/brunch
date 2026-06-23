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

import { forceLayout } from '@/views/graph/forceLayout.js';
import type { SimModel } from '@/views/graph/graphForces.js';
import type { GraphNodeData, GraphNodeKind } from '@/views/graph/types.js';
import { useForceLayout } from '@/views/graph/useForceLayout.js';

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

  it('moves nodes off their seed positions as the simulation ticks', () => {
    const m = model();
    const { result } = renderHook(() => useForceLayout(m));
    const seed = positionsById(result.current.nodes);

    settle();

    const settled = positionsById(result.current.nodes);
    const moved = [...settled].some(([id, p]) => {
      const start = seed.get(id)!;
      return Math.hypot(p.x - start.x, p.y - start.y) > 1;
    });
    expect(moved).toBe(true);
  });

  it('settles into the same layout the synchronous forceLayout produces', () => {
    const m = model();
    const { result } = renderHook(() => useForceLayout(m));

    settle();

    const live = positionsById(result.current.nodes);
    for (const expected of forceLayout(m)) {
      const actual = live.get(expected.id)!;
      expect(actual.x).toBeCloseTo(expected.position.x, 4);
      expect(actual.y).toBeCloseTo(expected.position.y, 4);
    }
  });

  it('parks the frame loop once settled (no infinite ticking)', () => {
    const m = model();
    renderHook(() => useForceLayout(m));

    settle();

    expect(frameQueue.length).toBe(0);
  });

  it('returns no nodes and schedules no frames for an empty model', () => {
    const empty: SimModel = { nodes: [], edges: [] };
    const { result } = renderHook(() => useForceLayout(empty));

    expect(result.current.nodes).toEqual([]);
    expect(frameQueue.length).toBe(0);
  });
});
