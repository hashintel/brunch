import { TUI } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { AGENT_STRATEGY_IDS, type AgentStrategySelection } from '../../../session/schema/kinds.js';
import { createTestLabTheme } from '../../__tests__/support/tui-theme.js';
import { VirtualTerminal } from '../../__tests__/support/virtual-terminal.js';
import { createRuntimeStrategyPickerComponent } from '../runtime-posture/axis-picker.js';

const theme = createTestLabTheme();

function trackLine(viewport: string[]): string {
  const helpIndex = viewport.findIndex((line) => line.includes('←/→ or h/l/j/k cycle'));
  if (helpIndex <= 0) throw new Error('track line not found');
  return viewport[helpIndex - 1]!;
}

/**
 * Drive the runtime strategy picker through a real pi-tui TUI backed by the
 * shared VirtualTerminal harness. This complements the fast direct-render test
 * in runtime-axis-picker.test.ts by exercising focus + input routing + overlay
 * render through the actual TUI input path.
 */
describe('runtime posture picker harness', () => {
  it('cycles highlight with arrow and hjkl keys through real TUI input routing', async () => {
    const terminal = new VirtualTerminal(120, 32);
    const tui = new TUI(terminal);
    const selected: Array<AgentStrategySelection | undefined> = [];

    const picker = createRuntimeStrategyPickerComponent({
      current: 'auto',
      theme,
      onDone: (value) => selected.push(value),
    });

    const overlay = tui.showOverlay(picker, {
      anchor: 'center',
      width: 80,
      maxHeight: '50%',
      margin: 1,
    });
    overlay.focus();
    terminal.clearScreen();
    tui.start();

    try {
      await terminal.waitForRender();

      let viewport = terminal.getViewport().join('\n');
      expect(viewport).toContain('Choose Brunch strategy');
      expect(viewport).toContain('current:');
      expect(viewport).toContain('auto');
      expect(viewport).toContain('←/→ or h/l/j/k cycle · enter commits · esc/q cancels');
      // Active segment badge is visible as the label padded with an extra space
      // on each side (xterm normalizes ANSI away, leaving the spacing).
      expect(trackLine(terminal.getViewport())).toContain(' auto  ');

      terminal.sendInput('\x1b[C');
      await terminal.waitForRender();
      expect(trackLine(terminal.getViewport())).toContain(` ${AGENT_STRATEGY_IDS[0]}  `);
      expect(trackLine(terminal.getViewport())).not.toContain(' auto  ');

      terminal.sendInput('h');
      await terminal.waitForRender();
      expect(trackLine(terminal.getViewport())).toContain(' auto  ');

      terminal.sendInput('j');
      await terminal.waitForRender();
      expect(trackLine(terminal.getViewport())).toContain(` ${AGENT_STRATEGY_IDS[0]}  `);

      terminal.sendInput('k');
      await terminal.waitForRender();
      expect(trackLine(terminal.getViewport())).toContain(' auto  ');
    } finally {
      terminal.stop();
      tui.stop();
    }
  });

  it('commits the selected value on Enter routed through real TUI input routing', async () => {
    const terminal = new VirtualTerminal(120, 32);
    const tui = new TUI(terminal);
    const selected: Array<AgentStrategySelection | undefined> = [];

    const picker = createRuntimeStrategyPickerComponent({
      current: 'auto',
      theme,
      onDone: (value) => selected.push(value),
    });

    const overlay = tui.showOverlay(picker, {
      anchor: 'center',
      width: 80,
      maxHeight: '50%',
      margin: 1,
    });
    overlay.focus();
    terminal.clearScreen();
    tui.start();

    try {
      await terminal.waitForRender();

      terminal.sendInput('\x1b[C');
      await terminal.waitForRender();
      expect(trackLine(terminal.getViewport())).toContain(` ${AGENT_STRATEGY_IDS[0]}  `);

      terminal.sendInput('\r');
      expect(selected).toEqual([AGENT_STRATEGY_IDS[0]]);
    } finally {
      terminal.stop();
      tui.stop();
    }
  });

  it('cancels without a value on Esc routed through real TUI input routing', async () => {
    const terminal = new VirtualTerminal(120, 32);
    const tui = new TUI(terminal);
    const selected: Array<AgentStrategySelection | undefined> = [];

    const picker = createRuntimeStrategyPickerComponent({
      current: 'auto',
      theme,
      onDone: (value) => selected.push(value),
    });

    const overlay = tui.showOverlay(picker, {
      anchor: 'center',
      width: 80,
      maxHeight: '50%',
      margin: 1,
    });
    overlay.focus();
    terminal.clearScreen();
    tui.start();

    try {
      await terminal.waitForRender();

      terminal.sendInput('\x1b');
      expect(selected).toEqual([undefined]);
    } finally {
      terminal.stop();
      tui.stop();
    }
  });
});
