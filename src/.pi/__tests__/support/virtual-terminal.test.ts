import { describe, expect, it } from 'vitest';

import { VirtualTerminal } from './virtual-terminal.js';

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
