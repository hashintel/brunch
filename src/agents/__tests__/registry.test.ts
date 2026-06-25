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
  it('centralizes current bundled prompt and skill paths while the files still live under .pi', () => {
    expect(BUNDLED_AGENT_BODY_IDS).toEqual([
      'elicitor',
      'orchestrator',
      'explorer',
      'researcher',
      'projector',
      'reviewer',
      'pi-coder',
    ]);
    expect(bundledAgentBodyRepoPath('elicitor')).toBe('src/.pi/agents/elicitor/SYSTEM.md');
    expect(bundledAgentBodyLocation('reviewer')).toMatch(/src\/\.pi\/agents\/reviewer\/SYSTEM\.md$/);
    expect(bundledAgentBodyHome()).toMatch(/src\/\.pi\/agents$/);
    expect(promptResourceLocation('methods', 'generate-proposal')).toMatch(
      /src\/\.pi\/skills\/methods\/generate-proposal\/SKILL\.md$/,
    );
    expect(promptResourceAgentDir()).toMatch(/src\/\.pi$/);
  });
});
