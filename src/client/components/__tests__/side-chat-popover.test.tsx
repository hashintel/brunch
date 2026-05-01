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
});
