// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { createElement as h } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GraphLayoutToggle } from '@/client/components/graph/GraphLayoutToggle';

afterEach(() => {
  cleanup();
});

describe('GraphLayoutToggle', () => {
  it('offers the three layout modes', () => {
    const { container } = render(h(GraphLayoutToggle, { mode: 'force', onChange: () => {} }));
    for (const mode of ['force', 'workflow', 'free']) {
      expect(container.querySelector(`[data-graph-layout-mode="${mode}"]`)).not.toBeNull();
    }
  });

  it('marks the active mode as pressed', () => {
    const { container } = render(h(GraphLayoutToggle, { mode: 'workflow', onChange: () => {} }));
    expect(container.querySelector('[data-graph-layout-mode="workflow"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(container.querySelector('[data-graph-layout-mode="force"]')?.getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('reports the chosen mode on click', () => {
    const onChange = vi.fn();
    const { container } = render(h(GraphLayoutToggle, { mode: 'force', onChange }));
    fireEvent.click(container.querySelector('[data-graph-layout-mode="free"]')!);
    expect(onChange).toHaveBeenCalledWith('free');
  });
});
