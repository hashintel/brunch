// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod/v4';

import { ChatTabs } from '@/client/components/chat-tabs.js';
import { kindAccentHex } from '@/client/components/knowledge-card.js';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;

function makeItemChat(
  id: number,
  kind: SecondaryChat['pinnedItemKind'] = 'goal',
  mode: 'explore' | 'edit' = 'explore',
): SecondaryChat {
  return {
    chat: {
      id,
      specification_id: 1,
      kind: 'side_chat',
      parent_chat_id: 1,
      invoked_in_turn_id: 3,
      pinned_item_id: 5,
      pinned_span_hint: null,
      pinned_reconciliation_need_id: null,
      mode,
    },
    kickoffTurn: {
      id: 100 + id,
      specification_id: 1,
      parent_turn_id: null,
      phase: 'grounding',
      turn_kind: 'kickoff',
      question: '',
      why: null,
      impact: null,
      answer: null,
      is_resolution: false,
      user_parts: null,
      assistant_parts: `Anchored to 'Item ${id} excerpt'.`,
      created_at: '2026-05-18 10:00:00',
    },
    turns: [],
    pinnedItemKind: kind,
    pinnedReconciliationNeed: null,
    anchoredItemIds: [],
  };
}

function makeEmptyChat(id: number = 100): SecondaryChat {
  return {
    chat: {
      id,
      specification_id: 1,
      kind: 'side_chat',
      parent_chat_id: 1,
      invoked_in_turn_id: null,
      pinned_item_id: null,
      pinned_span_hint: null,
      pinned_reconciliation_need_id: null,
      mode: 'explore',
    },
    kickoffTurn: null,
    turns: [],
    pinnedItemKind: null,
    pinnedReconciliationNeed: null,
    anchoredItemIds: [],
  };
}

afterEach(() => {
  cleanup();
});

