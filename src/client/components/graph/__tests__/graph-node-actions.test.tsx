// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { createElement, type ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ create: vi.fn(), canCreate: true }));

vi.mock('@/client/components/secondary-chat-trigger', () => ({
  useSecondaryChatTrigger: () => ({
    canCreate: mocks.canCreate,
    isPending: false,
    create: mocks.create,
    inlineChatRoute: {},
  }),
}));

import { GraphNode } from '@/client/components/graph/GraphNode';
import { GraphNodeActionsProvider } from '@/client/components/graph/graphNodeActions';

const data = {
  kind: 'requirement',
  degree: 1,
  selected: false,
  dimmed: false,
  referenceCode: 'R7',
  content: 'Persist drafts',
  rationale: '',
};

function renderNode(requestEdit: (id: string) => void) {
  return render(
    createElement(
      ReactFlowProvider,
      null,
      createElement(
        GraphNodeActionsProvider,
        { value: { requestEdit } },
        createElement(
          GraphNode as unknown as ComponentType<Record<string, unknown>>,
          {
            id: 'requirement:7',
            type: 'graph',
            data,
            selected: false,
            dragging: false,
            isConnectable: true,
            zIndex: 0,
            positionAbsoluteX: 0,
            positionAbsoluteY: 0,
            deletable: true,
            selectable: true,
            draggable: true,
          } as unknown as Record<string, unknown>,
        ),
      ),
    ),
  );
}

afterEach(() => {
  cleanup();
  mocks.create.mockClear();
  mocks.canCreate = true;
});

describe('GraphNode — edit/chat actions', () => {
  it('requests the sidebar editor for the node when the edit icon is clicked', () => {
    const requestEdit = vi.fn();
    const { container } = renderNode(requestEdit);
    fireEvent.click(container.querySelector('[data-graph-node-edit]') as Element);
    expect(requestEdit).toHaveBeenCalledWith('requirement:7');
  });

  it('opens a side chat for the item when the chat icon is clicked', () => {
    const { container } = renderNode(vi.fn());
    fireEvent.click(container.querySelector('[data-graph-node-chat]') as Element);
    expect(mocks.create).toHaveBeenCalledWith({ kind: 'requirement', id: 7 });
  });

  it('disables chat when creation is unavailable', () => {
    mocks.canCreate = false;
    const { container } = renderNode(vi.fn());
    const chat = container.querySelector('[data-graph-node-chat]') as HTMLButtonElement;
    expect(chat.disabled).toBe(true);
    fireEvent.click(chat);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
