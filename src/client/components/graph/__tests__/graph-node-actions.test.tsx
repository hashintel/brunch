// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { createElement, type ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ stage: vi.fn(), create: vi.fn(), canCreate: true }));

vi.mock('@/client/components/patch-list-host', () => ({
  usePatchList: () => ({ stage: mocks.stage }),
}));
vi.mock('@/client/components/secondary-chat-trigger', () => ({
  useSecondaryChatTrigger: () => ({
    canCreate: mocks.canCreate,
    isPending: false,
    create: mocks.create,
    inlineChatRoute: {},
  }),
}));

import { GraphNode } from '@/client/components/graph/GraphNode';

const data = {
  kind: 'requirement',
  degree: 1,
  selected: false,
  dimmed: false,
  referenceCode: 'R7',
  content: 'Persist drafts',
  rationale: '',
};

function renderNode() {
  return render(
    createElement(
      ReactFlowProvider,
      null,
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
  );
}

afterEach(() => {
  cleanup();
  mocks.stage.mockClear();
  mocks.create.mockClear();
  mocks.canCreate = true;
});

describe('GraphNode — edit/chat actions', () => {
  it('opens a side chat for the item when the chat icon is clicked', () => {
    const { container } = renderNode();
    fireEvent.click(container.querySelector('[data-graph-node-chat]') as Element);
    expect(mocks.create).toHaveBeenCalledWith({ kind: 'requirement', id: 7 });
  });

  it('edits in place and stages an edit patch on Cmd+Enter', () => {
    const { container } = renderNode();
    fireEvent.click(container.querySelector('[data-graph-node-edit]') as Element);
    const input = container.querySelector('[data-graph-node-edit-input]') as HTMLTextAreaElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: 'Persist drafts to disk' } });
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
    expect(mocks.stage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'edit',
        anchor: { kind: 'requirement', itemId: 7 },
        currentContent: 'Persist drafts',
        newContent: 'Persist drafts to disk',
      }),
    );
  });

  it('disables chat when creation is unavailable', () => {
    mocks.canCreate = false;
    const { container } = renderNode();
    const chat = container.querySelector('[data-graph-node-chat]') as HTMLButtonElement;
    expect(chat.disabled).toBe(true);
    fireEvent.click(chat);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
