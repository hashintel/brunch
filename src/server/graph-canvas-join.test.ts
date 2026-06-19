// @vitest-environment happy-dom

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  crossPhaseDecisionLink,
  denseGoalAnchor,
  emptySpec,
} from '@/client/__fixtures__/graph-view.js';
import { SpatialGraph } from '@/views/graph/SpatialGraph';
import { nodeColor } from '@/views/graph/nodeStyle';

// src/server/graph-canvas-join.test.ts -> repo root
const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const componentPath = resolve(packageRoot, 'src/views/graph/SpatialGraph.tsx');

/**
 * React Flow measures its container and node sizes through ResizeObserver,
 * DOMMatrixReadOnly and the element offset getters — none of which exist in a
 * headless DOM. Install the standard @xyflow/react test doubles so the canvas
 * and its node wrappers actually render. This is test plumbing, not a stand-in
 * for the behaviour under test.
 */
function mockReactFlow() {
  class MockResizeObserver {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: { width: 40, height: 40, top: 0, left: 0, right: 40, bottom: 40 },
          } as unknown as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = MockResizeObserver;

  class MockDOMMatrixReadOnly {
    m22: number;
    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([\d.]+)\)/)?.[1];
      this.m22 = scale === undefined ? 1 : Number(scale);
    }
  }
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly =
    MockDOMMatrixReadOnly;

  try {
    Object.defineProperties(globalThis.HTMLElement.prototype, {
      offsetHeight: {
        configurable: true,
        get() {
          return parseFloat((this as HTMLElement).style.height) || 40;
        },
      },
      offsetWidth: {
        configurable: true,
        get() {
          return parseFloat((this as HTMLElement).style.width) || 40;
        },
      },
    });
  } catch {
    // offset getters already redefined by an earlier test in this worker
  }

  (globalThis.SVGElement.prototype as unknown as { getBBox: () => unknown }).getBBox = () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  (
    globalThis.Element.prototype as unknown as { getBoundingClientRect: () => unknown }
  ).getBoundingClientRect = function () {
    return { x: 0, y: 0, top: 0, left: 0, bottom: 40, right: 40, width: 40, height: 40, toJSON() {} };
  };
}

beforeAll(() => {
  mockReactFlow();
});

afterEach(() => {
  cleanup();
});

/** Render a populated graph and wait until React Flow has painted its canvas. */
async function renderGraph(entityState = crossPhaseDecisionLink()) {
  const result = render(createElement(SpatialGraph, { entityState }));
  await waitFor(() => {
    expect(result.container.querySelector('.react-flow')).toBeTruthy();
  });
  return result;
}

/** Parse the `translate(Xpx, Ypx)` from a React Flow node wrapper's transform. */
function nodeTranslate(el: Element): { x: number; y: number } {
  const transform = (el as HTMLElement).style.transform;
  const match = transform.match(/translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/);
  if (match === null) {
    throw new Error(`node wrapper has no translate transform: "${transform}"`);
  }
  return { x: Number(match[1]), y: Number(match[2]) };
}

describe('SpatialGraph module', () => {
  it('is the sole composing component at src/views/graph/SpatialGraph.tsx', () => {
    expect(existsSync(componentPath)).toBe(true);
  });
});

describe('SpatialGraph — empty spec delegation', () => {
  it('delegates to GraphEmptyState when the spec has no knowledge', () => {
    const { container } = render(createElement(SpatialGraph, { entityState: emptySpec() }));

    // GraphEmptyState marks its orientation card with data-graph-empty-state.
    expect(container.querySelector('[data-graph-empty-state]')).toBeTruthy();
  });

  it('does not mount the React Flow canvas for an empty spec', () => {
    const { container } = render(createElement(SpatialGraph, { entityState: emptySpec() }));

    expect(container.querySelector('.react-flow')).toBeNull();
  });
});

