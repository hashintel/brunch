import { describe, expect, it } from 'vitest';

import { activeToolNamesForLiveElicitor } from '../active-tools.js';

describe('activeToolNamesForLiveElicitor', () => {
  it('filters registered tools through the fixed live elicitor allowlist', () => {
    expect(
      activeToolNamesForLiveElicitor({
        registeredToolNames: [
          'read',
          'grep',
          'bash',
          'edit',
          'read_graph',
          'mutate_graph',
          'present_question',
          'request_response',
          'brunch_session_query',
        ],
      }),
    ).toEqual(['read', 'grep', 'read_graph', 'mutate_graph', 'present_question', 'request_response']);
  });

  it('admits shell-provided opt-in tools without opening blocked tool names', () => {
    expect(
      activeToolNamesForLiveElicitor({
        registeredToolNames: ['read', 'bash', 'subagent', 'brunch_session_query'],
        devAllowedToolNames: ['subagent', 'brunch_session_query'],
      }),
    ).toEqual(['read', 'subagent', 'brunch_session_query']);
  });
});
