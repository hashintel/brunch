import { describe, expect, it } from 'vitest';

import { runBrunchFauxTurn } from './index.js';

describe('runBrunchFauxTurn', () => {
  it('runs a scripted prompt to assistant turn with no network credentials', async () => {
    const result = await runBrunchFauxTurn({
      prompt: 'Use the faux provider for one deterministic turn.',
      responseText: 'The faux launcher completed without network I/O.',
    });

    expect(result).toEqual({
      prompt: 'Use the faux provider for one deterministic turn.',
      assistantText: 'The faux launcher completed without network I/O.',
      providerCallCount: 1,
    });
  });
});
