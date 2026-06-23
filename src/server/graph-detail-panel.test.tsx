// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { createElement as h } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GraphDetailPanel } from '@/views/graph/GraphDetailPanel';
import type { GraphDetail } from '@/views/graph/types';

afterEach(() => {
  cleanup();
});

const detail: GraphDetail = {
  kind: 'requirement',
  referenceCode: 'R1',
  content: 'The requirement',
  rationale: 'Because',
  connections: [
    {
      direction: 'outgoing',
      relationship: 'depends_on',
      otherId: 'goal:7',
      otherKind: 'goal',
      otherReference: 'G7',
      otherContent: 'The goal',
    },
  ],
};

describe('GraphDetailPanel', () => {
  it('selects the connected node when a connection is clicked', () => {
    const onSelect = vi.fn();
    const { container } = render(h(GraphDetailPanel, { detail, onClose: () => {}, onSelect }));

    const connection = container.querySelector('[data-graph-detail-connection="goal:7"]');
    expect(connection).not.toBeNull();

    fireEvent.click(connection!);
    expect(onSelect).toHaveBeenCalledWith('goal:7');
  });
});
