import { access } from 'node:fs/promises';
import { relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BUNDLED_AGENT_BODY_IDS,
  bundledAgentBodyRepoPath,
  bundledAgentBodyLocation,
  bundledAgentBodyHome,
} from '../registry.js';

describe('agent context registry', () => {
  it('owns the foreground body registry contract', async () => {
    expect(BUNDLED_AGENT_BODY_IDS).toEqual(['elicitor', 'executor']);
    expect(bundledAgentBodyRepoPath('elicitor')).toBe('src/agents/prompts/elicitor.md');

    for (const id of BUNDLED_AGENT_BODY_IDS) {
      await expect(access(bundledAgentBodyLocation(id))).resolves.toBeUndefined();
      expect(relative(bundledAgentBodyHome(), bundledAgentBodyLocation(id))).toBe(`${id}.md`);
    }
  });

});
