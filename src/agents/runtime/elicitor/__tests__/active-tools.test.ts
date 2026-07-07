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
        'present_question',
        'present_digest',
        'request_response',
        'subagent',
        'brunch_session_query',
      ],
    });

    expect(activeToolNames).toEqual([
      'read',
      'grep',
      'read_graph',
      'mutate_graph',
      'present_question',
      'present_digest',
      'request_response',
      'subagent',
    ]);
  });

  it('admits dev query opt-in tools without opening blocked tool names', () => {
    expect(
      activeToolNamesForLiveElicitor({
        registeredToolNames: ['read', 'bash', 'subagent', 'brunch_session_query'],
        devAllowedToolNames: ['brunch_session_query'],
      }),
    ).toEqual(['read', 'subagent', 'brunch_session_query']);
  });

  it('does not let dev opt-ins advertise blocked tool names', () => {
    expect(
      activeToolNamesForLiveElicitor({
        registeredToolNames: ['read', 'bash', 'edit', 'write', 'brunch_session_query'],
        devAllowedToolNames: ['bash', 'edit', 'write', 'brunch_session_query'],
      }),
    ).toEqual(['read', 'brunch_session_query']);
  });
});
