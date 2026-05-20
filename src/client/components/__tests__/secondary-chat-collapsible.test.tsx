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
    const html = (children ?? '').replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // oxlint-disable-next-line react/no-danger
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  },
}));

import {
  SecondaryChatCollapsible,
  SecondaryChatComposerPanel,
  type SecondaryChatCollapsibleProps,
} from '../secondary-chat-collapsible.js';
import type { MentionItem } from '../secondary-chat-mention-popup.js';
import type { SecondaryChatMode } from '../secondary-chat-trigger.js';

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;

function CollapsibleHarness({
  secondaryChat,
  onSubmitMessage,
  onSetMode,
  isModeUpdating,
  mentionableItems,
  ...collapsibleProps
}: SecondaryChatCollapsibleProps & {
  onSubmitMessage?: (message: string) => void;
  onSetMode?: (mode: SecondaryChatMode) => void;
  isModeUpdating?: boolean;
  mentionableItems?: readonly MentionItem[];
}) {
  return (
    <>
      <SecondaryChatCollapsible
        secondaryChat={secondaryChat}
        onPickStartSuggestion={onSubmitMessage}
        {...collapsibleProps}
      />
      {onSubmitMessage && (
        <SecondaryChatComposerPanel
          secondaryChat={secondaryChat}
          onSubmitMessage={onSubmitMessage}
          isStreaming={collapsibleProps.isStreaming}
          onSetMode={onSetMode}
          isModeUpdating={isModeUpdating}
          mentionableItems={mentionableItems}
        />
      )}
    </>
  );
}

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

    render(<CollapsibleHarness secondaryChat={chat} />);

    expect(screen.getByTestId('secondary-chat-collapsible')).toBeTruthy();
    expect(screen.queryByText('Secondary chat')).toBeNull();
  });

  it('does not render a chat-mode icon in the title (redundant with ChatSwitcher tabs and composer toggle)', () => {
    // The title chip used to show MessageSquare/Sparkles for mode, but
    // ChatSwitcher tabs already carry per-chat icons and the composer's
    // segmented toggle visualises mode at the bottom — so the title chip
    // was duplicate signal and is gone.
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'edit' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<CollapsibleHarness secondaryChat={chat} />);
    expect(screen.queryByTestId('secondary-chat-kind-chip')).toBeNull();
  });

  it('renders kickoff turn assistant_parts inline (no collapsible chrome)', () => {
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

    render(<CollapsibleHarness secondaryChat={chat} />);

    expect(screen.getByText('Editing this item.')).toBeTruthy();
  });

  it('renders the fresh-state hero ("Ask Brunch about anything" + chips) when no kickoff turn exists', () => {
    // User feedback supersedes the previous "empty body" expectation: a
    // brand-new chat now surfaces the centered hero with three static
    // "How to start" chips so the surface never reads as an empty void.
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };

    render(<CollapsibleHarness secondaryChat={chat} />);

    expect(screen.getByTestId('secondary-chat-fresh-state')).not.toBeNull();
    expect(screen.getByTestId('secondary-chat-fresh-state').textContent).toContain(
      'Ask Brunch about your spec',
    );
  });

  it('suppresses the fresh-state hero title when a server kickoff turn is present (no duplicate turn-zero prompt)', () => {
    // Bot round 5 (cursor#3272354434): the hero rendered "Where would
    // you like to begin?" alongside the kickoff "Hi! How can I help
    // with #G1?", producing two competing turn-zero prompts. The hero
    // still renders for item-anchored chats so the suggestion chips
    // remain reachable, but its redundant title is suppressed.
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
        assistant_parts: 'Hi! How can I help with **#G1**?',
        created_at: '',
      },
      turns: [],
      pinnedItemKind: 'goal',
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };

    render(<CollapsibleHarness secondaryChat={chat} />);

    expect(screen.getByText('Hi! How can I help with **#G1**?')).toBeTruthy();
    expect(screen.queryByTestId('secondary-chat-fresh-state-title')).toBeNull();
    // Hero shell + chip row still render so the suggestions surface stays.
    expect(screen.getByTestId('secondary-chat-fresh-state')).not.toBeNull();
  });

  it('renders an optimistic pending-user bubble during the submit → onFinish window (no missing user message)', () => {
    // Bot round 5 (cursor#3272392796): the server persists the user
    // turn before streaming, but the client only invalidates the bundle
    // in onFinish, so the user's message used to vanish from the
    // transcript until the assistant reply completed. The host now
    // surfaces the in-flight user text from useChat as pendingUserText.
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };

    render(
      <CollapsibleHarness
        secondaryChat={chat}
        pendingUserText="hello, are you there?"
        isStreaming
        streamingAssistantText=""
      />,
    );

    const bubble = screen.getByTestId('secondary-chat-pending-user-bubble');
    expect(bubble.textContent).toContain('hello, are you there?');
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
    render(<CollapsibleHarness secondaryChat={chat} onSubmitMessage={vi.fn()} />);
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
    render(<CollapsibleHarness secondaryChat={chat} onSubmitMessage={vi.fn()} />);
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
    render(<CollapsibleHarness secondaryChat={chat} onSetMode={onSetMode} onSubmitMessage={vi.fn()} />);
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
    render(<CollapsibleHarness secondaryChat={chat} onSetMode={onSetMode} onSubmitMessage={vi.fn()} />);
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
      <CollapsibleHarness
        secondaryChat={chat}
        onSetMode={onSetMode}
        isModeUpdating
        onSubmitMessage={vi.fn()}
      />,
    );
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
    render(<CollapsibleHarness secondaryChat={chat} onSubmitMessage={vi.fn()} />);
    expect(screen.getByTestId('secondary-chat-mode-edit').hasAttribute('disabled')).toBe(true);
  });

  it('does not render the mode toggle in the header (no composer mounted → no toggle)', () => {
    // Without `onSubmitMessage` the composer (which hosts the mode toggle)
    // is not mounted, so the toggle is absent from the entire surface.
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'edit' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<CollapsibleHarness secondaryChat={chat} onSetMode={vi.fn()} />);
    expect(screen.queryByTestId('secondary-chat-mode-toggle')).toBeNull();
  });

  it('toggles Ask↔Edit when Shift+Tab is pressed inside the composer textarea', () => {
    const onSetMode = vi.fn();
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'explore' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<CollapsibleHarness secondaryChat={chat} onSetMode={onSetMode} onSubmitMessage={vi.fn()} />);
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

  function makeKickoffTurn(id: number, text: string): NonNullable<SecondaryChat['kickoffTurn']> {
    return {
      id,
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
      assistant_parts: text,
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
    render(<CollapsibleHarness secondaryChat={chat} />);
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
    render(<CollapsibleHarness secondaryChat={chat} onSubmitMessage={onSubmitMessage} />);
    const input = screen.getByTestId('secondary-chat-composer-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '  hello  ' } });
    fireEvent.submit(screen.getByTestId('secondary-chat-composer'));
    // PromptInput awaits Promise.all([]) before invoking onSubmit; wait for the
    // callback to fire and for the cleared draft to be reflected.
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
    render(<CollapsibleHarness secondaryChat={chat} />);
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
      <CollapsibleHarness
        secondaryChat={chat}
        onSubmitMessage={onSubmitMessage}
        streamingAssistantText="streaming reply..."
        isStreaming
      />,
    );
    const streaming = screen.getByTestId('secondary-chat-streaming-assistant');
    expect(streaming.textContent).toContain('streaming reply...');
    expect(streaming.getAttribute('data-is-streaming')).toBe('true');
    expect((screen.getByTestId('secondary-chat-composer-input') as HTMLTextAreaElement).disabled).toBe(true);
  });

  it('renders the streaming pulse as a static text block under prefers-reduced-motion', () => {
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
        <CollapsibleHarness
          secondaryChat={chat}
          onSubmitMessage={vi.fn()}
          streamingAssistantText="streaming reply..."
          isStreaming
        />,
      );
      const streaming = screen.getByTestId('secondary-chat-streaming-assistant');
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
    render(<CollapsibleHarness secondaryChat={chat} />);
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
    render(<CollapsibleHarness secondaryChat={chat} />);
    const turn = screen.getByTestId('secondary-chat-assistant-turn');
    const strong = turn.querySelector('strong');
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe('bold');
    expect(turn.textContent).not.toContain('**');
  });

  it('renders 3 turn-zero suggestions for mode=explore and hides them after a user turn', () => {
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'explore', pinned_item_id: 42 },
      kickoffTurn: makeKickoffTurn(99, 'Anchored to item.'),
      turns: [],
      pinnedItemKind: 'goal',
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<CollapsibleHarness secondaryChat={chat} onSubmitMessage={vi.fn()} />);
    const row = screen.getByTestId('secondary-chat-suggestions');
    expect(row.dataset.mode).toBe('explore');
    expect(screen.getAllByTestId('secondary-chat-suggestion')).toHaveLength(3);

    cleanup();
    const chatAfter: SecondaryChat = {
      chat: { ...baseChat, mode: 'explore', pinned_item_id: 42 },
      kickoffTurn: makeKickoffTurn(99, 'Anchored to item.'),
      turns: [makeUserTurn(1, 'first message')],
      pinnedItemKind: 'goal',
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<CollapsibleHarness secondaryChat={chatAfter} onSubmitMessage={vi.fn()} />);
    expect(screen.queryByTestId('secondary-chat-suggestions')).toBeNull();
  });

  it('changes the suggestion set with the mode', () => {
    const chatEdit: SecondaryChat = {
      chat: { ...baseChat, mode: 'edit', pinned_item_id: 42 },
      kickoffTurn: makeKickoffTurn(99, 'Editing item.'),
      turns: [],
      pinnedItemKind: 'goal',
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<CollapsibleHarness secondaryChat={chatEdit} onSubmitMessage={vi.fn()} />);
    const row = screen.getByTestId('secondary-chat-suggestions');
    expect(row.dataset.mode).toBe('edit');
    expect(row.dataset.reconciliationKind).toBe('none');
  });

  it('routes reconciliation-kind into the suggestion set', () => {
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
    render(<CollapsibleHarness secondaryChat={chat} onSubmitMessage={vi.fn()} />);
    expect(screen.getByTestId('secondary-chat-suggestions').dataset.reconciliationKind).toBe('supersedes');
  });

  it('clicking a suggestion submits the chat immediately without filling the draft', () => {
    const chat: SecondaryChat = {
      chat: { ...baseChat, mode: 'explore', pinned_item_id: 42 },
      kickoffTurn: makeKickoffTurn(99, 'Anchored to item.'),
      turns: [],
      pinnedItemKind: 'goal',
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    const onSubmitMessage = vi.fn();
    render(<CollapsibleHarness secondaryChat={chat} onSubmitMessage={onSubmitMessage} />);
    const firstSuggestion = screen.getAllByTestId('secondary-chat-suggestion')[0]!;
    const text = firstSuggestion.textContent ?? '';
    fireEvent.click(firstSuggestion);
    expect(onSubmitMessage).toHaveBeenCalledWith(text);
    const input = screen.getByTestId('secondary-chat-composer-input') as HTMLTextAreaElement;
    expect(input.value).toBe('');
  });

  it('opens the mention popup when the user types #', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(
      <CollapsibleHarness
        secondaryChat={chat}
        onSubmitMessage={vi.fn()}
        mentionableItems={[
          { refCode: 'R1', kind: 'requirement', content: 'Auth' },
          { refCode: 'R2', kind: 'requirement', content: 'Search' },
          { refCode: 'G1', kind: 'goal', content: 'Ship V1' },
        ]}
      />,
    );
    const input = screen.getByTestId('secondary-chat-composer-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '#' } });
    expect(screen.getByTestId('secondary-chat-mention-popup').getAttribute('data-query')).toBe('');
    expect(screen.getAllByTestId('secondary-chat-mention-item').length).toBeGreaterThanOrEqual(3);
  });

  it('filters the mention popup by query prefix', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(
      <CollapsibleHarness
        secondaryChat={chat}
        onSubmitMessage={vi.fn()}
        mentionableItems={[
          { refCode: 'R1', kind: 'requirement', content: 'Auth' },
          { refCode: 'R2', kind: 'requirement', content: 'Search' },
          { refCode: 'G1', kind: 'goal', content: 'Ship V1' },
        ]}
      />,
    );
    const input = screen.getByTestId('secondary-chat-composer-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '#R' } });
    const popup = screen.getByTestId('secondary-chat-mention-popup');
    expect(popup.getAttribute('data-query')).toBe('R');
    const items = screen.getAllByTestId('secondary-chat-mention-item');
    expect(items.map((el) => el.getAttribute('data-ref-code'))).toEqual(['R1', 'R2']);
  });

  it('Escape dismisses the mention popup without inserting', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(
      <CollapsibleHarness
        secondaryChat={chat}
        onSubmitMessage={vi.fn()}
        mentionableItems={[{ refCode: 'R1', kind: 'requirement', content: 'Auth' }]}
      />,
    );
    const input = screen.getByTestId('secondary-chat-composer-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '#R' } });
    expect(screen.getByTestId('secondary-chat-mention-popup')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('secondary-chat-mention-popup')).toBeNull();
    expect(input.value).toBe('#R');
  });

  it('Enter on the mention popup inserts #REF-CODE and closes the popup', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(
      <CollapsibleHarness
        secondaryChat={chat}
        onSubmitMessage={vi.fn()}
        mentionableItems={[
          { refCode: 'R1', kind: 'requirement', content: 'Auth' },
          { refCode: 'R2', kind: 'requirement', content: 'Search' },
        ]}
      />,
    );
    const input = screen.getByTestId('secondary-chat-composer-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '#R' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByTestId('secondary-chat-mention-popup')).toBeNull();
    expect(input.value).toBe('#R1 ');
  });

  it('does not render the mention popup when no mention is active', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(
      <CollapsibleHarness
        secondaryChat={chat}
        onSubmitMessage={vi.fn()}
        mentionableItems={[{ refCode: 'R1', kind: 'requirement', content: 'Auth' }]}
      />,
    );
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
    render(<CollapsibleHarness secondaryChat={chat} />);
    expect(screen.queryByTestId('secondary-chat-reconciliation-panel')).toBeNull();
  });

  it('does not render the composer anchor chip when the draft is empty and there is no span hint (pinned item rendered elsewhere)', () => {
    const chat: SecondaryChat = {
      chat: { ...baseChat, pinned_item_id: 42 },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: 'requirement',
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<CollapsibleHarness secondaryChat={chat} onSubmitMessage={vi.fn()} />);
    expect(screen.queryByTestId('secondary-chat-composer-anchor-chip')).toBeNull();
  });

  it('renders each #REF-CODE in the draft as a chip above the composer', () => {
    const chat: SecondaryChat = {
      chat: { ...baseChat, pinned_item_id: 42 },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: 'requirement',
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<CollapsibleHarness secondaryChat={chat} onSubmitMessage={vi.fn()} />);
    const input = screen.getByTestId('secondary-chat-composer-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'About #R1 and also #G2 — and #R1 again' } });
    const chips = screen.getAllByTestId('secondary-chat-composer-mention-chip');
    // Distinct mentions only — R1 appears twice in the draft but produces one chip.
    expect(chips).toHaveLength(2);
    expect(chips[0]?.getAttribute('data-ref-code')).toBe('R1');
    expect(chips[1]?.getAttribute('data-ref-code')).toBe('G2');
  });

  it('renders the span hint as a chip above the composer when pinned_span_hint is set', () => {
    const chat: SecondaryChat = {
      chat: { ...baseChat, pinned_item_id: 42, pinned_span_hint: 'highlighted excerpt' },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: 'requirement',
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<CollapsibleHarness secondaryChat={chat} onSubmitMessage={vi.fn()} />);
    const span = screen.getByTestId('secondary-chat-composer-anchor-span');
    expect(span.textContent).toContain('highlighted excerpt');
    expect(span.getAttribute('title')).toBe('highlighted excerpt');
  });

  it('does not render the composer anchor chip when the draft has no mentions and no span hint', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    render(<CollapsibleHarness secondaryChat={chat} onSubmitMessage={vi.fn()} />);
    expect(screen.queryByTestId('secondary-chat-composer-anchor-chip')).toBeNull();
  });
});
