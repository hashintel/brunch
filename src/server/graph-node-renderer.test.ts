// @vitest-environment happy-dom

/**
 * Oracle for the GraphNode card renderer.
 *
 * GraphNode renders a knowledge item as a rectangular card on the single uniform
 * `cardFootprint`, reusing the knowledge-card visual language: a KindBadge +
 * reference code + a name. Kind is accented via `nodeColor` (a CSS var driving
 * the accent bar / selection ring). Selection and neighbour-dimming are driven
 * by the `data` payload — the canvas owns that state; full rationale and
 * connections live in the side panel, not on the card. Source/target handles are
 * retained so edges can attach.
 *
 * These tests drive the component through its public React Flow node surface
 * (the `data` payload), so they survive internal refactors but pin the contract.
 */

import { cleanup, render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { createElement, type ComponentType } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { knowledgeKinds, knowledgeKindReferencePrefixes, type KnowledgeKind } from '@/shared/knowledge.js';
import { cardFootprint } from '@/views/graph/cardFootprint';
import { GraphNode } from '@/views/graph/GraphNode';
import { nodeColor } from '@/views/graph/graphStyle';

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

function rootEl(container: HTMLElement): HTMLElement {
  const el = container.firstElementChild;
  if (!(el instanceof HTMLElement)) throw new Error('node root not rendered');
  return el;
}

function rootClass(container: HTMLElement): string {
  return rootEl(container).getAttribute('class') ?? '';
}

/** Numeric pixel value of an inline style property on a single element, or undefined. */
function stylePx(el: Element, prop: 'width' | 'height'): number | undefined {
  if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) return undefined;
  const value = el.style[prop];
  return value.endsWith('px') ? Number.parseFloat(value) : undefined;
}

/** True when some element in the tree is sized exactly to the uniform footprint. */
function hasFootprintBox(container: HTMLElement): boolean {
  return Array.from(container.querySelectorAll('*')).some(
    (el) => stylePx(el, 'width') === cardFootprint.width && stylePx(el, 'height') === cardFootprint.height,
  );
}

describe('GraphNode — card identity', () => {
  it('renders a rectangular card, not the old rounded-full dot', () => {
    const { container } = renderNode(baseData());
    expect(container.innerHTML).not.toContain('rounded-full');
  });

  it('shows the reference code', () => {
    const { container } = renderNode(baseData({ referenceCode: 'R42' }));
    expect(container.textContent ?? '').toContain('R42');
  });

  it("shows the item's name (content)", () => {
    const { container } = renderNode(baseData({ content: 'Encrypt data at rest' }));
    expect(container.textContent ?? '').toContain('Encrypt data at rest');
  });

  it('lays the card out on the single uniform footprint', () => {
    const { container } = renderNode(baseData());
    expect(hasFootprintBox(container)).toBe(true);
  });

  it('uses the SAME footprint regardless of degree (uniform, not degree-sized)', () => {
    const small = renderNode(baseData({ degree: 1 }));
    expect(hasFootprintBox(small.container)).toBe(true);
    cleanup();
    const big = renderNode(baseData({ degree: 16 }));
    expect(hasFootprintBox(big.container)).toBe(true);
  });

  it('clamps the name so a long title cannot overflow the fixed card', () => {
    const { container } = renderNode(baseData());
    const clamped = container.querySelector('.line-clamp-2');
    expect(clamped).not.toBeNull();
    expect(clamped?.textContent ?? '').toContain('Persist drafts to disk');
  });
});

describe('GraphNode — reuses the knowledge-card kind language', () => {
  it("renders the kind's badge prefix alongside the reference code", () => {
    for (const kind of knowledgeKinds) {
      const { container } = renderNode(baseData({ kind, referenceCode: 'X1' }));
      expect(container.textContent ?? '').toContain(knowledgeKindReferencePrefixes[kind]);
      cleanup();
    }
  });

  it('paints each kind with its accent color from nodeColor', () => {
    for (const kind of knowledgeKinds) {
      const { container } = renderNode(baseData({ kind }));
      expect(container.innerHTML.toLowerCase()).toContain(nodeColor(kind).toLowerCase());
      cleanup();
    }
  });

  it('accents distinct kinds with distinct colors', () => {
    const goal = renderNode(baseData({ kind: 'goal' }));
    const goalHtml = goal.container.innerHTML.toLowerCase();
    cleanup();
    const decision = renderNode(baseData({ kind: 'decision' }));
    const decisionHtml = decision.container.innerHTML.toLowerCase();

    expect(goalHtml).toContain(nodeColor('goal').toLowerCase());
    expect(decisionHtml).toContain(nodeColor('decision').toLowerCase());
    expect(goalHtml).not.toContain(nodeColor('decision').toLowerCase());
  });
});

describe('GraphNode — connection handles', () => {
  it('retains React Flow handles so edges can attach', () => {
    const { container } = renderNode(baseData());
    expect(container.querySelectorAll('.react-flow__handle').length).toBeGreaterThanOrEqual(2);
  });

  it('exposes both a source and a target handle for directed edges', () => {
    const { container } = renderNode(baseData());
    const classes = Array.from(container.querySelectorAll('.react-flow__handle')).map((h) => h.className);
    expect(classes.some((c) => /\bsource\b/.test(c))).toBe(true);
    expect(classes.some((c) => /\btarget\b/.test(c))).toBe(true);
  });
});

describe('GraphNode — canvas-driven selection / dimming state', () => {
  it('is neither selected nor dimmed by default', () => {
    const cls = rootClass(renderNode(baseData()).container);
    expect(cls).not.toMatch(/is-selected/);
    expect(cls).not.toMatch(/is-dimmed/);
  });

  it('marks the selected state from data so the stylesheet can emphasise it', () => {
    expect(rootClass(renderNode(baseData({ selected: true })).container)).toMatch(/is-selected/);
  });

  it('marks the dimmed state from data so de-emphasised neighbours fade', () => {
    expect(rootClass(renderNode(baseData({ dimmed: true })).container)).toMatch(/is-dimmed/);
  });
});
