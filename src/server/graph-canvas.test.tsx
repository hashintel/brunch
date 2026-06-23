// @vitest-environment happy-dom

import { cleanup, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { crossPhaseDecisionLink, singleItemNoEdges } from '@/client/__fixtures__/graph-view.js';

const reactFlowRenders = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('@xyflow/react', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    ReactFlow: (props: Record<string, unknown> & { children?: unknown }) => {
      reactFlowRenders.push(props);
      return React.createElement('div', { 'data-react-flow': '' });
    },
    Handle: () => React.createElement('span', { 'data-react-flow-handle': '' }),
    Position: { Top: 'top', Bottom: 'bottom' },
    useReactFlow: () => ({ fitView: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn() }),
    useStore: <T,>(selector: (state: { transform: [number, number, number] }) => T) =>
      selector({ transform: [0, 0, 1] }),
  };
});

import { GraphCanvas } from '@/views/graph/GraphCanvas.js';

afterEach(() => {
  cleanup();
  reactFlowRenders.length = 0;
});

function lastReactFlowProps() {
  const props = reactFlowRenders.at(-1);
  if (props === undefined) throw new Error('ReactFlow did not render');
  return props;
}

function renderedNodes() {
  return lastReactFlowProps().nodes as Array<{ id: string; position: { x: number; y: number } }>;
}

describe('GraphCanvas', () => {
  it('renders React Flow immediately with synchronously positioned nodes', () => {
    render(createElement(GraphCanvas, { entityState: singleItemNoEdges() }));

    expect(document.querySelector('[data-graph-loading]')).toBeNull();
    expect(renderedNodes()).toHaveLength(1);
  });

  it('uses fresh positions immediately when the entity state changes', () => {
    const { rerender } = render(createElement(GraphCanvas, { entityState: singleItemNoEdges() }));
    expect(renderedNodes()).toHaveLength(1);

    rerender(createElement(GraphCanvas, { entityState: crossPhaseDecisionLink() }));

    const nodes = renderedNodes();
    expect(nodes).toHaveLength(4);
    expect(nodes.some((node) => node.position.x !== 0 || node.position.y !== 0)).toBe(true);
  });

  it('marks the canvas read-only at the React Flow level', () => {
    render(createElement(GraphCanvas, { entityState: crossPhaseDecisionLink() }));

    const props = lastReactFlowProps();
    expect(props.nodesDraggable).toBe(false);
    expect(props.nodesConnectable).toBe(false);
  });
});
