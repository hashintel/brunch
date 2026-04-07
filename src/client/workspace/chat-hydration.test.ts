import { describe, expect, it } from 'vitest';

import { getChatHydrationReason } from './chat-hydration.js';

describe('chat hydration policy', () => {
  it('hydrates persisted turns on initial project entry', () => {
    expect(getChatHydrationReason(undefined, 1)).toBe('initial-project-entry');
  });

  it('hydrates persisted turns on explicit project navigation', () => {
    expect(getChatHydrationReason(1, 2)).toBe('project-navigation');
  });

  it('does not rehydrate persisted turns on same-project refresh', () => {
    expect(getChatHydrationReason(1, 1)).toBe('same-project-refresh');
  });
});
