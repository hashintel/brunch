// @vitest-environment happy-dom

/**
 * Oracle for the ZoomControl pill.
 *
 * ZoomControl is a small pill rendered center-bottom inside the React Flow
 * canvas with the composition [−] [percentage] [+]. Its contract:
 *
 *   - The percentage readout is the *live* zoom level, sourced reactively from
 *     React Flow's transform scale via `useStore((s) => s.transform[2])`. When
 *     the transform scale changes, the readout changes with it.
 *   - The [−] button triggers React Flow's `zoomOut` (from `useReactFlow`).
 *   - The [+] button triggers React Flow's `zoomIn`.
 *   - Clicking the percentage re-frames all nodes to fill the viewport via
 *     `fitView` (matching mount behavior) — it does NOT snap zoom back to 100%.
 *
 * The hooks `useStore` and `useReactFlow` come from the `@xyflow/react`
 * framework, so the component is exercised through its rendered/interactive
 * surface with those framework hooks stubbed to controllable values. The
 * component is queried through stable data attributes, mirroring the
 * convention used by the other graph-view components (e.g. GraphEdge's
 * `data-graph-edge` / `data-relationship`).
 *
 * Contract data attributes:
 *   - `[data-zoom-control]`     the root pill element
 *   - `[data-zoom-out]`         the [−] control (zoom out)
 *   - `[data-zoom-percentage]`  the live percentage readout (also the fitView trigger)
 *   - `[data-zoom-in]`          the [+] control (zoom in)
 */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { createElement as h } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  state: { transform: [0, 0, 1] as [number, number, number] },
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  fitView: vi.fn(),
  setViewport: vi.fn(),
  zoomTo: vi.fn(),
}));

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@xyflow/react');
  return {
    ...actual,
    useStore: (selector: (s: typeof mocks.state) => unknown) => selector(mocks.state),
    useReactFlow: () => ({
      zoomIn: mocks.zoomIn,
      zoomOut: mocks.zoomOut,
      fitView: mocks.fitView,
      setViewport: mocks.setViewport,
      zoomTo: mocks.zoomTo,
    }),
  };
});

// Component under test. Lives alongside the other graph-view modules.
import { ZoomControl } from '@/client/components/graph/ZoomControl';

function setScale(scale: number): void {
  mocks.state.transform = [0, 0, scale];
}

function renderControl() {
  const result = render(h(ZoomControl));
  const root = result.container.querySelector('[data-zoom-control]');
  if (root === null) {
    throw new Error('ZoomControl did not render an element marked with data-zoom-control');
  }
  return { ...result, root };
}

function digits(text: string | null | undefined): string {
  return (text ?? '').replace(/[^0-9]/g, '');
}

beforeEach(() => {
  setScale(1);
  mocks.zoomIn.mockClear();
  mocks.zoomOut.mockClear();
  mocks.fitView.mockClear();
  mocks.setViewport.mockClear();
  mocks.zoomTo.mockClear();
});

afterEach(cleanup);

describe('ZoomControl — composition', () => {
  it('renders a pill containing zoom-out, percentage, and zoom-in controls', () => {
    const { root } = renderControl();
    expect(root.querySelector('[data-zoom-out]')).not.toBeNull();
    expect(root.querySelector('[data-zoom-percentage]')).not.toBeNull();
    expect(root.querySelector('[data-zoom-in]')).not.toBeNull();
  });

  it('orders the controls as [−] [percentage] [+]', () => {
    const { root } = renderControl();
    const markers = Array.from(
      root.querySelectorAll('[data-zoom-out],[data-zoom-percentage],[data-zoom-in]'),
    ).map((el) => {
      if (el.hasAttribute('data-zoom-out')) return 'out';
      if (el.hasAttribute('data-zoom-percentage')) return 'pct';
      return 'in';
    });
    expect(markers).toEqual(['out', 'pct', 'in']);
  });
});

describe('ZoomControl — live percentage readout', () => {
  it('shows 100% when the transform scale is 1', () => {
    setScale(1);
    const { root } = renderControl();
    expect(digits(root.querySelector('[data-zoom-percentage]')?.textContent)).toBe('100');
    expect(root.querySelector('[data-zoom-percentage]')?.textContent).toContain('%');
  });

  it('derives the readout from the transform scale (0.5 → 50%, 2 → 200%)', () => {
    setScale(0.5);
    const half = renderControl();
    expect(digits(half.root.querySelector('[data-zoom-percentage]')?.textContent)).toBe('50');
    cleanup();

    setScale(2);
    const double = renderControl();
    expect(digits(double.root.querySelector('[data-zoom-percentage]')?.textContent)).toBe('200');
  });

  it('reacts to a changed transform scale on re-render', () => {
    setScale(1);
    const { root, rerender } = renderControl();
    expect(digits(root.querySelector('[data-zoom-percentage]')?.textContent)).toBe('100');

    setScale(0.75);
    rerender(h(ZoomControl));
    expect(digits(root.querySelector('[data-zoom-percentage]')?.textContent)).toBe('75');
  });
});

describe('ZoomControl — actions', () => {
  it('steps zoom out by 10% when the [−] control is clicked', () => {
    setScale(1);
    const { root } = renderControl();
    fireEvent.click(root.querySelector('[data-zoom-out]') as Element);
    expect(mocks.zoomTo).toHaveBeenCalledWith(0.9);
  });

  it('steps zoom in by 10% when the [+] control is clicked', () => {
    setScale(1);
    const { root } = renderControl();
    fireEvent.click(root.querySelector('[data-zoom-in]') as Element);
    expect(mocks.zoomTo).toHaveBeenCalledWith(1.1);
  });

  it('snaps a fractional zoom to the nearest 10% mark when stepping', () => {
    setScale(0.43);
    const { root } = renderControl();
    fireEvent.click(root.querySelector('[data-zoom-in]') as Element);
    expect(mocks.zoomTo).toHaveBeenCalledWith(0.5);
  });

  it('clamps zoom out at the minimum', () => {
    setScale(0.1);
    const { root } = renderControl();
    fireEvent.click(root.querySelector('[data-zoom-out]') as Element);
    expect(mocks.zoomTo).toHaveBeenCalledWith(0.1);
  });

  it('fits all nodes (capped at 100%) when the percentage is clicked', () => {
    const { root } = renderControl();
    fireEvent.click(root.querySelector('[data-zoom-percentage]') as Element);
    expect(mocks.fitView).toHaveBeenCalledWith({ minZoom: 0.1, maxZoom: 1 });
    expect(mocks.zoomTo).not.toHaveBeenCalled();
  });
});
