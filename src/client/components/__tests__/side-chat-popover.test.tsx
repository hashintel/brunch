// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
    it('renders the Note button when onAnnotateRequest is provided', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          onAnnotateRequest={() => {}}
          onAnnotateCancel={() => {}}
          onAnnotateSubmit={() => {}}
        />,
      );

      expect(screen.getByRole('button', { name: /add a note/i })).toBeTruthy();
    });

    it('does not render the Note button without onAnnotateRequest', () => {
      render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);

      expect(screen.queryByRole('button', { name: /add a note/i })).toBeNull();
    });

    it('clicking Note fires onAnnotateRequest', () => {
      const onAnnotateRequest = vi.fn();
      render(
        <SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} onAnnotateRequest={onAnnotateRequest} />,
      );

      fireEvent.click(screen.getByRole('button', { name: /add a note/i }));
      expect(onAnnotateRequest).toHaveBeenCalledTimes(1);
    });

    it('disables the Note button while a stream is in flight', () => {
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

      const button = screen.getByRole('button', { name: /add a note/i }) as HTMLButtonElement;
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
      expect(screen.queryByRole('status', { name: /change saved/i })).toBeNull();
      expect(screen.queryByText(/saving change/i)).toBeNull();
    });

    it('shows the "saving change…" status while isApplying is true (no staging panel flash)', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          stagedPatches={[{ id: 'p1', kind: 'annotate', summary: 'note' }]}
          isApplying
        />,
      );

      expect(screen.getByText(/saving change/i)).toBeTruthy();
      // Staging panel must NOT show during in-flight auto-apply.
      expect(screen.queryByRole('region', { name: /staged annotations/i })).toBeNull();
    });

    // Card 4 follow-up: "Change saved" toast moved out of the side-chat
    // composer into <PatchListOverlay /> (rendered in the structured-list
    // view above PendingReviewSection), so the popover no longer surfaces
    // the saved confirmation. Toast lifecycle is exercised in
    // patch-list-overlay.test.tsx.

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
      expect(screen.getByText(/2 pending changes/i)).toBeTruthy();
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

      fireEvent.click(screen.getByRole('button', { name: /discard staged change/i }));
      expect(onDiscardPatch).toHaveBeenCalledWith('p1');
    });

    it('Apply button on a staged patch fires onApply', () => {
      const onApply = vi.fn();
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          stagedPatches={[{ id: 'p1', kind: 'annotate', summary: 'note' }]}
          onApply={onApply}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /apply 1 change/i }));
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

      fireEvent.click(screen.getByRole('button', { name: /undo last change/i }));
      expect(onUndo).toHaveBeenCalledTimes(1);
    });
  });

  describe('notes drawer header', () => {
    it('shows a sticky "Notes (N)" header inside the drawer with a close button that collapses it', () => {
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          existingAnnotations={[
            { id: 1, summary: 'first', body: '' },
            { id: 2, summary: 'second', body: '' },
          ]}
        />,
      );

      // Drawer is collapsed initially — header is not visible.
      expect(screen.queryByRole('button', { name: /hide notes/i })).toBeNull();

      // Open the drawer via the toggle button next to the action row.
      fireEvent.click(screen.getByRole('button', { name: /show existing notes/i }));

      // Sticky header inside the drawer renders "Notes (2)" plus a close button.
      const closeButton = screen.getByRole('button', { name: /hide notes/i });
      expect(closeButton).toBeTruthy();
      expect(closeButton.parentElement?.textContent).toContain('Notes (2)');

      // Clicking the × in the header collapses the drawer (close button disappears).
      fireEvent.click(closeButton);
      expect(screen.queryByRole('button', { name: /hide notes/i })).toBeNull();
    });
  });

  describe('notes drawer promote-from-drawer affordance', () => {
    it('clicking the + button on a drawer item fires onPromoteAnnotation with the right id', () => {
      const onPromoteAnnotation = vi.fn();
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          existingAnnotations={[
            { id: 11, summary: 'first', body: '' },
            { id: 22, summary: 'second', body: '' },
          ]}
          onPromoteAnnotation={onPromoteAnnotation}
        />,
      );

      // Open the drawer.
      fireEvent.click(screen.getByRole('button', { name: /show existing notes/i }));

      // Click the + button on the first item.
      fireEvent.click(screen.getByRole('button', { name: /add first to context/i }));
      expect(onPromoteAnnotation).toHaveBeenCalledTimes(1);
      expect(onPromoteAnnotation).toHaveBeenCalledWith(11);
    });

    it('renders the in-context indicator (no + button) when activeAnnotationIds includes the id', () => {
      const onPromoteAnnotation = vi.fn();
      render(
        <SideChatPopover
          pinnedItem={baseItem}
          onDismiss={() => {}}
          existingAnnotations={[
            { id: 11, summary: 'first', body: '' },
            { id: 22, summary: 'second', body: '' },
          ]}
          activeAnnotationIds={[11]}
          onPromoteAnnotation={onPromoteAnnotation}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /show existing notes/i }));

      // 'first' is already in context — no + button for it; the second item still has one.
      expect(screen.queryByRole('button', { name: /add first to context/i })).toBeNull();
      expect(screen.getByRole('button', { name: /add second to context/i })).toBeTruthy();

      // The "Already in chat context" indicator appears on the first row.
      const firstRow = screen.getByText('first').closest('[data-annotation-id]') as HTMLElement | null;
      expect(firstRow).not.toBeNull();
      expect(firstRow!.querySelector('[title="Already in chat context"]')).not.toBeNull();
    });
  });

  // Card 4 follow-up: saved-toast lifecycle moved to <PatchListOverlay />.
  // See patch-list-overlay.test.tsx for the canonical lifecycle suite.
});

