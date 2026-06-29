import { describe, expect, it } from 'vitest';

import { BUNDLED_AGENT_BODY_IDS, bundledAgentBodyRepoPath } from '../registry.js';

describe('agent context registry', () => {
  it('owns the foreground body registry contract', () => {
    expect(BUNDLED_AGENT_BODY_IDS).toEqual(['elicitor', 'executor']);
    expect(bundledAgentBodyRepoPath('elicitor')).toBe('src/agents/prompts/elicitor.md');
  });
});
