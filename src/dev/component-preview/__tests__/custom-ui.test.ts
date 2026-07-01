import type { KeybindingsManager } from '@earendil-works/pi-coding-agent';
import { TUI } from '@earendil-works/pi-tui';
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
});
