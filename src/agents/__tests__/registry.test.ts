import { describe, expect, it } from 'vitest';

import {
  BUNDLED_AGENT_BODY_IDS,
  bundledAgentBodyRepoPath,
  bundledAgentBodyLocation,
  bundledAgentBodyHome,
  promptResourceAgentDir,
  promptResourceLocation,
} from '../registry.js';

describe('agent context registry', () => {
  it('centralizes bundled prompt and current skill paths', () => {
    expect(BUNDLED_AGENT_BODY_IDS).toEqual(['elicitor', 'executor']);
    expect(bundledAgentBodyRepoPath('elicitor')).toBe('src/agents/prompts/elicitor.md');
    expect(bundledAgentBodyLocation('executor')).toMatch(/src\/agents\/prompts\/executor\.md$/);
    expect(bundledAgentBodyHome()).toMatch(/src\/agents\/prompts$/);
    expect(promptResourceLocation('methods', 'generate-proposal')).toMatch(
      /src\/agents\/skills\/methods\/generate-proposal\/SKILL\.md$/,
    );
    expect(promptResourceAgentDir()).toMatch(/src\/agents\/?$/);
  });
});
