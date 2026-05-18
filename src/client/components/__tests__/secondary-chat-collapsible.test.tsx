// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { secondaryChatStateSchema } from '@/shared/api-types.js';

vi.mock('@/client/components/ai-elements/conversation.js', () => ({
  Conversation: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConversationContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/client/components/ai-elements/reasoning.js', () => ({
  Reasoning: ({
    children,
    'data-testid': testId,
    isStreaming,
  }: {
    children: React.ReactNode;
    'data-testid'?: string;
    isStreaming?: boolean;
  }) => (
    <div data-testid={testId} data-is-streaming={String(Boolean(isStreaming))}>
      {children}
    </div>
  ),
  ReasoningTrigger: () => <div data-testid="reasoning-trigger" />,
  ReasoningContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/client/components/ai-elements/message.js', () => ({
  Message: ({
    children,
    'data-testid': testId,
    from,
  }: {
    children: React.ReactNode;
    'data-testid'?: string;
    from?: string;
  }) => (
    <div data-testid={testId} data-from={from}>
      {children}
    </div>
  ),
  MessageContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  MessageResponse: ({ children }: { children: string }) => {
    // Lightweight markdown shim: render **bold** as <strong> so the
    // markdown-rendering acceptance test can assert real markdown behavior
    // without pulling the heavy rich renderer into happy-dom.
    const html = (children ?? '').replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // oxlint-disable-next-line react/no-danger
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  },
}));

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

  it('renders the mode toggle (now in composer leading edge) reflecting the persisted mode', () => {
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'edit' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} onSubmitMessage={vi.fn()} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
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
    render(<SecondaryChatCollapsible secondaryChat={chat} onSubmitMessage={vi.fn()} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
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
    render(<SecondaryChatCollapsible secondaryChat={chat} onSetMode={onSetMode} onSubmitMessage={vi.fn()} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
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
    render(<SecondaryChatCollapsible secondaryChat={chat} onSetMode={onSetMode} onSubmitMessage={vi.fn()} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
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
    render(
      <SecondaryChatCollapsible
        secondaryChat={chat}
        onSetMode={onSetMode}
        isModeUpdating
        onSubmitMessage={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
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
    render(<SecondaryChatCollapsible secondaryChat={chat} onSubmitMessage={vi.fn()} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    expect(screen.getByTestId('secondary-chat-mode-edit').hasAttribute('disabled')).toBe(true);
  });

  it('does not render the mode toggle in the header (kind chip remains)', () => {
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'edit' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    // No onSubmitMessage = no composer rendered = no mode toggle anywhere.
    render(<SecondaryChatCollapsible secondaryChat={chat} onSetMode={vi.fn()} />);
    expect(screen.queryByTestId('secondary-chat-mode-toggle')).toBeNull();
    // Kind chip still rendered (in header) so collapsed state shows kind.
    expect(screen.getByTestId('secondary-chat-kind-chip')).toBeTruthy();
  });

  it('toggles Ask↔Edit when Shift+Tab is pressed inside the composer textarea (FE-716 C21)', () => {
    const onSetMode = vi.fn();
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'explore' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} onSetMode={onSetMode} onSubmitMessage={vi.fn()} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    const textarea = screen.getByTestId('secondary-chat-composer-input');
    fireEvent.keyDown(textarea, { key: 'Tab', shiftKey: true });
    expect(onSetMode).toHaveBeenCalledWith('edit');
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

  it('renders the composer when onSubmitMessage is provided and submits trimmed text', async () => {
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
    const input = screen.getByTestId('secondary-chat-composer-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '  hello  ' } });
    fireEvent.submit(screen.getByTestId('secondary-chat-composer'));
    // PromptInput awaits Promise.all([]) before invoking onSubmit; wait for
    // the callback to fire and for the cleared draft to be reflected.
    await waitFor(() => {
      expect(onSubmitMessage).toHaveBeenCalledWith('hello');
    });
    await waitFor(() => {
      expect(input.value).toBe('');
    });
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
    const streaming = screen.getByTestId('secondary-chat-streaming-assistant');
    expect(streaming.textContent).toContain('streaming reply...');
    // FE-716 C22: streaming-assistant now uses `<Reasoning isStreaming>` (the
    // mock surfaces `isStreaming` via data-is-streaming).
    expect(streaming.getAttribute('data-is-streaming')).toBe('true');
    expect((screen.getByTestId('secondary-chat-composer-input') as HTMLTextAreaElement).disabled).toBe(true);
  });

  it('renders the streaming pulse as a static text block under prefers-reduced-motion (FE-716 C22)', () => {
    const matchMediaMock = (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    const prevMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: matchMediaMock,
    });
    try {
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
          onSubmitMessage={vi.fn()}
          streamingAssistantText="streaming reply..."
          isStreaming
        />,
      );
      fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
      const streaming = screen.getByTestId('secondary-chat-streaming-assistant');
      // Reduced-motion path = plain div (no Reasoning wrapper). The Reasoning
      // mock would set data-is-streaming; absence proves we took the static path.
      expect(streaming.getAttribute('data-is-streaming')).toBeNull();
      expect(streaming.textContent).toBe('streaming reply...');
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: prevMatchMedia,
      });
    }
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

  it('renders markdown in assistant turns (e.g. **bold** becomes <strong>)', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [makeAssistantTurn(20, 'this is **bold** content')],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    const turn = screen.getByTestId('secondary-chat-assistant-turn');
    const strong = turn.querySelector('strong');
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe('bold');
    expect(turn.textContent).not.toContain('**');
  });

  it('renders 3 turn-zero suggestions for mode=explore and hides them after a user turn (FE-716 C23)', () => {
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'explore' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} onSubmitMessage={vi.fn()} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    const row = screen.getByTestId('secondary-chat-suggestions');
    expect(row.dataset.mode).toBe('explore');
    expect(screen.getAllByTestId('secondary-chat-suggestion')).toHaveLength(3);

    cleanup();
    const chatAfter: SecondaryChat = {
      chat: { ...baseChat, mode: 'explore' },
      kickoffTurn: null,
      turns: [makeUserTurn(1, 'first message')],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chatAfter} onSubmitMessage={vi.fn()} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    expect(screen.queryByTestId('secondary-chat-suggestions')).toBeNull();
  });

  it('changes the suggestion set with the mode (FE-716 C23)', () => {
    const chatEdit: SecondaryChat = {
      chat: { ...baseChat, mode: 'edit' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chatEdit} onSubmitMessage={vi.fn()} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    const row = screen.getByTestId('secondary-chat-suggestions');
    expect(row.dataset.mode).toBe('edit');
    expect(row.dataset.reconciliationKind).toBe('none');
  });

  it('routes reconciliation-kind into the suggestion set (FE-716 C23)', () => {
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'explore', pinned_reconciliation_need_id: 7 },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: {
        needId: 7,
        kind: 'supersedes',
        sourceItemId: 10,
        sourceRefCode: 'G2',
        sourceExcerpt: 'src',
        targetItemId: 20,
        targetRefCode: 'R5',
        targetExcerpt: 'tgt',
      },
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} onSubmitMessage={vi.fn()} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    expect(screen.getByTestId('secondary-chat-suggestions').dataset.reconciliationKind).toBe('supersedes');
  });

  it('clicking a suggestion populates the composer draft (FE-716 C23)', () => {
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'explore' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<SecondaryChatCollapsible secondaryChat={chat} onSubmitMessage={vi.fn()} />);
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    const firstSuggestion = screen.getAllByTestId('secondary-chat-suggestion')[0]!;
    const text = firstSuggestion.textContent ?? '';
    fireEvent.click(firstSuggestion);
    const input = screen.getByTestId('secondary-chat-composer-input') as HTMLTextAreaElement;
    expect(input.value).toBe(text);
  });

  it('opens the mention popup when the user types # (FE-716 C25)', () => {
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
        onSubmitMessage={vi.fn()}
        mentionableItems={[
          { refCode: 'R1', kind: 'requirement', content: 'Auth' },
          { refCode: 'R2', kind: 'requirement', content: 'Search' },
          { refCode: 'G1', kind: 'goal', content: 'Ship V1' },
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    const input = screen.getByTestId('secondary-chat-composer-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '#' } });
    expect(screen.getByTestId('secondary-chat-mention-popup').getAttribute('data-query')).toBe('');
    expect(screen.getAllByTestId('secondary-chat-mention-item').length).toBeGreaterThanOrEqual(3);
  });

  it('filters the mention popup by query prefix (FE-716 C25)', () => {
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
        onSubmitMessage={vi.fn()}
        mentionableItems={[
          { refCode: 'R1', kind: 'requirement', content: 'Auth' },
          { refCode: 'R2', kind: 'requirement', content: 'Search' },
          { refCode: 'G1', kind: 'goal', content: 'Ship V1' },
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    const input = screen.getByTestId('secondary-chat-composer-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '#R' } });
    const popup = screen.getByTestId('secondary-chat-mention-popup');
    expect(popup.getAttribute('data-query')).toBe('R');
    const items = screen.getAllByTestId('secondary-chat-mention-item');
    expect(items.map((el) => el.getAttribute('data-ref-code'))).toEqual(['R1', 'R2']);
  });

  it('Escape dismisses the mention popup without inserting (FE-716 C25)', () => {
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
        onSubmitMessage={vi.fn()}
        mentionableItems={[{ refCode: 'R1', kind: 'requirement', content: 'Auth' }]}
      />,
    );
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    const input = screen.getByTestId('secondary-chat-composer-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '#R' } });
    expect(screen.getByTestId('secondary-chat-mention-popup')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('secondary-chat-mention-popup')).toBeNull();
    expect(input.value).toBe('#R');
  });

  it('Enter on the mention popup inserts #REF-CODE and closes the popup (FE-716 C25)', () => {
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
        onSubmitMessage={vi.fn()}
        mentionableItems={[
          { refCode: 'R1', kind: 'requirement', content: 'Auth' },
          { refCode: 'R2', kind: 'requirement', content: 'Search' },
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    const input = screen.getByTestId('secondary-chat-composer-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '#R' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByTestId('secondary-chat-mention-popup')).toBeNull();
    expect(input.value).toBe('#R1 ');
  });

  it('does not render the mention popup when no mention is active (FE-716 C25)', () => {
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
        onSubmitMessage={vi.fn()}
        mentionableItems={[{ refCode: 'R1', kind: 'requirement', content: 'Auth' }]}
      />,
    );
    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    const input = screen.getByTestId('secondary-chat-composer-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'hello world' } });
    expect(screen.queryByTestId('secondary-chat-mention-popup')).toBeNull();
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
