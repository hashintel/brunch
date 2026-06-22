// @vitest-environment happy-dom

/**
 * Oracle for the read-only GraphNode card.
 *
 * The graph view is a read-only knowledge map: users explore edges, hover focus,
 * neighbour dimming, and the detail panel — but they must NOT be able to draw new
 * edges by dragging from a node's connect anchors. This slice disables the
 * connect-drag affordance on GraphNode by making its React Flow handles
 * non-connectable, while leaving the handles themselves in place so existing
 * edges still attach and render.
 *
 * React Flow tags a Handle with the `connectable` (and `connectionindicator`)
 * class only when that handle accepts new connections (`isConnectable` truthy).
 * These tests drive GraphNode through its public React Flow node surface and
 * assert on that observable class contract, so they survive internal refactors
 * but pin the read-only behaviour.
 */

import { cleanup, render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { createElement, type ComponentType } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { KnowledgeKind } from '@/shared/knowledge.js';
import { GraphNode } from '@/views/graph/GraphNode';

afterEach(cleanup);

interface RenderData {
  kind: KnowledgeKind;
  degree: number;
  selected: boolean;
  dimmed: boolean;
  referenceCode: string;
  content: string;
  rationale: string;
}

function baseData(overrides: Partial<RenderData> = {}): RenderData {
  return {
    kind: 'requirement',
    degree: 3,
    selected: false,
    dimmed: false,
    referenceCode: 'R7',
    content: 'Persist drafts to disk',
    rationale: 'Users lose work when the tab closes',
    ...overrides,
  };
}

function makeProps(data: RenderData) {
  return {
    id: `${data.kind}:1`,
    type: 'graph',
    data,
    selected: data.selected,
    dragging: false,
    // The canvas advertises nodes as connectable at the React Flow level; the
    // node component itself is responsible for refusing the connect affordance.
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

function renderNode(data: RenderData) {
  return render(
    createElement(
      ReactFlowProvider,
      null,
      createElement(
        GraphNode as unknown as ComponentType<Record<string, unknown>>,
        makeProps(data) as unknown as Record<string, unknown>,
      ),
    ),
  );
}

function handles(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('.react-flow__handle')) as HTMLElement[];
}

describe('GraphNode — read-only: no connect-drag affordance', () => {
  it('keeps the handles in the DOM so existing edges can still attach', () => {
    const { container } = renderNode(baseData());
    expect(handles(container).length).toBeGreaterThanOrEqual(2);
  });

  it('marks no handle as connectable, so users cannot start a new edge', () => {
    const { container } = renderNode(baseData());
    const hs = handles(container);
    expect(hs.length).toBeGreaterThanOrEqual(2);
    for (const h of hs) {
      expect(h.classList.contains('connectable')).toBe(false);
    }
  });

  it('shows no connection indicator on any handle', () => {
    const { container } = renderNode(baseData());
    for (const h of handles(container)) {
      expect(h.classList.contains('connectionindicator')).toBe(false);
    }
  });

  it('disables the connect affordance regardless of the kind rendered', () => {
    for (const kind of ['goal', 'decision', 'requirement'] as KnowledgeKind[]) {
      const { container } = renderNode(baseData({ kind }));
      for (const h of handles(container)) {
        expect(h.classList.contains('connectable')).toBe(false);
      }
      cleanup();
    }
  });

  it('still preserves directed source and target handles (edge rendering untouched)', () => {
    const { container } = renderNode(baseData());
    const classes = handles(container).map((h) => h.className);
    expect(classes.some((c) => /\bsource\b/.test(c))).toBe(true);
    expect(classes.some((c) => /\btarget\b/.test(c))).toBe(true);
  });
});
