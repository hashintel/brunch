import { TUI } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { VirtualTerminal } from '../../../.pi/__tests__/support/virtual-terminal.js';
import { registerBrunchAlternatives } from '../../../.pi/components/alternatives.js';
import { captureMessageRenderer, previewStaticComponent, sampleCustomMessage } from '../static-preview.js';
import { createComponentPreviewTheme } from '../theme.js';

const theme = createComponentPreviewTheme();

describe('previewStaticComponent', () => {
  it('mounts the component and resolves + unmounts on the next keypress', async () => {
    const terminal = new VirtualTerminal(80, 24);
    const tui = new TUI(terminal);
    tui.start();

    const resultPromise = previewStaticComponent(tui, {
      render: () => ['static-marker'],
      invalidate: () => {},
    });

    try {
      await terminal.waitForRender();
      expect(terminal.getViewport().join('\n')).toContain('static-marker');

      terminal.sendInput('\r');
      await resultPromise;

      await terminal.waitForRender();
      expect(terminal.getViewport().join('\n')).not.toContain('static-marker');
    } finally {
      terminal.stop();
      tui.stop();
    }
  });
});

describe('captureMessageRenderer', () => {
  it('throws when the registration function never registers the requested customType', () => {
    expect(() => captureMessageRenderer('missing-type', () => {})).toThrow(/missing-type/);
  });

  it("captures registerBrunchAlternatives's real renderer and renders a sample message", async () => {
    const renderer = captureMessageRenderer('alternatives-card-set', (pi) =>
      registerBrunchAlternatives(pi, (schema) => schema),
    );

    const message = sampleCustomMessage('alternatives-card-set', {
      headline: 'Pick a direction',
      alternatives: [
        { title: 'Option A', body: 'Ship the narrow slice first.' },
        { title: 'Option B', body: 'Widen scope now.', flavor: 'warning' as const },
      ],
    });

    const component = renderer(message, { expanded: false, outputPad: 1 }, theme);
    expect(component).toBeDefined();

    const terminal = new VirtualTerminal(100, 30);
    const tui = new TUI(terminal);
    tui.start();

    try {
      const resultPromise = previewStaticComponent(tui, component!);
      await terminal.waitForRender();

      const viewport = terminal.getViewport().join('\n');
      expect(viewport).toContain('Pick a direction');
      expect(viewport).toContain('Option A');
      expect(viewport).toContain('Option B');

      terminal.sendInput('q');
      await resultPromise;
    } finally {
      terminal.stop();
      tui.stop();
    }
  });
});
