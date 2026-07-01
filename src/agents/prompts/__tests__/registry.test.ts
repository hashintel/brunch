import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { LIVE_BRUNCH_SKILL_IDS, renderBrunchSkills } from '../../skills/registry.js';
import { BUNDLED_AGENT_BODY_IDS, bundledAgentBodyLocation } from '../registry.js';

describe('agent context registry', () => {
  it('owns the foreground body registry contract', () => {
    expect(BUNDLED_AGENT_BODY_IDS).toEqual(['elicitor', 'executor']);
  });

  it('keeps bundled foreground bodies literal, without raw template placeholders', () => {
    for (const bodyId of BUNDLED_AGENT_BODY_IDS) {
      const body = readFileSync(bundledAgentBodyLocation(bodyId), 'utf8');

      expect(body, bodyId).not.toMatch(/\$\{[^}]+\}/);
    }
  });

  it('exposes project as a first-level live Brunch skill with a portable absolute location', () => {
    const rendered = renderBrunchSkills();
    const projectLocationMatch =
      /<name>project<\/name>\s*<description>[^<]*<\/description>\s*<location>([^<]+)<\/location>/u.exec(
        rendered,
      );

    const projectLocation = projectLocationMatch?.[1];

    expect(LIVE_BRUNCH_SKILL_IDS).toContain('project');
    expect(rendered).toContain('<name>project</name>');
    expect(projectLocation).toMatch(/agents\/skills\/project\/SKILL\.md$/u);
    if (projectLocation) expect(existsSync(projectLocation)).toBe(true);
  });
});
