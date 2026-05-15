// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { secondaryChatStateSchema } from '@/shared/api-types.js';

import { SecondaryChatCollapsible } from '../secondary-chat-collapsible.js';

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;

const baseChat: SecondaryChat['chat'] = {
  id: 7,
  specification_id: 1,
  kind: 'side_chat',
  parent_chat_id: 1,
  invoked_in_turn_id: 3,
  pinned_item_id: null,
  pinned_span_hint: null,
  mode: 'explore',
};

afterEach(() => cleanup());

describe('SecondaryChatCollapsible', () => {
  it('renders the header for a secondary chat with a kickoff turn', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: {
        id: 99,
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
        assistant_parts: 'Editing this item.',
        created_at: '',
      },
      turns: [],
    };

    render(<SecondaryChatCollapsible secondaryChat={chat} />);

    expect(screen.getByTestId('secondary-chat-collapsible')).toBeTruthy();
    expect(screen.getByTestId('secondary-chat-collapsible-trigger')).toBeTruthy();
  });

  it('starts collapsed — body content is not visible', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: {
        id: 99,
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
        assistant_parts: 'Editing this item.',
        created_at: '',
      },
      turns: [],
    };

    render(<SecondaryChatCollapsible secondaryChat={chat} />);

    expect(screen.queryByText('Editing this item.')).toBeNull();
  });

  it('expands on trigger click and reveals kickoff turn assistant_parts', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: {
        id: 99,
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
        assistant_parts: 'Editing this item.',
        created_at: '',
      },
      turns: [],
    };

    render(<SecondaryChatCollapsible secondaryChat={chat} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));

    expect(screen.getByText('Editing this item.')).toBeTruthy();
  });

  it('renders an empty body when no kickoff turn exists', () => {
    const chat: SecondaryChat = { chat: baseChat, kickoffTurn: null, turns: [] };

    render(<SecondaryChatCollapsible secondaryChat={chat} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));

    const body = screen.getByTestId('secondary-chat-collapsible-body');
    expect(body.textContent?.trim()).toBe('');
  });

  it('renders the mode toggle reflecting the persisted mode', () => {
    const chat: SecondaryChat = { chat: { ...baseChat, mode: 'edit' }, kickoffTurn: null, turns: [] };
    render(<SecondaryChatCollapsible secondaryChat={chat} />);
    const toggle = screen.getByTestId('secondary-chat-mode-toggle');
    expect(toggle.dataset.mode).toBe('edit');
    expect(screen.getByTestId('secondary-chat-mode-edit').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('secondary-chat-mode-ask').getAttribute('aria-pressed')).toBe('false');
  });

  it('falls back to explore mode when chat.mode is null', () => {
    const chat: SecondaryChat = { chat: { ...baseChat, mode: null }, kickoffTurn: null, turns: [] };
    render(<SecondaryChatCollapsible secondaryChat={chat} />);
    const toggle = screen.getByTestId('secondary-chat-mode-toggle');
    expect(toggle.dataset.mode).toBe('explore');
  });

  it('invokes onSetMode when the user clicks a different mode', () => {
    const onSetMode = vi.fn();
    const chat: SecondaryChat = { chat: { ...baseChat, mode: 'explore' }, kickoffTurn: null, turns: [] };
    render(<SecondaryChatCollapsible secondaryChat={chat} onSetMode={onSetMode} />);
    fireEvent.click(screen.getByTestId('secondary-chat-mode-edit'));
    expect(onSetMode).toHaveBeenCalledWith('edit');
  });

  it('does not invoke onSetMode when clicking the already-active mode', () => {
    const onSetMode = vi.fn();
    const chat: SecondaryChat = { chat: { ...baseChat, mode: 'explore' }, kickoffTurn: null, turns: [] };
    render(<SecondaryChatCollapsible secondaryChat={chat} onSetMode={onSetMode} />);
    fireEvent.click(screen.getByTestId('secondary-chat-mode-ask'));
    expect(onSetMode).not.toHaveBeenCalled();
  });

  it('disables the toggle while a mode update is in flight', () => {
    const onSetMode = vi.fn();
    const chat: SecondaryChat = { chat: { ...baseChat, mode: 'explore' }, kickoffTurn: null, turns: [] };
    render(<SecondaryChatCollapsible secondaryChat={chat} onSetMode={onSetMode} isModeUpdating />);
    expect(screen.getByTestId('secondary-chat-mode-edit').hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByTestId('secondary-chat-mode-edit'));
    expect(onSetMode).not.toHaveBeenCalled();
  });

  it('disables the toggle when no onSetMode handler is provided (read-only display)', () => {
    const chat: SecondaryChat = { chat: { ...baseChat, mode: 'explore' }, kickoffTurn: null, turns: [] };
    render(<SecondaryChatCollapsible secondaryChat={chat} />);
    expect(screen.getByTestId('secondary-chat-mode-edit').hasAttribute('disabled')).toBe(true);
  });
});
