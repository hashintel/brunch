// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { createElement as h } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GraphDetailPanel } from '@/client/components/graph/GraphDetailPanel';
import type { GraphDetail } from '@/client/components/graph/types';

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

const noopProps = {
  editing: false,
  onClose: () => {},
  onSelect: () => {},
  onStartEdit: () => {},
  onCancelEdit: () => {},
  onSave: () => {},
};

describe('GraphDetailPanel', () => {
  it('selects the connected node when a connection is clicked', () => {
    const onSelect = vi.fn();
    const { container } = render(h(GraphDetailPanel, { ...noopProps, detail, onSelect }));

    const connection = container.querySelector('[data-graph-detail-connection="goal:7"]');
    expect(connection).not.toBeNull();

    fireEvent.click(connection!);
    expect(onSelect).toHaveBeenCalledWith('goal:7');
  });

  it('starts editing from the header edit button', () => {
    const onStartEdit = vi.fn();
    const { container } = render(h(GraphDetailPanel, { ...noopProps, detail, onStartEdit }));
    expect(container.querySelector('[data-graph-detail-edit-input]')).toBeNull();
    fireEvent.click(container.querySelector('[data-graph-detail-edit]') as Element);
    expect(onStartEdit).toHaveBeenCalled();
  });

  it('shows the content in an editable textarea and saves the edited text', () => {
    const onSave = vi.fn();
    const { container } = render(h(GraphDetailPanel, { ...noopProps, detail, editing: true, onSave }));
    const input = container.querySelector('[data-graph-detail-edit-input]') as HTMLTextAreaElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('The requirement');

    fireEvent.change(input, { target: { value: 'The refined requirement' } });
    fireEvent.click(container.querySelector('[data-graph-detail-save]') as Element);
    expect(onSave).toHaveBeenCalledWith('The refined requirement');
  });

  it('cancels editing without saving on Escape', () => {
    const onSave = vi.fn();
    const onCancelEdit = vi.fn();
    const { container } = render(
      h(GraphDetailPanel, { ...noopProps, detail, editing: true, onSave, onCancelEdit }),
    );
    const input = container.querySelector('[data-graph-detail-edit-input]') as HTMLTextAreaElement;
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCancelEdit).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
