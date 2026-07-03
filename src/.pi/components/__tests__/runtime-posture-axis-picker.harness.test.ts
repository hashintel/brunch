import { TUI } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { operationalModeLabel, type OperationalModeId } from '../../../session/schema/kinds.js';
import { createTestLabTheme } from '../../__tests__/support/tui-theme.js';
import { VirtualTerminal } from '../../__tests__/support/virtual-terminal.js';
import { createRuntimeModePickerComponent } from '../runtime-posture/axis-picker.js';

const theme = createTestLabTheme();

function trackLine(viewport: string[]): string {
  const helpIndex = viewport.findIndex((line) => line.includes('←/→ or h/l/j/k cycle'));
  if (helpIndex <= 0) throw new Error('track line not found');
  return viewport[helpIndex - 1]!;
}

/**
 * The active segment's badge always contributes its own leading space
 * (`makeSolidBadge`'s ` label ` wrapper). Whichever side of the badge abuts
 * the track's lateral padding or the ` | ` separator stacks a second space on
 * top of it — the leading side does this for every segment position (first:
 * padding + badge; last: separator + badge), so a doubled leading space
 * reliably marks "this segment is active" regardless of where it sits in the
 * track. The trailing side does not: the last segment gets no filler after
 * it in the real inline-swap presentation this component ships with, so a
 * doubled *trailing* space is a false invariant (it only held under the
 * fixed-width overlay box this harness used to wrap the picker in).
 */
function isActiveInTrack(line: string, label: string): boolean {
  return line.includes(`  ${label}`);
}

/**
 * Drive the runtime mode picker through a real pi-tui TUI backed by the
 * shared VirtualTerminal harness. This complements the fast direct-render test
 * in runtime-axis-picker.test.ts by exercising focus + input routing through
 * the actual TUI input path.
 *
 * Presented via `tui.addChild` + `tui.setFocus` (inline swap), matching the
 * real call site (`commands/index.ts`'s `openModePicker` calls `ctx.ui.custom`
 * with no overlay options) — not `tui.showOverlay`, which this component
 * never actually ships as.
 */
describe('runtime posture picker harness', () => {
  it('cycles highlight with arrow and hjkl keys through real TUI input routing', async () => {
    const terminal = new VirtualTerminal(120, 32);
    const tui = new TUI(terminal);
    const selected: Array<OperationalModeId | undefined> = [];

    const picker = createRuntimeModePickerComponent({
      current: 'elicit',
      theme,
      onDone: (value: OperationalModeId | undefined) => selected.push(value),
    });

    tui.addChild(picker);
    tui.setFocus(picker);
    terminal.clearScreen();
    tui.start();

    try {
      await terminal.waitForRender();

      let viewport = terminal.getViewport().join('\n');
      expect(viewport).toContain('Choose Brunch mode');
      expect(viewport).toContain('current:');
      expect(viewport).toContain(operationalModeLabel('elicit'));
      expect(viewport).toContain('←/→ or h/l/j/k cycle · enter commits · esc/q cancels');
      expect(isActiveInTrack(trackLine(terminal.getViewport()), operationalModeLabel('elicit'))).toBe(true);

      terminal.sendInput('\x1b[C');
      await terminal.waitForRender();
      expect(isActiveInTrack(trackLine(terminal.getViewport()), operationalModeLabel('execute'))).toBe(true);
      expect(isActiveInTrack(trackLine(terminal.getViewport()), operationalModeLabel('elicit'))).toBe(false);

      terminal.sendInput('h');
      await terminal.waitForRender();
      expect(isActiveInTrack(trackLine(terminal.getViewport()), operationalModeLabel('elicit'))).toBe(true);

      terminal.sendInput('j');
      await terminal.waitForRender();
      expect(isActiveInTrack(trackLine(terminal.getViewport()), operationalModeLabel('execute'))).toBe(true);

      terminal.sendInput('k');
      await terminal.waitForRender();
      expect(isActiveInTrack(trackLine(terminal.getViewport()), operationalModeLabel('elicit'))).toBe(true);
    } finally {
      terminal.stop();
      tui.stop();
    }
  });

  it('commits the selected mode on Enter routed through real TUI input routing', async () => {
    const terminal = new VirtualTerminal(120, 32);
    const tui = new TUI(terminal);
    const selected: Array<OperationalModeId | undefined> = [];

    const picker = createRuntimeModePickerComponent({
      current: 'elicit',
      theme,
      onDone: (value: OperationalModeId | undefined) => selected.push(value),
    });

    tui.addChild(picker);
    tui.setFocus(picker);
    terminal.clearScreen();
    tui.start();

    try {
      await terminal.waitForRender();

      terminal.sendInput('\x1b[C');
      await terminal.waitForRender();
      expect(isActiveInTrack(trackLine(terminal.getViewport()), operationalModeLabel('execute'))).toBe(true);

      terminal.sendInput('\r');
      expect(selected).toEqual(['execute']);
    } finally {
      terminal.stop();
      tui.stop();
    }
  });

  it('cancels without a value on Esc routed through real TUI input routing', async () => {
    const terminal = new VirtualTerminal(120, 32);
    const tui = new TUI(terminal);
    const selected: Array<OperationalModeId | undefined> = [];

    const picker = createRuntimeModePickerComponent({
      current: 'elicit',
      theme,
      onDone: (value: OperationalModeId | undefined) => selected.push(value),
    });

    tui.addChild(picker);
    tui.setFocus(picker);
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
