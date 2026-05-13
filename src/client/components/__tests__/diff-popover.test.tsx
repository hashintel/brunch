// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DiffPopover } from '../diff-popover.js';

afterEach(() => {
  cleanup();
});

function Harness({
  before,
  after,
  title,
  kindAccent,
  initiallyOpen = true,
  withKindChip = false,
  onCloseSpy,
  anchorRect,
}: {
  before: string;
  after: string;
  title: string;
  kindAccent?: string;
  initiallyOpen?: boolean;
  withKindChip?: boolean;
  onCloseSpy?: () => void;
  anchorRect?: Partial<DOMRect>;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  // Track anchor in state so DiffPopover re-renders once the ref attaches.
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  const setAnchorRef = (node: HTMLButtonElement | null) => {
    if (node && anchorRect) {
      node.getBoundingClientRect = () =>
        ({
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
          ...anchorRect,
        }) as DOMRect;
    }
    setAnchor(node);
  };

  return (
    <div>
      <button type="button" ref={setAnchorRef} onClick={() => setOpen(true)}>
        anchor
      </button>
      <button type="button" data-testid="outside">
        outside
      </button>
      <DiffPopover
        open={open}
        onClose={() => {
          setOpen(false);
          onCloseSpy?.();
        }}
        anchor={anchor}
        before={before}
        after={after}
        title={title}
        kindAccent={kindAccent ?? null}
        kindChip={
          withKindChip ? (
            <span data-testid="kind-chip" className="text-[10px]">
              edit
            </span>
          ) : undefined
        }
      />
    </div>
  );
}

describe('DiffPopover', () => {
  it('renders nothing when open is false', () => {
    render(<Harness before="old" after="new" title="Edit: rephrase" initiallyOpen={false} />);
    expect(screen.queryByRole('dialog', { name: /diff/i })).toBeNull();
  });

  it('renders the diff body, title, and close button when open', () => {
    render(<Harness before="Use SQLite" after="Use Postgres" title="Edit storage choice" />);
    const dialog = screen.getByRole('dialog', { name: /diff/i });
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('Edit storage choice');
    expect(screen.getByRole('button', { name: /close diff/i })).toBeTruthy();
    // ContentDiff emits removed/added markers.
    expect(document.querySelector('[data-diff-kind="removed"]')).not.toBeNull();
    expect(document.querySelector('[data-diff-kind="added"]')).not.toBeNull();
  });

  it('renders the kindChip in the header when provided', () => {
    render(<Harness before="a" after="b" title="t" withKindChip kindAccent="#9333ea" />);
    expect(screen.getByTestId('kind-chip')).toBeTruthy();
  });

  it('clicking the close button calls onClose', () => {
    const onCloseSpy = vi.fn();
    render(<Harness before="a" after="b" title="t" onCloseSpy={onCloseSpy} />);
    fireEvent.click(screen.getByRole('button', { name: /close diff/i }));
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('pressing ESC closes the popover', () => {
    const onCloseSpy = vi.fn();
    render(<Harness before="a" after="b" title="t" onCloseSpy={onCloseSpy} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('clicking outside the popover and anchor closes it', () => {
    const onCloseSpy = vi.fn();
    render(<Harness before="a" after="b" title="t" onCloseSpy={onCloseSpy} />);
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('clicking inside the popover does not close it', () => {
    const onCloseSpy = vi.fn();
    render(<Harness before="alpha" after="beta" title="t" onCloseSpy={onCloseSpy} />);
    const dialog = screen.getByRole('dialog', { name: /diff/i });
    fireEvent.mouseDown(dialog);
    expect(onCloseSpy).not.toHaveBeenCalled();
  });

  it('places below the anchor by default when there is space (keeps the chip in view)', () => {
    // happy-dom defaults give window.innerHeight=768. Anchor at y=100 leaves
    // ample room below — preferred so the chip stays visible.
    render(
      <Harness
        before="a"
        after="b"
        title="t"
        anchorRect={{ top: 100, bottom: 116, left: 100, right: 200 }}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: /diff/i });
    expect(dialog.getAttribute('data-placement')).toBe('below');
  });

  it('flips above when there is not enough space below but there is room above', () => {
    // Anchor near the bottom of an 768px viewport leaves no room for a 160px popover below.
    render(
      <Harness
        before="a"
        after="b"
        title="t"
        anchorRect={{ top: 740, bottom: 756, left: 100, right: 200 }}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: /diff/i });
    expect(dialog.getAttribute('data-placement')).toBe('above');
  });
});
