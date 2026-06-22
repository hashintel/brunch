// @vitest-environment happy-dom

/**
 * Oracle for the canvas overlay wiring (the join slice that owns GraphCanvas).
 *
 * GraphCanvas is the sole component that renders <ReactFlow>. This slice rewires
 * the *resting* overlays mounted inside that surface:
 *
 *   - the <MiniMap> overlay is REMOVED (React Flow tags its minimap panel with
 *     the `.react-flow__minimap` class; after this slice no such element exists),
 *   - the ZoomControl pill (marked `[data-zoom-control]`, with its
 *     [−] / percentage / [+] controls) is MOUNTED INSIDE <ReactFlow> so it can
 *     read the live transform via React Flow's store,
 *   - the bottom-left Legend (`[data-graph-legend]`, wrapped in a
 *     `bottom-… left-…` positioned container) is left EXACTLY as-is — still
 *     present, still inside the React Flow surface, still anchored bottom-left.
 *
 * The canvas is driven through its public surface: render GraphCanvas with a
 * real multi-kind entity state and wait for React Flow to settle (the canvas
 * lays out once in an effect, then renders `.react-flow`). The assertions pin
 * the observable overlay DOM, so they survive internal refactors of the canvas.
 */

import { cleanup, render, waitFor } from '@testing-library/react';
import { createElement as h } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { crossPhaseDecisionLink } from '@/client/__fixtures__/graph-view.js';
import { GraphCanvas } from '@/views/graph/GraphCanvas';

afterEach(() => {
  cleanup();
});

// A populated, multi-kind graph: goal + constraint + decision + requirement,
// so the canvas renders the React Flow surface and a non-empty Legend.
const ENTITIES = crossPhaseDecisionLink();

/**
 * Render the canvas and wait for React Flow to mount after its settle-once
 * layout effect resolves (until then the canvas shows only a loading spinner).
 */
async function renderSettledCanvas(): Promise<HTMLElement> {
  const { container } = render(h(GraphCanvas, { entityState: ENTITIES }));
  await waitFor(() => {
    expect(container.querySelector('.react-flow')).toBeTruthy();
  });
  return container;
}

describe('canvas overlay wiring: MiniMap removed', () => {
  it('mounts the React Flow surface for a populated graph', async () => {
    const container = await renderSettledCanvas();
    expect(container.querySelector('.react-flow')).toBeTruthy();
  });

  it('renders no MiniMap overlay inside the canvas', async () => {
    const container = await renderSettledCanvas();
    expect(container.querySelector('.react-flow__minimap')).toBeNull();
  });
});

describe('canvas overlay wiring: ZoomControl pill mounted inside <ReactFlow>', () => {
  it('mounts the ZoomControl pill', async () => {
    const container = await renderSettledCanvas();
    expect(container.querySelector('[data-zoom-control]')).not.toBeNull();
  });

  it('places the pill inside the React Flow surface (so it can read the live transform)', async () => {
    const container = await renderSettledCanvas();
    const surface = container.querySelector('.react-flow');
    const pill = container.querySelector('[data-zoom-control]');
    expect(surface).toBeTruthy();
    expect(pill).not.toBeNull();
    expect(surface?.contains(pill as Node)).toBe(true);
  });

  it('mounts the real pill composition: [−] [percentage] [+]', async () => {
    const container = await renderSettledCanvas();
    const pill = container.querySelector('[data-zoom-control]');
    expect(pill).not.toBeNull();
    expect(pill?.querySelector('[data-zoom-out]')).not.toBeNull();
    expect(pill?.querySelector('[data-zoom-percentage]')).not.toBeNull();
    expect(pill?.querySelector('[data-zoom-in]')).not.toBeNull();
  });
});

describe('canvas overlay wiring: bottom-left Legend left as-is', () => {
  it('still renders the Legend inside the React Flow surface', async () => {
    const container = await renderSettledCanvas();
    const surface = container.querySelector('.react-flow');
    const legend = container.querySelector('[data-graph-legend]');
    expect(legend).not.toBeNull();
    expect(surface?.contains(legend as Node)).toBe(true);
  });

  it('keeps the Legend anchored bottom-left', async () => {
    const container = await renderSettledCanvas();
    const legend = container.querySelector('[data-graph-legend]');
    expect(legend).not.toBeNull();
    const wrapper = legend?.parentElement;
    expect(wrapper).not.toBeNull();
    const cls = wrapper?.className ?? '';
    expect(cls).toMatch(/\bbottom-/);
    expect(cls).toMatch(/\bleft-/);
  });
});
