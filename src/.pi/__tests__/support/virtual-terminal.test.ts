import {
  getOsc8LinkAtColumn,
  stripTerminalSequences,
  truncateToWidth,
  visibleWidth,
} from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { VirtualTerminal } from './virtual-terminal.js';

describe('pi-tui width utilities', () => {
  it('measures Indic grapheme clusters using terminal cell width', () => {
    expect(visibleWidth('क्ष')).toBe(2);
    expect(visibleWidth('क्षेत्र')).toBe(4);
  });

  it('closes an OSC 8 hyperlink before appending a truncation ellipsis', () => {
    const linked = '\x1b]8;;https://example.com\x07linked text\x1b]8;;\x07 tail';

    const truncated = truncateToWidth(linked, 8);

    expect(visibleWidth(truncated)).toBe(8);
    expect(stripTerminalSequences(truncated)).toBe('linke...');
    expect(getOsc8LinkAtColumn(truncated, 0)).toBe('https://example.com');
    expect(getOsc8LinkAtColumn(truncated, 5)).toBeUndefined();
  });
});

describe('VirtualTerminal waitForRender', () => {
  it('waits for a write scheduled after the render wait starts', async () => {
    const terminal = new VirtualTerminal(40, 8);

    try {
      const waitPromise = terminal.waitForRender(250);
      setTimeout(() => terminal.write('scheduled-late'), 45);

      await waitPromise;

      expect(terminal.getViewport().join('\n')).toContain('scheduled-late');
    } finally {
      terminal.stop();
    }
  });

  it('fails loud when writes keep the terminal from reaching an idle window before timeout', async () => {
    const terminal = new VirtualTerminal(40, 8);
    const interval = setInterval(() => terminal.write('tick'), 5);

    try {
      await expect(terminal.waitForRender(50)).rejects.toThrow('waitForRender timed out after 50ms');
    } finally {
      clearInterval(interval);
      terminal.stop();
    }
  });
});
