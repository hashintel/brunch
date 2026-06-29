import { describe, expect, it } from 'vitest';

import { projectBrunchPiSessionOptions } from '../pi-session-options.js';

describe('Brunch Pi session options', () => {
  it('projects the Brunch runtime hardening policy into Pi SDK session options', () => {
    const thinkingLevel = 'medium';
    const sessionStartEvent = {
      type: 'session_start' as const,
      reason: 'new' as const,
      previousSessionFile: '/sessions/old.jsonl',
    };

    expect(
      projectBrunchPiSessionOptions({
        sessionStartEvent,
        thinkingLevel,
      }),
    ).toEqual({
      sessionStartEvent,
      noTools: 'builtin',
      excludeTools: ['bash', 'edit', 'write'],
      thinkingLevel,
    });
  });

  it('keeps the default model sentinel non-owning unless a concrete override is supplied', () => {
    const thinkingLevel = 'medium';
    expect(
      projectBrunchPiSessionOptions({
        thinkingLevel,
      }),
    ).not.toHaveProperty('model');

    const model = { provider: 'test-provider', id: 'test-model' } as never;

    expect(
      projectBrunchPiSessionOptions({
        thinkingLevel,
        model,
      }),
    ).toMatchObject({ model });
  });
});
