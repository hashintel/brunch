// @vitest-environment happy-dom

/**
 * Oracle for the `graph-node-renderer` slice.
 *
 * The slice implements the GraphNode renderer at `src/graph/GraphNode.tsx` as a
 * rectangular *card* that replaces the old rounded-full dot:
 *
 *   - collapsed, it shows the item's reference code and name, accented by kind
 *     via `nodeColor` and laid out on the single uniform `cardFootprint`;
 *   - it expands to reveal the item's rationale as a z-raised overlay that
 *     floats above neighbours WITHOUT changing the card's collapsed footprint
 *     (no layout reflow / no simulation re-run);
 *   - assumption nodes with no rationale show a "no reasoning recorded"
 *     affordance instead of empty rationale;
 *   - it retains source/target connection handles so edges can attach.
 *
 * These tests drive the component through its public React Flow node surface
 * (the `data` payload + user interaction), so they survive internal refactors
 * but pin the documented rendering contract.
 */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { createElement, type ComponentType } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { knowledgeKinds, type KnowledgeKind } from '@/shared/knowledge.js';
import { cardFootprint } from '@/views/graph/cardFootprint';
import { GraphNode } from '@/views/graph/GraphNode';
import { nodeColor } from '@/views/graph/nodeColor';

afterEach(cleanup);

// The render payload the card draws from: the existing kind/degree/selected/
// dimmed fields plus the reference code, name (content), and rationale carried
// from the knowledge item it represents.
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

// React Flow hands its custom node a NodeProps object carrying the data payload.
function makeProps(data: RenderData) {
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

function renderNode(data: RenderData) {
  return render(
    createElement(
      ReactFlowProvider,
      null,
      // Typed as a React Flow node; cast loosely for the test harness.
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
function stylePx(el: Element, prop: string): number | undefined {
  const style = el.getAttribute('style') ?? '';
  const m = style.match(new RegExp(`${prop}:\\s*([\\d.]+)px`));
  return m ? Number(m[1]) : undefined;
}

/** True when some element in the tree is sized exactly to the uniform footprint. */
function hasFootprintBox(container: HTMLElement): boolean {
  return Array.from(container.querySelectorAll('*')).some(
    (el) => stylePx(el, 'width') === cardFootprint.width && stylePx(el, 'height') === cardFootprint.height,
  );
}

/** Highest inline z-index declared anywhere in the rendered tree (0 if none). */
function maxZIndex(container: HTMLElement): number {
  let max = 0;
  for (const el of container.querySelectorAll('*')) {
    const style = el.getAttribute('style') ?? '';
    const m = style.match(/z-index:\s*(-?\d+)/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/** Click the card root to toggle its expanded state. */
function toggleExpand(container: HTMLElement): void {
  fireEvent.click(rootEl(container));
}

describe('GraphNode — collapsed card identity', () => {
  it('renders a rectangular card, not the old rounded-full dot', () => {
    const { container } = renderNode(baseData());
    expect(container.innerHTML).not.toContain('rounded-full');
  });

  it('shows the reference code in the collapsed state', () => {
    const { container } = renderNode(baseData({ referenceCode: 'R42' }));
    expect(container.textContent ?? '').toContain('R42');
  });

  it("shows the item's name (content) in the collapsed state", () => {
    const { container } = renderNode(baseData({ content: 'Encrypt data at rest' }));
    expect(container.textContent ?? '').toContain('Encrypt data at rest');
  });

  it('lays the collapsed card out on the single uniform footprint', () => {
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
});

describe('GraphNode — accented by kind via nodeColor', () => {
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

describe('GraphNode — expand to reveal rationale', () => {
  it('starts collapsed (no expanded state class)', () => {
    const { container } = renderNode(baseData());
    expect(rootClass(container)).not.toMatch(/expand/i);
  });

  it('marks the card expanded after the expand affordance is activated', () => {
    const { container } = renderNode(baseData());
    toggleExpand(container);
    expect(rootClass(container)).toMatch(/expand/i);
  });

  it('reveals the rationale text once expanded', () => {
    const rationale = 'Regulatory audit requires a durable record';
    const { container } = renderNode(baseData({ rationale }));
    toggleExpand(container);
    expect(container.textContent ?? '').toContain(rationale);
  });

  it('renders the rationale inside the card overlay element', () => {
    const rationale = 'Regulatory audit requires a durable record';
    const { container } = renderNode(baseData({ rationale }));
    toggleExpand(container);
    const overlay = container.querySelector('.graph-node__card-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent ?? '').toContain(rationale);
  });

  it('collapses again when the affordance is toggled back', () => {
    const { container } = renderNode(baseData());
    toggleExpand(container);
    expect(rootClass(container)).toMatch(/expand/i);
    toggleExpand(container);
    expect(rootClass(container)).not.toMatch(/expand/i);
  });
});

describe('GraphNode — overlay floats above neighbours without reflow', () => {
  it('z-raises the node when expanded so the overlay floats above neighbours', () => {
    const { container } = renderNode(baseData());
    const collapsedZ = maxZIndex(container);
    toggleExpand(container);
    expect(maxZIndex(container)).toBeGreaterThan(collapsedZ);
  });

  it('keeps the collapsed card footprint unchanged when expanded (no layout reflow)', () => {
    const { container } = renderNode(baseData());
    expect(hasFootprintBox(container)).toBe(true);
    toggleExpand(container);
    // The card box itself stays the uniform footprint; the rationale is an
    // overlay, so revealing it never grows the packed card.
    expect(hasFootprintBox(container)).toBe(true);
  });
});

describe('GraphNode — assumption with no rationale', () => {
  it('shows a "no reasoning recorded" affordance for an assumption with empty rationale', () => {
    const { container } = renderNode(baseData({ kind: 'assumption', rationale: '' }));
    toggleExpand(container);
    expect((container.textContent ?? '').toLowerCase()).toContain('no reasoning recorded');
  });

  it('does not invent a "no reasoning recorded" affordance when an assumption has a rationale', () => {
    const rationale = 'Assumed because the spec predates the new auth flow';
    const { container } = renderNode(baseData({ kind: 'assumption', rationale }));
    toggleExpand(container);
    const text = (container.textContent ?? '').toLowerCase();
    expect(text).toContain(rationale.toLowerCase());
    expect(text).not.toContain('no reasoning recorded');
  });
});
