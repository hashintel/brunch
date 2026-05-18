// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod/v4';

import { ChatSwitcher } from '@/client/components/chat-switcher.js';
import { kindAccentHex } from '@/client/components/knowledge-card.js';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;

function makeChat(id: number, kind: SecondaryChat['pinnedItemKind'] = 'context'): SecondaryChat {
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
      mode: 'explore',
    },
    kickoffTurn: null,
    turns: [],
    pinnedItemKind: kind,
    pinnedReconciliationNeed: null,
    anchoredItemIds: [],
  };
}

afterEach(() => {
  cleanup();
});

describe('ChatSwitcher — C27 selective kind-accent tinting', () => {
  it('renders nothing when no chats are provided', () => {
    const { container } = render(<ChatSwitcher chats={[]} activeChatId={null} onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('decorates the trigger button with a kindAccentHex left-border for the active chat', () => {
    const chats = [makeChat(7, 'goal'), makeChat(8, 'constraint')];
    render(<ChatSwitcher chats={chats} activeChatId={8} onSelect={vi.fn()} />);

    const trigger = screen.getByTestId('chat-switcher-trigger') as HTMLButtonElement;
    expect(trigger.getAttribute('data-accent-hex')).toBe(kindAccentHex.constraint);
    expect(trigger.style.borderLeftColor).not.toBe('');
    expect(trigger.style.borderLeftWidth).toBe('3px');
  });

  it('marks the active dropdown row with a kindAccentHex border and forwards selection', () => {
    const onSelect = vi.fn();
    const chats = [makeChat(7, 'goal'), makeChat(11, 'decision')];
    render(<ChatSwitcher chats={chats} activeChatId={11} onSelect={onSelect} />);

    // Radix `DropdownMenu` listens for pointer events; fire pointerdown +
    // pointerup so happy-dom mirrors a real user open-click.
    const trigger = screen.getByTestId('chat-switcher-trigger');
    fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(trigger, { button: 0, pointerType: 'mouse' });
    fireEvent.click(trigger);

    const activeRow = screen.getByTestId('chat-switcher-item-11');
    expect(activeRow.getAttribute('data-active')).toBe('true');
    expect(activeRow.getAttribute('data-accent-hex')).toBe(kindAccentHex.decision);
    expect(activeRow.style.borderLeftWidth).toBe('3px');

    const inactiveRow = screen.getByTestId('chat-switcher-item-7');
    expect(inactiveRow.getAttribute('data-active')).toBe('false');
    expect(inactiveRow.style.borderLeftWidth).toBe('');

    fireEvent.pointerDown(inactiveRow, { button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(inactiveRow, { button: 0, pointerType: 'mouse' });
    fireEvent.click(inactiveRow);
    expect(onSelect).toHaveBeenCalledWith(7);
  });
});