describe('SideChatPopover — impact tier chip on edit patches (V2 §4.1)', () => {
  it('renders a Soft impact chip on staged edit patches with impact="soft"', () => {
    render(
      <SideChatPopover
        pinnedItem={baseItem}
        onDismiss={() => {}}
        stagedPatches={[{ id: 'p1', kind: 'edit', summary: 'Edit: rephrase', impact: 'soft' }]}
      />,
    );
    const chip = screen.getByLabelText(/soft impact/i);
    expect(chip.getAttribute('data-impact')).toBe('soft');
    expect(chip.textContent).toMatch(/soft impact/i);
  });

  it('renders a Hard impact chip on staged edit patches with impact="hard"', () => {
    render(
      <SideChatPopover
        pinnedItem={baseItem}
        onDismiss={() => {}}
        stagedPatches={[{ id: 'p1', kind: 'edit', summary: 'Edit: rephrase', impact: 'hard' }]}
      />,
    );
    const chip = screen.getByLabelText(/hard impact — v3/i);
    expect(chip.getAttribute('data-impact')).toBe('hard');
  });

  it('renders a No impact chip on staged edit patches with impact="none"', () => {
    render(
      <SideChatPopover
        pinnedItem={baseItem}
        onDismiss={() => {}}
        stagedPatches={[{ id: 'p1', kind: 'edit', summary: 'Edit: rephrase', impact: 'none' }]}
      />,
    );
    const chip = screen.getByLabelText(/no impact/i);
    expect(chip.getAttribute('data-impact')).toBe('none');
  });

  it('does not render an impact chip when the staged patch is not an edit', () => {
    render(
      <SideChatPopover
        pinnedItem={baseItem}
        onDismiss={() => {}}
        stagedPatches={[{ id: 'p1', kind: 'annotate', summary: 'note' }]}
      />,
    );
    expect(screen.queryByLabelText(/impact/i)).toBeNull();
  });

  it('does not render an impact chip when impact is omitted on an edit patch', () => {
    render(
      <SideChatPopover
        pinnedItem={baseItem}
        onDismiss={() => {}}
        stagedPatches={[{ id: 'p1', kind: 'edit', summary: 'Edit: rephrase' }]}
      />,
    );
    expect(screen.queryByLabelText(/impact/i)).toBeNull();
  });
});

