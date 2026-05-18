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
  pinned_reconciliation_need_id: null,
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
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };

    render(<SecondaryChatCollapsible secondaryChat={chat} />);

    expect(screen.getByTestId('secondary-chat-collapsible')).toBeTruthy();
    expect(screen.getByTestId('secondary-chat-collapsible-trigger')).toBeTruthy();
    // The header no longer uses the "Secondary chat" label — only the kind chip.
    expect(screen.queryByText('Secondary chat')).toBeNull();
  });

  it('renders the Ask kind chip when mode is explore', () => {
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'explore' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };

    render(<SecondaryChatCollapsible secondaryChat={chat} />);

    const chip = screen.getByTestId('secondary-chat-kind-chip');
    expect(chip.dataset.kind).toBe('ask');
    expect(chip.textContent).toContain('Ask');
  });

  it('renders the Edit kind chip when mode is edit', () => {
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'edit' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };

    render(<SecondaryChatCollapsible secondaryChat={chat} />);

    const chip = screen.getByTestId('secondary-chat-kind-chip');
    expect(chip.dataset.kind).toBe('edit');
    expect(chip.textContent).toContain('Edit');
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
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
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
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };

    render(<SecondaryChatCollapsible secondaryChat={chat} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));

    expect(screen.getByText('Editing this item.')).toBeTruthy();
  });

  it('renders an empty body when no kickoff turn exists', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };

    render(<SecondaryChatCollapsible secondaryChat={chat} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));

    const body = screen.getByTestId('secondary-chat-collapsible-body');
    expect(body.textContent?.trim()).toBe('');
  });

  it('renders the mode toggle reflecting the persisted mode', () => {
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'edit' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} />);
    const toggle = screen.getByTestId('secondary-chat-mode-toggle');
    expect(toggle.dataset.mode).toBe('edit');
    expect(screen.getByTestId('secondary-chat-mode-edit').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('secondary-chat-mode-ask').getAttribute('aria-pressed')).toBe('false');
  });

  it('falls back to explore mode when chat.mode is null', () => {
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: null },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} />);
    const toggle = screen.getByTestId('secondary-chat-mode-toggle');
    expect(toggle.dataset.mode).toBe('explore');
  });

  it('invokes onSetMode when the user clicks a different mode', () => {
    const onSetMode = vi.fn();
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'explore' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} onSetMode={onSetMode} />);
    fireEvent.click(screen.getByTestId('secondary-chat-mode-edit'));
    expect(onSetMode).toHaveBeenCalledWith('edit');
  });

  it('does not invoke onSetMode when clicking the already-active mode', () => {
    const onSetMode = vi.fn();
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'explore' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} onSetMode={onSetMode} />);
    fireEvent.click(screen.getByTestId('secondary-chat-mode-ask'));
    expect(onSetMode).not.toHaveBeenCalled();
  });

  it('disables the toggle while a mode update is in flight', () => {
    const onSetMode = vi.fn();
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'explore' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} onSetMode={onSetMode} isModeUpdating />);
    expect(screen.getByTestId('secondary-chat-mode-edit').hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByTestId('secondary-chat-mode-edit'));
    expect(onSetMode).not.toHaveBeenCalled();
  });

  it('disables the toggle when no onSetMode handler is provided (read-only display)', () => {
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'explore' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} />);
    expect(screen.getByTestId('secondary-chat-mode-edit').hasAttribute('disabled')).toBe(true);
  });
});

describe('SecondaryChatCollapsible — turns + composer (C5b)', () => {
  function makeUserTurn(id: number, text: string): SecondaryChat['turns'][number] {
    return {
      id,
      specification_id: 1,
      parent_turn_id: null,
      phase: 'grounding',
      turn_kind: 'question',
      question: '',
      why: null,
      impact: null,
      answer: null,
      is_resolution: false,
      user_parts: text,
      assistant_parts: null,
      created_at: '',
    };
  }

  function makeAssistantTurn(id: number, text: string): SecondaryChat['turns'][number] {
    return {
      id,
      specification_id: 1,
      parent_turn_id: null,
      phase: 'grounding',
      turn_kind: 'question',
      question: '',
      why: null,
      impact: null,
      answer: null,
      is_resolution: false,
      user_parts: null,
      assistant_parts: text,
      created_at: '',
    };
  }

  it('renders persisted user/assistant turns under the kickoff body when expanded', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [makeUserTurn(10, 'why?'), makeAssistantTurn(11, 'because.')],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    expect(screen.getByText('why?')).toBeTruthy();
    expect(screen.getByText('because.')).toBeTruthy();
  });

  it('renders the composer when onSubmitMessage is provided and submits trimmed text', () => {
    const onSubmitMessage = vi.fn();
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} onSubmitMessage={onSubmitMessage} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    const input = screen.getByTestId('secondary-chat-composer-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  hello  ' } });
    fireEvent.click(screen.getByTestId('secondary-chat-composer-send'));
    expect(onSubmitMessage).toHaveBeenCalledWith('hello');
    expect(input.value).toBe('');
  });

  it('does not render the composer when onSubmitMessage is omitted', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    expect(screen.queryByTestId('secondary-chat-composer')).toBeNull();
  });

  it('renders streaming assistant text and disables the composer while isStreaming is true', () => {
    const onSubmitMessage = vi.fn();
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(
      <SecondaryChatCollapsible
        secondaryChat={chat}
        onSubmitMessage={onSubmitMessage}
        streamingAssistantText="streaming reply..."
        isStreaming
      />,
    );
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    expect(screen.getByTestId('secondary-chat-streaming-assistant').textContent).toBe('streaming reply...');
    expect((screen.getByTestId('secondary-chat-composer-input') as HTMLInputElement).disabled).toBe(true);
  });

  it('renders the reconciliation panel when pinnedReconciliationNeed is set', () => {
    const chat: SecondaryChat = {
      chat: { ...baseChat, pinned_reconciliation_need_id: 42 },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: {
        needId: 42,
        kind: 'supersedes',
        sourceItemId: 10,
        sourceRefCode: 'G2',
        sourceExcerpt: 'updated goal text',
        targetItemId: 20,
        targetRefCode: 'R5',
        targetExcerpt: 'existing requirement text',
      },
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    const panel = screen.getByTestId('secondary-chat-reconciliation-panel');
    expect(panel.getAttribute('data-reconciliation-need-id')).toBe('42');
    expect(panel.getAttribute('data-reconciliation-kind')).toBe('supersedes');
    expect(panel.textContent).toContain('Supersedes');
    const source = screen.getByTestId('secondary-chat-reconciliation-source');
    expect(source.textContent).toContain('G2');
    expect(source.textContent).toContain('updated goal text');
    const target = screen.getByTestId('secondary-chat-reconciliation-target');
    expect(target.textContent).toContain('R5');
    expect(target.textContent).toContain('existing requirement text');
  });

  it('does not render the reconciliation panel when pinnedReconciliationNeed is null', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    expect(screen.queryByTestId('secondary-chat-reconciliation-panel')).toBeNull();
  });
});
