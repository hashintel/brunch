// @vitest-environment happy-dom

import { createElement } from 'react';

import { cleanup, render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, describe, expect, it } from 'vitest';

import { GraphNode } from '@/views/graph/GraphNode';
import { nodeColor, nodeSize } from '@/views/graph/nodeStyle';
import type { GraphNodeData, GraphNodeKind } from '@/views/graph/types';

// The eight knowledge kinds a graph node can represent. Mirrors the
// GraphNodeKind union in src/views/graph/types.ts.
const allKinds: GraphNodeKind[] = [
  'goal',
  'term',
  'context',
  'constraint',
  'requirement',
  'criterion',
  'decision',
  'assumption',
];

afterEach(cleanup);

function baseData(overrides: Partial<GraphNodeData> = {}): GraphNodeData {
  return { kind: 'goal', degree: 3, selected: false, dimmed: false, ...overrides };
}

// React Flow passes its custom node a NodeProps object. We supply the shape the
// renderer would, carrying the GraphNodeData payload the component renders from.
function makeProps(data: GraphNodeData) {
  return {
    id: `${data.kind}:1`,
    type: 'graphNode',
    data,
    selected: data.selected,
    dragging: false,
    isConnectable: true,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    width: undefined,
    height: undefined,
    deletable: true,
    selectable: true,
    draggable: true,
  };
}

function renderNode(data: GraphNodeData) {
  return render(
    createElement(
      ReactFlowProvider,
      null,
      // The component is typed as a React Flow node; cast loosely for the test harness.
      createElement(GraphNode as unknown as (p: unknown) => unknown, makeProps(data) as unknown),
    ),
  );
}

// Largest inline `width: <n>px` declared anywhere in the rendered markup. The
// node's degree-driven size dominates the small, fixed handle dimensions.
function maxWidthPx(html: string): number {
  const widths = [...html.matchAll(/width:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
  return widths.length > 0 ? Math.max(...widths) : 0;
}

function rootClass(container: HTMLElement): string {
  return container.firstElementChild?.getAttribute('class') ?? '';
}

describe('GraphNode — colored by kind', () => {
  it('paints each kind with its accent color from nodeStyle/kindAccentHex', () => {
    for (const kind of allKinds) {
      const { container } = renderNode(baseData({ kind }));
      expect(container.innerHTML.toLowerCase()).toContain(nodeColor(kind).toLowerCase());
      cleanup();
    }
  });

  it('renders distinct kinds with distinct colors', () => {
    const goal = renderNode(baseData({ kind: 'goal' }));
    const goalHtml = goal.container.innerHTML.toLowerCase();
    cleanup();
    const requirement = renderNode(baseData({ kind: 'requirement' }));
    const requirementHtml = requirement.container.innerHTML.toLowerCase();

    expect(goalHtml).toContain(nodeColor('goal').toLowerCase());
    expect(requirementHtml).toContain(nodeColor('requirement').toLowerCase());
    expect(goalHtml).not.toContain(nodeColor('requirement').toLowerCase());
  });
});

describe('GraphNode — sized by degree', () => {
  it('renders a more-connected node larger than a less-connected one', () => {
    const small = renderNode(baseData({ degree: 1 }));
    const smallWidth = maxWidthPx(small.container.innerHTML);
    cleanup();
    const big = renderNode(baseData({ degree: 16 }));
    const bigWidth = maxWidthPx(big.container.innerHTML);

    expect(bigWidth).toBeGreaterThan(smallWidth);
  });

  it('derives its rendered size from nodeSize(degree)', () => {
    const { container } = renderNode(baseData({ degree: 16 }));
    const width = maxWidthPx(container.innerHTML);
    expect(Math.abs(width - nodeSize(16))).toBeLessThanOrEqual(1);
  });

  it('still renders an isolated node (degree 0) with a positive size', () => {
    const { container } = renderNode(baseData({ degree: 0 }));
    expect(maxWidthPx(container.innerHTML)).toBeGreaterThan(0);
  });
});

describe('GraphNode — connection handles', () => {
  it('renders React Flow handles so edges can attach', () => {
    const { container } = renderNode(baseData());
    const handles = container.querySelectorAll('.react-flow__handle');
    expect(handles.length).toBeGreaterThanOrEqual(2);
  });

  it('exposes both a source and a target handle for directed edges', () => {
    const { container } = renderNode(baseData());
    const classes = Array.from(container.querySelectorAll('.react-flow__handle')).map(
      (h) => h.className,
    );
    expect(classes.some((c) => /\bsource\b/.test(c))).toBe(true);
    expect(classes.some((c) => /\btarget\b/.test(c))).toBe(true);
  });
});

describe('GraphNode — highlight / dim states', () => {
  it('marks a dimmed node with a dim state class', () => {
    const { container } = renderNode(baseData({ dimmed: true }));
    expect(rootClass(container)).toMatch(/dim/i);
  });

  it('does not dim a node that is not de-emphasized', () => {
    const { container } = renderNode(baseData({ dimmed: false }));
    expect(rootClass(container)).not.toMatch(/dim/i);
  });

  it('produces visibly different markup for dimmed vs un-dimmed nodes', () => {
    const dimmed = renderNode(baseData({ dimmed: true }));
    const dimmedClass = rootClass(dimmed.container);
    cleanup();
    const normal = renderNode(baseData({ dimmed: false }));
    const normalClass = rootClass(normal.container);

    expect(dimmedClass).not.toBe(normalClass);
  });

  it('marks a selected node with a highlight/selection state class', () => {
    const { container } = renderNode(baseData({ selected: true }));
    expect(rootClass(container)).toMatch(/select|highlight|active/i);
  });

  it('does not apply the selection state class to an unselected node', () => {
    const { container } = renderNode(baseData({ selected: false }));
    expect(rootClass(container)).not.toMatch(/select|highlight|active/i);
  });
});
