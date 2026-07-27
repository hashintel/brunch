// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SelectionMenu } from '../selection-menu.js';

afterEach(() => {
  cleanup();
});

const sampleRect = {
  top: 100,
  left: 200,
  bottom: 120,
  right: 280,
  width: 80,
  height: 20,
  x: 200,
  y: 100,
} as DOMRect;

describe('SelectionMenu', () => {
  it('renders both buttons when given a rect', () => {
    render(<SelectionMenu rect={sampleRect} onChat={() => {}} onAnnotate={() => {}} />);
    expect(screen.getByRole('button', { name: /chat/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /add to notes/i })).toBeTruthy();
  });

  it('renders nothing when rect is null', () => {
    const { container } = render(<SelectionMenu rect={null} onChat={() => {}} onAnnotate={() => {}} />);
    expect(container.querySelector('[data-selection-menu]')).toBeNull();
  });

  it('calls onChat when the chat button is clicked', () => {
    const onChat = vi.fn();
    render(<SelectionMenu rect={sampleRect} onChat={onChat} onAnnotate={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /chat/i }));
    expect(onChat).toHaveBeenCalledOnce();
  });

  it('calls onAnnotate when the annotate button is clicked', () => {
    const onAnnotate = vi.fn();
    render(<SelectionMenu rect={sampleRect} onChat={() => {}} onAnnotate={onAnnotate} />);
    fireEvent.click(screen.getByRole('button', { name: /add to notes/i }));
    expect(onAnnotate).toHaveBeenCalledOnce();
  });

  it('positions itself above the selection rect via fixed positioning', () => {
    render(<SelectionMenu rect={sampleRect} onChat={() => {}} onAnnotate={() => {}} />);
    const root = document.querySelector('[data-selection-menu]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.style.position).toBe('fixed');
    // Anchored above with a small gap; concrete pixel math is covered by visual review.
    expect(parseInt(root.style.top, 10)).toBeLessThan(sampleRect.top);
  });
});
