// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ChatLayoutMode } from '../unified-chat-shell.js';
import {
  CHAT_LAYOUT_MODE_ORDER,
  chatLayoutModeStorageKey,
  decrementChatLayoutMode,
  useChatLayoutMode,
} from '../use-chat-layout-mode.js';

function Harness({ specificationId }: { specificationId: string }) {
  const { layoutMode, setLayoutMode } = useChatLayoutMode(specificationId);
  return (
    <div>
      <output data-testid="mode">{layoutMode}</output>
      {(['compact', 'side-docked', 'maximize', 'full'] as ChatLayoutMode[]).map((mode) => (
        <button key={mode} data-testid={`set-${mode}`} onClick={() => setLayoutMode(mode)}>
          set {mode}
        </button>
      ))}
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('decrementChatLayoutMode', () => {
  it('walks the order tier-by-tier and stops at compact', () => {
    expect(decrementChatLayoutMode('full')).toBe('maximize');
    expect(decrementChatLayoutMode('maximize')).toBe('side-docked');
    expect(decrementChatLayoutMode('side-docked')).toBe('compact');
    expect(decrementChatLayoutMode('compact')).toBe('compact');
  });

  it('publishes the canonical tier order', () => {
    expect(CHAT_LAYOUT_MODE_ORDER).toEqual(['compact', 'side-docked', 'maximize', 'full']);
  });
});

describe('useChatLayoutMode — C13', () => {
  it('defaults to side-docked when localStorage is empty', () => {
    render(<Harness specificationId="42" />);
    expect(screen.getByTestId('mode').textContent).toBe('side-docked');
  });

  it('persists the chosen mode to localStorage under a per-spec key', () => {
    render(<Harness specificationId="42" />);
    fireEvent.click(screen.getByTestId('set-maximize'));
    expect(screen.getByTestId('mode').textContent).toBe('maximize');
    expect(window.localStorage.getItem(chatLayoutModeStorageKey('42'))).toBe('maximize');
  });

  it('rehydrates the persisted mode on first mount, clamping the disabled Full tier to Maximize (C17)', () => {
    window.localStorage.setItem(chatLayoutModeStorageKey('99'), 'full');
    render(<Harness specificationId="99" />);
    expect(screen.getByTestId('mode').textContent).toBe('maximize');
    // Storage is rewritten so subsequent reads don't repeat the clamp.
    expect(window.localStorage.getItem(chatLayoutModeStorageKey('99'))).toBe('maximize');
  });

  it('rehydrates non-disabled persisted modes as-is', () => {
    window.localStorage.setItem(chatLayoutModeStorageKey('100'), 'maximize');
    render(<Harness specificationId="100" />);
    expect(screen.getByTestId('mode').textContent).toBe('maximize');
  });

  it('ignores junk values in localStorage and falls back to the default', () => {
    window.localStorage.setItem(chatLayoutModeStorageKey('99'), 'not-a-mode');
    render(<Harness specificationId="99" />);
    expect(screen.getByTestId('mode').textContent).toBe('side-docked');
  });

  it('decrements one tier on Escape from the reachable max (maximize → side-docked → compact, then stays)', () => {
    window.localStorage.setItem(chatLayoutModeStorageKey('1'), 'maximize');
    render(<Harness specificationId="1" />);
    expect(screen.getByTestId('mode').textContent).toBe('maximize');

    const press = () => {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
    };

    press();
    expect(screen.getByTestId('mode').textContent).toBe('side-docked');
    press();
    expect(screen.getByTestId('mode').textContent).toBe('compact');
    press();
    expect(screen.getByTestId('mode').textContent).toBe('compact');
  });

  it('clamps a programmatic setLayoutMode("full") to Maximize (C17)', () => {
    render(<Harness specificationId="1" />);
    fireEvent.click(screen.getByTestId('set-full'));
    expect(screen.getByTestId('mode').textContent).toBe('maximize');
    expect(window.localStorage.getItem(chatLayoutModeStorageKey('1'))).toBe('maximize');
  });

  it('skips Esc handling when the event has already been defaultPrevented', () => {
    render(<Harness specificationId="1" />);
    fireEvent.click(screen.getByTestId('set-maximize'));
    expect(screen.getByTestId('mode').textContent).toBe('maximize');

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      event.preventDefault();
      window.dispatchEvent(event);
    });
    expect(screen.getByTestId('mode').textContent).toBe('maximize');
  });

  it('switches the persisted slot when the specification id changes', () => {
    window.localStorage.setItem(chatLayoutModeStorageKey('a'), 'maximize');
    window.localStorage.setItem(chatLayoutModeStorageKey('b'), 'compact');

    const { rerender } = render(<Harness specificationId="a" />);
    expect(screen.getByTestId('mode').textContent).toBe('maximize');

    rerender(<Harness specificationId="b" />);
    expect(screen.getByTestId('mode').textContent).toBe('compact');
  });
});
