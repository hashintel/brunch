// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SideChatPopover, type SideChatMessage, type SideChatThreadItem } from '../side-chat-popover.js';

function toThreadItems(messages: readonly SideChatMessage[]): readonly SideChatThreadItem[] {
  return messages.map((message, index) => ({
    kind: 'message' as const,
    id: `m-${index}`,
    message,
    timestamp: index,
  }));
}

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

  it('does not fire onDismiss when the user clicks outside the popover', () => {
    const onDismiss = vi.fn();
    render(
      <div>
        <button type="button">outside</button>
        <SideChatPopover pinnedItem={baseItem} onDismiss={onDismiss} />
      </div>,
    );

    fireEvent.mouseDown(screen.getByText('outside'));

    expect(onDismiss).not.toHaveBeenCalled();
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

  it('exposes the popover surface as a dialog with an accessible name', () => {
    render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);

    expect(screen.getByRole('dialog', { name: /side[- ]chat/i })).toBeTruthy();
  });

  describe('messages, streaming, and submit', () => {
    it('renders user and assistant messages from the threadItems prop in order', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          threadItems={toThreadItems([
            { role: 'user', text: 'Why SQLite?' },
            { role: 'assistant', text: 'It keeps the runtime local-first.' },
          ])}
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
          threadItems={toThreadItems([
            { role: 'user', text: 'Why?' },
            { role: 'assistant', text: 'It keeps', pending: true },
          ])}
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
          threadItems={toThreadItems([
            { role: 'user', text: 'Why?' },
            { role: 'assistant', text: 'It depends.' },
          ])}
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
          threadItems={toThreadItems([
            { role: 'user', text: 'Why?' },
            { role: 'assistant', text: 'Something went wrong — try again.', error: true },
          ])}
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
          threadItems={toThreadItems([
            { role: 'user', text: 'Why?' },
            { role: 'assistant', text: 'It depends.' },
          ])}
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
          threadItems={toThreadItems([
            { role: 'user', text: 'Why?' },
            { role: 'assistant', text: '', pending: true },
          ])}
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
          threadItems={toThreadItems([
            { role: 'user', text: 'Q' },
            { role: 'assistant', text: '', pending: true },
          ])}
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

    it('Save button is disabled until both summary and body are non-empty', () => {
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

      const saveButton = screen.getByRole('button', { name: /^save$/i }) as HTMLButtonElement;
      expect(saveButton.disabled).toBe(true);

      fireEvent.change(screen.getByLabelText('Annotation summary'), { target: { value: 'sum' } });
      expect(saveButton.disabled).toBe(true);

      fireEvent.change(screen.getByLabelText('Annotation body'), { target: { value: 'body' } });
      expect(saveButton.disabled).toBe(false);
    });

    it('Save submits trimmed summary + body via onAnnotateSubmit', () => {
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
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

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

  describe('apply lifecycle (saving / saved / stuck)', () => {
    it('does not render any inline status when there are no staged patches and no completed batch', () => {
      render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);
      expect(screen.queryByRole('region', { name: /staged annotations/i })).toBeNull();
      expect(screen.queryByRole('status', { name: /annotation saved/i })).toBeNull();
      expect(screen.queryByText(/saving annotation/i)).toBeNull();
    });

    it('shows the "Saving annotation…" status while isApplying is true (no staging panel flash)', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          stagedPatches={[{ id: 'p1', kind: 'annotate', summary: 'note' }]}
          isApplying
        />,
      );

      expect(screen.getByText(/saving annotation/i)).toBeTruthy();
      // Staging panel must NOT show during in-flight auto-apply.
      expect(screen.queryByRole('region', { name: /staged annotations/i })).toBeNull();
    });

    it('shows the "✓ Annotation saved" confirmation with Undo when staged is empty and canUndo is true', () => {
      const onUndo = vi.fn();
      render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} canUndo onUndo={onUndo} />);

      const status = screen.getByRole('status', { name: /annotation saved/i });
      expect(status).toBeTruthy();
      expect(status.textContent).toContain('Annotation saved');

      fireEvent.click(screen.getByRole('button', { name: /^undo$/i }));
      expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it('does not render the saved confirmation when canUndo is false', () => {
      render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);
      expect(screen.queryByRole('status', { name: /annotation saved/i })).toBeNull();
    });

    it('renders the staging panel only when staged>0 and not currently applying (i.e., a stuck/failed batch)', () => {
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
      expect(screen.getByText(/2 pending annotations/i)).toBeTruthy();
    });

    it('Discard button on a stuck patch fires onDiscardPatch', () => {
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

    it('Retry button on a stuck patch fires onApply', () => {
      const onApply = vi.fn();
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          stagedPatches={[{ id: 'p1', kind: 'annotate', summary: 'note' }]}
          onApply={onApply}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /^retry$/i }));
      expect(onApply).toHaveBeenCalledTimes(1);
    });

    it('shows Undo in the staging panel when canUndo is true and staged is non-empty (mixed state)', () => {
      const onUndo = vi.fn();
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          stagedPatches={[{ id: 'p1', kind: 'annotate', summary: 'note' }]}
          onUndo={onUndo}
          canUndo
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /^undo$/i }));
      expect(onUndo).toHaveBeenCalledTimes(1);
    });
  });

  describe('SideChatPopover — saved toast lifecycle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows the saved toast when canUndo is true and no patches are staged', () => {
      render(
        <SideChatPopover
          pinnedItem={{ referenceCode: 'C1', content: 'item', kind: 'constraint' }}
          onDismiss={() => {}}
          canUndo
          isApplying={false}
          stagedPatches={[]}
        />,
      );
      expect(screen.getByLabelText(/annotation saved/i)).toBeTruthy();
    });

    it('auto-hides the toast after 5 seconds', () => {
      render(
        <SideChatPopover
          pinnedItem={{ referenceCode: 'C1', content: 'item', kind: 'constraint' }}
          onDismiss={() => {}}
          canUndo
          isApplying={false}
          stagedPatches={[]}
        />,
      );
      expect(screen.getByLabelText(/annotation saved/i)).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.queryByLabelText(/annotation saved/i)).toBeNull();
    });

    it('renders the toast inside the composer footer between the attach and send buttons', () => {
      const { container } = render(
        <SideChatPopover
          pinnedItem={{ referenceCode: 'C1', content: 'item', kind: 'constraint' }}
          onDismiss={() => {}}
          canUndo
          isApplying={false}
          stagedPatches={[]}
        />,
      );
      const toast = container.querySelector('[aria-label="Annotation saved"]') as HTMLElement;
      const attach = container.querySelector('[aria-label="Attach (coming soon)"]') as HTMLElement;
      const send = container.querySelector('[aria-label="Send message"]') as HTMLElement;
      expect(toast).not.toBeNull();
      expect(attach).not.toBeNull();
      expect(send).not.toBeNull();
      // attach precedes toast precedes send
      expect(attach.compareDocumentPosition(toast) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(toast.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
