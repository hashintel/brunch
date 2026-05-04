// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SideChatPopover } from '../side-chat-popover.js';

afterEach(() => {
  cleanup();
});

const baseItem = { referenceCode: 'D12', content: 'Use SQLite for the local store.' };

describe('SideChatPopover', () => {
  it('renders the pinned item referenceCode and content', () => {
    render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);

    expect(screen.getByText('D12')).toBeTruthy();
    expect(screen.getByText('Use SQLite for the local store.')).toBeTruthy();
  });

  it('renders an empty message list area', () => {
    render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);

    const list = screen.getByRole('log', { name: /side[- ]chat messages/i });
    expect(list.children.length).toBe(0);
  });

  it('disables the send button when the input is empty', () => {
    render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);

    const send = screen.getByRole('button', { name: /send/i }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
  });

  it('enables the send button when the input has trimmed content', () => {
    render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Why SQLite?' } });
    const send = screen.getByRole('button', { name: /send/i }) as HTMLButtonElement;
    expect(send.disabled).toBe(false);
  });

  it('keeps the send button disabled when input is whitespace-only', () => {
    render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: '   ' } });
    const send = screen.getByRole('button', { name: /send/i }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
  });

  it('fires onDismiss when the close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<SideChatPopover pinnedItem={baseItem} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /close side[- ]chat/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('fires onDismiss when Esc is pressed', () => {
    const onDismiss = vi.fn();
    render(<SideChatPopover pinnedItem={baseItem} onDismiss={onDismiss} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('fires onDismiss when the user clicks outside the popover', () => {
    const onDismiss = vi.fn();
    render(
      <div>
        <button type="button">outside</button>
        <SideChatPopover pinnedItem={baseItem} onDismiss={onDismiss} />
      </div>,
    );

    fireEvent.mouseDown(screen.getByText('outside'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not fire onDismiss for clicks inside the popover', () => {
    const onDismiss = vi.fn();
    render(<SideChatPopover pinnedItem={baseItem} onDismiss={onDismiss} />);

    fireEvent.mouseDown(screen.getByRole('dialog'));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('moves keyboard focus to the message input when the popover mounts', () => {
    render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);

    expect(document.activeElement).toBe(screen.getByLabelText('Message'));
  });

  it('traps Tab forward by wrapping focus from the last focusable to the message input', () => {
    render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);

    const close = screen.getByRole('button', { name: /close side[- ]chat/i });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab' });

    expect(document.activeElement).toBe(screen.getByLabelText('Message'));
  });

  it('traps Shift+Tab backward by wrapping focus from the message input to the last focusable', () => {
    render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);

    const messageInput = screen.getByLabelText('Message');
    messageInput.focus();
    fireEvent.keyDown(messageInput, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(screen.getByRole('button', { name: /close side[- ]chat/i }));
  });

  it('exposes the popover surface as a dialog with an accessible name', () => {
    render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);

    expect(screen.getByRole('dialog', { name: /side[- ]chat/i })).toBeTruthy();
  });

  describe('messages, streaming, and submit', () => {
    it('renders user and assistant messages from the messages prop in order', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          messages={[
            { role: 'user', text: 'Why SQLite?' },
            { role: 'assistant', text: 'It keeps the runtime local-first.' },
          ]}
        />,
      );

      const log = screen.getByRole('log', { name: /side[- ]chat messages/i });
      const items = log.querySelectorAll('[data-message-role]');
      expect(items).toHaveLength(2);
      expect(items[0].getAttribute('data-message-role')).toBe('user');
      expect(items[0].textContent).toContain('Why SQLite?');
      expect(items[1].getAttribute('data-message-role')).toBe('assistant');
      expect(items[1].textContent).toContain('It keeps the runtime local-first.');
    });

    it('marks a message with pending: true so the in-flight assistant turn renders as such', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          messages={[
            { role: 'user', text: 'Why?' },
            { role: 'assistant', text: 'It keeps', pending: true },
          ]}
        />,
      );

      const log = screen.getByRole('log', { name: /side[- ]chat messages/i });
      const items = log.querySelectorAll('[data-message-role]');
      expect(items).toHaveLength(2);
      expect(items[1].getAttribute('data-message-role')).toBe('assistant');
      expect(items[1].getAttribute('data-message-pending')).toBe('true');
      expect(items[1].textContent).toContain('It keeps');
    });

    it('renders no pending row when no message carries pending: true', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          messages={[
            { role: 'user', text: 'Why?' },
            { role: 'assistant', text: 'It depends.' },
          ]}
        />,
      );

      const log = screen.getByRole('log', { name: /side[- ]chat messages/i });
      const items = log.querySelectorAll('[data-message-role]');
      expect(items).toHaveLength(2);
      expect(items[1].getAttribute('data-message-pending')).not.toBe('true');
    });

    it('calls onSubmit with the trimmed input value when the send button is clicked', () => {
      const onSubmit = vi.fn();
      render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByLabelText('Message'), { target: { value: '  Why SQLite?  ' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith('Why SQLite?');
    });

    it('calls onSubmit when Enter is pressed in the message input', () => {
      const onSubmit = vi.fn();
      render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} onSubmit={onSubmit} />);

      const input = screen.getByLabelText('Message');
      fireEvent.change(input, { target: { value: 'Hello' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith('Hello');
    });

    it('does not call onSubmit when Shift+Enter is pressed (newline allowed in textarea)', () => {
      const onSubmit = vi.fn();
      render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} onSubmit={onSubmit} />);

      const input = screen.getByLabelText('Message');
      fireEvent.change(input, { target: { value: 'Hello' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('clears the message input after a successful submit', () => {
      render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} onSubmit={() => {}} />);

      const input = screen.getByLabelText('Message') as HTMLTextAreaElement;
      fireEvent.change(input, { target: { value: 'Hello' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      expect(input.value).toBe('');
    });

    it('renders error-flagged messages with a distinct treatment', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          messages={[
            { role: 'user', text: 'Why?' },
            { role: 'assistant', text: 'Something went wrong — try again.', error: true },
          ]}
        />,
      );

      const log = screen.getByRole('log', { name: /side[- ]chat messages/i });
      const items = log.querySelectorAll('[data-message-role]');
      expect(items).toHaveLength(2);
      expect(items[1].getAttribute('data-message-error')).toBe('true');
      expect(items[1].textContent).toContain('Something went wrong');
    });

    it('does not mark non-error messages with the error attribute', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          messages={[
            { role: 'user', text: 'Why?' },
            { role: 'assistant', text: 'It depends.' },
          ]}
        />,
      );

      const log = screen.getByRole('log', { name: /side[- ]chat messages/i });
      const items = log.querySelectorAll('[data-message-role]');
      expect(items[1].getAttribute('data-message-error')).not.toBe('true');
    });

    it('disables the send button while a submission is in-flight (last message is pending)', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          messages={[
            { role: 'user', text: 'Why?' },
            { role: 'assistant', text: '', pending: true },
          ]}
        />,
      );
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello' } });
      const send = screen.getByRole('button', { name: /send/i }) as HTMLButtonElement;
      expect(send.disabled).toBe(true);
    });

    it('does not call onSubmit when the input is empty', () => {
      const onSubmit = vi.fn();
      render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} onSubmit={onSubmit} />);

      const send = screen.getByRole('button', { name: /send/i });
      fireEvent.click(send);
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('annotate composer', () => {
    it('renders the Annotate button when onAnnotateRequest is provided', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          onAnnotateRequest={() => {}}
          onAnnotateCancel={() => {}}
          onAnnotateSubmit={() => {}}
        />,
      );

      expect(screen.getByRole('button', { name: /annotate item/i })).toBeTruthy();
    });

    it('does not render the Annotate button without onAnnotateRequest', () => {
      render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);

      expect(screen.queryByRole('button', { name: /annotate item/i })).toBeNull();
    });

    it('clicking Annotate fires onAnnotateRequest', () => {
      const onAnnotateRequest = vi.fn();
      render(
        <SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} onAnnotateRequest={onAnnotateRequest} />,
      );

      fireEvent.click(screen.getByRole('button', { name: /annotate item/i }));
      expect(onAnnotateRequest).toHaveBeenCalledTimes(1);
    });

    it('disables the Annotate button while a stream is in flight', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          messages={[
            { role: 'user', text: 'Q' },
            { role: 'assistant', text: '', pending: true },
          ]}
          onAnnotateRequest={() => {}}
        />,
      );

      const button = screen.getByRole('button', { name: /annotate item/i }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it('annotateMode replaces the chat input with the composer form', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          annotateMode
          onAnnotateRequest={() => {}}
          onAnnotateCancel={() => {}}
          onAnnotateSubmit={() => {}}
        />,
      );

      expect(screen.queryByLabelText('Message')).toBeNull();
      expect(screen.getByLabelText('Annotation summary')).toBeTruthy();
      expect(screen.getByLabelText('Annotation body')).toBeTruthy();
    });

    it('Stage button is disabled until both summary and body are non-empty', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          annotateMode
          onAnnotateRequest={() => {}}
          onAnnotateCancel={() => {}}
          onAnnotateSubmit={() => {}}
        />,
      );

      const stageButton = screen.getByRole('button', { name: /stage/i }) as HTMLButtonElement;
      expect(stageButton.disabled).toBe(true);

      fireEvent.change(screen.getByLabelText('Annotation summary'), { target: { value: 'sum' } });
      expect(stageButton.disabled).toBe(true);

      fireEvent.change(screen.getByLabelText('Annotation body'), { target: { value: 'body' } });
      expect(stageButton.disabled).toBe(false);
    });

    it('Stage submits trimmed summary + body via onAnnotateSubmit', () => {
      const onAnnotateSubmit = vi.fn();
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          annotateMode
          onAnnotateRequest={() => {}}
          onAnnotateCancel={() => {}}
          onAnnotateSubmit={onAnnotateSubmit}
        />,
      );

      fireEvent.change(screen.getByLabelText('Annotation summary'), { target: { value: '  sum  ' } });
      fireEvent.change(screen.getByLabelText('Annotation body'), { target: { value: ' body ' } });
      fireEvent.click(screen.getByRole('button', { name: /^stage$/i }));

      expect(onAnnotateSubmit).toHaveBeenCalledWith('sum', 'body');
    });

    it('Cancel fires onAnnotateCancel', () => {
      const onAnnotateCancel = vi.fn();
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          annotateMode
          onAnnotateRequest={() => {}}
          onAnnotateCancel={onAnnotateCancel}
          onAnnotateSubmit={() => {}}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onAnnotateCancel).toHaveBeenCalledTimes(1);
    });

    it('Esc cancels the composer instead of dismissing the popover when annotateMode is on', () => {
      const onDismiss = vi.fn();
      const onAnnotateCancel = vi.fn();
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={onDismiss}
          annotateMode
          onAnnotateRequest={() => {}}
          onAnnotateCancel={onAnnotateCancel}
          onAnnotateSubmit={() => {}}
        />,
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onAnnotateCancel).toHaveBeenCalledTimes(1);
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  describe('inline patch list', () => {
    it('does not render the inline list when no patches are staged', () => {
      render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);
      expect(screen.queryByRole('region', { name: /staged annotations/i })).toBeNull();
    });

    it('renders one row per staged patch with summary text', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          stagedPatches={[
            { id: 'p1', kind: 'annotate', summary: 'first note' },
            { id: 'p2', kind: 'annotate', summary: 'second note' },
          ]}
        />,
      );

      expect(screen.getByText('first note')).toBeTruthy();
      expect(screen.getByText('second note')).toBeTruthy();
      expect(screen.getByText('2 staged annotations')).toBeTruthy();
    });

    it('Discard button fires onDiscardPatch with the row id', () => {
      const onDiscardPatch = vi.fn();
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          stagedPatches={[{ id: 'p1', kind: 'annotate', summary: 'note' }]}
          onDiscardPatch={onDiscardPatch}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /discard staged annotation/i }));
      expect(onDiscardPatch).toHaveBeenCalledWith('p1');
    });

    it('Apply button fires onApply', () => {
      const onApply = vi.fn();
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          stagedPatches={[{ id: 'p1', kind: 'annotate', summary: 'note' }]}
          onApply={onApply}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
      expect(onApply).toHaveBeenCalledTimes(1);
    });

    it('Apply button is disabled while isApplying', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          stagedPatches={[{ id: 'p1', kind: 'annotate', summary: 'note' }]}
          onApply={() => {}}
          isApplying
        />,
      );

      const apply = screen.getByRole('button', { name: /applying/i }) as HTMLButtonElement;
      expect(apply.disabled).toBe(true);
    });

    it('renders Undo only when canUndo is true', () => {
      const { rerender } = render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          stagedPatches={[{ id: 'p1', kind: 'annotate', summary: 'note' }]}
          onApply={() => {}}
          onUndo={() => {}}
          canUndo={false}
        />,
      );
      expect(screen.queryByRole('button', { name: /^undo$/i })).toBeNull();

      rerender(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          stagedPatches={[{ id: 'p1', kind: 'annotate', summary: 'note' }]}
          onApply={() => {}}
          onUndo={() => {}}
          canUndo
        />,
      );
      expect(screen.getByRole('button', { name: /^undo$/i })).toBeTruthy();
    });

    it('Undo fires onUndo', () => {
      const onUndo = vi.fn();
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          stagedPatches={[{ id: 'p1', kind: 'annotate', summary: 'note' }]}
          onApply={() => {}}
          onUndo={onUndo}
          canUndo
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /^undo$/i }));
      expect(onUndo).toHaveBeenCalledTimes(1);
    });
  });
});
