import { describe, expect, it } from 'vitest';

import { getSpecificationScopedChatId } from '../-interview-hydration.js';

describe('project-scoped chat id', () => {
  it('changes when project identity changes', () => {
    expect(getSpecificationScopedChatId(1)).not.toBe(getSpecificationScopedChatId(2));
  });

  it('stays stable for the same project identity', () => {
    expect(getSpecificationScopedChatId(1)).toBe(getSpecificationScopedChatId(1));
  });
});
