import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { LIVE_BRUNCH_SKILL_IDS, renderBrunchSkills } from '../../skills/registry.js';
import { BUNDLED_AGENT_BODY_IDS, bundledAgentBodyLocation, bundledAgentBodyRepoPath } from '../registry.js';

describe('agent context registry', () => {
  it('owns the foreground body registry contract', () => {
    expect(BUNDLED_AGENT_BODY_IDS).toEqual(['elicitor', 'executor']);
    expect(bundledAgentBodyRepoPath('elicitor')).toBe('src/agents/prompts/elicitor.md');
  });

  it('keeps bundled foreground bodies literal, without raw template placeholders', () => {
    for (const bodyId of BUNDLED_AGENT_BODY_IDS) {
      const body = readFileSync(bundledAgentBodyLocation(bodyId), 'utf8');

      expect(body, bodyId).not.toMatch(/\$\{[^}]+\}/);
    }
  });

  it('exposes project as a first-level live Brunch skill', () => {
    expect(LIVE_BRUNCH_SKILL_IDS).toContain('project');
    expect(renderBrunchSkills()).toContain('<name>project</name>');
  });
});