describe('SideChatPopover — Edit-mode toggle (V2)', () => {
  it('keeps the Edit button disabled when onModeChange is not provided', () => {
    render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);
    const edit = screen.getByRole('button', { name: /edit unavailable/i }) as HTMLButtonElement;
    expect(edit.disabled).toBe(true);
  });

  it('explains that disabled Edit is unavailable in the current context', () => {
    render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} />);
    const edit = screen.getByRole('button', { name: /edit unavailable/i });
    expect(edit.getAttribute('title')).toBe('Edit unavailable in this context');
  });

  it('enables the Edit button when onModeChange is provided', () => {
    render(<SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} onModeChange={() => {}} />);
    const edit = screen.getByRole('button', { name: /edit/i }) as HTMLButtonElement;
    expect(edit.disabled).toBe(false);
  });

  it('clicking Edit when mode is "explore" calls onModeChange("edit")', () => {
    const onModeChange = vi.fn();
    render(
      <SideChatPopover
        pinnedItem={baseItem}
        onDismiss={() => {}}
        mode="explore"
        onModeChange={onModeChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onModeChange).toHaveBeenCalledWith('edit');
  });

  it('clicking Edit when mode is "edit" calls onModeChange("explore") (toggle off)', () => {
    const onModeChange = vi.fn();
    render(
      <SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} mode="edit" onModeChange={onModeChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onModeChange).toHaveBeenCalledWith('explore');
  });

  it('marks the Edit button as pressed when mode is "edit"', () => {
    render(
      <SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} mode="edit" onModeChange={() => {}} />,
    );
    const edit = screen.getByRole('button', { name: /edit/i });
    expect(edit.getAttribute('aria-pressed')).toBe('true');
  });

  it('marks the Edit button as not pressed when mode is "explore"', () => {
    render(
      <SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} mode="explore" onModeChange={() => {}} />,
    );
    const edit = screen.getByRole('button', { name: /edit/i });
    expect(edit.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('SideChatPopover — staged-edit diff popover (Card 4 polish)', () => {
  it('renders a "view diff" chip on edit patches that carry currentContent and newContent', () => {
    render(
      <SideChatPopover
        pinnedItem={baseItem}
        onDismiss={() => {}}
        stagedPatches={[
          {
            id: 'p1',
            kind: 'edit',
            summary: 'Edit: rephrase',
            currentContent: 'Use SQLite for the local store.',
            newContent: 'Use Postgres for the local store.',
          },
        ]}
      />,
    );
    const row = document.querySelector('[data-staged-patch-id="p1"]');
    expect(row).not.toBeNull();
    expect(row!.querySelector('[data-view-diff-chip]')).not.toBeNull();
    // The inline <details> expander has been removed.
    expect(row!.querySelector('details')).toBeNull();
  });

  it('clicking the "view diff" chip opens the DiffPopover with removed/added spans', () => {
    render(
      <SideChatPopover
        pinnedItem={baseItem}
        onDismiss={() => {}}
        stagedPatches={[
          {
            id: 'p1',
            kind: 'edit',
            summary: 'Edit: rephrase',
            currentContent: 'Use SQLite for the local store.',
            newContent: 'Use Postgres for the local store.',
          },
        ]}
      />,
    );
    // Popover starts closed.
    expect(document.querySelector('[data-diff-popover]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /view diff for edit: rephrase/i }));
    const popover = document.querySelector('[data-diff-popover]');
    expect(popover).not.toBeNull();
    const removed = popover!.querySelectorAll('[data-diff-kind="removed"]');
    const added = popover!.querySelectorAll('[data-diff-kind="added"]');
    expect(removed.length).toBeGreaterThan(0);
    expect(added.length).toBeGreaterThan(0);
    expect(Array.from(removed).some((node) => node.textContent?.includes('SQLite'))).toBe(true);
    expect(Array.from(added).some((node) => node.textContent?.includes('Postgres'))).toBe(true);
  });

  it('does not render a view-diff chip when the edit patch lacks currentContent or newContent', () => {
    render(
      <SideChatPopover
        pinnedItem={baseItem}
        onDismiss={() => {}}
        stagedPatches={[{ id: 'p1', kind: 'edit', summary: 'Edit: rephrase' }]}
      />,
    );
    const row = document.querySelector('[data-staged-patch-id="p1"]');
    expect(row).not.toBeNull();
    expect(row!.querySelector('[data-view-diff-chip]')).toBeNull();
    expect(row!.textContent).toContain('Edit: rephrase');
  });

  it('does not render a view-diff chip when before and after content are equal', () => {
    render(
      <SideChatPopover
        pinnedItem={baseItem}
        onDismiss={() => {}}
        stagedPatches={[
          {
            id: 'p1',
            kind: 'edit',
            summary: 'Edit: rephrase',
            currentContent: 'same content',
            newContent: 'same content',
          },
        ]}
      />,
    );
    const row = document.querySelector('[data-staged-patch-id="p1"]');
    expect(row!.querySelector('[data-view-diff-chip]')).toBeNull();
  });

  it('does not render a view-diff chip on non-edit staged patches', () => {
    render(
      <SideChatPopover
        pinnedItem={baseItem}
        onDismiss={() => {}}
        stagedPatches={[{ id: 'p1', kind: 'annotate', summary: 'Note about C1' }]}
      />,
    );
    const row = document.querySelector('[data-staged-patch-id="p1"]');
    expect(row!.querySelector('[data-view-diff-chip]')).toBeNull();
  });

  it('renders a kind chip on every staged patch row regardless of kind', () => {
    render(
      <SideChatPopover
        pinnedItem={baseItem}
        onDismiss={() => {}}
        stagedPatches={[
          { id: 'a', kind: 'annotate', summary: 'note' },
          { id: 'b', kind: 'edit', summary: 'edit' },
          { id: 'c', kind: 'edge', summary: 'edge' },
          { id: 'd', kind: 'drill-down', summary: 'drill' },
        ]}
      />,
    );
    expect(document.querySelector('[data-staged-patch-id="a"] [data-kind-chip="annotate"]')).not.toBeNull();
    expect(document.querySelector('[data-staged-patch-id="b"] [data-kind-chip="edit"]')).not.toBeNull();
    expect(document.querySelector('[data-staged-patch-id="c"] [data-kind-chip="edge"]')).not.toBeNull();
    expect(document.querySelector('[data-staged-patch-id="d"] [data-kind-chip="drill-down"]')).not.toBeNull();
  });
});

describe('SideChatPopover — Card 4 vocabulary + chrome polish', () => {
  it('moves the Note button into the input card next to the attach button', () => {
    const { container } = render(
      <SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} onAnnotateRequest={() => {}} />,
    );
    const note = container.querySelector('[aria-label="Add a note"]') as HTMLElement;
    const attach = container.querySelector('[aria-label="Attach (coming soon)"]') as HTMLElement;
    expect(note).not.toBeNull();
    expect(attach).not.toBeNull();
    // Both share the same parent (the input-card left action row).
    expect(note.parentElement).toBe(attach.parentElement);
  });

  it('renders the Edit-mode strip below the input card with an Off / Edit on toggle pill', () => {
    const { container, rerender } = render(
      <SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} mode="explore" onModeChange={() => {}} />,
    );
    const strip = container.querySelector('[data-edit-mode-strip]');
    expect(strip).not.toBeNull();
    expect(strip!.textContent).toContain('Edit mode');
    expect(strip!.textContent).toContain('Off');

    rerender(
      <SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} mode="edit" onModeChange={() => {}} />,
    );
    const stripActive = container.querySelector('[data-edit-mode-strip]');
    expect(stripActive!.textContent).toContain('Edit on');
  });

  it('input placeholder swaps to "Suggest an edit…" when mode is "edit"', () => {
    const { rerender } = render(
      <SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} mode="explore" onModeChange={() => {}} />,
    );
    const explore = screen.getByLabelText('Message') as HTMLTextAreaElement;
    expect(explore.placeholder).toMatch(/ask me anything/i);
    rerender(
      <SideChatPopover pinnedItem={baseItem} onDismiss={() => {}} mode="edit" onModeChange={() => {}} />,
    );
    const edit = screen.getByLabelText('Message') as HTMLTextAreaElement;
    expect(edit.placeholder).toMatch(/suggest an edit/i);
  });

  it('annotate composer placeholders read "Title" and "Details"', () => {
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
    const summary = screen.getByLabelText('Annotation summary') as HTMLInputElement;
    const body = screen.getByLabelText('Annotation body') as HTMLTextAreaElement;
    expect(summary.placeholder).toBe('Title');
    expect(body.placeholder).toBe('Details');
  });

  it('staged-patch discard button uses the X icon and is hidden until row hover/focus', () => {
    const { container } = render(
      <SideChatPopover
        pinnedItem={baseItem}
        onDismiss={() => {}}
        stagedPatches={[{ id: 'p1', kind: 'annotate', summary: 'note' }]}
        onDiscardPatch={() => {}}
      />,
    );
    const discard = container.querySelector('[aria-label^="Discard staged change"]') as HTMLButtonElement;
    expect(discard).not.toBeNull();
    // Hidden by default, revealed on group hover/focus-within.
    expect(discard.className).toMatch(/opacity-0/);
    expect(discard.className).toMatch(/group-hover\/staged-row:opacity-100/);
  });
});