describe('ChatTabs', () => {
  it('renders nothing when there are no chats and no create handler', () => {
    const { container } = render(<ChatTabs chats={[]} activeChatId={null} onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders empty (icon-only) tabs first, then item-anchored tabs, in chat.id ascending order', () => {
    const chats = [makeItemChat(8, 'goal'), makeEmptyChat(1), makeItemChat(11, 'constraint')];
    render(<ChatTabs chats={chats} activeChatId={1} onSelect={vi.fn()} />);

    expect(screen.getByTestId('chat-tabs-empty-1')).not.toBeNull();
    expect(screen.getByTestId('chat-tabs-item-8')).not.toBeNull();
    expect(screen.getByTestId('chat-tabs-item-11')).not.toBeNull();

    const strip = screen.getByTestId('chat-tabs');
    const buttonOrder = Array.from(strip.querySelectorAll<HTMLButtonElement>('[role="tab"]')).map((el) =>
      el.getAttribute('data-testid'),
    );
    expect(buttonOrder).toEqual(['chat-tabs-empty-1', 'chat-tabs-item-8', 'chat-tabs-item-11']);
  });

  it('does not render the "Master" text label on empty tabs (icon-only)', () => {
    render(<ChatTabs chats={[makeEmptyChat(1)]} activeChatId={1} onSelect={vi.fn()} />);
    expect(screen.getByTestId('chat-tabs-empty-1').textContent ?? '').not.toMatch(/Master/i);
  });

  it('shows the master tab + at most one item tab; remaining items collapse into the ChatSwitcher dropdown', () => {
    const chats = [makeEmptyChat(1), makeItemChat(7), makeItemChat(8), makeItemChat(9), makeItemChat(10)];
    render(<ChatTabs chats={chats} activeChatId={1} onSelect={vi.fn()} />);

    expect(screen.getByTestId('chat-tabs-empty-1')).not.toBeNull();
    expect(screen.getByTestId('chat-tabs-item-10')).not.toBeNull();
    expect(screen.queryByTestId('chat-tabs-item-7')).toBeNull();
    expect(screen.queryByTestId('chat-tabs-item-8')).toBeNull();
    expect(screen.queryByTestId('chat-tabs-item-9')).toBeNull();
    expect(screen.getByTestId('chat-switcher-trigger')).not.toBeNull();
  });

  it('uses the active item chat as the single visible item tab when active is an item; others fall into the dropdown', () => {
    const chats = [makeEmptyChat(1), makeItemChat(7), makeItemChat(8), makeItemChat(9)];
    render(<ChatTabs chats={chats} activeChatId={8} onSelect={vi.fn()} />);

    expect(screen.getByTestId('chat-tabs-empty-1')).not.toBeNull();
    expect(screen.getByTestId('chat-tabs-item-8')).not.toBeNull();
    expect(screen.getByTestId('chat-tabs-item-8').getAttribute('data-active')).toBe('true');
    expect(screen.queryByTestId('chat-tabs-item-7')).toBeNull();
    expect(screen.queryByTestId('chat-tabs-item-9')).toBeNull();
    expect(screen.getByTestId('chat-switcher-trigger')).not.toBeNull();
  });

  it('marks the active tab with data-active=true and decorates item tabs with the kind accent', () => {
    const chats = [makeEmptyChat(1), makeItemChat(7, 'decision')];
    render(<ChatTabs chats={chats} activeChatId={7} onSelect={vi.fn()} />);

    expect(screen.getByTestId('chat-tabs-empty-1').getAttribute('data-active')).toBe('false');
    const activeItem = screen.getByTestId('chat-tabs-item-7');
    expect(activeItem.getAttribute('data-active')).toBe('true');
    expect(activeItem.getAttribute('data-accent-hex')).toBe(kindAccentHex.decision);
    expect(activeItem.style.backgroundColor).not.toBe('');
    expect(activeItem.style.color).not.toBe('');
    expect(activeItem.style.borderColor).not.toBe('');
  });

  it("forwards click → onSelect with the tab's chat id (empty and item tabs)", () => {
    const onSelect = vi.fn();
    const chats = [makeEmptyChat(1), makeItemChat(7), makeItemChat(11)];
    render(<ChatTabs chats={chats} activeChatId={1} onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId('chat-tabs-item-11'));
    expect(onSelect).toHaveBeenLastCalledWith(11);
    fireEvent.click(screen.getByTestId('chat-tabs-empty-1'));
    expect(onSelect).toHaveBeenLastCalledWith(1);
  });

  it('does NOT render any "+" create-empty button (master + at-most-one-item tabs only)', () => {
    render(<ChatTabs chats={[makeEmptyChat(1)]} activeChatId={1} onSelect={vi.fn()} />);
    expect(screen.queryByTestId('chat-tabs-create-empty')).toBeNull();
  });

  it('clicking the active tab fires onActiveTabClick instead of onSelect', () => {
    const onSelect = vi.fn();
    const onActiveTabClick = vi.fn();
    const chats = [makeEmptyChat(1), makeItemChat(7)];
    render(
      <ChatTabs chats={chats} activeChatId={7} onSelect={onSelect} onActiveTabClick={onActiveTabClick} />,
    );

    fireEvent.click(screen.getByTestId('chat-tabs-item-7'));
    expect(onActiveTabClick).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('chat-tabs-empty-1'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('renders a streaming indicator on tabs whose chat ids are in streamingChatIds', () => {
    const chats = [makeEmptyChat(1), makeItemChat(7), makeItemChat(11)];
    render(<ChatTabs chats={chats} activeChatId={7} onSelect={vi.fn()} streamingChatIds={new Set([7])} />);

    const streamingTab = screen.getByTestId('chat-tabs-item-7');
    expect(streamingTab.getAttribute('data-streaming')).toBe('true');
    expect(streamingTab.querySelector('[data-testid="chat-tabs-streaming-dot"]')).not.toBeNull();

    expect(screen.getByTestId('chat-tabs-empty-1').getAttribute('data-streaming')).toBe('false');
    expect(
      screen.getByTestId('chat-tabs-item-11').querySelector('[data-testid="chat-tabs-streaming-dot"]'),
    ).toBeNull();
  });

  it('renders an unread indicator on tabs whose chat ids are in unreadChatIds', () => {
    const chats = [makeEmptyChat(1), makeItemChat(7), makeItemChat(11)];
    render(<ChatTabs chats={chats} activeChatId={1} onSelect={vi.fn()} unreadChatIds={new Set([7, 11])} />);

    const unread7 = screen.getByTestId('chat-tabs-item-7');
    expect(unread7.getAttribute('data-unread')).toBe('true');
    expect(unread7.querySelector('[data-testid="chat-tabs-unread-dot"]')).not.toBeNull();

    const unread11 = screen.getByTestId('chat-tabs-item-11');
    expect(unread11.getAttribute('data-unread')).toBe('true');
    expect(unread11.querySelector('[data-testid="chat-tabs-unread-dot"]')).not.toBeNull();

    expect(screen.getByTestId('chat-tabs-empty-1').getAttribute('data-unread')).toBe('false');
    expect(
      screen.getByTestId('chat-tabs-empty-1').querySelector('[data-testid="chat-tabs-unread-dot"]'),
    ).toBeNull();
  });

  it('hides the unread dot on a tab that is also currently streaming (streaming dot takes precedence)', () => {
    const chats = [makeItemChat(7)];
    render(
      <ChatTabs
        chats={chats}
        activeChatId={null}
        onSelect={vi.fn()}
        streamingChatIds={new Set([7])}
        unreadChatIds={new Set([7])}
      />,
    );

    const tab = screen.getByTestId('chat-tabs-item-7');
    expect(tab.getAttribute('data-streaming')).toBe('true');
    expect(tab.querySelector('[data-testid="chat-tabs-streaming-dot"]')).not.toBeNull();
    expect(tab.querySelector('[data-testid="chat-tabs-unread-dot"]')).toBeNull();
  });
});
