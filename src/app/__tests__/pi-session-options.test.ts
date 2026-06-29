import { describe, expect, it } from 'vitest';

import { FOREGROUND_AGENT_ROSTER } from '../../agents/runtime/policy.js';
import { projectBrunchPiSessionOptions } from '../pi-session-options.js';

describe('Brunch Pi session options', () => {
  it('projects the Brunch runtime hardening policy into Pi SDK session options', () => {
    const sessionStartEvent = {
      type: 'session_start' as const,
      reason: 'new' as const,
      previousSessionFile: '/sessions/old.jsonl',
    };

    expect(
      projectBrunchPiSessionOptions({
        sessionStartEvent,
        thinkingLevel: FOREGROUND_AGENT_ROSTER.elicit.foregroundAgent.thinking,
      }),
    ).toEqual({
      sessionStartEvent,
      noTools: 'builtin',
      excludeTools: ['bash', 'edit', 'write'],
      thinkingLevel: FOREGROUND_AGENT_ROSTER.elicit.foregroundAgent.thinking,
    });
  });

  it('keeps the default model sentinel non-owning unless a concrete override is supplied', () => {
    expect(
      projectBrunchPiSessionOptions({
        thinkingLevel: FOREGROUND_AGENT_ROSTER.elicit.foregroundAgent.thinking,
      }),
    ).not.toHaveProperty('model');

    const model = { provider: 'test-provider', id: 'test-model' } as never;

    expect(
      projectBrunchPiSessionOptions({
        thinkingLevel: FOREGROUND_AGENT_ROSTER.elicit.foregroundAgent.thinking,
        model,
      }),
    ).toMatchObject({ model });
  });
});
