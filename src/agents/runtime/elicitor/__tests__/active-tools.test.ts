import { describe, expect, it } from 'vitest';

import { activeToolNamesForLiveElicitor } from '../active-tools.js';

describe('activeToolNamesForLiveElicitor', () => {
  it('filters registered tools through the fixed live elicitor allowlist', async () => {
    const activeToolNames = activeToolNamesForLiveElicitor({
      registeredToolNames: [
        'read',
        'grep',
        'bash',
        'edit',
        'read_graph',
        'mutate_graph',
        'ask',
        'present_digest',

        'subagent',
      ],
    });

    expect(activeToolNames).toEqual([
      'read',
      'grep',
      'read_graph',
      'mutate_graph',
      'ask',
      'present_digest',

      'subagent',
    ]);
  });
});
