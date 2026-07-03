import type { KeybindingsManager } from '@earendil-works/pi-coding-agent';
import { Key, matchesKey, TUI } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { VirtualTerminal } from '../../../.pi/__tests__/support/virtual-terminal.js';
import { showComponentPreview } from '../custom-ui.js';
import { createComponentPreviewTheme } from '../theme.js';

const theme = createComponentPreviewTheme();
const keybindings = undefined as unknown as KeybindingsManager;

describe('showComponentPreview', () => {
  it('opens inline (addChild) when no overlay option is given, and removes on done', async () => {
    const terminal = new VirtualTerminal(80, 24);
    const tui = new TUI(terminal);

    let capturedDone: ((result?: string) => void) | undefined;
    const resultPromise = showComponentPreview(tui, theme, keybindings, (_tui, _theme, _kb, done) => {
      capturedDone = done;
      return { render: () => ['inline-marker'], invalidate: () => {} };
    });
    tui.start();

    try {
      await terminal.waitForRender();
      expect(terminal.getViewport().join('\n')).toContain('inline-marker');

      capturedDone?.('picked');
      await expect(resultPromise).resolves.toBe('picked');

      await terminal.waitForRender();
      expect(terminal.getViewport().join('\n')).not.toContain('inline-marker');
    } finally {
      terminal.stop();
      tui.stop();
    }
  });

  it('opens as a real overlay when { overlay: true } is given, and hides on done', async () => {
    const terminal = new VirtualTerminal(80, 24);
    const tui = new TUI(terminal);
    tui.addChild({ render: () => ['base'], invalidate: () => {} });

    let capturedDone: ((result?: string) => void) | undefined;
    const resultPromise = showComponentPreview(
      tui,
      theme,
      keybindings,
      (_tui, _theme, _kb, done) => {
        capturedDone = done;
        return { render: () => ['overlay-marker'], invalidate: () => {} };
      },
      { overlay: true, overlayOptions: { anchor: 'center', width: 40 } },
    );
    tui.start();

    try {
      await terminal.waitForRender();
      expect(terminal.getViewport().join('\n')).toContain('overlay-marker');

      capturedDone?.(undefined);
      await expect(resultPromise).resolves.toBeUndefined();

      await terminal.waitForRender();
      expect(terminal.getViewport().join('\n')).not.toContain('overlay-marker');
    } finally {
      terminal.stop();
      tui.stop();
    }
  });

  it('enables mouse SGR mode only while a wheel-scroll preview is open', async () => {
    const terminal = new VirtualTerminal(80, 24);
    const tui = new TUI(terminal);

    let capturedDone: ((result?: string) => void) | undefined;
    const resultPromise = showComponentPreview(
      tui,
      theme,
      keybindings,
      (_tui, _theme, _kb, done) => {
        capturedDone = done;
        return { render: () => ['wheel-marker'], invalidate: () => {} };
      },
      { wheelScroll: true },
    );
    tui.start();

    try {
      await terminal.waitForRender();
      expect(terminal.writes.join('')).toContain('\x1b[?1000h\x1b[?1006h');

      capturedDone?.('picked');
      await expect(resultPromise).resolves.toBe('picked');

      expect(terminal.writes.join('')).toContain('\x1b[?1006l\x1b[?1000l');
    } finally {
      terminal.stop();
      tui.stop();
    }
  });

  it('does not write mouse DECSET sequences by default for inline or overlay previews', async () => {
    const inlineTerminal = new VirtualTerminal(80, 24);
    const inlineTui = new TUI(inlineTerminal);
    const overlayTerminal = new VirtualTerminal(80, 24);
    const overlayTui = new TUI(overlayTerminal);

    let closeInline: (() => void) | undefined;
    let closeOverlay: (() => void) | undefined;
    const inlinePromise = showComponentPreview(inlineTui, theme, keybindings, (_tui, _theme, _kb, done) => {
      closeInline = done;
      return { render: () => ['inline-marker'], invalidate: () => {} };
    });
    const overlayPromise = showComponentPreview(
      overlayTui,
      theme,
      keybindings,
      (_tui, _theme, _kb, done) => {
        closeOverlay = done;
        return { render: () => ['overlay-marker'], invalidate: () => {} };
      },
      { overlay: true },
    );
    inlineTui.start();
    overlayTui.start();

    try {
      await inlineTerminal.waitForRender();
      await overlayTerminal.waitForRender();
      closeInline?.();
      closeOverlay?.();
      await inlinePromise;
      await overlayPromise;

      expect(inlineTerminal.writes.join('')).not.toContain('\x1b[?1000h');
      expect(inlineTerminal.writes.join('')).not.toContain('\x1b[?1006h');
      expect(overlayTerminal.writes.join('')).not.toContain('\x1b[?1000h');
      expect(overlayTerminal.writes.join('')).not.toContain('\x1b[?1006h');
    } finally {
      inlineTerminal.stop();
      inlineTui.stop();
      overlayTerminal.stop();
      overlayTui.stop();
    }
  });

  it('routes wheel-scroll input as arrow-key input when opted in', async () => {
    const terminal = new VirtualTerminal(80, 24);
    const tui = new TUI(terminal);
    const received: string[] = [];

    void showComponentPreview(
      tui,
      theme,
      keybindings,
      () => ({
        render: () => ['input-marker'],
        handleInput: (data) => received.push(data),
        invalidate: () => {},
      }),
      { wheelScroll: true },
    );
    tui.start();

    try {
      await terminal.waitForRender();
      terminal.sendInput('\x1b[<65;10;5M');

      expect(received.some((data) => matchesKey(data, Key.down))).toBe(true);
    } finally {
      terminal.stop();
      tui.stop();
    }
  });
});
