import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  LIVE_BRUNCH_SKILL_IDS,
  loadLiveBrunchSkillManifestEntries,
  renderBrunchSkills,
} from '../registry.js';

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));
const distSkillsDir = join(repoRoot, 'dist/agents/skills');

describe('live skill resource packaging', () => {
  it('has a source SKILL.md for every registered live skill', () => {
    for (const id of LIVE_BRUNCH_SKILL_IDS) {
      const sourcePath = join(repoRoot, 'src/agents/skills', id, 'SKILL.md');
      expect(existsSync(sourcePath), sourcePath).toBe(true);
    }
  });

  it.skipIf(!existsSync(distSkillsDir))(
    'has a packaged dist SKILL.md for every registered live skill after the build asset step',
    () => {
      for (const id of LIVE_BRUNCH_SKILL_IDS) {
        const distPath = join(distSkillsDir, id, 'SKILL.md');
        expect(existsSync(distPath), distPath).toBe(true);
      }
    },
  );
});

describe('live skill manifest rendering', () => {
  it('escapes XML-significant characters in names, descriptions, and locations', () => {
    const rendered = renderBrunchSkills([
      {
        name: 'a & b',
        description: 'use <read> when "matching" > threshold',
        location: 'src/agents/skills/a&b/SKILL.md',
      },
    ]);

    expect(rendered).toContain('<name>a &amp; b</name>');
    expect(rendered).toContain(
      '<description>use &lt;read&gt; when &quot;matching&quot; &gt; threshold</description>',
    );
    expect(rendered).toContain('<location>src/agents/skills/a&amp;b/SKILL.md</location>');
    expect(rendered).not.toContain('<read>');
  });

  it('reuses the same loaded manifest entries across repeated default calls', () => {
    expect(loadLiveBrunchSkillManifestEntries()).toBe(loadLiveBrunchSkillManifestEntries());
  });
});
