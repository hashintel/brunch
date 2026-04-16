import { describe, expect, it } from 'vitest';

import { getProjectScopedChatId } from './-interview-hydration.js';

describe('project-scoped chat id', () => {
  it('changes when project identity changes', () => {
    expect(getProjectScopedChatId(1)).not.toBe(getProjectScopedChatId(2));
  });

  it('stays stable for the same project identity', () => {
    expect(getProjectScopedChatId(1)).toBe(getProjectScopedChatId(1));
  });
});