describe('SpatialGraph — renders the canvas for a populated spec', () => {
  it('mounts the React Flow canvas rather than the empty state', async () => {
    const { container } = await renderGraph();

    expect(container.querySelector('.react-flow')).toBeTruthy();
    expect(container.querySelector('[data-graph-empty-state]')).toBeNull();
  });

  it('places nodes at the settled force-layout positions (computed before paint, no fly-in)', async () => {
    const { container } = await renderGraph();

    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__node').length).toBeGreaterThanOrEqual(2);
    });

    const positions = Array.from(container.querySelectorAll('.react-flow__node')).map(
      nodeTranslate,
    );

    // Every node already carries a finite layout position on first paint...
    for (const { x, y } of positions) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
    // ...and the force layout spreads them out rather than stacking at one origin.
    const distinct = new Set(positions.map(({ x, y }) => `${x},${y}`));
    expect(distinct.size).toBeGreaterThan(1);
  });
});

describe('SpatialGraph — wires the model into React Flow nodes', () => {
  it('renders one React Flow node per knowledge item in the spec', async () => {
    const { container } = await renderGraph();

    // crossPhaseDecisionLink: goal + constraint + decision + requirement = 4.
    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__node').length).toBe(4);
    });
  });

  it('scales the node count with the projected model (dense hub fixture)', async () => {
    const { container } = await renderGraph(denseGoalAnchor());

    // denseGoalAnchor: 1 goal + 15 decisions = 16 nodes.
    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__node').length).toBe(16);
    });
  });

  it('renders GraphNode for each node, colored by its knowledge kind', async () => {
    const { container } = await renderGraph();

    await waitFor(() => {
      expect(container.querySelector('.react-flow__node .graph-node')).toBeTruthy();
    });
    // GraphNode paints its kind accent color; the goal node carries the goal accent.
    expect(container.innerHTML.toLowerCase()).toContain(nodeColor('goal').toLowerCase());
  });
});

describe('SpatialGraph — pan/zoom and minimap', () => {
  it('renders the React Flow minimap', async () => {
    const { container } = await renderGraph();

    await waitFor(() => {
      expect(container.querySelector('.react-flow__minimap')).toBeTruthy();
    });
  });

  it('renders the pannable, zoomable viewport surface', async () => {
    const { container } = await renderGraph();

    // The pane is the pan target; the viewport carries the zoom transform.
    expect(container.querySelector('.react-flow__pane')).toBeTruthy();
    expect(container.querySelector('.react-flow__viewport')).toBeTruthy();
  });
});

describe('SpatialGraph — selection emphasis via useGraphSelection', () => {
  it('highlights a clicked node and dims items it is not connected to (proving edges are wired into the model)', async () => {
    const { container } = await renderGraph();

    await waitFor(() => {
      expect(container.querySelector('.react-flow__node[data-id="goal:10"]')).toBeTruthy();
    });

    // Topology: decision:30 -> goal:10, constraint:20 -> decision:30,
    // requirement:40 -> decision:30. Selecting goal:10 highlights it and its
    // one-hop neighbour decision:30, and dims constraint:20 (two hops away).
    // decision:30 stays un-dimmed ONLY if the goal<->decision edge is in the
    // model — so this also proves the edges were wired through.
    const goalNode = container.querySelector('.react-flow__node[data-id="goal:10"]');
    if (goalNode === null) throw new Error('goal node not rendered');
    fireEvent.click(goalNode);

    await waitFor(() => {
      expect(
        container.querySelector('.react-flow__node[data-id="goal:10"] .graph-node.is-selected'),
      ).toBeTruthy();
    });

    expect(
      container.querySelector('.react-flow__node[data-id="constraint:20"] .graph-node.is-dimmed'),
    ).toBeTruthy();
    expect(
      container.querySelector('.react-flow__node[data-id="decision:30"] .graph-node.is-dimmed'),
    ).toBeNull();
  });
});
